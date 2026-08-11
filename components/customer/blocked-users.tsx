"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { fetchMyBlockedUsers, unblockUser, type BlockedUser } from "@/lib/api/moderation";
import { createClient } from "@/lib/supabase/client";

/**
 * Who you have blocked, and the way back — a port of `blocked_users_screen.dart`.
 *
 * Its opening comment is the whole justification: Google Play asks for blocking, and **a
 * block with no undo is a trap rather than a tool**. Somebody who blocked a salon by mistake
 * would otherwise have no way to book with them again, because a block is symmetric and
 * takes the conversation with it.
 *
 * ## It re-reads instead of dropping the row
 *
 * `unblock_user` returns void, so the only way to know what is blocked *now* is to ask.
 * Removing the row locally would be faster and would mean a failed unblock leaves somebody
 * believing they have let a person back in — `blocked_users_screen.dart:36-39` makes the same
 * call and says so. The re-read is also what makes the list correct after two tabs.
 *
 * `unblock_user` raises nothing when there was no block, deliberately (see the migration), so
 * a double press is harmless rather than an error to explain.
 */
export function BlockedUsers({ initial }: { initial: BlockedUser[] }) {
  const [users, setUsers] = useState(initial);
  /** Which rows are mid-request. A set, because two unblocks can be in flight at once. */
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  async function unblock(user: BlockedUser) {
    if (busy.has(user.id)) return;
    setBusy((prev) => new Set(prev).add(user.id));
    try {
      const supabase = createClient();
      await unblockUser(supabase, user.id);
      setUsers(await fetchMyBlockedUsers(supabase));
      toast.success(`${displayName(user)} is unblocked.`);
    } catch {
      toast.error("Couldn't unblock. Try again.");
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
  }

  if (users.length === 0) {
    return (
      <EmptyState
        icon={Icons.unlocked}
        title="Nobody is blocked"
        message="Blocking someone stops their messages reaching you. You can do it from any conversation."
      />
    );
  }

  return (
    <ul className="border-hairline-soft divide-hairline-soft divide-y rounded-md border">
      {users.map((user) => (
        <li key={user.id} className="p-base gap-md flex items-center">
          <Avatar name={displayName(user)} photoUrl={user.avatarUrl} size={44} />
          <div className="min-w-0 flex-1">
            <p className="text-title text-ink truncate font-medium">{displayName(user)}</p>
            <p className="text-caption-sm text-muted">
              Blocked{" "}
              {/* `timeZone: UTC` would be wrong here — this is a real instant, not a
                  Thimphu day held as UTC midnight, so it formats in Bhutan time like every
                  other timestamp in the product. */}
              {user.blockedAt.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Thimphu",
              })}
            </p>
          </div>
          <Button
            variant="outlined"
            disabled={busy.has(user.id)}
            onClick={() => void unblock(user)}
          >
            Unblock
          </Button>
        </li>
      ))}
    </ul>
  );
}

/**
 * `my_blocked_users` returns `profiles.full_name`, which is nullable — **1 of 17 live
 * profiles has an avatar and most have a name, but nothing requires one.** A row with no name
 * still has to be unblockable, so it gets a placeholder rather than an empty line and an
 * avatar with no initials.
 */
function displayName(user: BlockedUser): string {
  const name = user.fullName?.trim();
  return name && name.length > 0 ? name : "Blocked account";
}
