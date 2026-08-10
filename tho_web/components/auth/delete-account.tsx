"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons, IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { deleteAccount, deleteAccountRefusal } from "@/lib/api/account";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * The last thing anyone sees before their account is destroyed — a port of
 * `tho/app/lib/customer/delete_account_sheet.dart`.
 *
 * ## The copy is a compliance surface, not styling
 *
 * It is ported close to verbatim on purpose. Since `20260806000003` this is a real
 * deletion: the `auth.users` row goes and the email is freed, with no way back. Play only
 * permits the salon to retain past bookings and reviews **where the person is told about
 * that retention**, so the "What the salon keeps" block is the thing that keeps this
 * lawful. Hiding it behind a friendlier one-liner is what gets an app rejected. If it has
 * to change, the privacy policy changes with it.
 *
 * ## Two jobs pulling against each other
 *
 * It has to be hard to trigger by accident, and it has to be honest about consequences.
 * The typed, **case-sensitive, untrimmed** `DELETE` does the first: no stray click and no
 * autocomplete produces it, and comparing untrimmed means the trailing space a mobile
 * keyboard adds after a word is treated as the typo it is, not as an intention.
 *
 * ## After it succeeds, the session must end
 *
 * The user behind the session no longer exists, so nothing else it does will work. The
 * form submits to `/auth/sign-out` — the same route handler every other sign-out uses,
 * which also clears `tho_active_business`, a cookie browser JavaScript architecturally
 * cannot touch. It is a real form submit rather than a router push because the response
 * must set cookies.
 */
export function DeleteAccountCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="border-hairline-soft mt-xl pt-lg border-t">
        <h2 className="text-display-sm text-ink font-semibold">Delete your account</h2>
        <p className="text-body-sm text-muted mt-xs mb-base">
          Permanently removes your sign-in and your personal data. This cannot be undone.
        </p>
        <Button variant="outlined" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </div>

      {/* Keyed so every opening starts with an empty confirm field and no stale error —
          cheaper and more obviously right than clearing two pieces of state, and it means
          an abandoned attempt cannot leak into the next one. */}
      {open ? <DeleteAccountSheet key="open" onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function DeleteAccountSheet({ onClose }: { onClose: () => void }) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Exact, case-sensitive, untrimmed. See the note above.
  const armed = confirm === "DELETE";

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(createClient());
      // Do not close the sheet: the next thing is a full page navigation to the sign-out
      // handler, and swapping this for the page underneath first would flash a shell that
      // belongs to an account that no longer exists.
      setDone(true);
    } catch (caught) {
      setError(
        deleteAccountRefusal(caught) ??
          "Couldn't delete your account. Please check your connection and try again.",
      );
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={busy || done ? () => {} : onClose} title="Delete your account">
      <div className="p-base">
        <p className="text-body-md text-body">
          This cannot be undone. Your sign-in is removed, so you will not be able to get
          back into this account.
        </p>

        <GroupLabel>What is removed</GroupLabel>
        <ul className="gap-sm flex flex-col">
          <Line kind="removed">
            Your profile and sign-in — your name, phone number and photo, and the email
            becomes free to use again
          </Line>
          <Line kind="removed">Saved salons and followed stylists</Line>
          <Line kind="removed">Your chat messages to salons</Line>
          <Line kind="removed">Notifications and your reminders</Line>
        </ul>

        <GroupLabel>What the salon keeps</GroupLabel>
        <ul className="gap-sm flex flex-col">
          <Line kind="kept">
            Past bookings and reviews stay as the salon&apos;s business record — they are
            how a salon works out its takings and its tax. Your name comes off them: they
            show as &quot;Deleted user&quot;.
          </Line>
        </ul>

        <div className="mt-lg">
          <Field
            label="Type DELETE to confirm"
            value={confirm}
            onChange={setConfirm}
            placeholder="DELETE"
            autoComplete="off"
            disabled={busy || done}
          />
        </div>

        {error ? (
          <p role="alert" className="text-body-sm text-error-text mt-md">
            {error}
          </p>
        ) : null}

        <div className="mt-lg">
          {done ? (
            /* A real form POST, because the response has to set cookies. Auto-submitting
               would be worse than one press: a page that signs you out while you are still
               reading is the same defect `account_blocked_screen.dart` documents. */
            <form action="/auth/sign-out" method="post">
              <p className="text-body-sm text-ink mb-sm">
                Your account has been deleted. Sign out to finish.
              </p>
              <button
                type="submit"
                className="bg-ink text-on-primary text-title hover:bg-obsidian-soft flex min-h-12 w-full items-center justify-center rounded-sm font-medium"
              >
                Sign out
              </button>
            </form>
          ) : (
            <button
              type="button"
              disabled={!armed || busy}
              onClick={() => void remove()}
              aria-busy={busy || undefined}
              className={cn(
                "text-title flex min-h-12 w-full items-center justify-center rounded-sm font-medium",
                // While busy the button is disabled, so the disabled fill is pushed back
                // to the live colour — otherwise the label would sit on the pale inert
                // tint and read as a dead control. Same reasoning as the Dart original.
                armed || busy
                  ? "bg-error-text text-on-primary hover:bg-error-text-hover"
                  : "bg-error-soft text-error-text cursor-not-allowed",
              )}
            >
              {busy ? "Deleting…" : "Delete my account"}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-caption-sm text-muted mt-lg mb-sm font-semibold tracking-[0.14em] uppercase">
      {children}
    </p>
  );
}

function Line({ kind, children }: { kind: "removed" | "kept"; children: React.ReactNode }) {
  const removed = kind === "removed";
  const Icon = removed ? Icons.minus : Icons.check;
  return (
    <li className="gap-sm text-body-sm text-body flex items-start">
      <Icon
        className={cn("mt-0.5 shrink-0", removed ? "text-error-text" : "text-success-text")}
        style={{ width: IconSize.xs, height: IconSize.xs }}
        aria-hidden
      />
      <span>{children}</span>
    </li>
  );
}
