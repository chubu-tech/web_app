"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { ScanLatch } from "@/lib/queue-deep-link";

/**
 * The camera scanner for a shop's walk-in QR — a port of
 * `tho/app/lib/customer/queue/scan_screen.dart`.
 *
 * ## What it decides, and what it does not
 *
 * It resolves a business id and hands off to `/q/<id>`, which is the route that actually joins
 * (and which counts the arrival as a scan — `p_via_qr`). The scanner itself knows nothing about
 * queues beyond the link shape, exactly as the Dart's comment says of itself, and the parsing is
 * `lib/queue-deep-link.ts` with the app's own test cases.
 *
 * `router.replace`, not `push`: Back from the queue page should return to wherever the customer
 * came from, not to a camera they have finished with.
 *
 * ## Why the decode loop is hand-written
 *
 * `jsqr` is a decode function over pixels and nothing else — no camera, no worker, no bundler
 * assets. That is the point: `getUserMedia`, a `<video>`, an offscreen `<canvas>` and a
 * `requestAnimationFrame` loop are ~40 lines that behave the same in every browser, where a
 * scanner library's worker plumbing is the part most likely to break under a bundler. It is
 * imported dynamically so 35KB of decoder is on this route and no other.
 *
 * **The loop throttles to ~8 decodes a second** rather than running every frame. A 1080p frame is
 * two megapixels of scanning; at 60Hz that is a hot phone for no gain, because a code held in
 * front of a camera is there for far longer than 125ms.
 *
 * ## Three failure modes, said plainly
 *
 * - **No secure context.** `getUserMedia` does not exist on plain http away from localhost, so
 *   this is not a permission problem and asking again will not help. The app has no equivalent —
 *   an installed app is always "secure" — so this state is web-only and is stated as such.
 * - **Permission refused.** The browser will not re-prompt for a denied origin from a click, so
 *   the only honest action is "how to undo it", not a Retry that silently fails.
 * - **No camera.** A desktop without one, which on this platform is a *likely* visitor rather
 *   than an edge case. It offers the way a browser user would actually do this: point the phone's
 *   own camera at the code.
 *
 * A code that decodes but is not one of ours never latches, so the camera keeps hunting and says
 * so inline instead of closing.
 */
export function QrScanner() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const latch = useRef(new ScanLatch());
  const raf = useRef<number | null>(null);
  const lastDecode = useRef(0);

  const [problem, setProblem] = useState<"insecure" | "denied" | "no-camera" | null>(null);
  const [live, setLive] = useState(false);
  const [sawForeign, setSawForeign] = useState(false);
  const [torch, setTorch] = useState<boolean | null>(null);

  /** Every track stopped, and the loop cancelled. Called on unmount and on a hit. */
  const teardown = useCallback(() => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      // Not a permission failure: on http away from localhost the API is simply absent.
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setProblem(window.isSecureContext ? "no-camera" : "insecure");
        return;
      }

      let decode: typeof import("jsqr").default;
      try {
        decode = (await import("jsqr")).default;
      } catch {
        if (!cancelled) setProblem("no-camera");
        return;
      }

      let media: MediaStream;
      try {
        media = await navigator.mediaDevices.getUserMedia({
          // The back camera on a phone. `ideal` rather than `exact` so a laptop with only a
          // front camera still gets a stream instead of an OverconstrainedError.
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (caught) {
        if (cancelled) return;
        const name = caught instanceof Error ? caught.name : "";
        setProblem(
          name === "NotAllowedError" || name === "SecurityError" ? "denied" : "no-camera",
        );
        return;
      }

      if (cancelled) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }

      stream.current = media;
      const el = video.current;
      if (!el) return;
      el.srcObject = media;
      try {
        await el.play();
      } catch {
        // Autoplay refusals are recoverable — `playsInline` plus a muted track is what makes
        // this work on iOS, and the loop below is harmless while the video is not yet playing.
      }
      if (cancelled) return;
      setLive(true);

      // Is a torch available on this track? `torch` is not in the DOM types, and a browser that
      // does not support it simply omits the capability rather than erroring.
      const caps = media.getVideoTracks()[0]?.getCapabilities?.() as
        | { torch?: boolean }
        | undefined;
      setTorch(caps?.torch ? false : null);

      canvas.current ??= document.createElement("canvas");
      const ctx = canvas.current.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        setProblem("no-camera");
        return;
      }

      const tick = (time: number) => {
        raf.current = requestAnimationFrame(tick);
        // ~8 a second. See the note above: every frame is heat, not accuracy.
        if (time - lastDecode.current < 125) return;
        lastDecode.current = time;

        const v = video.current;
        if (!v || v.readyState < 2 || v.videoWidth === 0) return;

        const c = canvas.current!;
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const frame = ctx.getImageData(0, 0, c.width, c.height);

        const found = decode(frame.data, frame.width, frame.height, {
          // Most QR codes are dark-on-light; trying only that is measurably faster and the
          // printed poster is exactly that. `attemptBoth` would double the work per frame.
          inversionAttempts: "dontInvert",
        });
        if (!found?.data) return;

        const id = latch.current.businessIdFor(found.data);
        if (id == null) {
          // A real code, just not ours. The latch is untouched, so scanning continues.
          setSawForeign(true);
          return;
        }
        // Stop before navigating, so a frame decoded during the transition cannot flip the
        // foreign-code message on for one paint. The latch already makes this one-shot.
        teardown();
        router.replace(`/q/${id}`);
      };
      raf.current = requestAnimationFrame(tick);
    }

    void start();
    return () => {
      cancelled = true;
      teardown();
    };
  }, [router, teardown]);

  async function toggleTorch() {
    const track = stream.current?.getVideoTracks()[0];
    if (!track || torch == null) return;
    try {
      // Through `unknown`: `torch` is a real constraint in Chromium and is not in the DOM
      // types at all, so there is nothing for a direct assertion to overlap with.
      await track.applyConstraints({
        advanced: [{ torch: !torch }],
      } as unknown as MediaTrackConstraints);
      setTorch(!torch);
    } catch {
      // The capability was advertised and refused. Hide the control rather than leave a
      // button that does nothing.
      setTorch(null);
    }
  }

  if (problem) return <Problem kind={problem} />;

  return (
    <div className="gap-base flex flex-col">
      <div className="bg-obsidian relative aspect-[3/4] w-full overflow-hidden rounded-lg tablet:aspect-video">
        <video
          ref={video}
          muted
          playsInline
          // `muted` + `playsInline` is what lets iOS Safari play an inline stream at all.
          className="size-full object-cover"
        />

        {/* The viewfinder, and it is `aria-hidden` because it is a picture of a square —
            everything it communicates is in the line of text below, which is announced. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="border-canvas absolute top-1/2 left-1/2 size-[240px] max-w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-lg border-[3px]" />
        </div>

        {torch != null ? (
          <button
            type="button"
            onClick={() => void toggleTorch()}
            aria-pressed={torch}
            aria-label={torch ? "Turn off the light" : "Turn on the light"}
            className="bg-canvas/85 text-ink hover:bg-canvas top-base right-base shadow-card absolute flex size-11 items-center justify-center rounded-full"
          >
            <Icons.qr style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
          </button>
        ) : null}
      </div>

      <p aria-live="polite" className="text-body-md text-body text-center">
        {sawForeign
          ? "That code isn't a salon queue QR."
          : live
            ? "Point at the shop's queue QR."
            : "Starting the camera…"}
      </p>
    </div>
  );
}

function Problem({ kind }: { kind: "insecure" | "denied" | "no-camera" }) {
  if (kind === "insecure") {
    return (
      <EmptyState
        icon={Icons.camera}
        title="Scanning needs a secure connection"
        message="A browser only gives a page the camera over https. Open this page on the live site, or ask the salon to add you to the queue."
      />
    );
  }

  if (kind === "denied") {
    return (
      <EmptyState
        icon={Icons.camera}
        title="Camera access is off"
        // No Retry: a browser will not re-prompt for an origin it has been refused on, so a
        // button that looks like it might work is worse than the instruction that does.
        message="Allow camera access for this site in your browser's address bar, then reload. You can also just point your phone's own camera at the code."
      />
    );
  }

  return (
    <EmptyState
      icon={Icons.camera}
      title="No camera here"
      // The most likely visitor on this platform, not an edge case — and there is a better
      // answer than an apology, because the printed code is an ordinary link.
      message="This device has no camera to scan with. Point your phone's camera at the shop's code — it opens the same page."
      action={
        <Button variant="outlined" onClick={() => window.history.back()}>
          Go back
        </Button>
      }
    />
  );
}
