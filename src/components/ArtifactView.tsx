import { Download } from "lucide-react";

import {
  artifactToText,
  buildSrt,
  infographicSvg,
  srtTime,
  type Artifacts,
  type OutputId,
} from "@/lib/artifacts";
import { download, exportArtifact, slug, svgToPng } from "@/lib/export";

export function ArtifactView({
  id,
  artifacts,
  title,
}: {
  id: OutputId;
  artifacts: Artifacts;
  title: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => navigator.clipboard.writeText(artifactToText(id, artifacts))}
          className="rounded-sm border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary"
        >
          Copy text
        </button>
        <button
          onClick={() => exportArtifact(id, artifacts, title)}
          className="flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary"
        >
          <Download className="h-3 w-3" /> Export this item
        </button>
        {id === "infographic" && artifacts.infographic && (
          <button
            onClick={() =>
              svgToPng(infographicSvg(artifacts.infographic!), `${slug(title)}-infographic.png`)
            }
            className="rounded-sm border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary"
          >
            Download PNG
          </button>
        )}
        {id === "video" && artifacts.video && (
          <button
            onClick={() =>
              download(
                `${slug(title)}-subtitles.srt`,
                buildSrt(artifacts.video!.shots),
                "application/x-subrip",
              )
            }
            className="rounded-sm border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary"
          >
            Download .srt
          </button>
        )}
      </div>
      <Body id={id} a={artifacts} />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="border border-border bg-background p-5 text-sm leading-relaxed">{children}</div>;
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mono mb-2 text-[11px] uppercase tracking-[0.16em] text-primary">{children}</h4>
  );
}

function Body({ id, a }: { id: OutputId; a: Artifacts }) {
  if (id === "linkedin" && a.linkedin)
    return (
      <Card>
        <p className="whitespace-pre-wrap">{a.linkedin.text}</p>
        <p className="mt-4 text-primary">
          {a.linkedin.hashtags.map((h) => (h.startsWith("#") ? h : "#" + h)).join("  ")}
        </p>
      </Card>
    );

  if (id === "twitter" && a.twitter)
    return (
      <div className="space-y-3">
        {a.twitter.posts.map((p, i) => (
          <div key={i} className="border border-border bg-background p-4">
            <div className="mono mb-2 flex justify-between text-[11px] text-muted-foreground">
              <span>POST {i + 1}</span>
              <span className={p.length > 280 ? "text-destructive" : "text-accent"}>
                {p.length}/280
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{p}</p>
          </div>
        ))}
      </div>
    );

  if (id === "advisory" && a.advisory)
    return (
      <Card>
        <div className="mono mb-4 space-y-1 border-b border-border pb-3 text-[11px] uppercase tracking-wide text-muted-foreground">
          <p className="text-primary">{a.advisory.classification}</p>
          <p>Distribution: {a.advisory.distribution}</p>
          <p>Reference: {a.advisory.reference}</p>
        </div>
        <p className="mb-4 font-semibold">SUBJECT: {a.advisory.subject}</p>
        {a.advisory.sections.map((s, i) => (
          <div key={i} className="mb-4">
            <H>{s.heading}</H>
            <p className="whitespace-pre-wrap text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </Card>
    );

  if (id === "infographic" && a.infographic)
    return (
      <div className="space-y-4">
        <div
          className="overflow-x-auto border border-border"
          dangerouslySetInnerHTML={{ __html: infographicSvg(a.infographic) }}
        />
        <Card>
          <H>Design brief</H>
          <p className="font-semibold">{a.infographic.title}</p>
          <p className="text-muted-foreground">{a.infographic.subtitle}</p>
          <ul className="mt-3 space-y-1 text-muted-foreground">
            {a.infographic.points.map((p, i) => (
              <li key={i}>• {p}</li>
            ))}
          </ul>
        </Card>
      </div>
    );

  if (id === "execsummary" && a.execsummary)
    return (
      <Card>
        <p className="mb-3 font-semibold">{a.execsummary.title}</p>
        <ul className="mb-4 space-y-1">
          {a.execsummary.bullets.map((b, i) => (
            <li key={i} className="text-muted-foreground">
              • {b}
            </li>
          ))}
        </ul>
        <p className="whitespace-pre-wrap">{a.execsummary.body}</p>
      </Card>
    );

  if (id === "presentation" && a.presentation)
    return (
      <div className="space-y-3">
        {a.presentation.slides.map((s, i) => (
          <div key={i} className="border border-border bg-background p-4">
            <div className="mono mb-2 text-[11px] text-muted-foreground">SLIDE {i + 1}</div>
            <p className="font-semibold">{s.title}</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {s.bullets.map((b, j) => (
                <li key={j}>• {b}</li>
              ))}
            </ul>
            <p className="mt-3 border-l-2 border-primary pl-3 text-xs text-muted-foreground">
              <span className="mono text-primary">SPEAKER NOTES: </span>
              {s.notes}
            </p>
          </div>
        ))}
      </div>
    );

  if (id === "report" && a.report)
    return (
      <Card>
        <p className="mb-4 font-serif text-lg font-bold">{a.report.title}</p>
        {a.report.sections.map((s, i) => (
          <div key={i} className="mb-4">
            <H>{s.heading}</H>
            <p className="whitespace-pre-wrap text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </Card>
    );

  if (id === "video" && a.video)
    return (
      <div className="space-y-4">
        <div className="border-l-2 border-primary bg-card p-4 text-xs text-muted-foreground">
          This is a <strong className="text-foreground">production package</strong>, not an MP4.
          GenNexus does not render video and cannot analyse existing video files — that requires a
          connected video model or production service.
        </div>
        <Card>
          <H>Logline</H>
          <p>{a.video.logline}</p>
          <p className="mono mt-2 text-xs text-muted-foreground">
            Target runtime: {a.video.runtimeSeconds}s · {a.video.shots.length} shots
          </p>
        </Card>
        <div className="space-y-3">
          {a.video.shots.map((s, i) => (
            <div key={i} className="border border-border bg-background p-4 text-sm">
              <div className="mono mb-2 flex justify-between text-[11px] text-muted-foreground">
                <span>SHOT {i + 1} — {s.scene}</span>
                <span className="text-primary">
                  {srtTime(s.start)} → {srtTime(s.end)}
                </span>
              </div>
              <p>
                <span className="mono text-[11px] text-primary">VISUAL: </span>
                {s.visual}
              </p>
              <p className="mt-1 text-muted-foreground">
                <span className="mono text-[11px] text-primary">NARRATION: </span>
                {s.narration}
              </p>
              <p className="mt-1 text-muted-foreground">
                <span className="mono text-[11px] text-primary">ON-SCREEN: </span>
                {s.onscreen}
              </p>
            </div>
          ))}
        </div>
        <Card>
          <H>Visual direction</H>
          <p className="text-muted-foreground">{a.video.visualDirection}</p>
          <H>
            <span className="mt-4 inline-block">Production notes</span>
          </H>
          <p className="text-muted-foreground">{a.video.productionNotes}</p>
        </Card>
        <Card>
          <H>Subtitles (SRT)</H>
          <pre className="mono max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
            {buildSrt(a.video.shots)}
          </pre>
        </Card>
      </div>
    );

  return <Card>Nothing generated for this format.</Card>;
}
