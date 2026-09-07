"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icons, IconSize } from "@/components/ui/icons";
import { useDialogOverlay } from "@/components/ui/use-dialog-overlay";
import { usePrefersReducedMotion } from "@/components/ui/use-prefers-reduced-motion";
import { GUIDE_SUMMARIES } from "@/lib/guide/summary";
import type { GuideAudience } from "@/lib/guide/timeline";
import { cn } from "@/lib/utils";

/**
 * The walkthrough, played in a dialog.
 *
 * ## Almost all of this is `<video controls>`
 *
 * The previous player was a slideshow: sixteen screenshots, a hand-built transport, a
 * progress rail, a narration hook driving `speechSynthesis`, and a pause button that had to
 * cancel an utterance and restart it from the top of the frame. Roughly six hundred lines,
 * every one of which existed because a stack of `<img>` tags is not a video.
 *
 * This is a video. So play, pause, scrub, volume, mute, fullscreen, picture-in-picture,
 * captions, keyboard control and the screen-reader announcements for all of it come from the
 * browser, drawn in the idiom each platform's users already know, maintained by people who
 * do nothing else. Re-implementing any of it would be a worse version of something already
 * on the page.
 *
 * What is left is the four things a `<video>` genuinely does not do: be a dialog, decide
 * whether to start itself, offer a way back to the beginning once it has finished, and say
 * something useful when the file will not load.
 *
 * ## It is a dialog, so it behaves like one
 *
 * `useDialogOverlay` is the hook `Sheet` and the collapse nav use: scroll lock, focus moved
 * in, Escape, a Tab trap, and focus restored to the button that opened it. Written out
 * rather than inherited, because the browser gives an overlay none of it.
 *
 * Not built on `Sheet`, deliberately — `Sheet` is a titled bottom sheet that hugs its content
 * and caps at 32rem, and this wants to be as wide as a 16:9 film can be without leaving the
 * viewport. Same behaviour, different shape, which is the split `use-dialog-overlay.ts`
 * exists to serve.
 *
 * ## Autoplay is attempted, not assumed
 *
 * Somebody who presses "How it works" wants the film to start, and the press is a user
 * gesture, so `play()` is normally allowed. Normally. It can still be refused — an iOS Low
 * Power Mode, a data-saver, a browser that decided the gesture had expired by the time a
 * lazily-imported component mounted — and the failure is a rejected promise, not an
 * exception. Catching it and doing nothing is the whole handler: the poster is up and the
 * controls are there, so a refused autoplay degrades into exactly the state a paused video
 * is in anyway.
 *
 * Under `prefers-reduced-motion` it does not attempt at all. A film that begins moving the
 * moment it opens is precisely the auto-updating content that preference is about, and the
 * play button is right there.
 *
 * ## Captions
 *
 * `scripts/captions-guide.py` writes `<audience>.vtt` from the same narration the voice was
 * read from, so the two cannot drift. The track is not `default` — captions are a preference,
 * and the browser both remembers the viewer's and offers the control. What matters is that a
 * narrated film without them is unusable to anyone who cannot hear it, and the CC button only
 * appears when a track exists.
 */
export function GuidePlayer({
  audience,
  onClose,
}: {
  audience: GuideAudience;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const titleId = useId();
  const reduced = usePrefersReducedMotion();

  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);

  useDialogOverlay({ open: true, onClose, panel });

  useEffect(() => {
    if (reduced) return;
    // Rejected rather than thrown, and a refusal is a legitimate outcome rather than an
    // error: the poster and controls are already the correct fallback.
    video.current?.play().catch(() => {});
  }, [reduced]);

  const replay = useCallback(() => {
    const el = video.current;
    if (!el) return;
    el.currentTime = 0;
    setEnded(false);
    el.play().catch(() => {});
  }, []);

  const summary = GUIDE_SUMMARIES[audience];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Decorative: Escape and the Close button are the documented ways out, so the scrim
          needs no role of its own. */}
      <div className="scrim absolute inset-0" aria-hidden onClick={onClose} />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "bg-canvas relative flex h-full w-full flex-col overflow-hidden outline-none",
          // Full-bleed on a phone, a centred window from 744 up — the collapsing strategy
          // the rest of the product uses, and the same call `Sheet` makes.
          "tablet:h-auto tablet:w-[calc(100%-2rem)] tablet:max-w-[64rem] tablet:rounded-lg",
          // The cap is not decoration. Above 744 the panel is sized by its content, and its
          // content is a 16:9 film as wide as the panel: at 1024 that is 576px of video under
          // a 56px header. A laptop with its chrome open is 620px tall and a phone in
          // landscape is 390px, and in both the panel grew past the viewport — centred, so it
          // was cut off at the top *and* the bottom, taking the transport controls with it.
          // `svh` rather than `vh` because a mobile browser's toolbars are part of the answer.
          "tablet:max-h-[92svh]",
        )}
      >
        <div className="border-hairline-soft px-base gap-md flex min-h-14 shrink-0 items-center border-b">
          <h2
            id={titleId}
            className="text-display-sm text-ink flex-1 truncate font-semibold"
          >
            {summary.title}
          </h2>
          {/* The run time beside the title rather than only in the launcher's label: this is
              the point somebody decides whether to watch now, and it is the one fact that
              decides it. */}
          <span className="text-caption text-muted hidden shrink-0 tablet:inline">
            {summary.runLabel}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-ink -mr-2 flex size-12 shrink-0 items-center justify-center rounded-full"
          >
            <Icons.close style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
          </button>
        </div>

        {/*
          Black behind the film rather than the page's own ground. A 16:9 video letterboxed
          on a phone leaves bands above and below it, and bands in the canvas colour read as
          a layout mistake where black reads as the edge of the picture. That held when the
          canvas was the editorial cream and holds harder now it is white.
        */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black tablet:aspect-video">
          {failed ? (
            <p className="text-body p-base max-w-prose text-center text-white/80">
              The walkthrough could not be loaded. It may be worth trying again in a moment.
            </p>
          ) : (
            <video
              ref={video}
              // The one place the audience becomes a URL. `key` as well, so switching
              // audience remounts rather than leaving the old film's buffered data and
              // current time attached to a new source.
              key={audience}
              // Absolutely positioned, so the element *is* its container rather than being
              // measured against it.
              //
              // The obvious form — `w-full aspect-video max-h-full` — does not survive a
              // short window. `max-height: 100%` needs a parent with a definite height to
              // resolve against, and the parent here is a flex item whose `height` is `auto`;
              // the cap silently evaluates to none, the aspect ratio wins, and the video is
              // laid out 576px tall inside a 570px box with its transport controls clipped
              // off the bottom. Filling the box removes the question: the wrapper's
              // `tablet:aspect-video` gives the shape when there is room, `flex-1 min-h-0`
              // takes it away when there is not, and `object-contain` keeps the picture
              // undistorted either way.
              className="absolute inset-0 h-full w-full object-contain"
              controls
              playsInline
              preload="none"
              poster={`/guide/video/${audience}-poster.webp`}
              onEnded={() => setEnded(true)}
              onPlay={() => setEnded(false)}
              onError={() => setFailed(true)}
            >
              <source src={`/guide/video/${audience}.mp4`} type="video/mp4" />
              <track
                kind="captions"
                srcLang="en"
                label="English"
                src={`/guide/video/${audience}.vtt`}
              />
            </video>
          )}

          {/*
            Only once it has finished. The native controls can scrub back to zero, but at the
            end of five minutes the thing somebody wants is one button, and hunting for the
            start of a scrubber is not it.
          */}
          {ended ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <button
                type="button"
                onClick={replay}
                className="bg-paper text-ink gap-sm text-title shadow-lift flex min-h-12 items-center rounded-full px-5 font-medium"
              >
                <Icons.restart
                  className="text-rausch-cta shrink-0"
                  style={{ width: IconSize.sm, height: IconSize.sm }}
                  aria-hidden
                />
                Watch again
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
