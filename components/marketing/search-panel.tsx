"use client";

import { useEffect, useId, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/marketing/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * One facet of the search bar: a segment you click, and the panel it opens.
 *
 * The site had no dropdown before this, and the one existing overlay (the mobile
 * nav sheet) has no Escape handler and no focus management. That gap is not
 * inherited here: this closes on Escape and on an outside pointer press, returns
 * focus to its own trigger, and announces itself with `aria-expanded` /
 * `aria-controls`.
 */
export function SearchPanel({
  icon: Icon,
  label,
  value,
  placeholder,
  open,
  onOpen,
  onClose,
  align = "left",
  width = "w-[min(28rem,calc(100vw-2.5rem))]",
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string | null;
  placeholder: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  align?: "left" | "right";
  width?: string;
  children: React.ReactNode;
}) {
  const panelId = useId();
  const reduced = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        trigger.current?.focus();
      }
    }
    function onPointer(event: PointerEvent) {
      if (!wrap.current?.contains(event.target as Node)) onClose();
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, onClose]);

  return (
    <div ref={wrap} className="relative min-w-0 flex-1">
      <button
        ref={trigger}
        type="button"
        onClick={open ? onClose : onOpen}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={cn(
          "flex w-full min-w-0 items-center gap-3 rounded-full px-5 py-3 text-left",
          "transition-colors duration-200",
          // The bar itself is white now, so the open segment tints *down* rather
          // than lifting onto paper — a white-on-white lift with a second shadow
          // inside a shadowed bar was two elevations where the system has one.
          open ? "bg-surface-soft" : "hover:bg-surface-soft",
        )}
      >
        <Icon className="text-muted size-[1.125rem] shrink-0" aria-hidden />
        <span className="min-w-0">
          <span className="text-muted block text-caption-sm font-semibold tracking-[0.12em] uppercase">
            {label}
          </span>
          <span
            className={cn(
              "block truncate text-ui",
              value ? "text-ink font-medium" : "text-muted-soft",
            )}
          >
            {value ?? placeholder}
          </span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            role="group"
            aria-label={label}
            initial={{ opacity: 0, y: reduced ? 0 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -8 }}
            transition={{ duration: 0.28, ease: EASE }}
            className={cn(
              // `rounded-md` + the one shadow tier. The reference applies exactly
              // this definition to its own dropdowns — account menu, language
              // picker, date picker — and has no second tier to reach for.
              "bg-canvas shadow-card absolute top-[calc(100%+0.75rem)] z-30 overflow-hidden rounded-md",
              "ring-hairline ring-1 ring-inset",
              width,
              align === "right" ? "right-0" : "left-0",
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A selectable row inside a panel. */
export function PanelOption({
  active,
  onSelect,
  children,
  meta,
}: {
  active?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  meta?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-ui",
        "transition-colors duration-200",
        // `hover:bg-surface-soft`, not `hover:bg-canvas`. The panel's own surface
        // is canvas, so the hover state resolved to the colour already underneath
        // it and these rows had no hover feedback at all.
        active
          ? "bg-rausch-soft text-ink font-semibold"
          : "text-body hover:bg-surface-soft",
      )}
    >
      <span className="truncate">{children}</span>
      {meta && (
        <span className="text-muted-soft shrink-0 text-caption tabular-nums">
          {meta}
        </span>
      )}
    </button>
  );
}

/** Small pill used for the time-of-day row and the entity counts. */
export function PanelChip({
  active,
  onSelect,
  children,
  hint,
}: {
  active?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "rounded-full px-3.5 py-2 text-left text-caption font-medium",
        "transition-colors duration-200",
        active
          ? "bg-ink text-white"
          : "text-body ring-hairline hover:ring-border-strong hover:bg-surface-soft ring-1 ring-inset",
      )}
    >
      <span className="block">{children}</span>
      {hint && (
        <span
          className={cn(
            "block text-caption-sm font-normal",
            active ? "text-white/65" : "text-muted-soft",
          )}
        >
          {hint}
        </span>
      )}
    </button>
  );
}

export function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted px-5 pt-4 pb-1.5 text-caption-sm font-semibold tracking-[0.16em] uppercase">
      {children}
    </p>
  );
}
