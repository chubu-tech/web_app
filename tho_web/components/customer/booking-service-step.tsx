"use client";

import { useState } from "react";
import { Icons, IconSize } from "@/components/ui/icons";
import { serviceCategories } from "@/lib/booking-basket";
import type { ServiceItem } from "@/lib/types/salon";
import { cn, formatDuration, formatNu } from "@/lib/utils";

/**
 * Step 1 — **Select services**, and the step that makes this a basket rather than a
 * picker.
 *
 * The customer flow booked one service at a time until now. `create_booking` has taken
 * `p_service_ids` as an array since it was written, `compute_availability` fits the whole
 * list into one interval, and the owner's counter form has been sending several since 3a
 * — so this is the client catching up with the RPC, not a new capability.
 *
 * ## A row is a toggle, not a radio
 *
 * Which is why it is a `button` with `aria-pressed` rather than the kit's `SelectTile`:
 * that one wraps a real `<input type="radio">`, which is the right control for *one of
 * these* and the wrong one for *any of these*. A checkbox group would also be defensible;
 * `aria-pressed` matches the pressed-pill affordance the design actually draws, and it is
 * what `Chip` in this kit already uses.
 *
 * ## Categories appear only when the data can fill them
 *
 * `serviceCategories` returns nothing below two distinct groups, so on this platform the
 * chip row is usually absent — `services.category` is filled on 2 of 33 live rows. A
 * single chip reading "Other" above every salon would be Fresha's shape without Fresha's
 * data, which is worse than a plain list.
 */
export function BookingServiceStep({
  services,
  unbookableCount,
  selectedIds,
  onToggle,
}: {
  /** Already narrowed to what somebody performs — see `bookableServices`. */
  services: ServiceItem[];
  /** How many the salon lists that no stylist performs. Stated, never hidden. */
  unbookableCount: number;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const categories = serviceCategories(services);
  const [category, setCategory] = useState<string | null>(null);

  const shown =
    category == null ? services : services.filter((s) => s.category?.trim() === category);

  if (services.length === 0) {
    return (
      <p className="text-body-md text-muted">
        Nothing here is bookable online yet — call the salon to arrange an appointment.
      </p>
    );
  }

  return (
    <div>
      {categories.length > 0 ? (
        <ul className="gap-sm scrollbar-none mb-lg flex overflow-x-auto" aria-label="Categories">
          <li>
            <CategoryChip
              label="All"
              selected={category == null}
              onClick={() => setCategory(null)}
            />
          </li>
          {categories.map((c) => (
            <li key={c}>
              <CategoryChip
                label={c}
                selected={category === c}
                onClick={() => setCategory(c)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <ul className="gap-md flex flex-col">
        {shown.map((s) => (
          <li key={s.id}>
            <ServiceRow
              service={s}
              selected={selectedIds.includes(s.id)}
              onToggle={() => onToggle(s.id)}
            />
          </li>
        ))}
      </ul>

      {unbookableCount > 0 ? (
        <p className="text-caption-sm text-muted mt-lg">
          {unbookableCount} more service{unbookableCount === 1 ? "" : "s"} at this salon
          {unbookableCount === 1 ? " isn't" : " aren't"} bookable online yet.
        </p>
      ) : null}
    </div>
  );
}

function CategoryChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "text-title px-lg min-h-11 shrink-0 rounded-full font-medium whitespace-nowrap",
        "transition-colors duration-[var(--duration-fast)]",
        selected
          ? "bg-ink text-on-primary"
          : "border-hairline bg-paper text-ink hover:border-border-strong border",
      )}
    >
      {label}
    </button>
  );
}

/**
 * One service.
 *
 * The whole row is the control, so the plus is decorative (`aria-hidden`) and the row
 * carries the label — a button inside a button is invalid, and two adjacent controls for
 * one choice is two tab stops for one decision.
 */
function ServiceRow({
  service,
  selected,
  onToggle,
}: {
  service: ServiceItem;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        "p-lg gap-base flex w-full items-center rounded-lg border text-left",
        "transition-colors duration-[var(--duration-fast)]",
        selected
          ? "border-rausch-cta bg-paper"
          : "border-hairline-soft bg-paper hover:border-border-strong",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="text-title text-ink block font-medium">{service.name}</span>
        <span className="text-body-sm text-muted mt-xxs block">
          {formatDuration(service.durationMinutes)}
        </span>
        {service.description ? (
          <span className="text-body-sm text-muted mt-xs line-clamp-2 block">
            {service.description}
          </span>
        ) : null}
        <span className="text-title text-ink mt-md block font-semibold tabular-nums">
          {formatNu(service.price)}
        </span>
      </span>

      <span
        aria-hidden
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full border transition-colors duration-[var(--duration-fast)]",
          selected
            ? "border-rausch-cta bg-rausch-cta text-on-primary"
            : "border-hairline text-ink",
        )}
      >
        <Icons.add
          style={{ width: IconSize.sm, height: IconSize.sm }}
          className={cn("transition-transform duration-[var(--duration-base)]", selected && "rotate-45")}
        />
      </span>
    </button>
  );
}
