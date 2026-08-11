"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";

/**
 * The poster for the counter — a port of
 * `tho/app/lib/business/queue/queue_qr_sheet.dart`.
 *
 * **What it encodes differs from the app, deliberately.** `kQueueLinkFor` still emits the
 * custom scheme `bhutansalons://q/<id>`, and its own doc comment lists the four things that
 * have to be true before it can switch to https — hosted `assetlinks.json`, an Apple
 * `apple-app-site-association`, iOS Associated Domains, and a real on-device scan. None of
 * that applies to a QR printed from a web console and scanned by a phone camera: a custom
 * scheme does **nothing** unless the app is already installed, which is the opposite of what
 * a poster on a counter is for.
 *
 * So this encodes `https://<origin>/q/<businessId>` — a URL this app already serves, and one
 * `QueueDeepLink.businessIdFrom` in `../tho` parses too, so it still deep-links into the app
 * once App Links are configured. AGENTS.md already called this shape "one poster, both
 * clients". Note the consequence while both exist: **a QR printed from the app and a QR
 * printed from here are not the same code**, and only this one works for a customer without
 * the app.
 *
 * **The image is server-rendered SVG.** It arrives as a string prop and is injected, which
 * costs no client JavaScript, scales to any paper size and prints as vectors rather than a
 * blurry canvas bitmap. The app's "Save / Share QR" button has no equivalent here — it is
 * hidden on web in the Dart too — because a browser's own print dialog is the thing that
 * actually gets it onto paper.
 */
export function QueueQrSheet({
  open,
  onClose,
  salonName,
  link,
  svg,
}: {
  open: boolean;
  onClose: () => void;
  salonName: string;
  link: string;
  /** Null when the encoder failed — the link is still worth showing. */
  svg: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Queue link copied.");
    } catch {
      // Clipboard access can be refused outright (an insecure origin, or a permission
      // policy). The link is on screen and selectable, so say that rather than nothing.
      toast.error("Couldn't copy — select the link and copy it by hand.");
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={salonName}
      footer={
        <Button variant="outlined" fullWidth onClick={() => void copy()}>
          <Icons.copy style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
          {copied ? "Link copied" : "Copy link"}
        </Button>
      }
    >
      <div className="gap-base flex flex-col items-center">
        <p className="text-body-md text-muted text-center">
          Have customers scan to join the queue.
        </p>

        {svg ? (
          <div
            className="border-hairline-soft bg-canvas p-base w-[220px] rounded-md border [&>svg]:h-auto [&>svg]:w-full"
            // The string is built server-side by the `qrcode` encoder from a URL this app
            // constructed itself — no user input reaches it.
            dangerouslySetInnerHTML={{ __html: svg }}
            role="img"
            aria-label={`QR code linking to ${link}`}
          />
        ) : (
          <p className="text-body-sm text-muted text-center">
            Couldn&apos;t draw the QR code. The link below still works.
          </p>
        )}

        <p className="text-caption-sm text-muted break-all text-center tabular-nums">
          {link}
        </p>

        <p className="text-caption-sm text-muted text-center">
          Print it for the counter, or send it to your staff group.
        </p>
      </div>
    </Sheet>
  );
}
