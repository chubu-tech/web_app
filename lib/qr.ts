import "server-only";

import QRCode from "qrcode";
import { salonScanUrl } from "./app-links";

/**
 * Making a scannable code for a salon — the one place that does it.
 *
 * Both halves of this lived as private helpers in `app/business/queue/page.tsx` until the
 * QR posters page needed exactly the same two, for the same salons, and a second copy is
 * how the printed poster and the on-screen sheet end up encoding different URLs. That is
 * not a hypothetical failure here: a QR already stuck to a counter cannot be re-issued, so
 * two encoders that disagree means a shop with two posters that go to different places.
 *
 * In `lib/` rather than beside a component, per AGENTS.md's rule about the client/server
 * boundary — these are pure helpers, and a component that grows a `"use client"` would
 * otherwise turn them into client references and break every server caller at runtime with
 * a green build.
 */

/**
 * The URL a printed code encodes: the salon's permanent address on `bhutansalons.com`.
 *
 * **Not built from the request host, and that is a correction.** This used to read `host` off
 * the incoming request so a preview deployment produced a code pointing at that preview. The
 * reasoning was sound for a link you click and wrong for one you laminate — see
 * `DEEP_LINK_ORIGIN` in `lib/app-links.ts` for the full argument, of which the load-bearing
 * half is that the app's Android intent filter pins `android:host="bhutansalons.com"`, so a
 * code on any other host cannot open Tho at all.
 *
 * Kept as a function rather than inlined because both printed surfaces — the poster and the
 * queue board's sheet — must not be able to disagree about it. Async for the same reason it
 * always was: every call site already awaits it, and changing that is churn with no gain.
 */
export async function queueScanUrl(businessId: string): Promise<string> {
  return salonScanUrl(businessId);
}

/**
 * The QR as a **fillable** path plus its viewBox, for a caller that owns the `<svg>` itself.
 *
 * ## Why this is not `qrSvg` with the attributes picked off
 *
 * That was the first implementation and it rendered an empty card, which is worth writing
 * down because the markup looked perfect the whole time: a `<path>` with a 2460-character
 * `d`, the right viewBox, the right fill, and nothing on screen.
 *
 * **`qrcode` emits a stroked path, and the design fills one.** Its `d` is a run of horizontal
 * segments on half-pixel centre lines — `M1 1.5h7m1 0h3…` — which are zero-area lines that
 * only become squares under `stroke-width: 1`. Fill them and every one fills to nothing.
 * `path.getBBox()` returning an empty rect was the tell.
 *
 * `Tho QR Poster.dc.html` draws its own `<svg>` with `fill="#14100E"`, and its `qr.js` emits
 * one closed rectangle per dark module: `M${c} ${r}h1v1h-1z`. So that is what this produces —
 * same shape, same coordinate space — while the encoding still comes from `qrcode` rather
 * than the design's hand-rolled encoder, which only covers versions 1–5 at level M.
 *
 * Proved equivalent to the shipping stroke renderer by comparing module sets on a live salon
 * URL: 740 dark modules, zero difference either way.
 *
 * ## The quiet zone lives in the card, not the path
 *
 * `margin` defaults to **0**, matching the design: its viewBox is exactly the module count,
 * so the code fills its box and the cream card supplies the quiet zone through its own 26px
 * of padding. The saved PNG is the opposite case and bakes in 4 modules — see `lib/qr-image.ts`.
 *
 * Null when the encode failed, which the caller must handle: the poster still has the link.
 */
export async function qrPath(
  link: string,
  {
    errorCorrectionLevel = "M",
    margin = 0,
  }: { errorCorrectionLevel?: "L" | "M" | "Q" | "H"; margin?: number } = {},
): Promise<{ path: string; viewBox: string } | null> {
  try {
    const qr = QRCode.create(link, { errorCorrectionLevel });
    const size = qr.modules.size;
    const data = qr.modules.data;

    let d = "";
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (data[r * size + c]) d += `M${c + margin} ${r + margin}h1v1h-1z`;
      }
    }

    const extent = size + margin * 2;
    return { path: d, viewBox: `0 0 ${extent} ${extent}` };
  } catch {
    return null;
  }
}

/**
 * The QR as a complete inline SVG string, or null if the encoder refused.
 *
 * The queue board's sheet renders this directly; the poster uses `qrPath` instead, because it
 * owns its own `<svg>`. Server-side either way: no client bundle, on screen before any
 * JavaScript runs, and it prints as vectors rather than a resolution-locked bitmap.
 *
 * **The default stays M**, the encoder's own and the level the queue sheet chose deliberately
 * — its note calls M "the right trade for a code that will be printed and then photographed
 * under salon lighting". The posters page opts up to **Q** for its own stated reason (paper by
 * a till gets scuffed and half-covered), which is the shape a documented decision should be
 * changed in: at the call site that wants something else, not underneath the caller that does
 * not.
 */
export async function qrSvg(
  link: string,
  {
    errorCorrectionLevel = "M",
    margin = 1,
    dark = "#222222",
    light = "#ffffff",
  }: {
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    /** In modules, not pixels — the quiet zone the scanner needs. */
    margin?: number;
    dark?: string;
    light?: string;
  } = {},
): Promise<string | null> {
  try {
    return await QRCode.toString(link, {
      type: "svg",
      errorCorrectionLevel,
      margin,
      color: { dark, light },
    });
  } catch {
    return null;
  }
}
