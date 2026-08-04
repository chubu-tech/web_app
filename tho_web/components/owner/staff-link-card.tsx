"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons, IconSize } from "@/components/ui/icons";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { linkStaffMember, unlinkStaffMember } from "@/lib/api/owner-setup";
import { createClient } from "@/lib/supabase/client";

/**
 * Attach a login to a stylist, or detach one — a port of the Login account block in
 * `staff_edit_screen.dart`.
 *
 * **This is what Phase 4 is built on.** `private.is_business_member` admits an active
 * `staff_members` row whose `profile_id` matches the caller, so linking is what lets someone
 * sign in and see their own day; nothing else grants staff access to a salon.
 *
 * **Two things the RPC does that a direct write cannot**, which is why it is the only path
 * and why `20260805000001` took `profile_id` out of the owner's UPDATE grant: it resolves the
 * address against `auth.users`, so the account must exist and the owner had to know an email
 * the person controls; and it sets `profiles.role = 'staff'`, so the app routes them to the
 * staff surface instead of the customer one.
 *
 * **The RPC's own message is passed through**, because *"Ask the person to create an account
 * first, then link"* is the actual next step and no wording of ours improves on it.
 *
 * Linking is immediate rather than part of the screen's Save: it changes another person's
 * account, which is not something to bundle into a button labelled Save.
 */
export function StaffLinkCard({
  staffId,
  linkedProfileId,
}: {
  staffId: string;
  linkedProfileId: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function link() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await linkStaffMember(createClient(), staffId, trimmed);
      setEmail("");
      toast.success("Linked — they can now sign in and see their bookings.");
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("linkStaff", caught));
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    try {
      await unlinkStaffMember(createClient(), staffId);
      toast.success("Account unlinked.");
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("unlinkStaff", caught));
    } finally {
      setBusy(false);
    }
  }

  if (linkedProfileId) {
    return (
      <div className="border-hairline-soft bg-surface-soft p-base gap-sm flex items-center rounded-md border">
        <Icons.verified
          className="text-success-text shrink-0"
          style={{ width: IconSize.xs, height: IconSize.xs }}
          aria-hidden
        />
        <p className="text-body-sm text-ink flex-1">Account linked — this staff can sign in.</p>
        <Button variant="quiet" busy={busy} onClick={() => void unlink()}>
          Unlink
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-body-sm text-muted mb-sm">
        Link a login so this stylist can sign in and see only their own bookings and schedule.
        They need to create an account first.
      </p>
      <Field
        label="Account email"
        value={email}
        onChange={setEmail}
        type="email"
        placeholder="name@email.com"
        autoComplete="off"
      />
      <div className="mt-sm">
        <Button variant="outlined" busy={busy} disabled={!email.trim()} onClick={() => void link()}>
          <Icons.link style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
          Link account
        </Button>
      </div>
    </div>
  );
}
