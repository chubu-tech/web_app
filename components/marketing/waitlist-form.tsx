"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { waitlist } from "@/lib/marketing/content";
import { joinWaitlist, validateEmail, type WaitlistSource } from "@/lib/marketing/waitlist";
import { cn } from "@/lib/marketing/utils";
import { Button } from "./ui/button";

/**
 * The waitlist form. One component, two homes: the modal every download CTA
 * opens, and `/waitlist`, which is where a scanned QR lands.
 *
 * Three things here are decisions rather than styling:
 *
 * 1. **It is a real `<form>` with a real `<input type="email">`.** Not a div
 *    with a click handler — that is what gets a phone keyboard with an `@` on
 *    it, autofill, and Enter-to-submit. `noValidate` turns off the browser's
 *    own bubble so there is exactly one error message on screen and a screen
 *    reader is told about it through `aria-describedby`.
 *
 * 2. **Errors appear on submit, then live on change.** Validating every
 *    keystroke from the start tells somebody their address is invalid while
 *    they are still typing the third character. After the first failed submit
 *    the message updates as they fix it, which is when live feedback helps.
 *
 * 3. **"Already on the list" is a success state**, styled identically to a
 *    fresh signup. Someone who cannot remember whether they signed up should
 *    get an answer, not a re-submission or an error.
 *
 * `tone` is what let the footer reuse this instead of forking it. The submit
 * path, the validation timing, the copy and the three result states are the
 * expensive part and there is now exactly one of each; only the palette differs.
 * Naming matches `StoreBadges`: `ink` on light grounds, `light` on dark ones.
 */
export function WaitlistForm({
  source,
  autoFocus = false,
  onDone,
  className,
  tone = "ink",
  stacked = false,
}: {
  source: WaitlistSource;
  autoFocus?: boolean;
  /** Fired after a successful join — the modal uses it to offer "Close". */
  onDone?: () => void;
  className?: string;
  /** `ink` on light backgrounds, `light` on the dark footer band. */
  tone?: "ink" | "light";
  /**
   * Keep the input above the button at every width. The default puts them side
   * by side from `sm:` up, which is right in a modal and wrong in a footer
   * column ~300px wide — `sm:` is a viewport query, so a narrow column on a wide
   * screen still takes the row branch and the two controls crush each other.
   */
  stacked?: boolean;
}) {
  const dark = tone === "light";
  const id = useId();
  const reduced = useReducedMotion();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"joined" | "already" | null>(null);
  // Set once the first submit fails; only then does typing re-validate.
  const submitted = useRef(false);
  const liveRegion = useRef<HTMLParagraphElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    submitted.current = true;
    const local = validateEmail(email);
    if (local) {
      setError(local);
      return;
    }

    setBusy(true);
    setError(null);
    const result = await joinWaitlist(email, source);
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setDone(result.status);
    onDone?.();
  }

  if (done) {
    const copy = waitlist.success[done];
    return (
      <motion.div
        role="status"
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={cn("text-center", className)}
      >
        <span
          className={cn(
            "text-rausch mx-auto grid size-14 place-items-center rounded-full",
            dark ? "bg-white/10" : "bg-rausch/10",
          )}
        >
          <Check className="size-7" strokeWidth={2.4} aria-hidden />
        </span>
        <p
          className={cn(
            "mt-5 text-heading font-semibold tracking-tight",
            dark ? "text-white" : "text-ink",
          )}
        >
          {copy.title}
        </p>
        <p
          className={cn(
            "mt-2 text-ui leading-relaxed",
            dark ? "text-white/70" : "text-body",
          )}
        >
          {copy.body}
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={cn("w-full", className)}>
      <label
        htmlFor={`${id}-email`}
        className={cn(
          "block text-caption font-medium",
          dark ? "text-white/70" : "text-body",
        )}
      >
        {waitlist.emailLabel}
      </label>

      <div className={cn("mt-2 flex flex-col gap-3", !stacked && "sm:flex-row")}>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus={autoFocus}
          value={email}
          disabled={busy}
          placeholder={waitlist.emailPlaceholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-note`}
          onChange={(event) => {
            setEmail(event.target.value);
            if (submitted.current) setError(validateEmail(event.target.value));
          }}
          className={cn(
            // `flex-1` is deliberately **not** unconditional, and this is the one
            // line that made the modal look broken on a phone. Stacked, the column
            // is the *main* axis, so `flex-basis: 0%` replaces `h-12` as the base
            // size — and a percentage against an auto-height container cannot
            // resolve, so it falls back to the input's max-content height: 21px of
            // `text-ui` leading, with `px-5` supplying no vertical padding to pad
            // it out. A half-height field beside a 48px button. It sizes the
            // *width* and only the width, so it belongs on the row branch alone.
            "h-12 w-full min-w-0 rounded-full px-5 text-ui",
            !stacked && "sm:flex-1",
            "ring-1 ring-inset transition-shadow duration-200 outline-none",
            // The reference's `text-input` focus: the stroke thickens to 2px and
            // flips to ink. No glow, no ring colour of its own.
            "focus:ring-2",
            dark
              ? "bg-white/10 text-white placeholder:text-white/40"
              : "text-ink placeholder:text-muted-soft bg-canvas",
            error
              // `error-text` (#c13515), not rausch. They are different reds for a
              // reason: rausch is the submit button sitting immediately beside this
              // field, so an invalid address used to outline itself in the same
              // colour as the control that would accept it.
              ? "ring-error-text focus:ring-error-text"
              : dark
                ? "ring-white/25 focus:ring-white/70"
                : "ring-hairline focus:ring-ink",
            "disabled:opacity-60",
          )}
        />

        <Button type="submit" disabled={busy}>
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {waitlist.submitting}
            </span>
          ) : (
            waitlist.submit
          )}
        </Button>
      </div>

      {/*
        One slot for both the reassurance and the error, so the layout does not
        jump when a message appears. `aria-live` is on the wrapper rather than
        the message: a region that is added to the DOM at the same moment it
        gains content is frequently not announced at all.
      */}
      <div aria-live="polite" className="mt-3 min-h-[1.25rem]">
        <AnimatePresence mode="wait" initial={false}>
          {error ? (
            <motion.p
              key="error"
              id={`${id}-error`}
              ref={liveRegion}
              initial={reduced ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "text-caption",
                dark ? "text-rausch-disabled" : "text-error-text",
              )}
            >
              {error}
            </motion.p>
          ) : (
            <p
              key="note"
              id={`${id}-note`}
              className={cn(
                "text-caption",
                dark ? "text-white/55" : "text-body/70",
              )}
            >
              {waitlist.reassurance}
            </p>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
