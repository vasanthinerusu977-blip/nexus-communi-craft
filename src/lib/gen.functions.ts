import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGateway, parseJsonLoose } from "./ai.server";
import type { Artifacts, OutputId } from "./artifacts";
import { SCHEMA_HINTS, SYSTEM_PROMPT, enforceTwitterLimits } from "./gen-prompt";

const GenerateInput = z.object({
  sourceText: z.string().min(1),
  fileNotes: z.string().default(""),
  outputs: z.array(z.string()).min(1),
  params: z.object({
    audience: z.string(),
    tone: z.string(),
    language: z.string(),
    detail: z.string(),
    objective: z.string(),
  }),
  changeRequest: z.string().optional(),
  previous: z.string().optional(),
});

export const generateArtifacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data }) => {
    const ids = data.outputs as OutputId[];
    const schema = ids.map((id) => SCHEMA_HINTS[id]).filter(Boolean).join(",\n");

    const userPrompt = [
      `SOURCE MATERIAL (the only permitted factual basis — never invent facts, names, figures, dates or organisational details that are not present here):`,
      "-----",
      data.sourceText.slice(0, 40000),
      "-----",
      data.fileNotes ? `ATTACHED FILE REFERENCES:\n${data.fileNotes}` : "",
      "",
      `PARAMETERS: audience=${data.params.audience}; tone=${data.params.tone}; language=${data.params.language}; detail=${data.params.detail}; objective=${data.params.objective}.`,
      `Write all output in ${data.params.language}.`,
      data.changeRequest
        ? `\nREVISION REQUEST — the user reviewed the previous draft and asked for exactly this change. Apply it faithfully while keeping everything else consistent:\n"${data.changeRequest}"\n\nPREVIOUS DRAFT (JSON):\n${(data.previous ?? "").slice(0, 30000)}`
        : "",
      "",
      `Return ONLY a JSON object with exactly these keys: ${ids.join(", ")}.`,
      `Shape:\n{\n${schema}\n}`,
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await callGateway(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { json: true },
    );

    const parsed = parseJsonLoose<Artifacts>(raw);
    if (parsed.twitter?.posts) parsed.twitter.posts = enforceTwitterLimits(parsed.twitter.posts);
    if (parsed.video?.shots) {
      let t = 0;
      parsed.video.shots = parsed.video.shots.map((s) => {
        const start = Number.isFinite(s.start) ? Number(s.start) : t;
        const end = Number.isFinite(s.end) && Number(s.end) > start ? Number(s.end) : start + 6;
        t = end;
        return { ...s, start, end };
      });
    }
    return parsed;
  });

const AnalyzeInput = z.object({
  sourceText: z.string().min(1),
  fileNotes: z.string().default(""),
});

export const analyzeSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AnalyzeInput.parse(d))
  .handler(async ({ data }) => {
    const raw = await callGateway(
      [
        {
          role: "system",
          content:
            "You are a source-analysis engine for a government communications drafting workspace. Analyse ONLY the supplied material. Never invent facts. Be candid about what the material does and does not support.",
        },
        {
          role: "user",
          content: `Analyse this source material and return JSON:
{"summary":"2-3 sentence neutral summary","documentType":"short label","keyEntities":["..."],"keyThemes":["..."],"gaps":["what the material does NOT establish"],"suitability":"one sentence on what communication products it can responsibly support","cautions":["review or verification cautions"]}

FILE REFERENCES: ${data.fileNotes || "none"}

MATERIAL:
${data.sourceText.slice(0, 30000)}`,
        },
      ],
      { json: true },
    );
    return parseJsonLoose<{
      summary: string;
      documentType: string;
      keyEntities: string[];
      keyThemes: string[];
      gaps: string[];
      suitability: string;
      cautions: string[];
    }>(raw);
  });

const ChatInput = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).min(1),
  knowledge: z.string().default(""),
});

export const assistantChat = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ChatInput.parse(d))
  .handler(async ({ data }) => {
    const system = `You are the GenNexus assistant. GenNexus is a source-aware communications workspace: users upload or paste source material, pick audience/tone/language/detail/objective, and generate structured drafts (LinkedIn post, X/Twitter thread with 280-character-safe posts, formal advisory with non-sensitive classification placeholders, infographic brief plus a rendered downloadable SVG visual, executive summary, presentation outline with speaker notes, report/article, and a video production package). The video package is a downloadable brief with storyboard, timed shot list, narration, on-screen copy, visual direction and valid SRT subtitles — GenNexus does NOT render MP4 files and cannot analyse existing videos; that requires a connected video model or production service. Every output is an unreviewed draft requiring authorized review before release. After generation users run a satisfaction loop: confirm satisfaction, or state exactly what to change and regenerate; every revision is stored and can be compared or restored.

STRICT RULES:
- Never invent founders, founding dates, leadership, ownership, funding, partnerships or agency affiliations.
- GenNexus is an independent drafting tool and is NOT affiliated with, endorsed by, or operated by NTRO or any government agency. Say so if asked.
- If asked an organisational fact that is not in the configured knowledge below, reply that the information has not been configured, and tell the user an administrator can add it in the admin Knowledge Base.
- Be concise and practical.

CONFIGURED KNOWLEDGE BASE:
${data.knowledge || "(empty — no organisational facts have been configured)"}`;

    return {
      reply: await callGateway([
        { role: "system", content: system },
        ...data.messages.map((m) => ({ role: m.role, content: m.content })),
      ]),
    };
  });
