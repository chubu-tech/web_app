"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { waitlist } from "@/lib/marketing/content";
import { parseHeading } from "@/lib/marketing/heading";
import type { WaitlistSource } from "@/lib/marketing/waitlist";
import { WaitlistForm } from "./waitlist-form";

/**
 * The waitlist modal, and the way anything on the page opens it.
 *
 * Five call sites want this — the header CTA, both store badges, the pricing
 * panel's "Get the app" and the download band — and they sit in four different
 * components at three depths. A context is what stops each of them owning a
 * copy of the open state and a copy of the dialog.
 *
 * The dialog is hand-rolled rather than pulled from a library because this
 * repo has no dialog primitive and one modal does not justify a dependency.
 * What it must not skip, and does not: `role="dialog"` + `aria-modal`, a
 * labelled title, Escape, a focus trap, focus restored to whatever opened it,
 * and a scroll lock. A modal missing any of those is a keyboard trap of the
 * bad kind.
 */

type WaitlistContext = {
  /** Open the modal, recording which call to action was pressed. */
  open: (source: WaitlistSource) => void;
};

const Context = createContext<WaitlistContext | null>(null);

/**
 * Safe to call from anywhere under the provider. It deliberately does **not**
 * throw when the provider is absent: the fallback scrolls to the download
 * band, which is where these links pointed before the waitlist existed.
 */
export function useWaitlist(): WaitlistContext {
  const ctx = useContext(Context);
  return (
    ctx ?? {
      open: () => {
        if (typeof document !== "undefined") {
          document.getElementById("download")?.scrollIntoView({ behavior: "smooth" });
        }
      },
    }
  );
}

export function WaitlistProvider({ children }: { children: React.ReactNode }) {
  const [source, setSource] = useState<WaitlistSource | null>(null);

  /**
   * Who to give focus back to, captured **here** rather than in the dialog.
   *
   * The dialog cannot do it: React applies the email input's `autoFocus`
   * during the commit that mounts it, which is before any effect in that tree
   * runs — so a dialog reading `document.activeElement` on mount reads the
   * input it just focused, and closing then drops focus on `<body>`. Measured,
   * not theorised. `open()` runs inside the click handler, while the button
   * that was pressed is still the active element.
   */
  const restoreTo = useRef<HTMLElement | null>(null);

  const open = useCallback((next: WaitlistSource) => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    setSource(next);
  }, []);

  const close = useCallback(() => {
    setSource(null);
    // `isConnected` guards the case where the trigger has since been removed —
    // the mobile nav sheet's button is gone by the time its modal closes.
    const target = restoreTo.current;
    restoreTo.current = null;
    if (target?.isConnected) target.focus();
  }, []);

  return (
    <Context.Provider value={{ open }}>
      {children}
      <AnimatePresence>
        {source && <WaitlistDialog source={source} onClose={close} />}
      </AnimatePresence>
    </Context.Provider>
  );
}

function WaitlistDialog({
  source,
  onClose,
}: {
  source: WaitlistSource;
  onClose: () => void;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus restoration is the provider's job, not this component's — see the
    // note on `restoreTo` there. What lives here is everything that only makes
    // sense while the dialog is on screen: the scroll lock, Escape, the trap.
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      // The trap. Query on each press rather than once: the panel's contents
      // change when the form flips to its success state, and a stale list
      // would send Tab to a button that is no longer there.
      const focusable = panel.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === panel.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const lines = parseHeading(waitlist.title);

  return (
    <div className="fixed inset-0 z-80 flex items-end justify-center sm:items-center">
      <motion.button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px]"
      />

      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        tabIndex={-1}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className={[
          // 32rem written out. `max-w-lg` resolves to `--spacing-lg` — 24px — which
          // is the same bug that made every `Sheet` in the product a sliver; see
          // `components/ui/sheet.tsx`. Here it left the waitlist modal 24px wide
          // with its heading, field and button spilling out beside it.
          "bg-canvas relative w-full max-w-[32rem] p-6 shadow-2xl sm:p-9",
          // A sheet on a phone, a card on everything else — the modal is the
          // full width of a 390px screen either way, so squaring off the
          // bottom corners is the honest shape there.
          "rounded-t-slab sm:rounded-slab max-h-[92dvh] overflow-y-auto",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-ink ring-ink/12 hover:bg-ink/5 absolute top-5 right-5 grid size-9 place-items-center rounded-full ring-1 ring-inset transition-colors"
        >
          <X className="size-4" strokeWidth={2} aria-hidden />
        </button>

        <span className="text-rausch text-caption-sm font-semibold tracking-[0.16em] uppercase">
          {waitlist.eyebrow}
        </span>

        <h2
          id={`${id}-title`}
          className="text-ink text-editorial-md mt-3 pr-10 font-semibold"
        >
          {lines.map((line, lineIndex) => (
            <span key={lineIndex} className="block">
              {line.map((word, wordIndex) =>
                typeof word === "string" ? (
                  <span key={wordIndex}>{word} </span>
                ) : (
                  <span key={wordIndex} className="font-normal tracking-[-0.01em]">
                    {word.text}{" "}
                  </span>
                ),
              )}
            </span>
          ))}
        </h2>

        <p id={`${id}-body`} className="text-body mt-3 text-ui leading-relaxed">
          {waitlist.body}
        </p>

        <WaitlistForm source={source} autoFocus className="mt-7" />
      </motion.div>
    </div>
  );
}
