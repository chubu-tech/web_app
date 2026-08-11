"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { HoursEditor } from "@/components/owner/hours-editor";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { setBusinessHours } from "@/lib/api/owner-setup";
import { weekFromWorkingHours, weekHasErrors, weekToPayload, type WeekHours } from "@/lib/hours";
import { createClient } from "@/lib/supabase/client";
import type { WorkingHour } from "@/lib/types/booking";
import type { StaffMember } from "@/lib/types/salon";

/**
 * Edit when the shop is open.
 *
 * **Two writes, in an order chosen for what a failure leaves behind.** `setBusinessHours`
 * upserts everything kept or changed, then deletes what is gone. There is no RPC for this
 * table, so a delete-then-insert was the alternative — and its failure state is a salon with
 * *no* hours, which every customer-facing surface renders as closed all week. This way a
 * half-failed save leaves the salon too open, which is visible and re-savable.
 *
 * **Clearing a day deletes its rows**, because a missing row is the only way this table says
 * "closed" — there is no flag, and Norzin's absent Sunday is exactly that today.
 *
 * The scope note is not hedging. These hours are display and reporting; a stylist's hours are
 * the booking gate. An owner who adds Sunday here and takes no Sunday bookings needs to know
 * where to look, and this is the only screen that can tell them.
 */
export function SalonHoursForm({
  businessId,
  hours,
  staff,
}: {
  businessId: string;
  hours: WorkingHour[];
  staff: StaffMember[];
}) {
  const router = useRouter();
  const [week, setWeek] = useState<WeekHours>(() => weekFromWorkingHours(hours));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (weekHasErrors(week)) {
      toast.error("Fix the overlapping hours before saving.");
      return;
    }
    setSaving(true);
    try {
      await setBusinessHours(createClient(), businessId, weekToPayload(week), hours);
      toast.success("Opening hours saved.");
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("saveSalonHours", caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <Link
        href="/business/settings"
        className="text-caption text-rausch-cta gap-xs mb-sm inline-flex items-center font-medium"
      >
        <Icons.back style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
        Settings
      </Link>
      <SectionHeader title="Opening hours" as="h1" />
      <p className="text-body-sm text-muted mb-base">
        Shown on your salon page, and used to work out how full each day is. Split a day to
        close over lunch. A day with nothing switched on reads as closed.
      </p>

      <div className="border-hairline-soft bg-surface-soft p-base mb-lg gap-sm flex items-start rounded-md border">
        <Icons.info
          className="text-muted mt-0.5 shrink-0"
          style={{ width: IconSize.xs, height: IconSize.xs }}
          aria-hidden
        />
        <p className="text-body-sm text-muted">
          These hours don&apos;t decide what can be booked — each stylist&apos;s own working
          hours do that.{" "}
          {staff.length > 0 ? (
            <Link href={`/business/staff/${staff[0]!.id}`} className="text-rausch-cta font-medium">
              Set {staff[0]!.displayName}&apos;s hours
            </Link>
          ) : (
            <Link href="/business/staff" className="text-rausch-cta font-medium">
              Add a stylist first
            </Link>
          )}
          .
        </p>
      </div>

      <HoursEditor week={week} onChange={setWeek} />

      <div className="mt-xl">
        <Button fullWidth busy={saving} onClick={() => void save()}>
          Save opening hours
        </Button>
      </div>
    </div>
  );
}
