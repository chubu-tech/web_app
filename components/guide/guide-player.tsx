"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { Icons, IconSize } from "@/components/ui/icons";
import { useDialogOverlay } from "@/components/ui/use-dialog-overlay";
import { usePrefersReducedMotion } from "@/components/ui/use-prefers-reduced-motion";
import { estimateSpeechSeconds } from "@/lib/guide/narration";
import {
  DEFAULT_SECONDS,
  FRAME_RATIO,
  WINDOW_RATIO,
  GUIDES,
  narrationFor,
  panPercent,
  type Guide,
  type GuideAudience,
  type GuideFrame,
  type GuideStep,
  type GuideVariant,
} from "@/lib/guide/steps";
import { cn } from "@/lib/utils";
import { useNarration } from "./use-narration";

/**
 * The guide player — real screenshots of this app, played in order, narrated, with a
 * highlight and an explanation on each.
 *
 * ## It is a dialog, so it behaves like one
 *
 * `useDialogOverlay` is the same hook `Sheet` and the collapse nav use: scroll lock, focus
 * moved in, Escape, a Tab trap, and focus restored to the button that opened it. Written
 * out rather than inherited, because the browser gives an overlay none of it.
 *
 * Not built on `Sheet` itself, deliberately. `Sheet` is a titled bottom sheet that hugs its
 * content and caps at 32rem; this is a stage that wants the width of the window and carries
 * its own transport. Same behaviour, different shape — which is exactly the split
 * `use-dialog-overlay.ts` exists to serve.
 *
 * ## Two frame sets, and a window onto the phone one
 *
 * Every step has a 1280x800 capture and a 390x844 one, and `useFrameVariant` picks by
 * viewport at the same 744 breakpoint the rest of the app collapses at. The phone frame is
 * the point of the exercise: a desktop screenshot shown 358px wide is a picture of a layout
 * that phone will never render.
 *
 * But a 390x844 frame shown whole at 358px wide is 775px tall, which is the entire viewport
 * with nothing left for the words. So the phone frame is shown through a **window** — a 3:4
 * opening onto a taller picture — and the window pans to whatever the step is highlighting.
 * That is why `panPercent` exists, and why the pan is applied to a layer holding the frame
 * *and* its ring: move the picture out from under a highlight positioned in percentages and
 * the ring walks off the thing it is pointing at.
 *
 * The result is the app at roughly life size on the device it was designed for, framed on
 * the control being explained.
 *
 * ## What decides when a frame is over
 *
 * With narration on, **the voice does**: the frame holds until the utterance ends, so the
 * words and the picture cannot drift apart, and the timer becomes a backstop for the
 * browsers that never report an end (see `use-narration.ts`). With narration off it is
 * `step.seconds`, one `setTimeout`, and nothing re-renders between frames.
 *
 * The progress segment fills with a CSS animation over the same duration, so the bar and
 * the clock cannot disagree. Pausing freezes the bar and cancels the voice; resuming
 * restarts both from the top of the frame rather than trying to resume a partial utterance,
 * which is a kindness on a frame somebody deliberately stopped at.
 *
 * ## `prefers-reduced-motion` changes four things
 *
 * The frame's entrance and drift go, the ring and copy entrances go (they are `motion-safe`,
 * so the media query does it), the progress fill goes — the app-wide rule at the foot of
 * `globals.css` would snap it to full and hold it there, lying about how much of the frame
 * is left — and **autoplay starts paused**. A guide that begins moving the moment it opens
 * is precisely the auto-updating content that preference is asking about. Narration is
 * untouched: it is not motion, it is on its own control, and it is what somebody who has
 * turned animation off may be relying on.
 */

const SOUND_KEY = "tho.guide.sound.v1";
const VARIANT_QUERY = "(min-width: 744px)";

/**
 * Which frame set to show, live.
 *
 * `useSyncExternalStore` rather than an effect, the same call `usePrefersReducedMotion`
 * makes: a rotated phone or a dragged window should swap frames without a reload, and
 * setting state from an effect renders once with a guess and again with the answer.
 *
 * The server snapshot is `phone`. It is never actually rendered — the player is only
 * imported on press — but a mobile-first default is the right answer to "assume nothing".
 */
let variantQuery: MediaQueryList | null = null;
/**
 * One `MediaQueryList`, made on first use — the same fix `usePrefersReducedMotion` carries.
 * `getSnapshot` runs on every render and again on every notification, and `matchMedia` parses
 * the query and allocates a fresh object each call, so the naive form built one per render to
 * read a boolean off it.
 */
const variantMedia = () => (variantQuery ??= window.matchMedia(VARIANT_QUERY));

function subscribeToVariant(onChange: () => void) {
  const query = variantMedia();
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useFrameVariant(): GuideVariant {
  return useSyncExternalStore(
    subscribeToVariant,
    () => (variantMedia().matches ? "wide" : "phone"),
    () => "phone" as const,
  );
}

/** The sound preference, remembered. A guide that forgets it every time is a guide that
 *  shouts at somebody twice. */
function readSoundPreference(): boolean {
  try {
    const stored = window.localStorage.getItem(SOUND_KEY);
    // Narration on by default: somebody pressing a play-shaped button is asking to be
    // shown, and the toggle is right there in the controls.
    return stored === null ? true : stored === "on";
  } catch {
    // Private mode, or storage disabled. The feature is not important enough to throw over.
    return true;
  }
}

export function GuidePlayer({
  audience,
  onClose,
}: {
  /**
   * Which guide to play, by name rather than by value.
   *
   * The launcher renders on every page and this player is behind `next/dynamic`, so handing it
   * a whole `Guide` meant the launcher had to import `steps.ts` — every frame, body and alt of
   * both guides — into the shared client bundle to name one. Taking the audience lets the data
   * land in this chunk, which is the one that is only fetched when somebody presses the button.
   */
  audience: GuideAudience;
  onClose: () => void;
}) {
  const guide = GUIDES[audience];
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const reduced = usePrefersReducedMotion();
  const variant = useFrameVariant();

  const [index, setIndex] = useState(0);
  /**
   * Playing starts true — this is a guide somebody pressed a play-shaped button to open —
   * except under reduced motion. The initialiser reads the hook's value once, which is what
   * we want: changing the preference mid-guide should not seize the transport out of the
   * viewer's hands.
   */
  const [playing, setPlaying] = useState(!reduced);
  const [sound, setSound] = useState(readSoundPreference);
  /**
   * Bumped whenever a frame's clock starts. It is the `key` on the stage and the progress
   * fill, which is what makes their animations replay — a CSS animation on an element that
   * merely re-renders does not restart.
   */
  const [run, setRun] = useState(0);

  const steps = guide.steps;
  const total = steps.length;
  const step = steps[index]!;
  const atEnd = index === total - 1;

  useDialogOverlay({ open: true, onClose, panel });

  const goTo = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(total - 1, next)));
      setRun((r) => r + 1);
    },
    [total],
  );

  const next = useCallback(() => {
    // The last frame ends playback rather than looping. A guide that starts over by itself
    // is a guide nobody can tell they have finished.
    if (atEnd) {
      setPlaying(false);
      return;
    }
    goTo(index + 1);
  }, [atEnd, goTo, index]);

  const previous = useCallback(() => goTo(index - 1), [goTo, index]);

  const restart = useCallback(() => {
    goTo(0);
    setPlaying(true);
  }, [goTo]);

  const narrationText = narrationFor(step);
  const { supported: canSpeak } = useNarration({
    text: narrationText,
    audio: step.audio,
    enabled: sound,
    playing,
    onFinished: next,
  });

  // The voice, when there is one, decides how long the frame is. Its estimate drives the
  // progress bar too, so the bar is a picture of the narration rather than of a timer that
  // happens to be running beside it.
  const narrating = sound && playing && (canSpeak || Boolean(step.audio));
  const holdSeconds = narrating
    ? estimateSpeechSeconds(narrationText)
    : (step.seconds ?? DEFAULT_SECONDS);

  useEffect(() => {
    if (!playing) return;
    // While narrating this is a backstop, not the clock: `useNarration` advances on the
    // utterance's own end event, and the margin is what keeps the two from racing.
    const ms = (narrating ? holdSeconds + 8 : holdSeconds) * 1000;
    const timer = setTimeout(next, ms);
    return () => clearTimeout(timer);
  }, [playing, next, holdSeconds, narrating, run]);

  const toggleSound = () => {
    setSound((on) => {
      const value = !on;
      try {
        window.localStorage.setItem(SOUND_KEY, value ? "on" : "off");
      } catch {
        // Nothing to do, and nothing worth breaking the guide over.
      }
      return value;
    });
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    // Space is a button's own activation key, so let a focused control have it — otherwise
    // the play button would toggle twice on one press. `k` is unambiguous and always ours.
    if (event.key === " " && isControl(document.activeElement)) return;

    const toggle = () => setPlaying((p) => !p);
    // A `Map` rather than an object literal, for the reason `StatusPill`'s tone table is
    // one: `event.key` is a string from outside this file, and a plain object answers for
    // `Object.prototype`'s members too. Escape belongs to `useDialogOverlay`.
    const transport = new Map<string, () => void>([
      [
        "ArrowRight",
        () => {
          setPlaying(false);
          next();
        },
      ],
      [
        "ArrowLeft",
        () => {
          setPlaying(false);
          previous();
        },
      ],
      ["Home", () => goTo(0)],
      ["End", () => goTo(total - 1)],
      [" ", toggle],
      ["k", toggle],
      ["m", toggleSound],
    ]);

    const handle = transport.get(event.key);
    if (!handle) return;
    event.preventDefault();
    handle();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Decorative: Escape and the Close button are the documented ways out, so the
          scrim needs no role of its own. */}
      <div
        className="scrim motion-safe:animate-guide-scrim absolute inset-0"
        aria-hidden
        onClick={onClose}
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cn(
          "bg-canvas motion-safe:animate-guide-panel relative flex h-full w-full flex-col overflow-hidden outline-none",
          // A full-bleed sheet on a phone, a centred window from 744 up — DESIGN.md's
          // collapsing strategy, and the same call `Sheet` makes.
          "tablet:h-auto tablet:max-h-[92svh] tablet:w-[calc(100%-2rem)] tablet:max-w-[68rem] tablet:rounded-lg",
        )}
      >
        <Header
          guide={guide}
          index={index}
          total={total}
          titleId={titleId}
          onClose={onClose}
        />

        <ProgressRail
          steps={steps}
          index={index}
          seconds={holdSeconds}
          playing={playing}
          reduced={reduced}
          run={run}
        />

        {/*
          The one scroll container. On a phone the frame and the explanation stack and this
          is what scrolls between them; from 1128 up they sit side by side and it rarely
          scrolls at all.
        */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="desktop:grid-cols-[minmax(0,1fr)_20rem] desktop:items-start grid gap-0">
            <Stage
              steps={steps}
              index={index}
              variant={variant}
              reduced={reduced}
              playing={playing}
              holdSeconds={holdSeconds}
              run={run}
            />
            <Explanation
              step={step}
              total={total}
              nextTitle={steps[index + 1]?.title}
              runKey={run}
            />
          </div>
        </div>

        <Controls
          steps={steps}
          index={index}
          playing={playing}
          atEnd={atEnd}
          sound={sound}
          canSpeak={canSpeak || Boolean(step.audio)}
          onToggleSound={toggleSound}
          onPrevious={() => {
            setPlaying(false);
            previous();
          }}
          onNext={() => {
            setPlaying(false);
            next();
          }}
          onToggle={() =>
            atEnd && !playing ? restart() : setPlaying((p) => !p)
          }
          onJump={(i) => {
            setPlaying(false);
            goTo(i);
          }}
        />

        {/*
          The step change, in words, for anybody who cannot see the frame swap. `polite` so
          it waits for a screen reader to finish whatever it is saying — an assertive
          announcement every nine seconds would talk over the reader's own exploration.
        */}
        <p aria-live="polite" className="sr-only">
          {`Step ${index + 1} of ${total}. ${step.title}. ${step.body}`}
        </p>
      </div>
    </div>,
    document.body,
  );
}

/** Space belongs to a focused control before it belongs to the transport. */
function isControl(node: Element | null): boolean {
  return (
    node instanceof HTMLElement &&
    (node.tagName === "BUTTON" ||
      node.tagName === "A" ||
      node.tagName === "INPUT")
  );
}

function Header({
  guide,
  index,
  total,
  titleId,
  onClose,
}: {
  guide: Guide;
  index: number;
  total: number;
  titleId: string;
  onClose: () => void;
}) {
  return (
    <div className="border-hairline-soft px-base gap-md tablet:px-lg flex min-h-14 shrink-0 items-center border-b">
      <span
        aria-hidden
        className="bg-rausch/10 text-rausch-cta tablet:grid hidden size-9 shrink-0 place-items-center rounded-full"
      >
        <Icons.guide style={{ width: IconSize.sm, height: IconSize.sm }} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="text-title text-ink truncate font-semibold">
          {guide.title}
        </h2>
        <p className="text-caption-sm text-muted truncate">
          Step {index + 1} of {total} · real screens from this site
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close the guide"
        className="text-muted hover:text-ink -mr-2 flex size-12 shrink-0 items-center justify-center rounded-full"
      >
        <Icons.close
          style={{ width: IconSize.sm, height: IconSize.sm }}
          aria-hidden
        />
      </button>
    </div>
  );
}

/**
 * One segment per step: filled behind you, filling on you, empty ahead.
 *
 * `aria-hidden` in full — the rail is a picture of where you are, and the same fact is
 * already in the header ("Step 4 of 16"), in the live region, and in the numbered jump
 * buttons at the foot. A third announcement of it is noise.
 */
function ProgressRail({
  steps,
  index,
  seconds,
  playing,
  reduced,
  run,
}: {
  steps: GuideStep[];
  index: number;
  seconds: number;
  playing: boolean;
  reduced: boolean;
  run: number;
}) {
  return (
    <div
      aria-hidden
      className="px-base tablet:px-lg gap-xxs flex shrink-0 py-2"
    >
      {steps.map((step, i) => (
        <span
          key={step.id}
          className="bg-surface-strong relative h-1 flex-1 overflow-hidden rounded-full"
        >
          {i < index ? <span className="bg-rausch absolute inset-0" /> : null}
          {i === index ? (
            reduced ? (
              // No fill animation: the app-wide reduced-motion rule would snap it to full
              // and then hold there, which is a bar saying the frame is over while it is
              // still on screen. A solid half-tint says "this one" and claims nothing about
              // time.
              <span className="bg-rausch/50 absolute inset-0" />
            ) : (
              <span
                key={run}
                className="bg-rausch absolute inset-0 origin-left"
                style={{
                  animation: `guide-progress ${seconds}s linear both`,
                  animationPlayState: playing ? "running" : "paused",
                }}
              />
            )
          ) : null}
        </span>
      ))}
    </div>
  );
}

/**
 * The frame, in a window that names the route it was captured on.
 *
 * The chrome is not decoration: these screenshots carry the app's own header, so without
 * something around them a viewer on `/discover` sees two THO headers and has to work out
 * which one is the picture. The address bar also states the claim the whole feature rests
 * on — this is `/business/queue`, not an artist's impression of it.
 */
function Stage({
  steps,
  index,
  variant,
  reduced,
  playing,
  holdSeconds,
  run,
}: {
  steps: GuideStep[];
  index: number;
  variant: GuideVariant;
  reduced: boolean;
  playing: boolean;
  holdSeconds: number;
  run: number;
}) {
  const step = steps[index]!;
  const frame = step[variant];
  // How far down the taller phone frame the window sits, so the ring is in view. Zero on the
  // wide frames, where the window is the whole picture.
  const pan = panPercent(variant, frame.hotspot);

  return (
    <figure className="p-base tablet:p-lg m-0 min-w-0">
      <div className="border-hairline-soft bg-surface-soft overflow-hidden rounded-md border">
        <div className="border-hairline-soft gap-sm bg-surface-strong flex items-center border-b px-3 py-2">
          <span aria-hidden className="gap-xxs flex shrink-0">
            <span className="bg-border-strong block size-2 rounded-full" />
            <span className="bg-border-strong block size-2 rounded-full" />
            <span className="bg-border-strong block size-2 rounded-full" />
          </span>
          <span className="text-caption-sm text-muted bg-canvas min-w-0 flex-1 truncate rounded-full px-3 py-1 text-center">
            {step.route}
          </span>
        </div>

        {/*
          The window. On the wide frames it is the whole picture (8:5, the exact capture
          ratio, so nothing is cropped and the measured hotspots land where they were
          measured). On a phone it is a 3:4 opening onto a 390x844 frame, panned so the
          highlight is in view — see `panPercent`.

          `overflow-hidden` is load-bearing twice over: it is what makes the window a window,
          and the highlight's outer shadow — 9999px of it — is what dims the rest of the
          picture.
        */}
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: WINDOW_RATIO[variant] }}
        >
          {/*
            The pan-and-drift layer, holding the frame AND its highlight so the two cannot
            come apart. Keyed by `run`, because that is what makes a CSS animation replay;
            the neighbours are kept warm by the preload layer below rather than by living
            in here.
          */}
          <div
            key={run}
            className="absolute inset-x-0 top-0"
            style={{
              aspectRatio: FRAME_RATIO[variant],
              transform: `translateY(-${pan}%)`,
              /*
                Applied only while playing, and that is a correctness fix rather than a
                tidy-up: paused, a `both`-filled animation holds its **first** keyframe, so
                a stopped guide sat at the arrival zoom for as long as somebody read it — and
                on a phone, where the frame is seen through a window, that pushed a highlight
                near the bottom edge out of view. At rest the layer is untransformed, which
                is also the state every hotspot percentage was measured against.
              */
              ...(reduced || !playing
                ? {}
                : { animation: `guide-frame-in ${holdSeconds}s linear both` }),
            }}
          >
            <Frame frame={frame} priority />
            {frame.hotspot ? <Highlight hotspot={frame.hotspot} /> : null}
          </div>

          {/*
            Next and previous, fetched but never shown. This is what makes the arrows
            instant, and it is bounded: three frames leave the network rather than
            thirty-two. `opacity-0` rather than `hidden`, because a display-none image is
            not guaranteed to be fetched at all.
          */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 opacity-0"
          >
            {[index - 1, index + 1]
              .filter((i) => i >= 0 && i < steps.length)
              .map((i) => (
                <Frame key={steps[i]!.id} frame={steps[i]![variant]} />
              ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

function Frame({
  frame,
  priority = false,
}: {
  frame: GuideFrame;
  priority?: boolean;
}) {
  return (
    <Image
      src={`/guide/${frame.image}`}
      alt={priority ? frame.alt : ""}
      aria-hidden={!priority}
      fill
      // Only the frame on screen is worth blocking on; its neighbours load at normal
      // priority while somebody reads.
      priority={priority}
      sizes="(min-width: 1128px) 44rem, (min-width: 744px) 60rem, 100vw"
      className="object-cover object-top"
    />
  );
}

/**
 * The highlight: a coral ring around the thing being talked about, and everything else
 * dimmed.
 *
 * The dimming is the ring's own outer `box-shadow` at 9999px rather than four dimming panels
 * or an SVG mask — one element, one paint, and it cannot leave a seam. `aria-hidden` because
 * the label it carries is already the first thing the step's `alt` and body say.
 *
 * It arrives a beat after the frame does (the delay is in `--animate-guide-ring`), which is
 * the difference between a ring that is part of the picture and somebody pointing at one.
 */
function Highlight({
  hotspot,
}: {
  hotspot: NonNullable<GuideFrame["hotspot"]>;
}) {
  const { x, y, w, h, label, place = "below" } = hotspot;
  // Anchor the label to whichever edge of the ring keeps it inside the picture: pinned left
  // by default, and to the right once the ring itself starts past the middle.
  const fromRight = x + w > 62;

  return (
    <div
      aria-hidden
      /*
        `text-caption-sm` is on this wrapper rather than on the label, and that is not style
        — it is `lib/utils.ts`'s documented trap. `cn` runs `twMerge`, which is configured
        with Tailwind's own scale and therefore files every token in `globals.css` under
        *colour*; a `cn` carrying both `text-caption-sm` and `text-on-primary` silently drops
        one. It cost this label its colour once already: white text became inherited ink on
        an ink pill, i.e. an unreadable black box, with the class still in the source and the
        build green. Font size inherits, this wrapper has no colour class, so nothing has to
        be merged.
      */
      className="text-caption-sm pointer-events-none absolute"
      style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
    >
      <div
        className="border-rausch motion-safe:animate-guide-ring absolute inset-0 rounded-sm border-2"
        style={{ boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.42)" }}
      />
      <span
        className={cn(
          "bg-ink text-on-primary motion-safe:animate-guide-label shadow-card absolute rounded-sm px-2 py-1 font-medium whitespace-nowrap",
          place === "above" ? "bottom-full mb-2" : "top-full mt-2",
        )}
        style={fromRight ? { right: 0 } : { left: 0 }}
      >
        {label}
      </span>
    </div>
  );
}

function Explanation({
  step,
  total,
  nextTitle,
  runKey,
}: {
  step: GuideStep;
  total: number;
  nextTitle?: string;
  runKey: number;
}) {
  // Keyed so the entrance replays on every step. The stagger is an inline `animation-delay`,
  // the pattern `NavRow` uses, because the shorthand in the utility resets it.
  const line = (i: number) => ({ animationDelay: `${i * 70}ms` });

  return (
    <div
      key={runKey}
      className="px-base pb-base tablet:px-lg desktop:pt-lg desktop:pr-lg desktop:pl-0 min-w-0"
    >
      <p
        className="text-caption-sm text-rausch-cta motion-safe:animate-guide-copy font-semibold tracking-[0.04em] uppercase"
        style={line(0)}
      >
        {step.chapter}
      </p>
      <h3
        className="text-display-sm text-ink motion-safe:animate-guide-copy mt-1 font-semibold"
        style={line(1)}
      >
        {step.title}
      </h3>
      <p
        className="text-body-sm text-body motion-safe:animate-guide-copy mt-2"
        style={line(2)}
      >
        {step.body}
      </p>
      <p
        className="text-caption text-muted border-hairline-soft motion-safe:animate-guide-copy mt-4 border-t pt-3"
        style={line(3)}
      >
        {nextTitle
          ? `Next · ${nextTitle}`
          : `That is the last of ${total} — press the button below to start again.`}
      </p>
    </div>
  );
}

function Controls({
  steps,
  index,
  playing,
  atEnd,
  sound,
  canSpeak,
  onToggleSound,
  onPrevious,
  onNext,
  onToggle,
  onJump,
}: {
  steps: GuideStep[];
  index: number;
  playing: boolean;
  atEnd: boolean;
  sound: boolean;
  canSpeak: boolean;
  onToggleSound: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggle: () => void;
  onJump: (index: number) => void;
}) {
  const finished = atEnd && !playing;
  const ToggleIcon = finished
    ? Icons.restart
    : playing
      ? Icons.pause
      : Icons.play;
  const toggleLabel = finished
    ? "Start the guide again"
    : playing
      ? "Pause the guide"
      : "Play the guide";

  return (
    <div
      className={cn(
        "border-hairline-soft px-base gap-sm tablet:px-lg flex shrink-0 items-center border-t py-3",
        // The iOS home indicator, on the one piece of chrome that sits on the bottom edge.
        "tablet:pb-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
      )}
    >
      <button
        type="button"
        onClick={onPrevious}
        disabled={index === 0}
        aria-label="Previous step"
        className="border-hairline text-ink hover:bg-surface-soft disabled:text-muted-soft disabled:hover:bg-transparent flex size-12 shrink-0 items-center justify-center rounded-full border disabled:cursor-not-allowed"
      >
        <Icons.chevronLeft
          style={{ width: IconSize.sm, height: IconSize.sm }}
          aria-hidden
        />
      </button>

      <button
        type="button"
        onClick={onToggle}
        aria-label={toggleLabel}
        className="bg-rausch-cta text-on-primary hover:bg-rausch-cta-pressed flex size-12 shrink-0 items-center justify-center rounded-full"
      >
        <ToggleIcon
          style={{ width: IconSize.sm, height: IconSize.sm }}
          aria-hidden
        />
      </button>

      <button
        type="button"
        onClick={onNext}
        disabled={atEnd}
        aria-label="Next step"
        className="border-hairline text-ink hover:bg-surface-soft disabled:text-muted-soft disabled:hover:bg-transparent flex size-12 shrink-0 items-center justify-center rounded-full border disabled:cursor-not-allowed"
      >
        <Icons.chevronRight
          style={{ width: IconSize.sm, height: IconSize.sm }}
          aria-hidden
        />
      </button>

      {/*
        The narration switch. Rendered only where there is a voice to switch: a browser with
        no `speechSynthesis` would otherwise offer a control that does nothing, which is the
        same dishonesty as a locked feature drawn as an available one.

        `aria-pressed` rather than a label that changes: the button is one concept in two
        states, and a screen reader announces the state itself.
      */}
      {canSpeak ? (
        <button
          type="button"
          onClick={onToggleSound}
          aria-pressed={sound}
          aria-label="Narration"
          title={sound ? "Turn narration off" : "Turn narration on"}
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full border",
            sound
              ? "border-rausch-cta text-rausch-cta bg-rausch/10"
              : "border-hairline text-muted hover:text-ink hover:bg-surface-soft",
          )}
        >
          {sound ? (
            <Icons.sound
              style={{ width: IconSize.sm, height: IconSize.sm }}
              aria-hidden
            />
          ) : (
            <Icons.soundOff
              style={{ width: IconSize.sm, height: IconSize.sm }}
              aria-hidden
            />
          )}
        </button>
      ) : null}

      {/*
        Jump to any frame. A real list of real buttons rather than dots with a click handler,
        so it is reachable by keyboard and each one says where it goes. `scrollbar-none` and
        horizontal scroll because sixteen 32px targets do not fit at 390px — and the arrows
        are the primary way through, so a scrolled rail is a shortcut rather than the route.

        `text-caption-sm` sits on the list, not the buttons: each button needs a colour class
        and `cn` would drop one of the two. See `Highlight` above.
      */}
      <ol className="scrollbar-none text-caption-sm gap-xxs ml-auto flex min-w-0 overflow-x-auto">
        {steps.map((step, i) => (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => onJump(i)}
              aria-current={i === index ? "step" : undefined}
              aria-label={`Step ${i + 1}: ${step.title}`}
              title={step.title}
              className={cn(
                "grid size-8 place-items-center rounded-full font-medium tabular-nums",
                i === index
                  ? "bg-ink text-on-primary"
                  : "text-muted hover:bg-surface-soft hover:text-ink",
              )}
            >
              {i + 1}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
