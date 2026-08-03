import { cn } from "@/lib/utils";

/**
 * A selectable row, ported from `_SelectTile` in
 * `tho/app/lib/customer/business_detail_screen.dart:729` — rausch outline and a
 * pale tint when chosen.
 *
 * **A real `<input type="radio">` inside a `<label>`**, not a div with a click
 * handler. That is the one deliberate departure from the Dart: it buys keyboard
 * selection, arrow-key movement within the group and correct screen-reader
 * announcement from the platform, none of which a styled div gets.
 */
export function SelectTile({
  name,
  value,
  checked,
  onSelect,
  title,
  subtitle,
  media,
  className,
}: {
  /** The radio group. Every tile in one group shares it. */
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  title: string;
  subtitle?: string | null;
  /** An avatar or thumbnail on the leading edge. */
  media?: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "gap-md p-base flex cursor-pointer items-center rounded-md border",
        "transition-colors duration-[--duration-fast]",
        checked
          ? "border-rausch bg-[#FFF5F7] border-2"
          : "border-hairline hover:border-border-strong",
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only peer"
      />
      <RadioDot selected={checked} />
      {media}
      <span className="min-w-0 flex-1">
        <span className="text-title text-ink block font-medium">{title}</span>
        {subtitle ? (
          <span className="text-body-sm text-muted block">{subtitle}</span>
        ) : null}
      </span>
    </label>
  );
}

/**
 * The bullet, ported from `_RadioDot` in `filter_screen.dart:396`.
 *
 * Purely decorative — it always sits beside a real radio or a control with its
 * own `aria-pressed`, so it is hidden from assistive tech rather than announced
 * twice.
 */
export function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
        selected ? "border-rausch" : "border-border-strong",
      )}
    >
      {selected ? <span className="bg-rausch size-3 rounded-full" /> : null}
    </span>
  );
}
