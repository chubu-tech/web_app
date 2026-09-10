"use client";

import Link from "next/link";
import { useState } from "react";
import { Chip } from "@/components/ui/chip";
import { Carousel } from "@/components/ui/carousel";
import { serviceCategories } from "@/lib/booking-basket";
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
 * ## The chips are gender AND category, each only when the data has any
 *
 * Fresha's chips are service categories, and until `20260910000001` this platform had no
 * equivalent to put there: `services.category` was a closed set of seven filled on 2 of 33
 * rows, so a category filter would have filed everything under "Other". An owner names
 * their own groups now, and a full salon menu carries a dozen of them — Xpress's runs from
 * Hair Care Services to Body Massage — so the category row is back, gated on the salon
 * having at least two real groups (`serviceCategories`). A single chip is a label, not a
 * filter.
 *
 * The gender row is the one this page has always had, kept for the same reason: `gender` is
 * what the app groups by (`_serviceTiles`), and it appears only when at least one service
 * is tagged.
 *
 * ## And the rows carry their group's heading
 *
 * A hundred-row price list needs both — the chips to jump, the headings to read. The
 * headings are dropped while a category chip is selected: a heading over a list that is
 * already only that category is repeating the chip, and one over a *subset* claims to be
 * the group and isn't. Order is the salon's own (`category_sort`), so this reads in the
 * order the owner built the menu.
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
  const [category, setCategory] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (services.length === 0) {
    // Says what to do about it rather than only what is absent. Six of the eighteen live
    // salons are in this state, so it is an ordinary case and not an edge one.
    return (
      <p className="text-body-sm text-muted">
        This salon hasn&apos;t put its menu up yet. Give them a call and they&apos;ll tell you
        what they do.
      </p>
    );
  }

  const tagged = services.some((s) => s.gender != null);
  /*
    Gender first, then category — the same order and the same reason as the booking flow's
    step: the category chips are built from the whole menu, so narrowing by category first
    could leave a selected chip showing an empty list.
  */
  const byGender = gender ? services.filter((s) => s.gender === gender) : services;
  const categories = serviceCategories(services);
  const filtered = category
    ? byGender.filter((s) => s.category?.trim() === category)
    : byGender;
  const shown = expanded ? filtered : filtered.slice(0, PREVIEW);

  /** What `shown` is laid out as: one flat run, or a run per heading in the salon's order. */
  const groups: { heading: string | null; rows: ServiceItem[] }[] =
    category != null || categories.length === 0
      ? [{ heading: null, rows: shown }]
      : [
          ...categories.map((heading) => ({
            heading,
            rows: shown.filter((s) => s.category?.trim() === heading),
          })),
          { heading: null, rows: shown.filter((s) => !s.category?.trim()) },
        ].filter((group) => group.rows.length > 0);

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

      {categories.length > 0 ? (
        <div className="mb-base">
          <Carousel label="Service categories" itemGap="gap-sm">
            <li className="shrink-0 snap-start">
              <Chip
                label="All"
                selected={category == null}
                onClick={() => setCategory(null)}
              />
            </li>
            {categories.map((c) => (
              <li key={c} className="shrink-0 snap-start">
                <Chip
                  label={c}
                  selected={category === c}
                  // Tapping the selected chip widens back to the whole menu, which is the
                  // same gesture the gender row above uses.
                  onClick={() => setCategory(category === c ? null : c)}
                />
              </li>
            ))}
          </Carousel>
        </div>
      ) : null}

      {groups.map((group) => (
        <section
          key={group.heading === null ? "__unfiled__" : `named:${group.heading}`}
          className="mb-base"
        >
          {/* Quiet and small: it groups rows, it does not compete with the salon's name or
              the tab above it. Suppressed when there is only one run — a lone heading over
              the whole list is a label, not a grouping. */}
          {group.heading !== null && groups.length > 1 ? (
            <h3 className="text-caption text-muted mb-xs font-semibold tracking-wide uppercase">
              {group.heading}
            </h3>
          ) : null}
          <ul className="gap-sm flex flex-col">
            {group.rows.map((s) => {
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
                    {/* Clamped rather than truncated at a character count: an owner writes as much
                        as they like and the row must stay a row. */}
                    {s.description ? (
                      <p className="text-caption-sm text-muted-soft mt-xxs line-clamp-2">
                        {s.description}
                      </p>
                    ) : null}
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
        </section>
      ))}

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
