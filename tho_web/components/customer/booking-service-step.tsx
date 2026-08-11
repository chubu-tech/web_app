"use client";

import { useState } from "react";
import { Icons, IconSize } from "@/components/ui/icons";
import { filterByGender, serviceCategories } from "@/lib/booking-basket";
import { GENDER_SERVICE_KINDS } from "@/lib/salon-filters";
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
  initialGender = "any",
}: {
  /** Already narrowed to what somebody performs — see `bookableServices`. */
  services: ServiceItem[];
  /** How many the salon lists that no stylist performs. Stated, never hidden. */
  unbookableCount: number;
  selectedIds: string[];
  onToggle: (id: string) => void;
  /**
   * The gender chip to open on, carried from Discover's filter through `?gender=`.
   *
   * Somebody who narrowed Discover to "Women" and then opened a salon has already said what
   * they are looking for; making them say it again in the flow is the hand-off
   * `book_flow_screen.dart:54` exists to avoid. `any` when nothing was filtered, which is
   * the common case.
   */
  initialGender?: string;
}) {
  const categories = serviceCategories(services);
  const [category, setCategory] = useState<string | null>(null);
  /**
   * Seeded once, from the URL, then owned here.
   *
   * Not derived from `initialGender` on every render: the customer must be able to widen a
   * seeded filter back to "All" without the URL fighting them, and the URL does not change
   * when they do — this narrows what is *shown*, not what was fetched.
   */
  const [gender, setGender] = useState(() =>
    GENDER_SERVICE_KINDS[initialGender] ? initialGender : "any",
  );

  /*
    Gender first, then category. The order is not arbitrary: the category chips are built
    from the salon's own `services.category` values across the **whole** menu, so filtering
    by category first and then by gender could leave a selected category chip showing an
    empty list. Narrowing by gender first keeps every visible chip meaningful.
  */
  const byGender = filterByGender(services, gender);
  const shown =
    category == null ? byGender : byGender.filter((s) => s.category?.trim() === category);

  if (services.length === 0) {
    return (
      <p className="text-body-md text-muted">
        Nothing here is bookable online yet — call the salon to arrange an appointment.
      </p>
    );
  }

  return (
    <div>
      {/*
        All · Women · Men — and no Unisex chip, deliberately. A unisex service serves
        everyone and appears under both, so a third chip would present those services as a
        separate menu rather than as part of both (`service_filters.dart:23`).

        Always shown, unlike the category row: gender is a question every salon's menu can
        answer, because `filterByGender` reads an absent `services.gender` as unisex — and 24
        of the 34 live services have none, so a chip row gated on the column being filled
        would almost never appear.
      */}
      <ul className="gap-sm scrollbar-none mb-lg flex overflow-x-auto" aria-label="Who it is for">
        {[
          { value: "any", label: "All" },
          { value: "women", label: "Women" },
          { value: "men", label: "Men" },
        ].map((option) => (
          <li key={option.value}>
            <CategoryChip
              label={option.label}
              selected={gender === option.value}
              onClick={() => setGender(option.value)}
            />
          </li>
        ))}
      </ul>

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

      {/*
        A filter that matches nothing needs saying, and it is a reachable state rather than a
        defensive one: a barbershop whose services are all `male` shows nothing under Women.
        An unexplained blank between two chip rows reads as a failed load, and the way out —
        widening the filter — is the one thing the sentence has to name.
      */}
      {shown.length === 0 ? (
        <p className="text-body-md text-muted">
          Nothing on this salon&apos;s menu matches that. Try{" "}
          <button
            type="button"
            onClick={() => {
              setGender("any");
              setCategory(null);
            }}
            className="text-rausch-cta cursor-pointer font-medium underline"
          >
            all services
          </button>
          .
        </p>
      ) : (
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
      )}

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
