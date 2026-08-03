import "server-only";

import { createClient } from "./supabase/server";
import { isGuestUser, type Account, type Role } from "./auth";

/**
 * Who is asking, resolved on the server.
 *
 * Role comes from `profiles.role` — a table column, never a JWT claim, because
 * the database authorises on the table too. Resolving it here rather than in a
 * client component avoids the problem the Flutter app had to work around
 * (`auth_gate.dart:37-45`): a background token refresh re-firing the role fetch
 * and flashing the whole shell back to a spinner. On the server there is no
 * refresh to race.
 */
export async function getAccount(): Promise<Account> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { state: "anonymous", user: null };
  if (isGuestUser(user)) return { state: "guest", user };

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // A registered user with no profile row shouldn't happen — the
  // `handle_new_user` trigger provisions one — but treat it as a customer
  // rather than crashing the shell.
  return { state: "registered", user, role: (data?.role as Role) ?? "customer" };
}

/** The signed-in user's id, or null. Guests count: they have a real id. */
export async function getUserId(): Promise<string | null> {
  const account = await getAccount();
  return account.user?.id ?? null;
}
