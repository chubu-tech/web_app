import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";
import {
  isBlocked,
  isDeleted,
  isGuestUser,
  type Account,
  type AccountState,
  type Role,
} from "./auth";

/**
 * Who is asking, resolved on the server.
 *
 * Role comes from `profiles.role` — a table column, never a JWT claim, because
 * the database authorises on the table too. Resolving it here rather than in a
 * client component avoids the problem the Flutter app had to work around
 * (`auth_gate.dart:37-45`): a background token refresh re-firing the role fetch
 * and flashing the whole shell back to a spinner. On the server there is no
 * refresh to race.
 *
 * ## It reads four columns, not one
 *
 * `role, deleted_at, suspended_at, suspended_until` — a port of `Api.myAccountState`,
 * and the extra three are what let a shell refuse a session that the server has already
 * stopped honouring. See `AccountState` in `lib/auth.ts` for the two audit findings that
 * put them there.
 *
 * **A missing row is `unavailable`, not `customer`.** This used to end
 * `?? "customer"`, which made "could not read the profile" indistinguishable from "is a
 * customer" — so tightening `profiles` RLS would have quietly demoted every owner and
 * stylist into the customer shell. Upstream calls this A2-08 and refuses to route on it;
 * so does this.
 *
 * ## `cache()` — it was running three times a page
 *
 * Measured on `/salon/[id]`: **three** `getAccount` calls per request, the first two timed
 * at **1239 ms and 1231 ms**. Each is a `supabase.auth.getUser()` — a network round trip to
 * the Auth server, which is what that second-plus is — followed by a `profiles` select.
 * Nothing was wrong with any single call site: the shell layout needs the account, the page
 * needs it, and a reader like `fetchMyFavouriteIds` needs the id. They had no way to share.
 *
 * `cache()` makes them share, per request. Both reads are unchanged, so this is a latency
 * fix with no behavioural surface: same result, same authority, same `profiles` columns,
 * once instead of three times.
 *
 * **Not a security relaxation.** The memo lives for one request and dies with it, so no
 * account state can survive into another visitor's render. Validation still happens — the
 * shared client performs a real `getUser()` against the Auth server exactly as before — and
 * the role still comes from the `profiles` table, never a JWT claim.
 */
export const getAccount = cache(async (): Promise<Account> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { state: "anonymous", user: null };
  if (isGuestUser(user)) return { state: "guest", user };

  const { data } = await supabase
    .from("profiles")
    .select("role, deleted_at, suspended_at, suspended_until")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return { state: "unavailable", user };

  const row = data as Record<string, unknown>;
  const at = (key: string): Date | null => {
    const raw = row[key];
    return typeof raw === "string" ? new Date(raw) : null;
  };

  const account: AccountState = {
    role: (row.role as Role) ?? "customer",
    deletedAt: at("deleted_at"),
    suspendedAt: at("suspended_at"),
    suspendedUntil: at("suspended_until"),
  };

  return { state: "registered", user, role: account.role, account };
});

/** The signed-in user's id, or null. Guests count: they have a real id. */
export async function getUserId(): Promise<string | null> {
  const account = await getAccount();
  return account.user?.id ?? null;
}

/**
 * Stop a deleted, suspended or unreadable account before it reaches a shell.
 *
 * Called from all three shell layouts — customer, `/business`, `/staff` — because those
 * are the three doors, and upstream checks this **before anything else**, ahead of the
 * role switch and ahead of the invite prompt (`auth_gate.dart:127`).
 *
 * **It does not sign anybody out.** Upstream is explicit about why
 * (`account_blocked_screen.dart:31-37`): tearing the session down here fires the auth
 * listener, swaps the explanation for the sign-in form, and leaves the person bounced to
 * a login page having read nothing — which is the confusion the screen exists to remove.
 * The session is safe to leave alive for the few seconds it takes to read, because every
 * write is already refused server-side by `private.is_user_blocked()`. The button on the
 * page is what ends it.
 *
 * Anonymous visitors and guests pass straight through: there is no profile row to judge.
 */
export async function requireLiveAccount(): Promise<Account> {
  const account = await getAccount();

  if (account.state === "unavailable") {
    redirect("/account/blocked?reason=unavailable");
  }
  if (account.state === "registered" && isBlocked(account.account)) {
    redirect(
      `/account/blocked?reason=${isDeleted(account.account) ? "deleted" : "suspended"}`,
    );
  }

  return account;
}
