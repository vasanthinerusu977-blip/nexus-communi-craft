import type { SourceAnalysis, SourceFileMeta } from "./artifacts";

const TEXT_EXT = ["txt", "md", "markdown", "csv", "tsv", "json", "log", "html", "htm", "xml", "srt"];

export function isTextFile(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return file.type.startsWith("text/") || file.type === "application/json" || TEXT_EXT.includes(ext);
}

export async function readFiles(
  files: File[],
): Promise<{ text: string; metas: SourceFileMeta[] }> {
  const metas: SourceFileMeta[] = [];
  let text = "";
  for (const f of files) {
    if (isTextFile(f)) {
      const content = (await f.text()).slice(0, 200000);
      text += `\n\n--- FILE: ${f.name} ---\n${content}`;
      metas.push({
        name: f.name,
        size: f.size,
        type: f.type || "text",
        extracted: true,
        note: "Text extracted and analysed in full.",
      });
    } else {
      metas.push({
        name: f.name,
        size: f.size,
        type: f.type || "unknown",
        extracted: false,
        note: "Binary or unsupported format — filename recorded as a reference only; contents were NOT extracted. Paste the relevant text to include it.",
      });
    }
  }
  return { text: text.trim(), metas };
}

export function analyseSource(pasted: string, fileText: string, metas: SourceFileMeta[]): SourceAnalysis {
  const combined = [pasted, fileText].filter(Boolean).join("\n\n");
  const words = combined.trim() ? combined.trim().split(/\s+/).length : 0;
  const supported = metas.filter((m) => m.extracted).map((m) => m.name);
  const unsupported = metas.filter((m) => !m.extracted).map((m) => m.name);

  const limitations: string[] = [];
  if (unsupported.length)
    limitations.push(
      `${unsupported.length} file(s) could not be read (${unsupported.join(", ")}). Only plain-text formats (.txt, .md, .csv, .json, .html, .xml) are extracted in-browser. Paste their text to include the content.`,
    );
  if (words > 0 && words < 60)
    limitations.push(
      "Source material is very short. Generated drafts will be thin and may rely on bracketed placeholders instead of facts.",
    );
  if (words > 6000)
    limitations.push(
      "Large source material — only the first ~40,000 characters are sent for generation. Trim to the most relevant sections for best fidelity.",
    );
  limitations.push(
    "Video files and external video links cannot be analysed. That requires a connected video model or media-analysis service.",
  );
  limitations.push(
    "Outputs are drafts derived only from this material; nothing is verified against external sources.",
  );

  return {
    characters: combined.length,
    words,
    readingMinutes: Math.max(1, Math.round(words / 220)),
    files: metas,
    limitations,
    supported,
    unsupported,
  };
}
