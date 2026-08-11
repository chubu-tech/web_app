import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { StaffEditor } from "@/components/owner/staff-editor";
import { fetchPendingInvite } from "@/lib/api/staff-invites";
import { fetchBusinessHours } from "@/lib/api/discovery";
import { fetchBusinessBookings } from "@/lib/api/owner";
import {
  fetchStaffPhotoRows,
  fetchStaffServiceIds,
  fetchStaffWorkingHours,
} from "@/lib/api/owner-setup";
import { fetchPayroll } from "@/lib/api/owner-back-office";
import { fetchServices, fetchStaff } from "@/lib/api/salon";
import { hasFeature } from "@/lib/entitlements";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";
import { thimphuToday } from "@/lib/time";

export const metadata: Metadata = { title: "Edit staff" };

/**
 * One stylist — a port of `staff_edit_screen.dart`.
 *
 * **The stylist is found in the active salon's roster, not read by id.** `staff_select` is
 * public for any active stylist of any live salon, so a plain `.eq("id", …)` would happily
 * return someone else's employee and render an editor whose every write then failed on RLS.
 * The same ownership check `/business/bookings/[id]` makes, and for the same reason.
 *
 * **Six reads, one round trip.** `staff_working_hours` and `service_staff` are what the
 * editor writes; `services` is the checkbox list; `business_hours` decides which weekdays
 * render editable (guidance only — `compute_availability` never consults it); the salon's
 * upcoming bookings are what the conflict warning counts. The bookings read covers 60 days
 * from now, exactly as `_conflictingBookings` does, and is filtered to this stylist here so
 * the client holds only what it needs.
 */
export default async function OwnerStaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const supabase = await createClient();
  // This route used to answer `notFound()` for **every** stylist, and nothing here was
  // wrong: `fetchStaff` named `*` on a table no client role holds table-level SELECT on,
  // swallowed the 42501, returned `[]`, and the `find` below missed. See `fetchStaff` for
  // why the pay columns cannot be part of that read even for an owner.
  const roster = await fetchStaff(supabase, active.id, { activeOnly: false });
  const member = roster.find((s) => s.id === id);
  if (!member) notFound();

  /**
   * Active stylists **other than this one** — what the Basic cap is measured against.
   *
   * Excluding the row being edited is the whole subtlety: counting it would make an already-
   * active stylist look like they had used up the salon's own allowance, so the Active
   * checkbox would lock the moment somebody opened the only stylist they have. The cap stops
   * a *new* active stylist, never an existing one.
   *
   * Free here — the roster is already loaded to find the member.
   */
  const otherActiveCount = roster.filter((s) => s.isActive && s.id !== member.id).length;

  const now = new Date();
  const in60Days = new Date(now.getTime() + 60 * 86_400_000);

  /**
   * This stylist's stored pay, and the **only** way a client can see it.
   *
   * `staff_members.commission_pct` and `base_salary_nu` are outside every client role's SELECT
   * privilege, so `fetchStaff` above cannot return them and `toStaffMember` substitutes 0 — which
   * meant the editor's pay inputs opened at 0 on a Pro salon and Save wrote that 0 over a real
   * salary. `payroll_report` is `SECURITY DEFINER`, so it reads both columns; the app re-reads
   * them the same way after `16e13d6` dropped them from its own projection.
   *
   * **Read only when the plan allows it.** The RPC raises `P0001 'payroll requires Pro'`
   * otherwise, and no live salon is Pro — so on every real salon this is skipped entirely and the
   * pay block renders its locked card, which is the same condition. Asking anyway would be one
   * guaranteed refusal per page load.
   *
   * The window is the current Thimphu month. It scopes the *aggregates* — completed bookings and
   * revenue — which nothing here reads; `commission_pct` and `base_salary_nu` come straight off
   * the row and are the same in any window. A natural month rather than an empty range so the
   * call is one a person would recognise in a log.
   */
  const payWindowStart = new Date(
    Date.UTC(thimphuToday().getUTCFullYear(), thimphuToday().getUTCMonth(), 1),
  );
  const payWindowEnd = new Date(
    Date.UTC(thimphuToday().getUTCFullYear(), thimphuToday().getUTCMonth() + 1, 1),
  );
  const storedPay = hasFeature(active.plan, "commissions")
    ? await fetchPayroll(supabase, active.id, payWindowStart, payWindowEnd)
        .then((rows) => {
          const row = rows.find((r) => r.staffMemberId === id);
          return row
            ? { commissionPct: row.commissionPct, baseSalaryNu: row.baseSalaryNu }
            : null;
        })
        // A failure must not take the editor down, and must not become a zero either: null
        // leaves the inputs at what the type says rather than inventing a salary.
        .catch(() => null)
    : null;

  const [services, serviceIds, hours, photos, salonHours, bookings, pendingInvite] =
    await Promise.all([
      fetchServices(supabase, active.id, { activeOnly: false }),
      fetchStaffServiceIds(supabase, id),
      fetchStaffWorkingHours(supabase, id),
      fetchStaffPhotoRows(supabase, id),
      // Its own failure must not blank the screen: it only greys weekdays out, so an
      // empty array means "every day editable", which is what `openWeekdaysFrom` already
      // does for an unseeded salon.
      fetchBusinessHours(supabase, active.id).catch(() => []),
      fetchBusinessBookings(supabase, active.id, { from: now, to: in60Days }).catch(
        () => [],
      ),
      // An outstanding invitation to this chair, if any. Failing to read it costs the
      // pending card and nothing else — the form below it still works, and re-sending is
      // safe because the RPC revokes any previous invite itself.
      fetchPendingInvite(supabase, id).catch(() => null),
    ]);

  return (
    <StaffEditor
      business={active}
      member={member}
      otherActiveCount={otherActiveCount}
      services={services}
      initialServiceIds={serviceIds}
      initialHours={hours}
      salonHours={salonHours}
      photos={photos}
      upcoming={bookings.filter((b) => b.staffMemberId === id)}
      pendingInvite={pendingInvite}
      storedPay={storedPay}
    />
  );
}
