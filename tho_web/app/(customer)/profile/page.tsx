import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Profile" };

/**
 * Profile — who you are and how to stop being it.
 *
 * Small on purpose in 2b: it exists because auth now does, and signing out needs a
 * home. Editing a profile, notification preferences and the legal pages arrive with
 * 2d. Nothing here is a placeholder — every row does what it says.
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
      </Shell>
    );
  }

  if (account.state === "guest") {
    return (
      <Shell>
        <EmptyState
          icon={Icons.person}
          title="Browsing as a guest"
          message="Your saved salons are kept. Create an account and they come with you — booking, queues and messages unlock too."
          action={
            <Link
              href="/sign-up?next=/profile"
              className="bg-rausch-cta text-on-primary text-title hover:bg-rausch-cta-pressed inline-flex min-h-12 items-center rounded-sm px-4 font-medium"
            >
              Create an account
            </Link>
          }
        />
        <div className="mt-lg mx-auto max-w-sm">
          <SignOutButton />
        </div>
      </Shell>
    );
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, avatar_url")
    .eq("id", account.user.id)
    .maybeSingle();

  const name = (profile?.full_name as string | null) ?? null;

  return (
    <Shell>
      <div className="gap-base flex items-center">
        <Avatar
          name={name ?? account.user.email ?? "You"}
          photoUrl={profile?.avatar_url as string | null}
          size={64}
        />
        <div className="min-w-0">
          <p className="text-display-sm text-ink truncate font-semibold">
            {name ?? "Your account"}
          </p>
          <p className="text-body-sm text-muted truncate">{account.user.email}</p>
          {profile?.phone ? (
            <p className="text-body-sm text-muted truncate">{profile.phone as string}</p>
          ) : null}
        </div>
      </div>

      <ul className="mt-lg border-hairline-soft divide-hairline-soft divide-y rounded-md border">
        <Row href="/bookings" icon={Icons.booking} label="My bookings" />
        <Row href="/saved" icon={Icons.favourite} label="Saved salons" />
      </ul>

      <div className="mt-lg max-w-sm">
        <SignOutButton />
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
