"use client";

import { Avatar } from "@/components/ui/avatar";
import { Icons, IconSize } from "@/components/ui/icons";
import type { StaffMember } from "@/lib/types/salon";
import { cn } from "@/lib/utils";

/** The sentinel `?staff=` value for "whoever is free". Not a real staff id. */
export const ANY_STAFF = "any";

/**
 * Step 2 — **Select professional**.
 *
 * The list is `eligibleStaff`, i.e. only stylists who perform **every** service in the
 * basket. That is an intersection and it is load-bearing: `create_booking` and
 * `compute_availability` both raise on a pair that is not in `service_staff`, so offering
 * a stylist who does three of four selected services builds an appointment the server can
 * only refuse. On live data Norzin lists five services and its stylists perform three, so
 * the empty case is reachable and says which service caused it.
 *
 * ## "Any professional" is a real option, not a label
 *
 * There is no RPC that answers *"when is anyone free"* — `compute_availability` takes one
 * stylist — so choosing this fans the availability call out across the eligible list and
 * unions the results, then names one of them at confirm time. See `use-availability.ts`.
 *
 * It is offered even with a single eligible stylist, and that is deliberate: it still
 * means "I don't mind", and hiding it would make the step look like it had one answer
 * when the answer is the *same* either way. It is placed first, as Fresha does, because
 * it is the option that yields the most times.
 */
export function BookingProfessionalStep({
  staff,
  selectedId,
  onSelect,
  blockedServiceNames,
}: {
  /** Already intersected — see `eligibleStaff`. */
  staff: StaffMember[];
  /** A staff id, `ANY_STAFF`, or null. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  /**
   * The services that emptied the list, when it is empty. Named rather than counted:
   * "no stylist here does both of those" is not actionable without knowing which.
   */
  blockedServiceNames: string[];
}) {
  if (staff.length === 0) {
    return (
      <div className="border-hairline-soft bg-paper p-lg rounded-lg border">
        <p className="text-title text-ink font-medium">
          No one here performs all of those together
        </p>
        <p className="text-body-sm text-muted mt-xs">
          {blockedServiceNames.length > 0
            ? `Go back and remove ${listOut(blockedServiceNames)} — or book them as a separate appointment.`
            : "Go back and choose fewer services, or book them as separate appointments."}
        </p>
      </div>
    );
  }

  return (
    <ul className="gap-md flex flex-col">
      <li>
        <Row
          selected={selectedId === ANY_STAFF}
          onSelect={() => onSelect(ANY_STAFF)}
          title="Any professional"
          subtitle="Maximum availability"
          media={
            <span className="bg-rausch/10 grid size-11 place-items-center rounded-full">
              <Icons.people
                className="text-rausch-cta"
                style={{ width: IconSize.sm, height: IconSize.sm }}
                aria-hidden
              />
            </span>
          }
        />
      </li>
      {staff.map((member) => (
        <li key={member.id}>
          <Row
            selected={selectedId === member.id}
            onSelect={() => onSelect(member.id)}
            title={member.displayName}
            subtitle={member.role}
            media={<Avatar name={member.displayName} photoUrl={member.photoUrl} size={44} />}
          />
        </li>
      ))}
    </ul>
  );
}

/** "A", "A and B", "A, B and C" — an Oxford-free list, matching the app's copy. */
function listOut(names: string[]): string {
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function Row({
  selected,
  onSelect,
  title,
  subtitle,
  media,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  media: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "p-base gap-base flex w-full items-center rounded-lg border text-left",
        "transition-colors duration-[var(--duration-fast)]",
        selected
          ? "border-rausch-cta bg-paper"
          : "border-hairline-soft bg-paper hover:border-border-strong",
      )}
    >
      <span className="shrink-0">{media}</span>
      <span className="min-w-0 flex-1">
        <span className="text-title text-ink block font-medium">{title}</span>
        <span className="text-body-sm text-muted block truncate">{subtitle}</span>
      </span>

      {/* The pill turns into a tick, which is what the pressed state looks like on
          Fresha. `aria-hidden` because `aria-pressed` on the row already says it, and a
          second announcement of the same fact is noise. */}
      <span
        aria-hidden
        className={cn(
          "shrink-0 rounded-full text-center font-medium transition-colors duration-[var(--duration-fast)]",
          selected
            ? "bg-rausch-cta text-on-primary grid size-11 place-items-center"
            : "border-hairline text-ink text-title px-lg min-h-11 border leading-[2.75rem]",
        )}
      >
        {selected ? (
          <Icons.check style={{ width: IconSize.sm, height: IconSize.sm }} />
        ) : (
          "Select"
        )}
      </span>
    </button>
  );
}
