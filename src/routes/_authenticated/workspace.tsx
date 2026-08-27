import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, FileText, Loader2, Package, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ArtifactView } from "@/components/ArtifactView";
import { supabase } from "@/integrations/supabase/client";
import {
  OUTPUT_TYPES,
  type Artifacts,
  type GenParams,
  type OutputId,
  type SourceAnalysis,
} from "@/lib/artifacts";
import { exportBundle } from "@/lib/export";
import { analyzeSource, generateArtifacts } from "@/lib/gen.functions";
import { analyseSource, readFiles } from "@/lib/source";

type AiAnalysis = {
  summary: string;
  documentType: string;
  keyEntities: string[];
  keyThemes: string[];
  gaps: string[];
  suitability: string;
  cautions: string[];
};

export const Route = createFileRoute("/_authenticated/workspace")({
  validateSearch: (s: Record<string, unknown>) => ({
    brief: typeof s["brief"] === "string" ? (s["brief"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Drafting Workspace — GenNexus" },
      {
        name: "description",
        content:
          "Upload or paste source material and generate source-grounded communication drafts with revision history.",
      },
      { property: "og:title", content: "Drafting Workspace — GenNexus" },
      {
        property: "og:description",
        content: "Source-grounded official communication drafts with a full revision trail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Workspace,
});

const PARAM_FIELDS: { key: keyof GenParams; label: string; options: string[] }[] = [
  {
    key: "audience",
    label: "Audience",
    options: [
      "General public",
      "Media / press",
      "Internal officials",
      "Inter-departmental",
      "Industry partners",
      "Academic / research",
    ],
  },
  {
    key: "tone",
    label: "Tone",
    options: ["Formal official", "Authoritative", "Neutral informational", "Reassuring", "Urgent advisory"],
  },
  {
    key: "language",
    label: "Language",
    options: ["English", "Hindi", "Bilingual (English + Hindi)", "French", "Spanish", "Arabic"],
  },
  { key: "detail", label: "Detail level", options: ["Concise", "Standard", "Comprehensive"] },
  {
    key: "objective",
    label: "Objective",
    options: [
      "Inform",
      "Advise / warn",
      "Announce",
      "Explain policy",
      "Build awareness",
      "Request action",
    ],
  },
];

function Workspace() {
  const { brief: briefParam } = Route.useSearch();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("Untitled brief");
  const [pasted, setPasted] = useState("");
  const [fileText, setFileText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [analysis, setAnalysis] = useState<SourceAnalysis | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [outputs, setOutputs] = useState<OutputId[]>(["linkedin", "execsummary"]);
  const [params, setParams] = useState<GenParams>({
    audience: "General public",
    tone: "Formal official",
    language: "English",
    detail: "Standard",
    objective: "Inform",
  });
  const [artifacts, setArtifacts] = useState<Artifacts | null>(null);
  const [active, setActive] = useState<OutputId>("linkedin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [briefId, setBriefId] = useState<string | null>(briefParam ?? null);
  const [version, setVersion] = useState(0);
  const [changeRequest, setChangeRequest] = useState("");
  const [loopState, setLoopState] = useState<"idle" | "asking" | "revising" | "done">("idle");

  const runGenerate = useServerFn(generateArtifacts);
  const runAnalyze = useServerFn(analyzeSource);
  const sourceText = [pasted, fileText].filter(Boolean).join("\n\n");

  useEffect(() => {
    if (!briefParam) return;
    (async () => {
      const { data: b } = await supabase.from("briefs").select("*").eq("id", briefParam).maybeSingle();
      if (!b) return;
      setTitle(b.title);
      setPasted(b.source_text);
      setOutputs(b.outputs as OutputId[]);
      setParams(b.params as GenParams);
      setAnalysis(b.source_analysis as unknown as SourceAnalysis);
      setBriefId(b.id);
      const { data: rev } = await supabase
        .from("revisions")
        .select("*")
        .eq("brief_id", b.id)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (rev) {
        setArtifacts(rev.artifacts as Artifacts);
        setVersion(rev.version);
        setActive((b.outputs as OutputId[])[0] ?? "linkedin");
        setLoopState(b.satisfied ? "done" : "asking");
      }
    })();
  }, [briefParam]);

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    const arr = [...list];
    setFiles(arr);
    const { text, metas } = await readFiles(arr);
    setFileText(text);
    setAnalysis(analyseSource(pasted, text, metas));
  }

  async function runSourceAnalysis() {
    if (!sourceText.trim()) {
      setError("Add pasted text or a readable file first.");
      return;
    }
    setError("");
    setAnalysing(true);
    const metas = analysis?.files ?? [];
    setAnalysis(analyseSource(pasted, fileText, metas));
    try {
      const notes = metas
        .map((m) => `${m.name} (${m.extracted ? "extracted" : "not extracted"})`)
        .join("; ");
      setAiAnalysis(await runAnalyze({ data: { sourceText, fileNotes: notes } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Source analysis failed.");
    } finally {
      setAnalysing(false);
    }
  }

  async function generate(revision = false) {
    if (!sourceText.trim()) {
      setError("Nothing to work from — paste content or upload a readable file.");
      return;
    }
    if (!outputs.length) {
      setError("Select at least one deliverable.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const metas = analysis?.files ?? [];
      const fileNotes = metas
        .map((m) => `${m.name}: ${m.extracted ? "text extracted" : "NOT extracted"}`)
        .join("; ");
      const result = await runGenerate({
        data: {
          sourceText,
          fileNotes,
          outputs,
          params,
          ...(revision && changeRequest ? { changeRequest } : {}),
          ...(revision && artifacts ? { previous: JSON.stringify(artifacts) } : {}),
        },
      });
      setArtifacts(result);
      setActive(outputs.find((o) => result[o]) ?? outputs[0]!);

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (uid) {
        let id = briefId;
        if (!id) {
          const { data: inserted, error: insErr } = await supabase
            .from("briefs")
            .insert({
              user_id: uid,
              title,
              source_text: sourceText.slice(0, 200000),
              source_files: metas as unknown as never,
              source_analysis: (analysis ?? {}) as unknown as never,
              outputs,
              params: params as unknown as never,
            })
            .select("id")
            .single();
          if (insErr) throw insErr;
          id = inserted.id;
          setBriefId(id);
          navigate({ to: "/workspace", search: { brief: id }, replace: true });
        } else {
          await supabase
            .from("briefs")
            .update({
              title,
              outputs,
              params: params as unknown as never,
              satisfied: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id);
        }
        const next = version + 1;
        await supabase.from("revisions").insert({
          brief_id: id,
          user_id: uid,
          version: next,
          artifacts: result as unknown as never,
          params: params as unknown as never,
          change_request: revision ? changeRequest : null,
        });
        setVersion(next);
      }
      setChangeRequest("");
      setLoopState("asking");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function markSatisfied() {
    setLoopState("done");
    if (briefId) await supabase.from("briefs").update({ satisfied: true }).eq("id", briefId);
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Drafting console
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full max-w-md border-b border-border bg-transparent pb-1 font-serif text-2xl font-bold outline-none focus:border-primary"
          />
        </div>
        {version > 0 && (
          <span className="mono rounded-sm border border-border px-3 py-1 text-xs text-muted-foreground">
            Version {version}
          </span>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* LEFT: input */}
        <div className="space-y-6">
          <Panel step="01" title="Source material">
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={8}
              placeholder="Paste press notes, minutes, policy text, briefing points…"
              className="w-full resize-y rounded-sm border border-border bg-background p-3 text-sm outline-none focus:border-primary"
            />
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInput.current?.click()}
              className="mt-3 cursor-pointer border border-dashed border-border p-5 text-center text-xs text-muted-foreground hover:border-primary"
            >
              <Upload className="mx-auto mb-2 h-4 w-4" />
              Drop files or click to upload — .txt, .md, .csv, .json, .html, .xml are read in full.
              Other formats are recorded by name only.
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                onChange={(e) => onFiles(e.target.files)}
              />
            </div>
            {files.length > 0 && (
              <ul className="mt-3 space-y-1">
                {(analysis?.files ?? []).map((f) => (
                  <li key={f.name} className="flex items-start gap-2 text-xs">
                    <FileText
                      className={`mt-0.5 h-3 w-3 shrink-0 ${f.extracted ? "text-accent" : "text-destructive"}`}
                    />
                    <span>
                      <span className="text-foreground">{f.name}</span>
                      <span className="block text-muted-foreground">{f.note}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={runSourceAnalysis}
              disabled={analysing}
              className="mt-4 w-full rounded-sm border border-primary py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
            >
              {analysing ? "Analysing source…" : "Analyse source"}
            </button>
          </Panel>

          <Panel step="02" title="Deliverables">
            <div className="grid gap-2">
              {OUTPUT_TYPES.map((t) => {
                const on = outputs.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() =>
                      setOutputs((o) => (on ? o.filter((x) => x !== t.id) : [...o, t.id]))
                    }
                    className={`flex items-start gap-3 border p-3 text-left text-sm transition-colors ${
                      on ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"
                    }`}
                  >
                    <span className="mono mt-0.5 w-7 shrink-0 text-[11px] text-primary">
                      {t.icon}
                    </span>
                    <span>
                      <span className="block font-semibold">{t.name}</span>
                      <span className="block text-xs text-muted-foreground">{t.desc}</span>
                    </span>
                    {on && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </Panel>

          <Panel step="03" title="Parameters">
            <div className="grid gap-3">
              {PARAM_FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="mono mb-1 block text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {f.label}
                  </span>
                  <select
                    value={params[f.key]}
                    onChange={(e) => setParams({ ...params, [f.key]: e.target.value })}
                    className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    {f.options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button
              onClick={() => generate(false)}
              disabled={busy}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-sm bg-primary py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Generating…" : artifacts ? "Regenerate from source" : "Generate drafts"}
            </button>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </Panel>
        </div>

        {/* RIGHT: analysis + output */}
        <div className="space-y-6">
          {analysis && (
            <Panel step="—" title="Source analysis">
              <div className="mono grid grid-cols-3 gap-3 text-center text-xs">
                {[
                  ["Words", analysis.words],
                  ["Characters", analysis.characters],
                  ["Read time", `${analysis.readingMinutes} min`],
                ].map(([l, v]) => (
                  <div key={String(l)} className="border border-border p-3">
                    <div className="text-lg font-bold text-primary">{v}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {l}
                    </div>
                  </div>
                ))}
              </div>
              {aiAnalysis && (
                <div className="mt-4 space-y-3 text-sm">
                  <p className="text-muted-foreground">{aiAnalysis.summary}</p>
                  <p className="mono text-xs text-primary">TYPE: {aiAnalysis.documentType}</p>
                  <TagRow label="Entities" items={aiAnalysis.keyEntities} />
                  <TagRow label="Themes" items={aiAnalysis.keyThemes} />
                  <Bullets label="Not established by this material" items={aiAnalysis.gaps} />
                  <p className="border-l-2 border-accent pl-3 text-xs text-muted-foreground">
                    {aiAnalysis.suitability}
                  </p>
                  <Bullets label="Review cautions" items={aiAnalysis.cautions} />
                </div>
              )}
              <div className="mt-4 border-l-2 border-destructive bg-card p-3">
                <p className="mono mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-destructive">
                  <AlertTriangle className="h-3 w-3" /> Limitations
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {analysis.limitations.map((l, i) => (
                    <li key={i}>• {l}</li>
                  ))}
                </ul>
              </div>
            </Panel>
          )}

          {artifacts && (
            <div className="border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
                <span className="mono text-[11px] uppercase tracking-[0.18em] text-primary">
                  Generated drafts
                </span>
                <button
                  onClick={() => exportBundle(artifacts, title)}
                  className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110"
                >
                  <Package className="h-3 w-3" /> Export bundle (.zip)
                </button>
              </div>
              <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
                {OUTPUT_TYPES.filter((t) => artifacts[t.id]).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActive(t.id)}
                    className={`rounded-sm px-3 py-1.5 text-xs font-semibold ${
                      active === t.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              <div className="p-5">
                <ArtifactView id={active} artifacts={artifacts} title={title} />
              </div>

              {/* satisfaction loop */}
              <div className="border-t border-border p-5">
                {loopState === "done" ? (
                  <p className="flex items-center gap-2 text-sm text-accent">
                    <Check className="h-4 w-4" /> Marked as final by you. Still a draft — an
                    authorized officer must review before release. You can regenerate any time.
                  </p>
                ) : loopState === "revising" ? (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">What exactly should change?</p>
                    <textarea
                      value={changeRequest}
                      onChange={(e) => setChangeRequest(e.target.value)}
                      rows={3}
                      placeholder="e.g. Make the advisory shorter, drop the third X post, use a firmer tone in the summary."
                      className="w-full rounded-sm border border-border bg-background p-3 text-sm outline-none focus:border-primary"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => generate(true)}
                        disabled={busy || !changeRequest.trim()}
                        className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {busy ? "Revising…" : "Apply changes & regenerate"}
                      </button>
                      <button
                        onClick={() => setLoopState("asking")}
                        className="rounded-sm border border-border px-4 py-2 text-sm hover:border-primary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-semibold">Are you satisfied with this draft?</p>
                    <button
                      onClick={markSatisfied}
                      className="flex items-center gap-1.5 rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-background"
                    >
                      <Check className="h-4 w-4" /> Yes, finalise
                    </button>
                    <button
                      onClick={() => setLoopState("revising")}
                      className="flex items-center gap-1.5 rounded-sm border border-border px-4 py-2 text-sm hover:border-primary"
                    >
                      <X className="h-4 w-4" /> No, request changes
                    </button>
                    {briefId && (
                      <button
                        onClick={() => navigate({ to: "/history" })}
                        className="text-sm text-primary hover:underline"
                      >
                        View revision history
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {!artifacts && !analysis && (
            <div className="border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              Add source material on the left, analyse it, then generate your drafts.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Panel({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-card p-5">
      <h2 className="mono mb-4 text-[11px] uppercase tracking-[0.18em] text-primary">
        {step} · {title}
      </h2>
      {children}
    </section>
  );
}

function TagRow({ label, items }: { label: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mono mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t, i) => (
          <span key={i} className="rounded-sm border border-border px-2 py-0.5 text-xs">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function Bullets({ label, items }: { label: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mono mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {items.map((t, i) => (
          <li key={i}>• {t}</li>
        ))}
      </ul>
    </div>
  );
}
