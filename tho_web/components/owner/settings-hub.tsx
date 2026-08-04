import Link from "next/link";
import { SETUP_DESTINATIONS } from "@/components/owner/destinations";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { DAY_NAMES, openWeekdaysFrom } from "@/lib/hours";
import type { WorkingHour } from "@/lib/types/booking";
import type { Business, ServiceItem, StaffMember } from "@/lib/types/salon";

/**
 * The four setup destinations, each with the state of the thing it leads to.
 *
 * A server component: it renders four links and some counting, and nothing here is
 * interactive. The state lines are the whole point — an owner opening Settings wants to know
 * *whether* anything needs doing before deciding where to go.
 *
 * Two of the lines say something no other screen does:
 *
 * - **"2 stylists have no hours"** — a stylist with no `staff_working_hours` rows cannot be
 *   booked at all, because `is_bookable_window` needs a row the booking fits inside. It is
 *   the single most likely reason a salon believes the booking flow is broken.
 * - **"Not on the map"** — `lat`/`lng` decide whether the salon appears on `/map` and
 *   whether any distance can be shown. Eight of the nine seeded salons are pinned; a new one
 *   is not, and nothing else prompts for it.
 */
export function SettingsHub({
  business,
  services,
  staff,
  hours,
  staffWithoutHours,
}: {
  business: Business;
  services: ServiceItem[];
  staff: StaffMember[];
  hours: WorkingHour[];
  staffWithoutHours: number;
}) {
  const state: Record<string, string> = {
    "/business/settings/salon": salonLine(business),
    "/business/hours": hoursLine(hours),
    "/business/services": servicesLine(services),
    "/business/staff": staffLine(staff, staffWithoutHours),
  };

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[1128px] tablet:px-lg">
      <SectionHeader title="Set up your salon" as="h1" />
      <p className="text-body-sm text-muted mb-lg">
        What customers see, and what the booking engine works from.
      </p>

      <ul className="gap-md grid tablet:grid-cols-2">
        {SETUP_DESTINATIONS.map((d) => {
          const Icon = d.icon;
          return (
            <li key={d.href}>
              <Link
                href={d.href}
                className="border-hairline-soft p-base gap-base hover:bg-surface-soft flex items-start rounded-md border"
              >
                <span className="bg-surface-soft text-ink grid size-11 shrink-0 place-items-center rounded-sm">
                  <Icon style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-title text-ink block font-medium">{d.label}</span>
                  <span className="text-body-sm text-muted block">{d.blurb}</span>
                  <span className="text-caption text-ink mt-xs block font-medium">
                    {state[d.href]}
                  </span>
                </span>
                <Icons.chevronRight
                  className="text-muted-soft mt-xs shrink-0"
                  style={{ width: IconSize.sm, height: IconSize.sm }}
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="text-caption-sm text-muted mt-lg">
        Insights, messages and your plan arrive next. Everything here is shared with the phone
        app — the same salon, the same numbers.
      </p>
    </div>
  );
}

function salonLine(b: Business): string {
  const bits: string[] = [];
  bits.push(b.addressText?.trim() ? b.addressText.trim() : "No address yet");
  if (b.lat == null || b.lng == null) bits.push("not on the map");
  if (!b.coverUrl) bits.push("no cover photo");
  return bits.join(" · ");
}

/**
 * "Open Mon–Sat" is tempting and wrong: the days a salon opens are not always a run, and a
 * salon closed on Wednesday would read as open. So the open days are named, and a closed day
 * is what a missing `business_hours` row means — the table has no flag for it.
 */
function hoursLine(hours: WorkingHour[]): string {
  if (hours.length === 0) return "No opening hours set";
  const open = openWeekdaysFrom(hours);
  const names = [...open].sort((a, b) => a - b).map((d) => DAY_NAMES[d]!.slice(0, 3));
  const closed = [0, 1, 2, 3, 4, 5, 6].filter((d) => !open.has(d));
  if (closed.length === 0) return "Open every day";
  return `Open ${names.join(", ")} · closed ${closed.map((d) => DAY_NAMES[d]!.slice(0, 3)).join(", ")}`;
}

function servicesLine(services: ServiceItem[]): string {
  if (services.length === 0) return "Nothing on the menu yet";
  const live = services.filter((s) => s.isActive).length;
  const off = services.length - live;
  const head = `${live} ${live === 1 ? "service" : "services"}`;
  return off > 0 ? `${head} · ${off} switched off` : head;
}

function staffLine(staff: StaffMember[], withoutHours: number): string {
  const live = staff.filter((s) => s.isActive).length;
  if (live === 0) return "Nobody on the team yet";
  const head = `${live} ${live === 1 ? "stylist" : "stylists"}`;
  if (withoutHours === 0) return head;
  return `${head} · ${withoutHours} with no hours, so they can't be booked`;
}
