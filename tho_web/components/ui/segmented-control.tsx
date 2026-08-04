import { Icons, IconSize } from "./icons";
import { cn } from "@/lib/utils";

/**
 * The pill segmented control, ported from `_Segments` in
 * `tho/app/lib/customer/customer_home.dart:1019`. When `counts` is given each
 * segment shows its item count, so a lifecycle split (Upcoming · Completed ·
 * Cancelled) is readable without switching tabs.
 *
 * Built on `role="tablist"` so arrow keys and the selected state come from the
 * platform rather than being simulated.
 *
 * `locked` was added in 3a for the owner calendar's Week segment, which is a Growth
 * feature. A locked segment still **looks like a segment and is still pressable** — it
 * has to be, because pressing it is how you find out what it is; `onChange` fires as
 * normal and the caller opens the paywall instead of switching. The app does exactly
 * this (`calendar_tab.dart`'s `_setMode`), and it is why the lock is a glyph rather
 * than `disabled`: a disabled tab tells you nothing and cannot be focused to ask.
 */
export function SegmentedControl({
  labels,
  counts,
  locked,
  index,
  onChange,
  className,
  label,
}: {
  labels: string[];
  counts?: number[];
  /** Segments that carry a lock glyph — a feature this plan does not include. */
  locked?: boolean[];
  index: number;
  onChange: (i: number) => void;
  className?: string;
  /** Names the group for a screen reader, e.g. "Browse salons or products". */
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("bg-surface-soft p-xs flex rounded-full", className)}
    >
      {labels.map((text, i) => {
        const active = i === index;
        return (
          <button
            key={text}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(i)}
            className={cn(
              "text-caption px-sm flex h-10 flex-1 items-center justify-center gap-1 rounded-full font-medium",
              "transition-colors duration-[--duration-base]",
              active ? "bg-canvas text-ink shadow-card" : "text-muted hover:text-ink",
            )}
          >
            {locked?.[i] ? (
              <Icons.locked
                className="shrink-0"
                style={{ width: IconSize.xxs, height: IconSize.xxs }}
                aria-label="Not on this plan"
              />
            ) : null}
            <span className="truncate">{text}</span>
            {counts && (counts[i] ?? 0) > 0 ? (
              <span
                className={cn(
                  "text-badge font-semibold tabular-nums",
                  active ? "text-rausch-cta" : "text-muted-soft",
                )}
              >
                {counts[i]}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
