import type { Metadata } from "next";
import { BrandLockup } from "@/components/ui/brand-lockup";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Icons, IconSize } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Account unavailable",
  // Never index a page that only exists for one signed-in person in trouble.
  robots: { index: false, follow: false },
};

/**
 * The end of the line for a deleted, suspended or unreadable account — a port of
 * `tho/app/lib/auth/account_blocked_screen.dart`.
 *
 * ## Why it exists at all
 *
 * Both terminal states used to be invisible to the client on both platforms. Upstream's
 * audit found a **deleted** account keeping a fully working session and creating a
 * confirmed booking (A2-01), and a **suspended** one booking, messaging, ordering and
 * queueing exactly as before (A2-04). The server refuses all of that now — but a refusal
 * nobody can interpret is its own failure: you land on Discover, press Book, and get
 * *"the slot may have just been taken"*, which is a lie about what happened.
 *
 * So this says the true thing once, plainly, and offers the only action left.
 *
 * ## Three reasons, not two
 *
 * `deleted` and `suspended` are upstream's. **`unavailable`** is the web's third and it
 * is not a blocked account at all — it is a session whose `profiles` row could not be
 * read. That used to resolve to "customer" (see `getAccount`), which is the A2-08 defect:
 * an unknown routed as a fact. It gets its own copy because telling somebody their
 * account is suspended when the truth is "we could not load it" would be a worse lie than
 * the one this page fixes.
 *
 * ## It renders outside every shell
 *
 * `app/account/` is its own segment, so there is no customer nav, no console chrome and
 * no footer — nothing to click that would only fail. It carries its own lockup for the
 * same reason `app/not-found.tsx` does: a page with no way out is a dead end. The lockup
 * links home, which for a blocked account means the sign-in page once they sign out.
 *
 * **The session is deliberately still alive while this renders.** See `requireLiveAccount`.
 */
export default async function AccountBlockedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string | string[] }>;
}) {
  const raw = (await searchParams).reason;
  const reason = Array.isArray(raw) ? raw[0] : raw;

  const copy = COPY[reason === "deleted" || reason === "suspended" ? reason : "unavailable"];

  return (
    <div
      data-shell="customer"
      className="bg-canvas flex min-h-full flex-col"
    >
      <header className="border-hairline-soft px-base tablet:px-lg flex h-[var(--header-height)] shrink-0 items-center border-b">
        <BrandLockup />
      </header>

      <main className="flex-1">
        <div className="px-base py-xxl tablet:px-lg mx-auto w-full max-w-[560px]">
          <span
            aria-hidden
            className="bg-error-soft mb-lg grid size-16 place-items-center rounded-full"
          >
            <Icons.error
              className="text-error-text"
              style={{ width: IconSize.lg, height: IconSize.lg }}
            />
          </span>

          <h1 className="text-display-lg text-ink font-semibold">{copy.title}</h1>
          <p className="text-body-md text-body mt-base">{copy.body}</p>
          {copy.detail ? (
            <p className="text-body-sm text-muted mt-md">{copy.detail}</p>
          ) : null}

          <div className="mt-xl">
            {/* The one action. A form POST to the route handler, the same path every
                other sign-out on the site uses — it also clears `tho_active_business`,
                which browser JavaScript architecturally cannot. */}
            <SignOutButton label="Sign out" fullWidth={false} />
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Deletion is permanent and suspension is not, so they must not share a sentence.
 *
 * No end date is quoted for a suspension even though `suspended_until` exists: it is
 * null for an indefinite ban, and a page that says "until 3 March" in one case and
 * nothing in the other reads as a bug rather than as two different situations. The
 * salon is not the right place to appeal to either — the operator is.
 */
const COPY = {
  deleted: {
    title: "This account has been deleted",
    body: "You can't sign in to it any more, and your bookings, saved salons and messages are no longer available here.",
    detail:
      "Some records are kept for a period where the law requires it — a completed booking a salon needs for its own accounts, for example.",
  },
  suspended: {
    title: "This account is suspended",
    body: "You can't book, message, order or join a queue while a suspension is in place.",
    detail: "If you think this is a mistake, reply to the email you received about it.",
  },
  unavailable: {
    title: "We couldn't load your account",
    body: "You're signed in, but we can't read your account details — so we've stopped rather than guess what you can do.",
    detail: "Signing out and back in usually clears it. If it keeps happening, let us know.",
  },
} as const;
