"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { GUEST_ACTIONS, upgradeGuest, type GuestAction } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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
  const [info, setInfo] = useState<string | null>(null);

  const signInHref = `/sign-in?next=${encodeURIComponent(
    next ?? (typeof window === "undefined" ? "/" : window.location.pathname + window.location.search),
  )}`;

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter an email and a password.");
      return;
    }
    if (password.length < 6) {
      setError("Use at least 6 characters for your password.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);

    const supabase = createClient();
    const result = await upgradeGuest(supabase, email.trim(), password, fullName.trim());

    if (!result.ok) {
      setBusy(false);
      setError(result.error ?? "Couldn't create your account. Please try again.");
      return;
    }
    if (!result.confirmed) {
      // Supabase needs the email round-trip before the user stops counting as
      // anonymous, so the sheet cannot hand back "you're in". Say what has to
      // happen next — `guest_wall.dart:91` makes exactly the same distinction.
      setBusy(false);
      setInfo(`Check ${email.trim()} to confirm your address, then come back and finish.`);
      return;
    }

    setBusy(false);
    // Role lives in a server component, so the shell has to re-render before the
    // caller retries against the new session.
    router.refresh();
    onClose();
    onUpgraded();
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Create an account to ${GUEST_ACTIONS[action]}`}>
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
            It takes a moment, and you keep everything you&apos;ve saved so far.
          </p>
        </div>

        <WallField label="Your name" hint="Optional" value={fullName} onChange={setFullName} />
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
          hint="At least 6 characters"
          required
        />

        {error ? (
          <p role="alert" className="text-body-sm text-error-text">
            {error}
          </p>
        ) : null}
        {info ? (
          <p role="status" className="text-body-sm text-success-text">
            {info}
          </p>
        ) : null}

        <Button type="submit" busy={busy} fullWidth>
          Create account
        </Button>

        <p className="text-body-sm text-muted text-center">
          Already have an account?{" "}
          <Link href={signInHref} className="text-rausch-cta font-medium underline">
            Sign in
          </Link>
        </p>

        <Button variant="quiet" fullWidth onClick={onClose} disabled={busy}>
          Keep looking around
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
