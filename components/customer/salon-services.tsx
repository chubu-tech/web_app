"use client";

import Link from "next/link";
import { useState } from "react";
import { Chip } from "@/components/ui/chip";
import { Carousel } from "@/components/ui/carousel";
import type { ServiceItem } from "@/lib/types/salon";
import { cn, formatDuration, formatNu } from "@/lib/utils";

/**
 * The salon's price list — Fresha's Services section: a row per service carrying its
 * name, how long it takes, what it costs, and a **Book** button.
 *
 * ## Every Book button opens the flow with that service already in the basket
 *
 * It used to point at this same page with `?service=<id>#book`, which put the service
 * into the rail's picker and left the customer to choose a stylist there — because
 * `/salon/<id>/book` required a service *and* a stylist and 404'd on a pair
 * `service_staff` did not carry.
 *
 * The flow owns both choices now, so the button goes straight into it:
 * `/salon/<id>/book?service=<id>`. That parameter *seeds* the basket rather than fixing
 * it, so one press is a shortcut and not a commitment — the first step is still the full
 * service list with this one already ticked.
 *
 * The link is the state, not a click handler, and that is the same call this repo makes
 * for the owner calendar's day and view: it survives a reload, it can be shared, and the
 * back button undoes it.
 *
 * ## An unbookable service is listed and says so
 *
 * `bookable` is derived from `service_staff`, not from the service being active — the
 * authority on what can be booked is who performs it. A service nobody performs is still
 * **shown**, because it is genuinely on the salon's price list and a customer ringing up
 * can have it; it just has a note where its button would be. Hiding it would make the web
 * price list quietly shorter than the one on the wall.
 *
 * ## The chips are the gender groups, and only when the data has any
 *
 * Fresha's chips are service categories. This platform has no equivalent to put there:
 * `services.category` is filled on 2 of 33 rows, so a category filter would file
 * everything under "Other" — that is written down in AGENTS.md. What the rows *do* carry
 * is `gender`, which the app already groups by (`_serviceTiles`), so the chips are Women /
 * Men / Unisex and they appear only when at least one service is tagged. 24 of 31 live
 * services have no gender, so on most salons this renders a plain list, which is the same
 * decision the picker makes.
 */

/** Rows shown before "See all" — Fresha shows four, and the fifth is where a list starts scrolling. */
const PREVIEW = 5;

const GENDERS: { value: string; label: string }[] = [
  { value: "female", label: "Women" },
  { value: "male", label: "Men" },
  { value: "unisex", label: "Unisex" },
];

export function SalonServices({
  salonId,
  services,
  staffByService,
  selectedId,
}: {
  salonId: string;
  services: ServiceItem[];
  /** Who performs what, from `service_staff`. */
  staffByService: Record<string, string[]>;
  /** The rail's current service, so the row that produced it reads as chosen. */
  selectedId?: string | null;
}) {
  const [gender, setGender] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (services.length === 0) {
    return <p className="text-body-sm text-muted">No services listed yet.</p>;
  }

  const tagged = services.some((s) => s.gender != null);
  const filtered = gender ? services.filter((s) => s.gender === gender) : services;
  const shown = expanded ? filtered : filtered.slice(0, PREVIEW);

  return (
    <div>
      {tagged ? (
        <div className="mb-base">
          <Carousel label="Service groups" itemGap="gap-sm">
            <li className="shrink-0 snap-start">
              <Chip label="All" selected={gender == null} onClick={() => setGender(null)} />
            </li>
            {GENDERS.filter((g) => services.some((s) => s.gender === g.value)).map((g) => (
              <li key={g.value} className="shrink-0 snap-start">
                <Chip
                  label={g.label}
                  selected={gender === g.value}
                  onClick={() => setGender(gender === g.value ? null : g.value)}
                />
              </li>
            ))}
          </Carousel>
        </div>
      ) : null}

      <ul className="gap-sm flex flex-col">
        {shown.map((s) => {
          const bookable = (staffByService[s.id]?.length ?? 0) > 0;
          const chosen = s.id === selectedId;
          return (
            <li
              key={s.id}
              className={cn(
                "gap-base p-base flex items-center rounded-md border transition-colors duration-[var(--duration-fast)]",
                chosen ? "border-ink bg-paper" : "border-hairline-soft hover:border-hairline",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-title text-ink font-medium">{s.name}</p>
                <p className="text-body-sm text-muted mt-xxs">
                  {formatDuration(s.durationMinutes)}
                </p>
                <p className="text-title text-ink mt-xs font-semibold">{formatNu(s.price)}</p>
              </div>

              {bookable ? (
                <Link
                  // Straight into the flow with this service already in the basket. It
                  // used to be `?service=<id>#book` on this page, which scrolled to the
                  // rail's picker — a step that existed only because the booking route
                  // could not be entered without a stylist as well.
                  href={`/salon/${salonId}/book?service=${s.id}`}
                  aria-label={`Book ${s.name}`}
                  /* A template literal, not `cn`: this string pairs `text-title` with a
                     `text-*` colour, and `cn` is tailwind-merge, which does not know this
                     project's type scale and would delete the size. See the note on `cn`
                     in `lib/utils.ts`. Nothing here needs merging, so nothing is lost. */
                  className={
                    "text-title min-h-11 shrink-0 inline-flex items-center justify-center rounded-full px-5 font-medium transition-colors duration-[var(--duration-fast)] " +
                    (chosen
                      ? "bg-ink text-on-primary"
                      : "border-hairline text-ink hover:bg-surface-soft border")
                  }
                >
                  {chosen ? "Selected" : "Book"}
                </Link>
              ) : (
                /* Not a disabled button: there is nothing to press and nothing to
                   enable it. The sentence is what a customer needs — the salon does
                   this service, just not through this page. */
                <span className="text-caption-sm text-muted max-w-[9rem] shrink-0 text-right">
                  Ask the salon — not bookable online
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {filtered.length > PREVIEW ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="border-hairline text-title text-ink hover:bg-surface-soft mt-base min-h-12 rounded-full border px-5 font-medium"
        >
          {expanded ? "Show less" : `See all ${filtered.length} services`}
        </button>
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-body-sm text-muted">Nothing in this group.</p>
      ) : null}
    </div>
  );
}
