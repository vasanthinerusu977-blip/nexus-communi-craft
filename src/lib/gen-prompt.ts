import type { OutputId } from "./artifacts";

export const SYSTEM_PROMPT = `You are GenNexus, a drafting engine for official-style government and public-institution communications.

ABSOLUTE RULES
- Ground every statement strictly in the supplied source material. Never invent facts, names, figures, dates, quotations, incidents, organisations, founders or affiliations.
- If the source does not support a needed detail, write a clearly bracketed placeholder such as [DATE TBC] or [AUTHORISING OFFICER] instead of inventing one.
- Do not claim affiliation with NTRO or any real agency. Use neutral placeholders like [ISSUING OFFICE] where an issuer is required.
- Use only non-sensitive classification and distribution placeholders (e.g. UNCLASSIFIED // FOR OFFICIAL USE ONLY (PLACEHOLDER)).
- Every deliverable is an unreviewed draft for authorized review.
- Output valid JSON only. No markdown fences, no commentary.`;

export const SCHEMA_HINTS: Record<OutputId, string> = {
  linkedin: `  "linkedin": { "text": "government-style LinkedIn post, 120-220 words, measured institutional voice, clear line breaks", "hashtags": ["4-6 professional hashtags"] }`,
  twitter: `  "twitter": { "posts": ["5-8 sequential posts. Each MUST be under 265 characters. Post 1 states the subject in official-comms register; the final post carries the call to action or reference. Keep numbering out of the text — it is added automatically."] }`,
  advisory: `  "advisory": { "classification": "UNCLASSIFIED // FOR OFFICIAL USE ONLY (PLACEHOLDER)", "distribution": "distribution placeholder", "reference": "ADV/[YYYY]/[NNN] placeholder", "subject": "subject line", "sections": [{ "heading": "e.g. PURPOSE / BACKGROUND / ASSESSMENT / RECOMMENDED ACTION / POINT OF CONTACT", "body": "text" }] }`,
  infographic: `  "infographic": { "title": "short punchy title", "subtitle": "one line", "stats": [{ "value": "figure taken from the source", "label": "what it means" }], "points": ["4-5 short key points, max 90 chars each"], "footer": "source attribution line" }`,
  execsummary: `  "execsummary": { "title": "title", "bullets": ["4-6 decision-relevant bullets"], "body": "150-250 word summary" }`,
  presentation: `  "presentation": { "slides": [{ "title": "slide title", "bullets": ["3-5 bullets"], "notes": "speaker notes, 40-80 words" }] }`,
  report: `  "report": { "title": "title", "sections": [{ "heading": "heading", "body": "several full paragraphs" }] }`,
  video: `  "video": { "logline": "one sentence", "runtimeSeconds": 60, "shots": [{ "scene": "scene name", "start": 0, "end": 6, "visual": "shot composition and visual direction", "narration": "spoken narration for this shot", "onscreen": "on-screen text/lower third" }], "visualDirection": "palette, typography, motion and accessibility direction", "productionNotes": "asset, voiceover, compliance and review notes" }`,
};

export function enforceTwitterLimits(posts: string[]): string[] {
  const out: string[] = [];
  for (const raw of posts) {
    let p = String(raw).replace(/^\s*\d+\s*[/.)]\s*\d*\s*/, "").trim();
    while (p.length > 265) {
      const cut = p.lastIndexOf(" ", 262);
      const head = p.slice(0, cut > 120 ? cut : 262).trim();
      out.push(head);
      p = p.slice(head.length).trim();
    }
    if (p) out.push(p);
  }
  const total = out.length;
  return out.map((p, i) => {
    const tag = ` (${i + 1}/${total})`;
    const body = p.length + tag.length > 280 ? p.slice(0, 280 - tag.length - 1).trim() : p;
    return body + tag;
  });
}
