import { cn } from "@/lib/utils";

/**
 * The pill segmented control, ported from `_Segments` in
 * `tho/app/lib/customer/customer_home.dart:1019`. When `counts` is given each
 * segment shows its item count, so a lifecycle split (Upcoming · Completed ·
 * Cancelled) is readable without switching tabs.
 *
 * Built on `role="tablist"` so arrow keys and the selected state come from the
 * platform rather than being simulated.
 */
export function SegmentedControl({
  labels,
  counts,
  index,
  onChange,
  className,
  label,
}: {
  labels: string[];
  counts?: number[];
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
