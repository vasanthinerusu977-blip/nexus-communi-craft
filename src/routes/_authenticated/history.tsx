import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { ArtifactView } from "@/components/ArtifactView";
import { supabase } from "@/integrations/supabase/client";
import { OUTPUT_TYPES, artifactToText, type Artifacts, type OutputId } from "@/lib/artifacts";
import { exportBundle } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Version History — GenNexus" },
      {
        name: "description",
        content: "Compare and restore earlier revisions of your generated communication drafts.",
      },
      { property: "og:title", content: "Version History — GenNexus" },
      {
        property: "og:description",
        content: "Every generation is stored as a revision you can compare and restore.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: History,
});

type Brief = {
  id: string;
  title: string;
  satisfied: boolean;
  created_at: string;
  outputs: string[];
};
type Revision = {
  id: string;
  version: number;
  created_at: string;
  change_request: string | null;
  artifacts: Artifacts;
};

function History() {
  const [selected, setSelected] = useState<string | null>(null);
  const [compare, setCompare] = useState<[number | null, number | null]>([null, null]);
  const [tab, setTab] = useState<OutputId>("linkedin");

  const briefs = useQuery({
    queryKey: ["briefs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("briefs")
        .select("id,title,satisfied,created_at,outputs")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Brief[];
    },
  });

  const revisions = useQuery({
    queryKey: ["revisions", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revisions")
        .select("id,version,created_at,change_request,artifacts")
        .eq("brief_id", selected!)
        .order("version", { ascending: false });
      if (error) throw error;
      return data as unknown as Revision[];
    },
  });

  const revs = revisions.data ?? [];
  const left = revs.find((r) => r.version === compare[0]);
  const right = revs.find((r) => r.version === compare[1]);
  const brief = briefs.data?.find((b) => b.id === selected);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
      <p className="mono text-[11px] uppercase tracking-[0.2em] text-primary">Archive</p>
      <h1 className="mt-1 font-serif text-2xl font-bold">Briefs & version history</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="space-y-2">
          {briefs.isLoading && <p className="mono text-sm text-muted-foreground">Loading…</p>}
          {briefs.data?.length === 0 && (
            <div className="border border-dashed border-border p-6 text-sm text-muted-foreground">
              No briefs yet.{" "}
              <Link to="/workspace" className="text-primary hover:underline">
                Create one in the workspace.
              </Link>
            </div>
          )}
          {briefs.data?.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                setSelected(b.id);
                setCompare([null, null]);
                setTab((b.outputs[0] as OutputId) ?? "linkedin");
              }}
              className={`w-full border p-4 text-left ${
                selected === b.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"
              }`}
            >
              <p className="font-semibold">{b.title}</p>
              <p className="mono mt-1 text-[11px] text-muted-foreground">
                {new Date(b.created_at).toLocaleString()} ·{" "}
                <span className={b.satisfied ? "text-accent" : "text-primary"}>
                  {b.satisfied ? "Finalised" : "In review"}
                </span>
              </p>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {!selected && (
            <div className="border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              Select a brief to view its revisions.
            </div>
          )}
          {selected && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/workspace"
                  search={{ brief: selected }}
                  className="rounded-sm bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Open latest in workspace
                </Link>
                <span className="mono text-xs text-muted-foreground">
                  {revs.length} revision(s)
                </span>
              </div>

              <div className="space-y-2">
                {revs.map((r) => (
                  <div key={r.id} className="border border-border bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="mono text-xs text-primary">VERSION {r.version}</p>
                        <p className="mono text-[11px] text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </p>
                        {r.change_request && (
                          <p className="mt-1 max-w-xl border-l-2 border-border pl-2 text-xs text-muted-foreground">
                            Requested change: {r.change_request}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <button
                          onClick={() => setCompare([r.version, compare[1]])}
                          className="rounded-sm border border-border px-2.5 py-1 hover:border-primary hover:text-primary"
                        >
                          Compare A
                        </button>
                        <button
                          onClick={() => setCompare([compare[0], r.version])}
                          className="rounded-sm border border-border px-2.5 py-1 hover:border-primary hover:text-primary"
                        >
                          Compare B
                        </button>
                        <button
                          onClick={() => exportBundle(r.artifacts, `${brief?.title ?? "brief"}-v${r.version}`)}
                          className="rounded-sm border border-border px-2.5 py-1 hover:border-primary hover:text-primary"
                        >
                          Export
                        </button>
                        <button
                          onClick={async () => {
                            const { data: userData } = await supabase.auth.getUser();
                            const uid = userData.user?.id;
                            if (!uid || !selected) return;
                            const top = Math.max(...revs.map((x) => x.version));
                            await supabase.from("revisions").insert({
                              brief_id: selected,
                              user_id: uid,
                              version: top + 1,
                              artifacts: r.artifacts as unknown as never,
                              change_request: `Restored from version ${r.version}`,
                            });
                            await revisions.refetch();
                          }}
                          className="rounded-sm bg-secondary px-2.5 py-1 hover:brightness-125"
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {(left || right) && (
                <div className="border border-border bg-card">
                  <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
                    {OUTPUT_TYPES.filter(
                      (t) => left?.artifacts[t.id] || right?.artifacts[t.id],
                    ).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`rounded-sm px-3 py-1.5 text-xs font-semibold ${
                          tab === t.id
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-4 p-4 md:grid-cols-2">
                    {[left, right].map((r, i) => (
                      <div key={i}>
                        <p className="mono mb-2 text-[11px] uppercase tracking-wide text-primary">
                          {i === 0 ? "A" : "B"} · {r ? `Version ${r.version}` : "not selected"}
                        </p>
                        {r ? (
                          r.artifacts[tab] ? (
                            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap border border-border bg-background p-3 text-xs text-muted-foreground">
                              {artifactToText(tab, r.artifacts)}
                            </pre>
                          ) : (
                            <p className="text-xs text-muted-foreground">Not present in this version.</p>
                          )
                        ) : (
                          <p className="text-xs text-muted-foreground">Pick a revision above.</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {revs[0] && (
                <div className="border border-border bg-card p-5">
                  <p className="mono mb-3 text-[11px] uppercase tracking-[0.18em] text-primary">
                    Latest revision preview
                  </p>
                  {revs[0].artifacts[tab] ? (
                    <ArtifactView
                      id={tab}
                      artifacts={revs[0].artifacts}
                      title={brief?.title ?? "brief"}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Select a deliverable tab that exists in this revision.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
