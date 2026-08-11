"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { friendlyAuthError, homeForRole, type Role } from "@/lib/auth";
import { DEFAULT_NEXT, safeNext } from "@/lib/next-path";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Email and password sign-in / sign-up, ported from
 * `tho/app/lib/auth/email_sign_in_screen.dart`.
 *
 * A **route**, not a sheet, unlike the guest wall: this is where a returning
 * customer arrives deliberately, so it has to be bookmarkable, survive a refresh,
 * work with a password manager, and give the confirmation email somewhere to land.
 * The guest wall stays a sheet because its job is the opposite — never lose the
 * half-finished booking behind it.
 *
 * Two things the app does that are deliberately **not** ported:
 *
 * - **The dev quick-login chips** (`email_sign_in_screen.dart:396`). They are
 *   `kDebugMode`-gated in Flutter; a bundled seed password has no safe equivalent on
 *   a public website.
 * - **The Customer/Business role toggle.** Sign-up stays customer-only even now that
 *   `/business` exists, and for a better reason than "it isn't built": an owner is
 *   onboarded by an operator, who creates the account *and* the salon together in the
 *   admin console. A self-served owner would land on a console with no salon in it,
 *   and `businesses.status` defaults to `pending` review anyway — so the toggle would
 *   promise a shop that nobody has agreed to list.
 */
export function AuthForm({
  mode,
  next,
}: {
  mode: "sign-in" | "sign-up";
  next: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const signUp = mode === "sign-up";
  const target = safeNext(next);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);

    const supabase = createClient();
    try {
      if (signUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            // `handle_new_user` reads these to provision the profile row, which is
            // why the role travels as auth metadata rather than being written after.
            data: { full_name: fullName.trim() || null, role: "customer" },
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(target)}`,
          },
        });
        if (signUpError) throw signUpError;

        // With "Confirm email" on — which this project has — sign-up returns no
        // session. Say what actually has to happen next rather than claiming
        // success and landing them somewhere that still treats them as a stranger.
        if (!data.session) {
          setBusy(false);
          setInfo(`Account created. Check ${email.trim()} to confirm, then sign in.`);
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }

      await landAfterAuth(router, target);
    } catch (caught) {
      setBusy(false);
      setError(friendlyAuthError(caught));
    }
  }

  return (
    <form onSubmit={submit} className="gap-base flex flex-col">
      {signUp ? (
        <Field
          label="Your name"
          hint="Optional"
          value={fullName}
          onChange={setFullName}
          autoComplete="name"
        />
      ) : null}

      <Field
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        placeholder="you@example.com"
        required
      />

      <Field
        label="Password"
        type={reveal ? "text" : "password"}
        value={password}
        onChange={setPassword}
        autoComplete={signUp ? "new-password" : "current-password"}
        hint={signUp ? "At least 6 characters" : undefined}
        required
        suffix={
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? "Hide password" : "Show password"}
            className="text-muted hover:text-ink flex size-12 items-center justify-center rounded-full"
          >
            {reveal ? (
              <Icons.hidden style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
            ) : (
              <Icons.visible style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
            )}
          </button>
        }
      />

      {error ? <Note kind="error">{error}</Note> : null}
      {info ? <Note kind="success">{info}</Note> : null}

      <Button type="submit" busy={busy} fullWidth className="mt-sm">
        {signUp ? "Create account" : "Sign in"}
      </Button>

      <p className="text-body-sm text-muted text-center">
        {signUp ? "Already have an account? " : "New here? "}
        <Link
          href={`/${signUp ? "sign-in" : "sign-up"}?next=${encodeURIComponent(target)}`}
          className="text-rausch-cta font-medium underline"
        >
          {signUp ? "Sign in" : "Create one"}
        </Link>
      </p>

      {/* An account is only needed to commit to something. Anyone can look around
          first — a wall in front of the salon list asks for commitment before
          showing anything worth committing to (THO-24). */}
      <div className="gap-md mt-sm flex items-center">
        <span className="bg-hairline h-px flex-1" />
        <span className="text-caption-sm text-muted">or</span>
        <span className="bg-hairline h-px flex-1" />
      </div>
      <Link
        href="/discover"
        className="border-hairline text-title text-ink hover:bg-surface-soft inline-flex min-h-12 items-center justify-center rounded-sm border font-medium"
      >
        Browse without an account
      </Link>
      <p className="text-caption-sm text-muted text-center">
        Look around freely. You only need an account to book, join a queue or message
        a salon.
      </p>
    </form>
  );
}

/**
 * Where a freshly signed-in user belongs.
 *
 * **An explicit `?next=` wins; the role decides the default.** Someone who signed in
 * halfway through a booking gets their booking back, whatever their role — that is the
 * whole reason `next` exists, and an owner who followed a link to a salon page meant to
 * go there. Only when `next` is the bare default does the role choose, which is what
 * makes a plain sign-in land an owner on `/business` instead of Discover.
 *
 * `router.refresh()` is required either way: role resolution happens in a server
 * component (`lib/session.ts`), so the shell has to re-render against the new cookie
 * before the navigation, or the owner nav renders for the previous session.
 */
async function landAfterAuth(
  router: ReturnType<typeof useRouter>,
  target: string,
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let destination = target;
  if (user && target === DEFAULT_NEXT) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    destination = homeForRole((data?.role as Role | undefined) ?? "customer");
  }

  router.refresh();
  router.replace(destination);
}

function Field({
  label,
  hint,
  value,
  onChange,
  type = "text",
  suffix,
  ...rest
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  suffix?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<"input">, "value" | "onChange" | "type">) {
  return (
    <label className="block">
      <span className="text-caption text-muted block">{label}</span>
      <span
        className={cn(
          "border-hairline mt-xs flex items-center rounded-sm border bg-canvas",
          "focus-within:border-ink focus-within:border-2",
        )}
      >
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-body-md text-ink placeholder:text-muted-soft px-md min-h-14 w-full bg-transparent outline-none"
          {...rest}
        />
        {suffix}
      </span>
      {hint ? <span className="text-caption-sm text-muted mt-xxs block">{hint}</span> : null}
    </label>
  );
}

function Note({
  kind,
  children,
}: {
  kind: "error" | "success";
  children: React.ReactNode;
}) {
  const Icon = kind === "error" ? Icons.error : Icons.info;
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "text-body-sm p-md gap-sm flex items-start rounded-sm",
        kind === "error"
          ? "bg-error-soft text-error-text"
          : "bg-success-soft text-success-text",
      )}
    >
      <Icon
        className="mt-0.5 shrink-0"
        style={{ width: IconSize.xs, height: IconSize.xs }}
        aria-hidden
      />
      {children}
    </p>
  );
}
