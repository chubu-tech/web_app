import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlockedUsers } from "@/components/customer/blocked-users";
import { HeroCircleButton } from "@/components/ui/detail-bits";
import { Icons } from "@/components/ui/icons";
import { fetchMyBlockedUsers } from "@/lib/api/moderation";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Blocked accounts",
  // Nobody else's business, and nothing here is a landing page.
  robots: { index: false, follow: false },
};

/**
 * Blocked accounts — a **route**, not a section of `/profile`.
 *
 * Three reasons, all of which the app's own `BlockedUsersScreen` gets by being a pushed
 * route:
 *
 * - **The empty state has to be reachable.** Almost nobody has blocked anybody — there are
 *   **0 `user_blocks` rows platform-wide** — so a block-list that only appeared when it had
 *   contents would be invisible in the one state that needs explaining: *"nobody is blocked,
 *   and here is where blocking happens"*.
 * - **The block sheet points at it by name.** It promises "you can undo it any time from
 *   Blocked accounts in your profile", and that promise needs somewhere to land.
 * - `/profile` is already an editor, two fact tables, a row list, an About block and a
 *   delete-account card. A sixth block on it is where a page stops being a page.
 *
 * **Not in `destinations.ts`**, deliberately: this is a control, not a place to go, and the
 * nav's rule is that every destination it lists is somewhere someone wants to be. The row on
 * `/profile` is written out for the same reason the legal links in the footer are.
 *
 * The read is server-side so the list is in the first paint; `BlockedUsers` re-reads after
 * every unblock, because the server is the authority on who is blocked.
 */
export default async function BlockedAccountsPage() {
  const account = await getAccount();
  // `my_blocked_users` raises `28000` without a session, and a guest can hold no blocks —
  // `block_user` requires `private.is_real_user()`. So there is nothing here for either,
  // and a 404 is the honest answer rather than an empty state that could never fill.
  if (account.state !== "registered") notFound();

  const supabase = await createClient();
  const blocked = await fetchMyBlockedUsers(supabase).catch(() => []);

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <div className="gap-md mb-lg flex items-center">
        <HeroCircleButton icon={Icons.back} label="Back to profile" href="/profile" />
        <h1 className="text-display-lg text-ink font-medium">Blocked accounts</h1>
      </div>

      <p className="text-body-md text-body mb-lg">
        A block works both ways: their messages stop reaching you and yours stop reaching
        them, and the conversation disappears from both sides. Nothing is deleted, and it
        comes back if you unblock them.
      </p>

      <BlockedUsers initial={blocked} />
    </div>
  );
}
