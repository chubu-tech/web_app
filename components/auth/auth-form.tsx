"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { friendlyAuthError, homeForRole, type Role } from "@/lib/auth";
import { DEFAULT_NEXT, safeNext } from "@/lib/next-path";
import { createClient } from "@/lib/supabase/client";
import { Field, FieldIcon } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  emailError,
  nameError,
  newPasswordError,
  signInPasswordError,
} from "@/lib/credentials";

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
 * **The dev quick-login chips** (`email_sign_in_screen.dart:396`) are the one thing
 * deliberately not ported: they are `kDebugMode`-gated in Flutter, and a bundled seed
 * password has no safe equivalent on a public website.
 *
 * **The Customer/Business toggle is ported** (`_RoleToggle`,
 * `email_sign_in_screen.dart:384`). It was left out while the only way to be an owner
 * here was for an operator to create the account *and* the salon together — a
 * self-served owner would have landed on a console with no salon in it. 3b built
 * `/business/new` and `NoSalonYet`, so that is no longer true: an owner who signs up
 * here is walked straight into adding their shop.
 *
 * Choosing "Business" promises a console, never a listing, and nothing here grants
 * anything. `handle_new_user` whitelists `customer | staff | owner` from the metadata
 * before writing the profile and says in its own comment that role is a routing hint;
 * authority is `businesses.owner_id` and RLS, and a salon created this way still opens
 * `pending` review.
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
  const [role, setRole] = useState<SignUpRole>("customer");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  /*
    **Per field, and all judged in one pass.** A form with three problems reports three, and
    each message names the field it belongs to rather than putting one line at the foot of the
    page about a field the person has already scrolled past.
  */
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string | null;
    email?: string | null;
    password?: string | null;
  }>({});

  const signUp = mode === "sign-up";
  const target = safeNext(next);

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    /*
      Judged here rather than left to the server, because the server answers about the
      *request*: `a@` comes back as "Unable to validate email address: invalid format", which
      says nothing about what to type instead. `lib/credentials.ts` is the one place these
      rules live, and it is shared with the guest wall.

      **The password rule differs by mode, and that is not an oversight.** Sign-up applies the
      8-character rule; sign-in checks only that the box is filled. Somebody who set a
      6-character password before that rule existed still has to be able to get in, and
      telling them their correct password is too short would be a lie about why they cannot.
    */
    const problems = {
      name: signUp ? nameError(fullName) : null,
      email: emailError(email),
      password: signUp ? newPasswordError(password) : signInPasswordError(password),
    };
    setFieldErrors(problems);
    if (problems.name || problems.email || problems.password) {
      setError(null);
      setInfo(null);
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
            data: { full_name: fullName.trim() || null, role },
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(target)}`,
          },
        });
        if (signUpError) throw signUpError;

        // With "Confirm email" on — which this project has — sign-up returns no
        // session. Say what actually has to happen next rather than claiming
        // success and landing them somewhere that still treats them as a stranger.
        if (!data.session) {
          setBusy(false);
          // An owner's next step is not a customer's — they have a shop to add before
          // the console has anything in it — and this note is the last thing they read
          // before leaving for their inbox.
          const then = role === "owner" ? " to add your salon" : "";
          setInfo(`Account created. Check ${email.trim()} to confirm, then sign in${then}.`);
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
          value={fullName}
          onChange={(v) => {
            setFullName(v);
            if (fieldErrors.name) setFieldErrors((e) => ({ ...e, name: null }));
          }}
          error={fieldErrors.name}
          autoComplete="name"
          prefix={<FieldIcon icon={Icons.person} />}
        />
      ) : null}

      <Field
        label="Email"
        type="email"
        value={email}
        onChange={(v) => {
          setEmail(v);
          if (fieldErrors.email) setFieldErrors((e) => ({ ...e, email: null }));
        }}
        error={fieldErrors.email}
        autoComplete="email"
        placeholder="you@example.com"
        required
        prefix={<FieldIcon icon={Icons.mail} />}
      />

      <Field
        label="Password"
        type={reveal ? "text" : "password"}
        value={password}
        onChange={(v) => {
          setPassword(v);
          if (fieldErrors.password) setFieldErrors((e) => ({ ...e, password: null }));
        }}
        error={fieldErrors.password}
        autoComplete={signUp ? "new-password" : "current-password"}
        // States the whole rule up front rather than letting somebody discover the letter and
        // the digit one refusal at a time.
        hint={signUp ? "At least 8 characters, with a letter and a number" : undefined}
        required
        prefix={<FieldIcon icon={Icons.locked} />}
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

      {signUp ? <RolePicker value={role} onChange={setRole} /> : null}

      {error ? <Note kind="error">{error}</Note> : null}
      {info ? <Note kind="success">{info}</Note> : null}

      {/* `shadow-cta-glow` is the one place in the product that shadow appears: this form has
          exactly one action, and on a white page under the warm wash the glow is what says
          so. See the utility's own note in `globals.css` for why it is not for a button
          among buttons. */}
      <Button type="submit" busy={busy} fullWidth className="mt-sm shadow-cta-glow">
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

/**
 * The two roles sign-up can mint. **A subset of `Role`, not a parallel union**, so that
 * `staff` and `admin` cannot leak in here: a stylist is linked to a salon by its owner
 * and an operator is promoted in SQL, neither of which is a thing to choose on a form.
 * `handle_new_user` whitelists the same way on the server.
 */
type SignUpRole = Extract<Role, "customer" | "owner">;

const ROLE_CHOICES: {
  value: SignUpRole;
  label: string;
  hint: string;
  icon: typeof Icons.salon;
}[] = [
  { value: "customer", label: "Customer", hint: "Book appointments", icon: Icons.person },
  { value: "owner", label: "Business", hint: "Run a salon", icon: Icons.salon },
];

/**
 * What someone is signing up as — a port of `_RoleToggle`
 * (`email_sign_in_screen.dart:384`), card for card: rausch outline and a pale tint on
 * the chosen one.
 *
 * **Real radios in a `<fieldset>`** where the Dart uses tappable cards. That is the
 * same departure `SelectTile` makes and for the same reason: arrow-key movement inside
 * the group, and a screen reader that reads "I am a — Business, 2 of 2" instead of two
 * unrelated controls. The input is `sr-only` rather than hidden so it still takes
 * focus, and the card paints the ring itself with `has-focus-visible` — a keyboard
 * user has to be able to see which card they are on.
 *
 * The one-line hints have no equivalent in the app, and are here because the audiences
 * differ: somebody who installed a salon app knows which one they are, somebody who
 * arrived from a search result may be reading the word "Business" cold.
 */
function RolePicker({
  value,
  onChange,
}: {
  value: SignUpRole;
  onChange: (role: SignUpRole) => void;
}) {
  return (
    <fieldset>
      <legend className="text-caption text-muted">I am a</legend>
      <div className="gap-md mt-sm flex">
        {ROLE_CHOICES.map(({ value: choice, label, hint, icon: Icon }) => {
          const selected = value === choice;
          return (
            <label
              key={choice}
              className={cn(
                "py-base px-sm flex flex-1 cursor-pointer flex-col items-center rounded-md border text-center",
                "transition-colors duration-[var(--duration-fast)]",
                "has-focus-visible:outline-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2",
                selected
                  ? "border-rausch bg-rausch-soft border-2"
                  : "border-hairline hover:border-border-strong",
              )}
            >
              <input
                type="radio"
                name="role"
                value={choice}
                checked={selected}
                onChange={() => onChange(choice)}
                className="sr-only"
              />
              <Icon
                className={selected ? "text-rausch" : "text-muted"}
                style={{ width: IconSize.md, height: IconSize.md }}
                aria-hidden
              />
              <span className="text-title text-ink mt-xs font-medium">{label}</span>
              <span className="text-caption-sm text-muted">{hint}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
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
