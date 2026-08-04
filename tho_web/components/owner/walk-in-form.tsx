"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { SlotPicker } from "@/components/customer/slot-picker";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SelectField } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { createBooking } from "@/lib/api/booking";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { createClient } from "@/lib/supabase/client";
import { formatMinutesOfDay, thimphuMinutesOfDay } from "@/lib/time";
import type { Slot } from "@/lib/types/booking";
import type { ServiceItem, StaffMember } from "@/lib/types/salon";
import { cn, formatDuration, formatNu } from "@/lib/utils";

/**
 * Book a slot for someone at the counter — a port of
 * `tho/app/lib/business/walk_in_screen.dart`.
 *
 * **Not the queue sheet.** That adds a place in the live line; this creates a real booking
 * (`create_booking` with `source: 'walk_in'`) at a chosen time, which is what someone who
 * walked in to be seen at four o'clock needs.
 *
 * **A basket, not one service.** Upstream's rework let a booking carry several services from
 * one salon, and the summary line — *"2 services · 2h 15m · Nu 1,600"* — is what makes the
 * combined duration visible before a time is picked, because that duration is what decides
 * which slots exist at all.
 *
 * **The stylist list is deliberately not narrowed by `service_staff`**, unlike the customer's
 * picker. The app's reason holds — a salon member is trusted to know their own team — and the
 * server still refuses a pair that isn't real, which two of Norzin's five services prove:
 * they are mapped to no staff, so choosing them yields no slots rather than a wrong booking.
 *
 * **The idempotency key is held across retries.** `create_booking` returns the booking a key
 * already made, so a double-press or a retry after a network wobble is the same booking; a
 * fresh key per press is exactly what produces two.
 */
export function WalkInForm({
  businessId,
  staff,
  services,
  initialDay,
}: {
  businessId: string;
  staff: StaffMember[];
  services: ServiceItem[];
  initialDay?: Date;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [picked, setPicked] = useState<string[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const idempotencyKey = useRef<string | null>(null);

  if (staff.length === 0 || services.length === 0) {
    return (
      <EmptyState
        icon={Icons.info}
        title="Add a service and staff first"
        message="Walk-ins need at least one active service and one staff member."
      />
    );
  }

  const chosen = services.filter((s) => picked.includes(s.id));
  const totalMinutes = chosen.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalPrice = chosen.reduce((sum, s) => sum + s.price, 0);
  const ready = chosen.length > 0 && staffId !== "";

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    // The basket's duration decides which slots exist, so a change invalidates the choice.
    setSlot(null);
  }

  async function submit() {
    if (!slot) return;
    idempotencyKey.current ??= crypto.randomUUID();
    setBusy(true);
    try {
      await createBooking(createClient(), {
        idempotencyKey: idempotencyKey.current,
        businessId,
        staffId,
        serviceIds: picked,
        start: slot.start,
        source: "walk_in",
        customerName: name.trim() || null,
        customerPhone: phone.trim() || null,
        customerNote: note.trim() || null,
      });
      toast.success("Walk-in booked.");
      router.push("/business");
    } catch (caught) {
      toast.error(ownerErrorMessage("addWalkIn", caught));
      // A taken slot has to disappear from the grid, and the *next* attempt is a new
      // booking rather than a retry of this one.
      idempotencyKey.current = null;
      setSlot(null);
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gap-lg flex flex-col">
      <section>
        <SectionHeader title="Customer (optional)" as="h2" />
        <div className="gap-base mt-sm flex flex-col">
          <Field label="Name" value={name} onChange={setName} placeholder="e.g. Karma" />
          <Field
            label="Phone"
            type="tel"
            value={phone}
            onChange={setPhone}
            placeholder="+975 17 000 000"
            hint="Lets you call or WhatsApp them from the booking."
          />
          <Field
            label="Note"
            value={note}
            onChange={setNote}
            placeholder="Anything to remember"
          />
        </div>
      </section>

      <section>
        <SectionHeader title="Services" as="h2" />
        <ul className="border-hairline divide-hairline-soft mt-sm divide-y rounded-md border">
          {services.map((s) => {
            const on = picked.includes(s.id);
            return (
              <li key={s.id}>
                <label
                  className={cn(
                    "gap-base px-base py-md flex cursor-pointer items-center",
                    on && "bg-rausch/5",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(s.id)}
                    className="accent-rausch size-5 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-body-md text-ink block truncate">{s.name}</span>
                    <span className="text-caption-sm text-muted block tabular-nums">
                      {s.durationMinutes} min · {formatNu(s.price)}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {chosen.length > 0 ? (
          <p className="text-body-sm text-ink mt-sm font-medium tabular-nums">
            {chosen.length} {chosen.length === 1 ? "service" : "services"} ·{" "}
            {formatDuration(totalMinutes)} · {formatNu(totalPrice)}
          </p>
        ) : null}
      </section>

      <section>
        <SectionHeader title="Staff" as="h2" />
        <div className="mt-sm">
          <SelectField
            label="Who's doing it"
            value={staffId}
            onChange={(next) => {
              setStaffId(next);
              setSlot(null);
            }}
            placeholder="Choose a staff member"
            options={staff.map((s) => ({ value: s.id, label: s.displayName }))}
          />
        </div>
      </section>

      <section>
        <SectionHeader title="Time" as="h2" />
        <div className="mt-sm">
          {ready ? (
            <SlotPicker
              staffId={staffId}
              serviceIds={picked}
              selected={slot}
              onSelect={setSlot}
              disabled={busy}
              reloadKey={reloadKey}
              initialDay={initialDay}
            />
          ) : (
            <p className="text-body-sm text-muted">
              Pick at least one service and a staff member to see open times.
            </p>
          )}
        </div>
      </section>

      {slot ? (
        <div className="border-hairline bg-canvas sticky bottom-0 -mx-4 border-t px-4 py-3 tablet:static tablet:mx-0 tablet:border-0 tablet:px-0">
          <Button fullWidth busy={busy} onClick={() => void submit()}>
            Book walk-in ·{" "}
            {formatMinutesOfDay(thimphuMinutesOfDay(slot.start))}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
