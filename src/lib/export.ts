import JSZip from "jszip";

import {
  artifactToText,
  buildSrt,
  DRAFT_NOTICE,
  infographicSvg,
  OUTPUT_TYPES,
  type Artifacts,
  type OutputId,
} from "./artifacts";

export function download(filename: string, content: string | Blob, mime = "text/plain") {
  const blob = typeof content === "string" ? new Blob([content], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function slug(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "gennexus"
  );
}

export function exportArtifact(id: OutputId, artifacts: Artifacts, title: string) {
  const base = `${slug(title)}-${id}`;
  if (id === "infographic" && artifacts.infographic) {
    download(`${base}.svg`, infographicSvg(artifacts.infographic), "image/svg+xml");
    download(`${base}-brief.txt`, artifactToText(id, artifacts));
    return;
  }
  if (id === "video" && artifacts.video) {
    download(`${base}-production-brief.txt`, artifactToText(id, artifacts));
    download(`${base}-subtitles.srt`, buildSrt(artifacts.video.shots), "application/x-subrip");
    return;
  }
  download(`${base}.txt`, artifactToText(id, artifacts));
}

export async function exportBundle(artifacts: Artifacts, title: string) {
  const zip = new JSZip();
  const folder = zip.folder(slug(title)) ?? zip;
  folder.file("00-README.txt", `${DRAFT_NOTICE}\n\nBundle: ${title}\nGenerated: ${new Date().toISOString()}\n`);

  for (const t of OUTPUT_TYPES) {
    const data = artifacts[t.id];
    if (!data) continue;
    folder.file(`${t.id}.txt`, artifactToText(t.id, artifacts));
    if (t.id === "infographic" && artifacts.infographic)
      folder.file("infographic.svg", infographicSvg(artifacts.infographic));
    if (t.id === "video" && artifacts.video)
      folder.file("video-subtitles.srt", buildSrt(artifacts.video.shots));
  }
  folder.file("artifacts.json", JSON.stringify(artifacts, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  download(`${slug(title)}-bundle.zip`, blob, "application/zip");
}

export async function svgToPng(svg: string, filename: string) {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || 1080;
  canvas.height = img.naturalHeight || 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  canvas.toBlob((blob) => {
    if (blob) download(filename, blob, "image/png");
  }, "image/png");
}
