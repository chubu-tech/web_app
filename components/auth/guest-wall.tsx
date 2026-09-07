"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import {
  GUEST_ACTIONS,
  resumeUpgrade,
  upgradeGuest,
  type GuestAction,
  type GuestUpgrade,
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { emailError, nameError, newPasswordError } from "@/lib/credentials";

/**
 * The wall a guest meets when they try to do something that commits them (THO-24),
 * ported from `tho/app/lib/auth/guest_wall.dart`.
 *
 * **A sheet at the point of action, never a redirect.** The guest has already chosen
 * a salon, a service and a time; throwing that away to go and make an account is how
 * you lose them. Anonymous sign-in upgrades the *same* user id, so everything they
 * did as a guest survives.
 *
 * One addition the app has no equivalent of: an **"already have an account"** link
 * into `/sign-in?next=…`. On a phone the app is installed and the account is on the
 * device; on the web the most likely visitor here is a returning customer who simply
 * isn't signed in, and the app's sheet gives them no way through.
 *
 * `onUpgraded` fires only when the caller should retry what it was doing — i.e. the
 * user is now genuinely registered. Email confirmation means that is often *not* the
 * case even after a successful call, which is why this reports the difference rather
 * than claiming success.
 */
export function GuestWall({
  open,
  onClose,
  action,
  onUpgraded,
  /** Where `/sign-in` should return to. Defaults to the current URL. */
  next,
}: {
  open: boolean;
  onClose: () => void;
  action: GuestAction;
  onUpgraded: () => void;
  next?: string;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /*
    `null` while the sheet is still asking for details. Once an account exists the fields
    come **off** the sheet — leaving them there invites a second `updateUser` for an account
    that is already made, which is what "Continue" exists to avoid.
  */
  const [madeAccount, setMadeAccount] = useState<Exclude<GuestUpgrade, "ready"> | null>(null);

  const signInHref = `/sign-in?next=${encodeURIComponent(
    next ?? (typeof window === "undefined" ? "/" : window.location.pathname + window.location.search),
  )}`;

  async function create(event: React.FormEvent) {
    event.preventDefault();
    /*
      The same rules as the sign-up screen, from the same module. This used to check only
      non-emptiness and a 6-character floor, so a guest upgrading here was held to a weaker
      standard than somebody signing up two routes away — for the same account.
    */
    const problem = nameError(fullName) ?? emailError(email) ?? newPasswordError(password);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);

    const result = await upgradeGuest(createClient(), email.trim(), password, fullName.trim());
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? "Couldn't create your account. Please try again.");
      return;
    }
    settle(result.outcome);
  }

  /**
   * Re-check without writing anything — the "Continue" path.
   *
   * Separate from {@link create} because a second `updateUser` would try to make the account
   * again for somebody who already has one.
   */
  async function check() {
    setBusy(true);
    setError(null);
    const outcome = await resumeUpgrade(createClient());
    setBusy(false);
    settle(outcome);
  }

  function settle(outcome: GuestUpgrade) {
    if (outcome !== "ready") {
      // The account exists; only this browser's session does not prove it yet. Keep the
      // sheet open on its second face rather than closing on a success the RPCs will refuse.
      setMadeAccount(outcome);
      return;
    }
    setMadeAccount(null);
    // Role lives in a server component, so the shell has to re-render before the
    // caller retries against the new session.
    router.refresh();
    onClose();
    onUpgraded();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        madeAccount == null ? `Create an account to ${GUEST_ACTIONS[action]}` : "One more step"
      }
    >
      <form onSubmit={create} className="p-base gap-base flex flex-col">
        <div className="flex flex-col items-center text-center">
          <span className="bg-surface-soft flex size-16 items-center justify-center rounded-full">
            <Icons.person
              className="text-rausch-cta"
              style={{ width: IconSize.lg, height: IconSize.lg }}
              aria-hidden
            />
          </span>
          <p className="text-body-sm text-muted mt-md">
            {madeAccount == null
              ? "It takes a moment, and you keep everything you've saved so far."
              : "Your account is made — we just need this browser signed in to it."}
          </p>
        </div>

        {madeAccount == null ? (
          <>
            {/*
              **No longer "Optional".** The salon sees this name on the booking — and until
              `20260902000004` it was the *only* way it reached `profiles` at all, because
              `handle_new_user` is AFTER INSERT and an anonymous user's INSERT carries no
              metadata. That is why a salon used to see "Guest" against a booking somebody had
              put their name to.
            */}
            <WallField
              label="Your name"
              hint="The salon sees this on your booking"
              value={fullName}
              onChange={setFullName}
              required
            />
            <WallField
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              required
            />
            <WallField
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              hint="At least 8 characters, with a letter and a number"
              required
            />
          </>
        ) : null}

        {error ? (
          <p role="alert" className="text-body-sm text-error-text">
            {error}
          </p>
        ) : null}

        {madeAccount === "awaitingEmailConfirmation" ? (
          <p role="status" className="text-body-sm text-body">
            Account created. Confirm your address from the email we sent to{" "}
            <strong className="text-ink font-medium">{email.trim()}</strong>, then tap Continue.
          </p>
        ) : null}
        {madeAccount === "sessionStale" ? (
          /*
            Not phrased as a failure to create the account, because the account exists. What
            failed is this browser proving it — and the fix is one more tap, not a second
            sign-up.
          */
          <p role="alert" className="text-body-sm text-error-text">
            Your account is ready, but this browser couldn&apos;t finish signing you in. Tap
            Continue to try again.
          </p>
        ) : null}

        {madeAccount == null ? (
          <Button type="submit" busy={busy} fullWidth>
            Create account
          </Button>
        ) : (
          <Button type="button" busy={busy} fullWidth onClick={() => void check()}>
            Continue
          </Button>
        )}

        <p className="text-body-sm text-muted text-center">
          Already have an account?{" "}
          <Link href={signInHref} className="text-rausch-cta font-medium underline">
            Sign in
          </Link>
        </p>

        <Button variant="quiet" fullWidth onClick={onClose} disabled={busy}>
          {madeAccount == null ? "Keep looking around" : "Not now"}
        </Button>
      </form>
    </Sheet>
  );
}

function WallField({
  label,
  hint,
  value,
  onChange,
  type = "text",
  ...rest
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
} & Omit<React.ComponentPropsWithoutRef<"input">, "value" | "onChange" | "type">) {
  return (
    <label className="block">
      <span className="text-caption text-muted block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "border-hairline mt-xs px-md min-h-14 w-full rounded-sm border",
          "text-body-md text-ink placeholder:text-muted-soft",
          "focus:border-ink focus:border-2 focus:outline-none",
        )}
        {...rest}
      />
      {hint ? <span className="text-caption-sm text-muted mt-xxs block">{hint}</span> : null}
    </label>
  );
}
