import type { Metadata } from "next";
import { NotLinked } from "@/components/staff/not-linked";
import { Avatar } from "@/components/ui/avatar";
import { PhotoStrip } from "@/components/ui/photo-gallery";
import { SectionHeader } from "@/components/ui/section-header";
import { fetchStaffPhotos } from "@/lib/api/staff";
import { fetchStaffWorkingHours } from "@/lib/api/owner-setup";
import { DAY_NAMES } from "@/lib/hours";
import { getStaffContext } from "@/lib/staff/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your schedule" };

/** `staff_working_hours.start_time` arrives as Postgres `time` — `09:00:00`. */
function hm(time: string): string {
  return time.slice(0, 5);
}

/**
 * A stylist's own profile, hours and portfolio — a port of `StaffScheduleTab`
 * (`staff/staff_home.dart:203`).
 *
 * **Read-only, deliberately, and it is the app's rule not a shortcut.** `staff_working_hours`
 * is written by `set_staff_working_hours`, and `20260805000001` narrowed what a staff row
 * accepts to `display_name`, `is_active`, `photo_url` and `updated_at` — none of which a
 * stylist may set for themselves either, because the UPDATE grant is gated on
 * `is_business_owner`. So the empty state names the person who can change it ("Ask your
 * manager") rather than offering an editor that would be refused with a `42501`.
 *
 * **These are the hours that gate bookings.** `private.is_bookable_window` reads
 * `staff_working_hours` and never `business_hours`, so what this page shows is exactly what
 * `compute_availability` will let a customer book — which is why a stylist reading it needs it
 * to be their own row and not the salon's opening times.
 *
 * `fetchStaffWorkingHours` is reused from the owner's stylist editor rather than duplicated;
 * `staff_working_hours_select` admits a business member, and a linked stylist is one.
 */
export default async function StaffSchedulePage() {
  const { me } = await getStaffContext();
  if (!me) return <NotLinked />;

  const supabase = await createClient();
  const [hours, photos] = await Promise.all([
    fetchStaffWorkingHours(supabase, me.id),
    fetchStaffPhotos(supabase, me.id),
  ]);

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <div className="gap-sm mb-xl flex flex-col items-center">
        <Avatar name={me.displayName} photoUrl={me.photoUrl} size={88} />
        <h1 className="text-display-md text-ink font-medium">{me.displayName}</h1>
      </div>

      <SectionHeader title="Weekly schedule" />
      {hours.length === 0 ? (
        <p className="text-body-sm text-muted">
          No hours set. Ask your manager to set your working hours.
        </p>
      ) : (
        <ul className="gap-sm flex flex-col">
          {/* Sorted by day because the read is ordered by `day_of_week` then start, and a
              stylist with a split shift has two rows for one day — which should read as two
              lines under the same name, not as two unrelated days. */}
          {hours.map((h) => (
            <li
              key={h.id}
              className="border-hairline px-base py-md gap-base flex items-center rounded-sm border"
            >
              <span className="text-title text-ink w-24 shrink-0 font-medium">
                {DAY_NAMES[h.dayOfWeek]}
              </span>
              <span className="text-body-md text-body tabular-nums">
                {hm(h.startTime)} – {hm(h.endTime)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {photos.length > 0 ? (
        <div className="mt-xl">
          <SectionHeader title="Your portfolio" />
          <PhotoStrip urls={photos} />
        </div>
      ) : null}
    </div>
  );
}
