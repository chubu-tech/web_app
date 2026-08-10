"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons, IconSize } from "@/components/ui/icons";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { unlinkStaffMember } from "@/lib/api/owner-setup";
import {
  createStaffInvite,
  revokeStaffInvite,
  type PendingInvite,
} from "@/lib/api/staff-invites";
import { createClient } from "@/lib/supabase/client";

/**
 * Invite someone to a chair, or detach the account already in it — a port of the Login
 * account block in `staff_edit_screen.dart:167-213,426-448`.
 *
 * ## It used to link instantly, and that was the bug
 *
 * This called `link_staff_member`, which resolved an email against `auth.users` and set
 * `profiles.role = 'staff'` on the spot. An owner who knew an address could convert a
 * stranger's account — replacing their entire shell — with no consent and no notice.
 * Upstream removed that RPC in `ee413c6` ("ask before making someone staff") and this was
 * the last caller anywhere. Now the owner invites and the person accepts; nothing about
 * their account moves until they do.
 *
 * ## The message after sending must not depend on whether the account exists
 *
 * `create_staff_invite` deliberately returns one constant answer, with a comment in the
 * SQL warning against a friendlier "we couldn't find that account" branch — because that
 * branch is an account-existence oracle for any address an owner cares to type. The toast
 * below therefore says the same sentence every time, and the pending card states the
 * address rather than a person. Do not "improve" either into a confirmation that somebody
 * is there.
 *
 * ## Three states, not two
 *
 * **Linked** — someone accepted; offer Unlink. **Invited** — outstanding, with the
 * address, when it lapses, and Revoke. **Neither** — the form. Sending while an invite is
 * outstanding is safe: the RPC revokes the old one itself, so re-sending is how you
 * correct a typo.
 */
export function StaffLinkCard({
  staffId,
  linkedProfileId,
  pendingInvite,
}: {
  staffId: string;
  linkedProfileId: string | null;
  /** Read server-side by the staff editor page. Null when nothing is outstanding. */
  pendingInvite: PendingInvite | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function invite() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await createStaffInvite(createClient(), staffId, trimmed);
      setEmail("");
      // One sentence, whether or not that address belongs to anyone. See above.
      toast.success("Invite sent — they join once they accept.");
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("inviteStaff", caught));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(inviteId: string) {
    setBusy(true);
    try {
      await revokeStaffInvite(createClient(), inviteId);
      toast.success("Invite withdrawn.");
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("inviteStaff", caught));
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

  if (pendingInvite) {
    return (
      <div className="border-hairline-soft bg-surface-soft p-base rounded-md border">
        <div className="gap-sm flex items-start">
          <Icons.mail
            className="text-muted mt-0.5 shrink-0"
            style={{ width: IconSize.xs, height: IconSize.xs }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            {/* The address, not a name. We do not know — and must not imply — that
                anybody holds it. */}
            <p className="text-body-sm text-ink">
              Invite sent to <span className="font-medium">{pendingInvite.email}</span> —
              they join once they accept.
            </p>
            <p className="text-caption text-muted mt-xxs">
              Expires{" "}
              {pendingInvite.expiresAt.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                timeZone: "Asia/Thimphu",
              })}
              . Sending a new invite replaces this one.
            </p>
          </div>
          <Button variant="quiet" busy={busy} onClick={() => void revoke(pendingInvite.id)}>
            Revoke
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-body-sm text-muted mb-sm">
        Invite someone to this chair. They&apos;ll be asked to accept, and once they do
        they can sign in and see only their own bookings and schedule.
      </p>
      <Field
        label="Their email"
        value={email}
        onChange={setEmail}
        type="email"
        placeholder="name@email.com"
        autoComplete="off"
      />
      <div className="mt-sm">
        <Button
          variant="outlined"
          busy={busy}
          disabled={!email.trim()}
          onClick={() => void invite()}
        >
          <Icons.send style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
          Send invite
        </Button>
      </div>
    </div>
  );
}
