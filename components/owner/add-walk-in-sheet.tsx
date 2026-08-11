"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { joinQueue } from "@/lib/api/queue";
import { createClient } from "@/lib/supabase/client";
import type { ServiceItem, StaffMember } from "@/lib/types/salon";
import { formatNu } from "@/lib/utils";

/**
 * Put someone standing at the counter into the line — a port of
 * `tho/app/lib/business/queue/add_walk_in_sheet.dart`.
 *
 * **Not the same thing as `/business/walk-in`**, and the app keeps them apart too: this adds
 * a place in the *live queue* (`join_queue`), while that books a *slot* (`create_booking`
 * with `source: 'walk_in'`). One is for someone waiting now, the other for someone who came
 * in to be seen at four o'clock.
 *
 * **A name is always sent, and that is a bug fix rather than a preference.** `join_queue`
 * only files an entry as an anonymous walk-in when the caller is a business member **and**
 * `p_name` is non-blank; with a blank name it sets `customer_profile_id` to the *caller*.
 * So in the app, an owner who leaves the optional Name field empty puts **themselves** in
 * their own queue — and a second blank add then raises `P0003` "you are already in this
 * queue", which the sheet reports as a generic failure. The field stays optional here
 * because most walk-ins do not give a name; a blank one becomes `"Walk-in"`, which is
 * exactly what the board would have displayed anyway.
 *
 * **A barber is optional and a service is not.** Blank barber means "Anyone", which is a
 * real state the line models (`staff_member_id` null, and `orderedShopWide` puts them in one
 * list). The service is what gives the entry its duration, and therefore everyone behind
 * them their wait.
 *
 * Unlike the customer's booking picker, the stylist list is **not** narrowed to who performs
 * the chosen service: `join_queue` only checks that each belongs to the salon and never
 * consults `service_staff`. The app's reasoning holds — a salon member is trusted to know
 * their own team.
 */
export function AddWalkInSheet({
  open,
  onClose,
  businessId,
  staff,
  services,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  businessId: string;
  staff: StaffMember[];
  services: ServiceItem[];
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [staffId, setStaffId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!serviceId) {
      toast.error("Choose a service.");
      return;
    }
    setBusy(true);
    try {
      await joinQueue(createClient(), {
        businessId,
        staffId: staffId || null,
        serviceId,
        // Never a QR scan: the shop is adding them at the counter. A member is exempt from
        // the `qr_only` check anyway, so this stays honest about what happened rather than
        // borrowing an exemption it does not need.
        viaQr: false,
        name: name.trim() || "Walk-in",
      });
      toast.success("Added to the queue.");
      reset();
      onClose();
      onAdded();
    } catch (caught) {
      toast.error(ownerErrorMessage("addWalkIn", caught));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setName("");
    setStaffId("");
    setServiceId("");
  }

  const noSetup = staff.length === 0 || services.length === 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add walk-in"
      footer={
        noSetup ? undefined : (
          <Button fullWidth busy={busy} onClick={() => void submit()}>
            Add to queue
          </Button>
        )
      }
    >
      {noSetup ? (
        <p className="text-body-md text-muted">
          Walk-ins need at least one active service and one staff member. Add them in the app
          and the line can start.
        </p>
      ) : (
        <div className="gap-base flex flex-col">
          <Field
            label="Name (optional)"
            value={name}
            onChange={setName}
            placeholder="e.g. Karma"
            hint="Leave it blank and they'll show on the board as a walk-in."
          />

          <SelectField
            label="Barber"
            value={staffId}
            onChange={setStaffId}
            options={[
              { value: "", label: "Anyone" },
              ...staff.map((s) => ({ value: s.id, label: s.displayName })),
            ]}
            hint="Anyone means whichever barber frees up first."
          />

          <SelectField
            label="Service"
            value={serviceId}
            onChange={setServiceId}
            placeholder="Choose a service"
            options={services.map((s) => ({
              value: s.id,
              label: `${s.name} · ${s.durationMinutes} min · ${formatNu(s.price)}`,
            }))}
            hint="Sets how long they'll be in the chair, and everyone else's wait."
          />
        </div>
      )}
    </Sheet>
  );
}
