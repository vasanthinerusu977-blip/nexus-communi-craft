import { createFileRoute, Link } from "@tanstack/react-router";

import { Assistant } from "@/components/Assistant";
import { OUTPUT_TYPES } from "@/lib/artifacts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GenNexus — Source-Aware Government Communications Workspace" },
      {
        name: "description",
        content:
          "Turn source documents into review-ready official communication drafts: advisories, LinkedIn posts, X threads, infographics, briefings, decks and video production packages.",
      },
      { property: "og:title", content: "GenNexus — Source-Aware Communications Workspace" },
      {
        property: "og:description",
        content:
          "Upload or paste source material and generate structured, review-ready official communication drafts with full revision history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/85 px-6 py-4 backdrop-blur md:px-10">
        <div className="flex items-center gap-3">
          <span className="h-6 w-1.5 bg-primary" />
          <span className="font-serif text-lg font-bold tracking-tight">GenNexus</span>
          <span className="mono hidden text-[11px] uppercase tracking-[0.2em] text-muted-foreground sm:inline">
            Communications Workspace
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-sm px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Sign Up
          </Link>
          <Link
            to="/auth"
            search={{ mode: "login" }}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
          >
            Log In
          </Link>
        </div>
      </header>

      <section className="gn-grid-bg border-b border-border px-6 py-20 md:px-10 md:py-28">
        <div className="mx-auto max-w-4xl">
          <p className="mono mb-5 inline-block border border-border px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-primary">
            Independent drafting tool — not a government system
          </p>
          <h1 className="font-serif text-4xl leading-tight font-bold md:text-6xl">
            Source material in.
            <br />
            Review-ready communications out.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            GenNexus reads what you give it — nothing else — and drafts a coordinated set of
            official-style communication products across every channel, with full revision history
            and an explicit review gate.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="rounded-sm bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110"
            >
              Create an account
            </Link>
            <Link
              to="/auth"
              search={{ mode: "login" }}
              className="rounded-sm border border-border px-6 py-3 text-sm font-semibold hover:border-primary hover:text-primary"
            >
              Log in to the console
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-border px-6 py-16 md:px-10">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-serif text-2xl font-bold">Deliverables</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Select any combination. Every item exports individually or as one bundle.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OUTPUT_TYPES.map((o) => (
              <div key={o.id} className="border border-border bg-card p-5">
                <span className="mono text-xs font-bold text-primary">{o.icon}</span>
                <h3 className="mt-3 text-sm font-semibold">{o.name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{o.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border px-6 py-16 md:px-10">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {[
            {
              t: "Source-bound generation",
              d: "Drafts are grounded strictly in your uploaded or pasted material. Missing facts become bracketed placeholders, never invention.",
            },
            {
              t: "Satisfaction loop & history",
              d: "Not right? Say exactly what to change and regenerate. Every revision is stored so you can compare and restore earlier versions.",
            },
            {
              t: "Review before release",
              d: "Everything is labelled an unreviewed draft requiring an authorized officer's approval. No agency affiliation is claimed or implied.",
            },
          ].map((c) => (
            <div key={c.t} className="border-l-2 border-primary bg-card/50 p-6">
              <h3 className="text-base font-semibold">{c.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-6 py-10 text-xs leading-relaxed text-muted-foreground md:px-10">
        <div className="mx-auto max-w-6xl">
          <p className="mono uppercase tracking-[0.18em] text-primary">Notice</p>
          <p className="mt-3 max-w-3xl">
            GenNexus is an independent drafting tool. It is not affiliated with, endorsed by, or
            operated by NTRO or any government agency. All generated content is an unreviewed draft
            and must be verified and approved by an authorized reviewer before distribution.
          </p>
        </div>
      </footer>

      <Assistant />
    </div>
  );
}
