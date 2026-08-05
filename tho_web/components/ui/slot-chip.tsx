import { cn } from "@/lib/utils";

/**
 * One bookable time, ported from `tho/app/lib/ui/widgets/slot_chip.dart`.
 *
 * A real radio, not a styled div: the slot grid is a single choice out of many, which
 * is what a radio group *is* — so arrow-key movement, the announced "3 of 24" and the
 * selected state all come from the platform.
 */
export function SlotChip({
  label,
  value,
  name,
  selected,
  onSelect,
  disabled = false,
}: {
  label: string;
  value: string;
  name: string;
  selected: boolean;
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "text-title flex min-h-12 cursor-pointer items-center justify-center rounded-full border font-medium tabular-nums",
        "transition-colors duration-[var(--duration-fast)]",
        selected
          ? "border-ink bg-ink text-on-primary"
          : "border-hairline text-ink hover:border-border-strong",
        disabled && "cursor-not-allowed opacity-50",
        "has-focus-visible:outline-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      {label}
    </label>
  );
}
