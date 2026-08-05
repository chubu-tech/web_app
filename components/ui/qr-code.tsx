import QRCode from "qrcode";
import { cn } from "@/lib/utils";

/**
 * A real, scannable QR — rendered to inline SVG **at build time**.
 *
 * Not an image file and not a client-side canvas: this is a server component,
 * so the modules are encoded during the build and the browser receives markup
 * it can paint immediately. No request, no layout shift, no JavaScript, and it
 * stays crisp at any size because it is vector.
 *
 * Do not confuse this with `QrTile` in `queue-live.tsx`. That one is a
 * *stylised* mark illustrating the salon-door queue scan — decoration, and
 * deliberately not scannable. This one encodes a URL somebody's camera will
 * actually follow.
 */
export async function QrCode({
  value,
  label,
  className,
  dark = "#141312",
  light = "#ffffff",
}: {
  /** The URL to encode. */
  value: string;
  /** Announced to screen readers, which cannot scan a QR code. */
  label: string;
  className?: string;
  dark?: string;
  light?: string;
}) {
  // `margin: 0` because the surrounding element supplies the quiet zone as
  // padding — a margin baked into the SVG cannot be styled or shared with the
  // card's own corner radius.
  const svg = await QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark, light },
  });

  return (
    <div
      role="img"
      aria-label={label}
      className={cn("[&>svg]:h-auto [&>svg]:w-full", className)}
      // Generated from a developer-authored URL by `qrcode`; no user input
      // reaches this string.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
