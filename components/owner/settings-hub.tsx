import Link from "next/link";
import { DeleteAccountCard } from "@/components/auth/delete-account";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { rowIcon } from "@/components/owner/destinations";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { DAY_NAMES, openWeekdaysFrom } from "@/lib/hours";
import { BACK_OFFICE_ROWS, SETUP_ROWS, tierNoteFor, type OwnerRow } from "@/lib/owner/destinations";
import type { WorkingHour } from "@/lib/types/booking";
import type { LoyaltyProgram, LoyaltyReward } from "@/lib/types/back-office";
import type { Business, Product, ServiceItem, StaffMember } from "@/lib/types/salon";
import { planTierFor } from "@/lib/plans";

/**
 * Everything an owner can reach that isn't a tab, in two groups, each row carrying the state
 * of the thing it leads to.
 *
 * A server component: it renders links and some counting, and nothing here is interactive.
 * The state lines are the whole point — an owner opening Settings wants to know *whether*
 * anything needs doing before deciding where to go.
 *
 * **Two groups rather than one list of twelve.** Setup is what you finish once and leave for
 * weeks; the back office is what you come back to. The app draws the same split with a tab and a
 * drawer, and lumping them together would bury "1 new order" among address fields.
 *
 * Four of the lines say something no other screen does:
 *
 * - **"2 stylists have no hours"** — a stylist with no `staff_working_hours` rows cannot be
 *   booked at all, because `is_bookable_window` needs a row the booking fits inside. It is
 *   the single most likely reason a salon believes the booking flow is broken.
 * - **"Not on the map"** — `lat`/`lng` decide whether the salon appears on `/map` and
 *   whether any distance can be shown. Eight of the nine seeded salons are pinned; a new one
 *   is not, and nothing else prompts for it.
 * - **"1 new order"** — somebody is waiting, and the only other place that says so is the
 *   Insights card.
 * - **"3 requests pending"** — this salon has asked to move tier and nothing has happened.
 *   Because a request can never be withdrawn, an owner who has forgotten would otherwise ask
 *   again and file a duplicate that also cannot be withdrawn.
 */
export function SettingsHub({
  business,
  services,
  staff,
  hours,
  staffWithoutHours,
  clientCount,
  newOrderCount,
  products,
  offerCount,
  liveOfferCount,
  loyaltyProgram,
  loyaltyRewards,
  pendingPlanRequests,
  qrReady,
  qrTotal,
}: {
  business: Business;
  services: ServiceItem[];
  staff: StaffMember[];
  hours: WorkingHour[];
  staffWithoutHours: number;
  /** Null when the client book is locked — a locked row states the plan, not a count. */
  clientCount: number | null;
  newOrderCount: number | null;
  products: Product[] | null;
  offerCount: number;
  liveOfferCount: number;
  loyaltyProgram: LoyaltyProgram | null;
  loyaltyRewards: LoyaltyReward[] | null;
  pendingPlanRequests: number;
  /** How many of the owner's salons have a printable QR, and how many there are. */
  qrReady: number;
  qrTotal: number;
}) {
  /*
    What each row says about itself today.

    **Only the unlocked case is written here.** A locked row's line is `tierNoteFor`, derived from
    the row's own `feature`, so the tier named on the row and the tier that unlocks the screen
    behind it are one fact rather than two strings. This used to be inferred from a null count
    handed down by the page and the tier written out by hand at four rows — a rule expressed four
    times, in a component nothing can test, which is how "Product orders" went gated-but-unmarked
    upstream.
  */
  const state: Record<string, string> = {
    "/business/settings/salon": salonLine(business),
    "/business/hours": hoursLine(hours),
    "/business/services": servicesLine(services),
    "/business/staff": staffLine(staff, staffWithoutHours),
<<<<<<< HEAD
    "/business/clients": clientCount == null ? "" : clientsLine(clientCount),
    "/business/orders": newOrderCount == null ? "" : ordersLine(newOrderCount),
    "/business/products": products == null ? "" : productsLine(products),
=======
    // The one row here that is not about the active salon — the page covers the whole
    // estate, so the count does too.
    "/business/qr": qrLine(qrReady, qrTotal),
  };

  const backOfficeState: Record<string, string> = {
    "/business/clients": clientCount == null ? locked("Growth") : clientsLine(clientCount),
    "/business/orders": newOrderCount == null ? locked("Growth") : ordersLine(newOrderCount),
    "/business/products": products == null ? locked("Growth") : productsLine(products),
>>>>>>> c67eb6b8491c7e8a01a1c510d39504e66ac7bef3
    "/business/offers": offersLine(offerCount, liveOfferCount),
    "/business/loyalty":
      loyaltyRewards == null ? "" : loyaltyLine(loyaltyProgram, loyaltyRewards),
    "/business/payroll": "Commission and base pay, month by month",
    "/business/tax": "Turnover and estimated income tax",
    "/business/plans": planLine(business, pendingPlanRequests),
  };

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[1128px] tablet:px-lg">
      <SectionHeader title="Set up your salon" as="h1" />
      <p className="text-body-sm text-muted mb-lg">
        What customers see, and what the booking engine works from.
      </p>

      <Rows rows={SETUP_ROWS} state={state} plan={business.plan} />

      <div className="mt-xl">
        <SectionHeader title="Run the business" />
        <p className="text-body-sm text-muted mb-lg">
          Your clients, your shop, your numbers and your plan.
        </p>
        <Rows rows={BACK_OFFICE_ROWS} state={state} plan={business.plan} />
      </div>

      <p className="text-caption-sm text-muted mt-lg">
        Everything here is shared with the phone app — the same salon, the same numbers.
      </p>

      {/*
        The way out, and from 1024 up the *only* way out.

        The console's collapse panel used to carry sign-out at every width. It now exists only
        below 1024, where the hamburger that opens it does — so without this an owner on a
        desktop would be back to the defect the panel was added to fix: no reachable sign-out
        anywhere in the console, the salon switcher included.

        At the bottom, under a rule and its own heading, because a session control is not a
        setting: it does not belong in either group above, and a red button among the rows an
        owner clicks all day is a mis-click waiting to happen. `fullWidth` off for the same
        reason — a full-bleed red bar reads as the page's primary action.
      */}
      <div className="border-hairline-soft mt-xl pt-lg border-t">
        <SectionHeader title="Account" />
        <p className="text-body-sm text-muted mb-base">
          Signing out ends the session on this device and forgets which salon you were
          looking at. Your salon, your bookings and your team are untouched.
        </p>
        <SignOutButton label="Log out" fullWidth={false} destructive />

        {/* The owner's own account, same sheet as the customer's. `delete_account` raises
            `P0001` naming how many salons they still own, so an owner with a live salon
            is refused in the server's own words rather than by a guess made here. */}
        <DeleteAccountCard />
      </div>
    </div>
  );
}

function Rows({
  rows,
  state,
  plan,
}: {
  rows: readonly OwnerRow[];
  state: Record<string, string>;
  plan: string;
}) {
  return (
    <ul className="gap-md grid tablet:grid-cols-2">
      {rows.map((d) => {
        const Icon = rowIcon(d.icon);
        // The tier note wins over the state line, and there is never both: a locked row has
        // nothing to count yet, and naming the tier is the more useful of the two things it
        // could say. The row stays a live link either way — the note is a courtesy, and the
        // server is the authority.
        const note = tierNoteFor(d, plan);
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
                  {note ?? state[d.href]}
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
  );
}

<<<<<<< HEAD
=======
/** A locked row states the tier rather than a count — there is nothing to count yet. */
/**
 * "3 of 9 ready to print" — and the blocked ones are the useful half of that sentence,
 * since a salon without a walk-in queue cannot have a poster at all.
 */
function qrLine(ready: number, total: number): string {
  if (total === 0) return "A poster for each salon's counter";
  if (ready === 0) return `No posters yet \u2014 ${total === 1 ? "this salon is" : "these salons are"} not approved yet`;
  if (ready === total) return `${ready} ${ready === 1 ? "poster" : "posters"} ready to print`;
  return `${ready} of ${total} ready to print`;
}

function locked(tier: string): string {
  return `${tier} plan and up`;
}

>>>>>>> c67eb6b8491c7e8a01a1c510d39504e66ac7bef3
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

function clientsLine(count: number): string {
  if (count === 0) return "Nobody in the book yet";
  return `${count} ${count === 1 ? "client" : "clients"}`;
}

function ordersLine(newCount: number): string {
  if (newCount === 0) return "Nothing waiting";
  return `${newCount} new — ${newCount === 1 ? "someone is" : "people are"} waiting`;
}

function productsLine(products: Product[]): string {
  if (products.length === 0) return "Nothing for sale yet";
  const out = products.filter((p) => !p.inStock).length;
  const head = `${products.length} ${products.length === 1 ? "product" : "products"}`;
  return out > 0 ? `${head} · ${out} sold out` : head;
}

/**
 * Live and total are different numbers and both matter: a salon with three offers, none of them
 * running, has nothing on its page and would otherwise read as busy.
 */
function offersLine(total: number, live: number): string {
  if (total === 0) return "None running";
  if (live === 0) return `${total} ${total === 1 ? "offer" : "offers"} · none live`;
  if (live === total) return `${live} live`;
  return `${live} live of ${total}`;
}

function loyaltyLine(
  program: LoyaltyProgram | null,
  rewards: LoyaltyReward[],
): string {
  if (program == null) return "Not set up yet";
  const live = rewards.filter((r) => r.isActive).length;
  const state = program.isActive ? "On" : "Off";
  if (rewards.length === 0) return `${state} · no rewards yet`;
  return `${state} · ${live} ${live === 1 ? "reward" : "rewards"}`;
}

function planLine(business: Business, pending: number): string {
  const name = planTierFor(business.plan).name;
  if (pending === 0) return `${name} · ${planTierFor(business.plan).priceLabel}`;
  return `${name} · ${pending} ${pending === 1 ? "request" : "requests"} pending`;
}
