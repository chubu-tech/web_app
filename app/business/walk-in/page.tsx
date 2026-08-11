import type { Metadata } from "next";
import Link from "next/link";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { WalkInForm } from "@/components/owner/walk-in-form";
import { Icons, IconSize } from "@/components/ui/icons";
import { fetchServices, fetchStaff } from "@/lib/api/salon";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";
import { fromIsoDay } from "@/lib/time";

export const metadata: Metadata = { title: "Add walk-in" };

/**
 * Book someone in at the counter.
 *
 * A route rather than a sheet — unlike the queue's Add walk-in, which really is a sheet.
 * This one is a five-part form with a slot grid in it, worth reloading and worth a back
 * button, and the app makes it a full screen for the same reason.
 *
 * `?date=` carries the day the calendar was showing, so the walk-in opens on the day the
 * owner was already looking at. `SlotPicker` clamps it into its own 60-day window, so a
 * stale link cannot land on a day the strip does not contain.
 */
export default async function OwnerWalkInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const raw = await searchParams;
  const dateParam = Array.isArray(raw.date) ? raw.date[0] : raw.date;
  const initialDay =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? fromIsoDay(dateParam) : undefined;

  const supabase = await createClient();
  const [staff, services] = await Promise.all([
    fetchStaff(supabase, active.id),
    fetchServices(supabase, active.id),
  ]);

  return (
    <div className="px-base py-lg gap-lg mx-auto flex w-full max-w-[720px] flex-col tablet:px-lg">
      <Link
        href="/business"
        className="text-title text-muted hover:text-ink gap-xs -ml-1 flex items-center font-medium"
      >
        <Icons.back style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
        Calendar
      </Link>

      <h1 className="text-display-lg text-ink font-medium">Add walk-in</h1>

      <WalkInForm
        businessId={active.id}
        staff={staff}
        services={services}
        initialDay={initialDay}
      />
    </div>
  );
}
