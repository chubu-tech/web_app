/**
 * Turning the poster's QR into a PNG, in the browser.
 *
 * ## Why the browser, and why PNG
 *
 * The modules are already computed on the server (`qrPath`) and arrive as a path string, so
 * nothing needs re-encoding — this only rasterises what is on screen. Doing it here rather
 * than server-side keeps ten salons' worth of base64 out of the RSC payload, and it is the
 * only option that fits this repo anyway: there are **no server actions**, every write goes
 * through the browser client (`lib/supabase/client.ts`), so the upload has to be here and
 * the bytes may as well be made beside it.
 *
 * PNG rather than the SVG it starts as, because of what the file is *for*. A saved code gets
 * sent to a printer, pasted into a Word document, and forwarded on WhatsApp — and WhatsApp
 * will not preview an SVG, which is the single most likely destination for it in Bhutan. The
 * vector version is already on the poster; this is the shareable one.
 *
 * ## The data URL is what keeps the canvas clean
 *
 * An `<img>` drawn from an external URL taints the canvas and makes `toBlob` throw a security
 * error. A `data:` URL has no origin to taint with, so building the SVG as a string and
 * inlining it is not a shortcut around a fetch — it is the reason this works at all.
 */

/** Big enough to print at A4 and to survive being resized by a messaging app. */
const DEFAULT_SIZE = 1024;

export async function qrPngBlob(
  qr: { path: string; viewBox: string },
  {
    size = DEFAULT_SIZE,
    dark = "#14100E",
    light = "#FFFFFF",
    /**
     * Quiet zone, in modules. **4 is the spec minimum and it is not optional here.**
     * The poster gets away with 0 because the cream card around it supplies the margin
     * visually; a bare PNG dropped into a document has whatever is behind it, which is
     * often a coloured slide. Baked in so the file is correct wherever it ends up.
     */
    quietModules = 4,
  }: { size?: number; dark?: string; light?: string; quietModules?: number } = {},
): Promise<Blob> {
  // `0 0 37 37` → 37. The viewBox is square by construction.
  const modules = Number(qr.viewBox.split(" ")[2]);
  if (!Number.isFinite(modules) || modules <= 0) {
    throw new Error(`Unreadable QR viewBox: ${qr.viewBox}`);
  }

  const extent = modules + quietModules * 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${extent} ${extent}" ` +
    `width="${size}" height="${size}" shape-rendering="crispEdges">` +
    `<rect width="${extent}" height="${extent}" fill="${light}"/>` +
    `<g transform="translate(${quietModules} ${quietModules})">` +
    `<path d="${qr.path}" fill="${dark}"/></g></svg>`;

  const img = new Image();
  img.decoding = "sync";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not rasterise the QR code."));
    // `encodeURIComponent` rather than `btoa`: the markup is ASCII here, but base64 of a
    // string containing anything non-Latin-1 throws, and the colours are caller-supplied.
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not rasterise the QR code.");
  ctx.drawImage(img, 0, 0, size, size);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the PNG."))),
      "image/png",
    );
  });
}
