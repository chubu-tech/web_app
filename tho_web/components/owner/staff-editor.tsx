"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { HoursEditor } from "@/components/owner/hours-editor";
import { StaffLinkCard } from "@/components/owner/staff-link-card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { Sheet } from "@/components/ui/sheet";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import type { PendingInvite } from "@/lib/api/staff-invites";
import {
  addStaffPhoto,
  deleteStaffPhoto,
  fetchStaffPhotoRows,
  setStaffPay,
  setStaffServices,
  setStaffWorkingHours,
  updateStaff,
  uploadOwnerImage,
} from "@/lib/api/owner-setup";
import { hasFeature, maxActiveStylists } from "@/lib/entitlements";
import {
  bookingsOutsideHours,
  openWeekdaysFrom,
  weekFromWorkingHours,
  weekHasErrors,
  weekToPayload,
  type WeekHours,
} from "@/lib/hours";
import { downscaleImage, imageRejection, releasePreview } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import type { Booking, WorkingHour } from "@/lib/types/booking";
import type { Business, BusinessPhoto, ServiceItem, StaffMember } from "@/lib/types/salon";
import { cn, formatDuration, formatNu } from "@/lib/utils";

/**
 * Everything about one stylist — a port of `staff_edit_screen.dart`.
 *
 * **The save order is the app's, and it is deliberate.** Hours first: it is the only write
 * here with real server-side validation (`set_staff_working_hours` rejects overlaps, inverted
 * intervals and malformed JSON), so the write most likely to fail leaves the database
 * untouched rather than half-saved. Then the row, then services, then pay.
 *
 * **The conflict warning exists because changing hours cannot retroactively invalidate a
 * booking.** `is_bookable_window` runs at create and reschedule time only, so without a
 * warning an owner can save a lunch break straight across a confirmed appointment and never
 * know. It is advisory — the count is computed from data already on the page, and Save anyway
 * is a real option, because the booking does stay booked.
 *
 * **Photo and hours writes are separate concerns from Save.** A picked photo uploads
 * immediately (the URL is what the row stores) and portfolio photos write on add and remove,
 * because both are complete acts on their own. Name, active, services, hours and pay wait for
 * Save.
 */
export function StaffEditor({
  business,
  member,
  services,
  initialServiceIds,
  initialHours,
  salonHours,
  photos: initialPhotos,
  upcoming,
  pendingInvite,
  storedPay,
  otherActiveCount,
}: {
  business: Business;
  member: StaffMember;
  /**
   * How many **other** stylists at this salon are active.
   *
   * Needed to check the Basic cap before flipping Active on, and counted on the server
   * because this editor only ever loads one staff row. Since
   * `20260807000004_basic_stylist_cap` the cap is a real trigger raising `P0001` on an
   * inactive → active update, so without this the checkbox offers a write that can only be
   * refused — and until `owner-errors.ts` grew a case for it, refused as *"please try
   * again"*.
   */
  otherActiveCount: number;
  services: ServiceItem[];
  initialServiceIds: string[];
  initialHours: WorkingHour[];
  salonHours: WorkingHour[];
  photos: BusinessPhoto[];
  upcoming: Booking[];
  /** An outstanding invitation to this chair. Read server-side; null is the norm. */
  pendingInvite: PendingInvite | null;
  /**
   * This stylist's **stored** commission and base salary, read through `payroll_report`.
   *
   * Null on any salon that is not Pro — which is every live one — and null if the read failed.
   * That is the difference between "no pay to show" and "pay of zero", and the pay block below
   * is locked in exactly the case this is null, so the two cannot disagree.
   *
   * **Why not `member`:** `staff_members.commission_pct` and `base_salary_nu` are outside every
   * client role's SELECT privilege, so `toStaffMember` substitutes 0 for both and no table read
   * can ever return the real figures. See `STAFF_PUBLIC_SELECT`.
   */
  storedPay: { commissionPct: number; baseSalaryNu: number } | null;
}) {
  const router = useRouter();
  /**
   * The cap, and whether the other stylists have already used it up.
   *
   * `maxActiveStylists` returns null for unlimited, which is Growth and above — so
   * `capReached` is false there without a special case.
   */
  const activeCap = maxActiveStylists(business.plan);
  const capReached = activeCap != null && otherActiveCount >= activeCap;

  const [name, setName] = useState(member.displayName);
  const [isActive, setIsActive] = useState(member.isActive);
  const [photoUrl, setPhotoUrl] = useState(member.photoUrl);
  /**
   * Whether Active is genuinely locked off — see the note on the checkbox.
   *
   * All three conditions are load-bearing: the cap is used up, this stylist is currently
   * unticked, **and** the saved row is inactive too. Without the last one, unticking an
   * already-active stylist disabled the box that had just been unticked.
   */
  const lockedOff = capReached && !isActive && !member.isActive;
  const [serviceIds, setServiceIds] = useState<string[]>(initialServiceIds);
  const [week, setWeek] = useState<WeekHours>(() => weekFromWorkingHours(initialHours));
  const [photos, setPhotos] = useState(initialPhotos);
  /**
   * The pay inputs, prefilled from `payroll_report` — **not from the staff row.**
   *
   * This used to read `member.commissionPct` and `member.baseSalaryNu`, which are always 0: no
   * client role holds SELECT on either column, so `toStaffMember` substitutes zero. The inputs
   * therefore opened at 0 on a Pro salon and **Save wrote 0 back over a real salary**, silently,
   * because `commit()` sends whatever is in the boxes. `payroll_report` returns both columns
   * (it is `SECURITY DEFINER`, so column privileges do not apply to it) and is the only way a
   * client can see them at all.
   *
   * Falling back to `member` rather than to a literal 0 keeps one thing true: when there is no
   * stored pay to show, the value shown is the same value the type says it is.
   */
  const [commission, setCommission] = useState(
    String(storedPay?.commissionPct ?? member.commissionPct),
  );
  const [salary, setSalary] = useState(String(storedPay?.baseSalaryNu ?? member.baseSalaryNu));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [confirmClashes, setConfirmClashes] = useState<number | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const portfolioInput = useRef<HTMLInputElement>(null);

  const openWeekdays = openWeekdaysFrom(salonHours);
  const canSetPay = hasFeature(business.plan, "commissions");

  async function uploadFor(
    files: FileList | null,
    label: string,
    previous: string | null,
    onDone: (url: string) => Promise<void> | void,
    setBusy: (busy: boolean) => void,
    input: HTMLInputElement | null,
  ) {
    const file = files?.[0];
    if (!file) return;
    const rejection = imageRejection(file);
    if (rejection) {
      toast.error(rejection);
      return;
    }
    setBusy(true);
    const picked = await downscaleImage(file);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("no session");
      const url = await uploadOwnerImage(
        supabase,
        user.id,
        picked.blob,
        label,
        picked.mime,
        previous,
      );
      await onDone(url);
    } catch (caught) {
      toast.error(ownerErrorMessage("uploadPhoto", caught));
    } finally {
      releasePreview(picked);
      setBusy(false);
      if (input) input.value = "";
    }
  }

  /** Save, having already decided about any conflicts. */
  async function commit() {
    setSaving(true);
    try {
      const supabase = createClient();
      // Hours first — see the note above.
      await setStaffWorkingHours(supabase, member.id, weekToPayload(week));
      await updateStaff(supabase, member.id, { displayName: name.trim(), isActive });
      await setStaffServices(supabase, member.id, serviceIds);
      if (canSetPay) {
        const pct = Number.parseFloat(commission.trim());
        const base = Number.parseInt(salary.trim(), 10);
        if (!Number.isFinite(pct) || pct < 0 || pct > 100 || !Number.isFinite(base) || base < 0) {
          toast.error("Enter a commission between 0 and 100, and a salary of 0 or more.");
          setSaving(false);
          return;
        }
        await setStaffPay(supabase, member.id, pct, base);
      }
      toast.success("Saved.");
      router.push("/business/staff");
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("saveStaff", caught));
    } finally {
      setSaving(false);
    }
  }

  function save() {
    if (!name.trim()) {
      toast.error("A name can't be empty.");
      return;
    }
    if (weekHasErrors(week)) {
      toast.error("Fix the overlapping hours before saving.");
      return;
    }
    const clashes = bookingsOutsideHours(upcoming, week, new Date());
    if (clashes > 0) {
      setConfirmClashes(clashes);
      return;
    }
    void commit();
  }

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <Link
        href="/business/staff"
        className="text-caption text-rausch-cta gap-xs mb-sm inline-flex items-center font-medium"
      >
        <Icons.back style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
        Staff
      </Link>
      <SectionHeader title={member.displayName} as="h1" />

      {/* ---------------------------------------------------- who they are ---- */}
      <div className="gap-base mt-base flex items-center">
        <Avatar name={name || member.displayName} photoUrl={photoUrl} size={72} />
        <div>
          <input
            ref={avatarInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) =>
              void uploadFor(
                e.target.files,
                `staff-${member.id}`,
                photoUrl,
                async (url) => {
                  await updateStaff(createClient(), member.id, { photoUrl: url });
                  setPhotoUrl(url);
                  toast.success("Photo updated.");
                },
                setUploading,
                avatarInput.current,
              )
            }
          />
          <Button
            variant="quiet"
            busy={uploading}
            onClick={() => avatarInput.current?.click()}
            className="px-0"
          >
            <Icons.camera style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
            {photoUrl ? "Change photo" : "Add photo"}
          </Button>
          <p className="text-caption-sm text-muted">Shown on your salon page.</p>
        </div>
      </div>

      <div className="mt-base">
        <Field label="Name" value={name} onChange={setName} />
      </div>

      {/*
        Activating is capped; deactivating never is.

        `capReached` is about the *other* stylists, so turning this one **off** is always
        allowed and turning it back on is refused only when the salon is already at its
        limit. That asymmetry is the whole point: the paywall stops a new active stylist, it
        does not undo an existing one — which matters because nine Basic salons are already
        over the cap and would otherwise be locked out of editing anybody.

        Checked here as well as in SQL. The trigger is the authority
        (`20260807000004_basic_stylist_cap`); this is so the answer arrives before the write
        rather than as a refusal, and the sentence names the cap instead of the plan.

        **`!member.isActive` is the third condition, and it was missing.** Measured in the
        browser on Menjong (Basic, two active stylists, cap one): the box unticked fine and
        then **disabled itself**, so the owner could not put back the value they had just
        taken off without reloading the page. Reading only local `isActive` made an *undo*
        indistinguishable from an *activation*. It is not: the persisted row is already
        active, so saving it active changes nothing and the trigger — which fires on
        inactive → active — never sees an update. Gating on the persisted state as well is
        what the comment above always claimed the code did.
      */}
      <label
        className={cn(
          "gap-base mt-base flex items-start",
          lockedOff ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        <input
          type="checkbox"
          checked={isActive}
          disabled={lockedOff}
          onChange={(e) => setIsActive(e.target.checked)}
          className="accent-rausch-cta mt-1 size-5"
        />
        <span>
          <span className="text-title text-ink block font-medium">Active</span>
          <span className="text-body-sm text-muted block">
            An inactive stylist can&apos;t be booked and doesn&apos;t count towards your plan&apos;s
            stylist limit.
          </span>
          {lockedOff ? (
            <span className="text-caption text-muted mt-xxs block">
              {business.plan === "basic" ? "The Basic plan" : "Your plan"} allows{" "}
              {activeCap === 1 ? "one active stylist" : `${activeCap} active stylists`}, and{" "}
              {otherActiveCount === 1 ? "one is" : `${otherActiveCount} are`} already active.{" "}
              <Link href="/business/plans" className="text-rausch-cta font-medium underline">
                See plans
              </Link>
            </span>
          ) : null}
        </span>
      </label>

      {/* --------------------------------------------------- login account ---- */}
      <div className="mt-xl">
        <SectionHeader title="Login account" as="h2" />
        <StaffLinkCard
          staffId={member.id}
          linkedProfileId={member.profileId}
          pendingInvite={pendingInvite}
        />
      </div>

      {/* -------------------------------------------------------------- pay ---- */}
      <div className="mt-xl">
        <SectionHeader title="Pay" as="h2" />
        {canSetPay ? (
          <>
            <div className="gap-base grid grid-cols-2">
              <Field
                label="Commission %"
                value={commission}
                onChange={setCommission}
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
              />
              <Field
                label="Base salary (Nu)"
                value={salary}
                onChange={setSalary}
                type="number"
                inputMode="numeric"
                min={0}
              />
            </div>
            <p className="text-caption-sm text-muted mt-xs">
              Total pay = base salary + commission % of their completed-booking revenue.
            </p>
          </>
        ) : (
          // No salon on the platform is on Pro, so this is the branch every live salon sees.
          // `set_staff_pay` refuses anything else in SQL ("payroll requires Pro"), and since
          // 20260805000001 the two columns are out of the owner's UPDATE grant as well — so
          // the gate holds on both paths, not just this one.
          <div className="border-hairline-soft bg-surface-soft p-base gap-sm flex items-start rounded-md border">
            <Icons.locked
              className="text-muted mt-0.5 shrink-0"
              style={{ width: IconSize.xs, height: IconSize.xs }}
              aria-hidden
            />
            <p className="text-body-sm text-muted">
              Commission and base salary are part of the Pro plan.
            </p>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------- services ---- */}
      <div className="mt-xl">
        <SectionHeader title="Services performed" as="h2" />
        {services.length === 0 ? (
          <p className="text-body-sm text-muted">
            <Link href="/business/services" className="text-rausch-cta font-medium">
              Add a service first
            </Link>{" "}
            — a stylist with no services can&apos;t be booked.
          </p>
        ) : (
          <ul className="divide-hairline-soft divide-y">
            {services.map((s) => (
              <li key={s.id}>
                <label className="gap-base py-md flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={serviceIds.includes(s.id)}
                    onChange={(e) =>
                      setServiceIds((current) =>
                        e.target.checked
                          ? [...current, s.id]
                          : current.filter((id) => id !== s.id),
                      )
                    }
                    className="accent-rausch-cta size-5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-title text-ink block truncate font-medium">
                      {s.name}
                      {!s.isActive ? " (switched off)" : ""}
                    </span>
                    <span className="text-body-sm text-muted block">
                      {formatDuration(s.durationMinutes)} · {formatNu(s.price)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ------------------------------------------------------ portfolio ---- */}
      <div className="mt-xl">
        <SectionHeader
          title="Portfolio photos"
          as="h2"
          action={
            <>
              <input
                ref={portfolioInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  void uploadFor(
                    e.target.files,
                    `staff-${member.id}-portfolio`,
                    null,
                    async (url) => {
                      const supabase = createClient();
                      await addStaffPhoto(supabase, member.id, url);
                      // Re-read rather than pushing the URL onto the list: removal needs the
                      // row's id, and the insert does not return it. One extra round trip
                      // beats a photo that cannot be deleted until the next page load.
                      setPhotos(await fetchStaffPhotoRows(supabase, member.id));
                      toast.success("Photo added.");
                    },
                    setAddingPhoto,
                    portfolioInput.current,
                  )
                }
              />
              <Button
                variant="quiet"
                busy={addingPhoto}
                onClick={() => portfolioInput.current?.click()}
              >
                <Icons.addPhoto style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
                Add
              </Button>
            </>
          }
        />
        {photos.length === 0 ? (
          <p className="text-body-sm text-muted mt-sm">
            No portfolio photos yet. These show on their public page.
          </p>
        ) : (
          <ul className="gap-sm mt-sm flex overflow-x-auto">
            {photos.map((p) => (
              <li key={p.id} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- a plain img: these are
                    user uploads in a horizontal strip, and next/image's layout machinery buys
                    nothing at 84px while making the delete overlay harder to place. */}
                <img
                  src={p.url}
                  alt=""
                  width={84}
                  height={84}
                  className="bg-surface-strong size-21 rounded-md object-cover"
                />
                <button
                  type="button"
                  onClick={() => void removePhoto(p)}
                  aria-label="Remove this photo"
                  className="bg-canvas border-hairline text-muted hover:text-ink absolute -top-1 -right-1 grid size-7 place-items-center rounded-full border"
                >
                  <Icons.trash
                    style={{ width: IconSize.xs, height: IconSize.xs }}
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------------------------------------------------- working hours --- */}
      <div className="mt-xl">
        <SectionHeader title="Working hours" as="h2" />
        <p className="text-body-sm text-muted mb-base">
          These decide what can be booked. Split a day to add a break — the gap stops new
          bookings.
        </p>
        <HoursEditor week={week} openWeekdays={openWeekdays} onChange={setWeek} />
      </div>

      <div className="mt-xl">
        <Button fullWidth busy={saving} onClick={save}>
          Save
        </Button>
      </div>

      <Sheet
        open={confirmClashes != null}
        onClose={() => setConfirmClashes(null)}
        title="Bookings fall outside these hours"
        footer={
          <div className="gap-sm flex">
            <Button variant="outlined" fullWidth onClick={() => setConfirmClashes(null)}>
              Go back
            </Button>
            <Button
              fullWidth
              busy={saving}
              onClick={() => {
                setConfirmClashes(null);
                void commit();
              }}
            >
              Save anyway
            </Button>
          </div>
        }
      >
        <p className="text-body-md text-muted">
          {confirmClashes === 1
            ? "1 upcoming booking falls outside these hours. It stays booked — reschedule it yourself if you need to."
            : `${confirmClashes} upcoming bookings fall outside these hours. They stay booked — reschedule them yourself if you need to.`}
        </p>
      </Sheet>
    </div>
  );

  async function removePhoto(photo: BusinessPhoto) {
    try {
      await deleteStaffPhoto(createClient(), photo.id);
      setPhotos((current) => current.filter((p) => p.id !== photo.id));
    } catch (caught) {
      toast.error(ownerErrorMessage("removePhoto", caught));
    }
  }
}
