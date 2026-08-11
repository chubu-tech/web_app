"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { acceptStaffInvite, type StaffInvite } from "@/lib/api/staff-invites";
import { createClient } from "@/lib/supabase/client";

/** Holds the "not now" for this browser session only. See the state below. */
const DISMISS_KEY = "tho_invite_dismissed";

/**
 * "X invited you to join" — a port of `tho/app/lib/auth/staff_invite_prompt.dart`.
 *
 * ## Accepting replaces your whole shell, so it takes a deliberate press
 *
 * `accept_staff_invite` sets `profiles.role = 'staff'`, which swaps Discover, bookings,
 * saved salons and the cart for a rota. Upstream calls this out as A2-02 — *"ask before
 * switching their whole world"* — and it is why this is a prompt rather than something
 * that happens on sign-in. **Not now** is a real answer and leaves everything alone; the
 * invitation keeps until it expires.
 *
 * ## Two refusals, two different sentences
 *
 * The server refuses an **owner or admin** accepting, because a role swap would strand
 * them behind a shell that cannot reach their own console. It separately refuses an
 * invite that has **expired or been revoked** since the page loaded — which is reachable
 * simply by leaving this open, since the owner can revoke at any time. Reporting one as
 * the other would send somebody to ask their salon for a new invite when the real problem
 * is that they run a salon themselves.
 *
 * ## After accepting, this navigates rather than re-rendering
 *
 * The role behind every server component on screen has just changed, so `router.refresh()`
 * alone would leave the customer shell around a person who is no longer a customer.
 * `push` to `/staff` re-resolves the layout chain from the top.
 */
export function StaffInvitePrompt({
  invites,
}: {
  /** From `my_staff_invites` — already filtered to pending, unexpired and unlinked. */
  invites: StaffInvite[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * "Not now" holds for the browser session.
   *
   * Upstream keeps it in a `bool` on the gate's state, which on a phone lasts until the
   * app is killed. The web equivalent of that lifetime is `sessionStorage`, not a `useState`
   * — a plain field would put the prompt back on the next navigation, which is the same
   * nagging the "Not now" button exists to prevent. It is read lazily rather than in an
   * effect so the first paint already knows, and it is deliberately **not** `localStorage`:
   * dismissing an invitation for ever is not what "not now" means.
   */
  const [dismissed, setDismissed] = useState(false);

  const invite = invites[0];
  if (!invite) return null;
  if (dismissed) return null;
  if (
    typeof window !== "undefined" &&
    window.sessionStorage.getItem(DISMISS_KEY) === invite.id
  ) {
    return null;
  }

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await acceptStaffInvite(createClient(), invite!.id);
      router.push("/staff");
    } catch (caught) {
      const text = String(
        typeof caught === "object" && caught !== null && "message" in caught
          ? (caught as { message: unknown }).message
          : caught,
      );
      setError(
        text.includes("owner or admin")
          ? "This account manages a salon, so it can't also join one as staff."
          : "This invitation is no longer valid. Ask the salon to send a new one.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="border-hairline-soft bg-paper shadow-card p-lg mb-lg rounded-lg border">
      <div className="gap-base flex items-start">
        <span
          aria-hidden
          className="bg-rausch/10 grid size-11 shrink-0 place-items-center rounded-full"
        >
          <Icons.link
            className="text-rausch-cta"
            style={{ width: IconSize.sm, height: IconSize.sm }}
          />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-display-sm text-ink font-semibold">
            {invite.businessName} invited you to join
          </h2>
          <p className="text-body-sm text-body mt-xs">
            {invite.staffName
              ? `They've set up "${invite.staffName}" for you. `
              : "They've set up a chair for you. "}
            Accept and Tho switches to your work view: your own schedule, your own
            bookings, and the hours your salon sets.
          </p>

          {invites.length > 1 ? (
            <p className="text-caption-sm text-muted mt-xs">
              {invites.length - 1} other invitation
              {invites.length - 1 === 1 ? "" : "s"} waiting.
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="text-body-sm text-error-text mt-sm">
              {error}
            </p>
          ) : null}

          <div className="gap-sm mt-base flex flex-wrap">
            <Button busy={busy} onClick={() => void accept()}>
              Accept and join
            </Button>
            <Button
              variant="quiet"
              disabled={busy}
              onClick={() => {
                // Keyed by invite id, so a *different* salon inviting you later still
                // gets asked. Dismissing one is not dismissing the idea.
                window.sessionStorage.setItem(DISMISS_KEY, invite!.id);
                setDismissed(true);
              }}
            >
              Not now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
