import type { Metadata } from "next";
import Link from "next/link";
import { readySecondary } from "@/components/customer/destinations";
import { ProfileEditor } from "@/components/customer/profile-editor";
import { DeleteAccountCard } from "@/components/auth/delete-account";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { fetchMyProfile } from "@/lib/api/profile";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { THIMPHU_TZ } from "@/lib/time";

export const metadata: Metadata = { title: "Profile" };

/**
 * Profile — who you are, what is under it, and how to stop being it.
 *
 * 2e made it editable. It is also where the app's **drawer** lives on this platform:
 * `SECONDARY` renders as rows below 744, where the tab bar carries only the five app
 * tabs.
 *
 * **There is no `/settings`, on purpose.** The app's Settings screen is two switches
 * writing `notif_reminders` / `notif_promos` to SharedPreferences that *nothing reads
 * back* — the screen says so itself — plus two read-only facts. `profiles` has no
 * preference columns, so there is nothing to persist and nothing to honour. The two
 * facts are the About block at the bottom of this page; the switches are not ported,
 * because a control that changes nothing is the same dishonesty as promising a
 * notification nothing sends.
 *
 * `profile_screen.dart:230-241` also links Privacy, Terms and Help, which are MVP
 * stubs in the app. They stay out of a public website until there is real copy.
 */
export default async function ProfilePage() {
  const account = await getAccount();

  if (account.state === "anonymous") {
    return (
      <Shell>
        <EmptyState
          icon={Icons.person}
          title="You're browsing as a visitor"
          message="Sign in to see your bookings and saved salons."
          action={
            <Link
              href="/sign-in?next=/profile"
              className="bg-rausch-cta text-on-primary text-title hover:bg-rausch-cta-pressed inline-flex min-h-12 items-center rounded-sm px-4 font-medium"
            >
              Sign in
            </Link>
          }
        />
        <About />
      </Shell>
    );
  }

  if (account.state === "guest") {
    return (
      <Shell>
        <EmptyState
          icon={Icons.person}
          title="Browsing as a guest"
          message="Your saved salons and the stylists you follow are kept. Create an account and they come with you — booking, queues and messages unlock too."
          action={
            <Link
              href="/sign-up?next=/profile"
              className="bg-rausch-cta text-on-primary text-title hover:bg-rausch-cta-pressed inline-flex min-h-12 items-center rounded-sm px-4 font-medium"
            >
              Create an account
            </Link>
          }
        />
        {/* Written out rather than `max-w-sm`, which resolves to `--spacing-sm` — 8px,
            which is narrower than the button's own text. See `components/ui/sheet.tsx`. */}
        <div className="mt-lg mx-auto max-w-[24rem]">
          <SignOutButton />
        </div>
        <About />
      </Shell>
    );
  }

  const supabase = await createClient();
  const profile = await fetchMyProfile(supabase, account.user.id);

  return (
    <Shell>
      {/* A guest has no name anyone will ever read — they cannot book, queue, order or
          message — so the editor is registered-only. */}
      <ProfileEditor
        initial={{
          fullName: profile?.fullName ?? null,
          phone: profile?.phone ?? null,
          avatarUrl: profile?.avatarUrl ?? null,
        }}
        email={account.user.email ?? null}
      />

      <dl className="mt-lg border-hairline-soft divide-hairline-soft divide-y rounded-md border">
        {account.user.email ? (
          <Fact icon={Icons.mail} label="Email" value={account.user.email} />
        ) : null}
        <Fact
          icon={Icons.person}
          label="Account type"
          value={capitalise(profile?.role ?? "customer")}
        />
      </dl>

      {/* Everything in `SECONDARY`, which is where it lives below 744 — the tab bar
          carries only the five app tabs. Driven off the same list as the nav so the two
          can never disagree about what exists, and My bookings leads because it is what
          someone opening Profile most often wants. */}
      <ul className="mt-lg border-hairline-soft divide-hairline-soft divide-y rounded-md border">
        <Row href="/bookings" icon={Icons.booking} label="My bookings" />
        {readySecondary().map((d) => (
          <Row key={d.href} href={d.href} icon={d.icon} label={d.label} />
        ))}
      </ul>

      {/*
        Safety, in its own group rather than mixed into the destinations above.

        **Written out, not from `destinations.ts`**, for the reason the footer's legal group
        is: blocked accounts is a control, not a place someone wants to be, and the nav's
        list is of places. It is a row rather than a section on this page so that its empty
        state — the ordinary one, since **0 accounts are blocked platform-wide** — is
        reachable and can say where blocking actually happens. The block sheet promises this
        row by name.
      */}
      <ul className="mt-lg border-hairline-soft divide-hairline-soft divide-y rounded-md border">
        <Row href="/profile/blocked" icon={Icons.locked} label="Blocked accounts" />
      </ul>

      {/* `max-w-sm` again — see above. */}
      <div className="mt-lg max-w-[24rem]">
        <SignOutButton />
      </div>

      <About />

      {/* Last on the page, under everything, and the only destructive control a customer
          has. A store-compliance surface as much as a feature — see the component. */}
      <div className="max-w-[24rem]">
        <DeleteAccountCard />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <h1 className="text-display-lg text-ink mb-lg font-medium">Profile</h1>
      {children}
    </div>
  );
}

/**
 * The two things from the app's Settings screen that are true and unchangeable.
 *
 * Styled as facts, not rows, and `settings_screen.dart:143` records why that matters:
 * the previous flat list of `ListTile`s gave a build number the same visual weight as a
 * preference someone could actually change.
 *
 * Shown to a visitor and a guest as well — the time zone is the one thing on this page
 * that a signed-out reader might genuinely need, because every time in the product is
 * in it.
 */
function About() {
  return (
    <section className="mt-xl">
      <h2 className="text-caption text-muted mb-sm font-semibold tracking-wide uppercase">
        About
      </h2>
      <dl className="border-hairline-soft divide-hairline-soft divide-y rounded-md border">
        <Fact
          icon={Icons.clock}
          label="Time zone"
          value={`Bhutan time (${THIMPHU_TZ})`}
        />
        <Fact icon={Icons.info} label="Version" value="Tho for web 1.0.0" />
      </dl>
    </section>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Icons.info;
  label: string;
  value: string;
}) {
  return (
    <div className="p-base gap-md flex min-h-14 items-center">
      <Icon
        className="text-muted shrink-0"
        style={{ width: IconSize.sm, height: IconSize.sm }}
        aria-hidden
      />
      <dt className="text-body-md text-body flex-1">{label}</dt>
      <dd className="text-body-sm text-muted min-w-0 truncate text-right">{value}</dd>
    </div>
  );
}

function Row({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Icons.booking;
  label: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="p-base gap-md text-title text-ink hover:bg-surface-soft flex min-h-14 items-center font-medium"
      >
        <Icon className="text-muted size-5 shrink-0" aria-hidden />
        <span className="flex-1">{label}</span>
        <Icons.chevronRight className="text-muted-soft size-4 shrink-0" aria-hidden />
      </Link>
    </li>
  );
}

function capitalise(role: string): string {
  return role.length === 0 ? "—" : role[0]!.toUpperCase() + role.slice(1);
}
