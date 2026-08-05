import { cn } from "@/lib/utils";

/**
 * The selection pill, ported from `_ChoicePill` in
 * `tho/app/lib/customer/filter_screen.dart:365` — rausch when selected, a quiet
 * grey fill otherwise.
 *
 * Rendered as a real `<button>` with `aria-pressed`, so the selected state is
 * announced rather than only coloured. The app's version is a `GestureDetector`
 * around a `Container`, which a screen reader reads as unlabelled text.
 */
export function Chip({
  label,
  selected,
  className,
  ...rest
}: Omit<React.ComponentPropsWithoutRef<"button">, "children"> & {
  label: string;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "text-caption px-lg min-h-11 shrink-0 rounded-full font-semibold",
        "transition-colors duration-[var(--duration-fast)]",
        selected
          ? "bg-rausch-cta text-on-primary"
          : "bg-surface-strong text-muted hover:text-ink",
        className,
      )}
      {...rest}
    >
      {label}
    </button>
  );
}
