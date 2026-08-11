import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchMyBusinesses } from "../api/owner";
import { homeForRole } from "../auth";
import { requireLiveAccount } from "../session";
import { SESSION_ENDED_COOKIE, sessionEndedRedirect } from "../session-timeout";
import { createClient } from "../supabase/server";
import type { Business } from "../types/salon";
import { ACTIVE_BUSINESS_COOKIE, resolveActiveBusinessId } from "./active-business";

/**
 * Who is running which salon — the one gate and the one read the whole owner console
 * shares.
 *
 * **Wrapped in React's `cache`**, so the layout and the page inside it resolve the same
 * context from a single round trip. Without it every `/business` request would read
 * `businesses` twice, once to draw the switcher and once to answer "which salon's day am
 * I showing" — and worse, the two could disagree if the cookie changed between them.
 *
 * **The gate lives here rather than in `proxy.ts`** for the reason the proxy's own doc
 * comment gives: role is `profiles.role`, a table column and not a JWT claim, so a proxy
 * check would cost a `profiles` read on every request in the app including the public
 * ones. The real authority is RLS regardless — this only decides what to render.
 *
 * **Role decides where you land; `owner_id` decides what you can touch.** Nothing below
 * treats `role = 'owner'` as permission: `fetchMyBusinesses` matches `owner_id`, and every
 * write goes through an RPC that checks `private.is_business_member` itself. Someone whose
 * `role` says owner and who owns nothing gets an empty console, not an error.
 */

export type OwnerContext = {
  userId: string;
  /** Every salon they own, oldest first — the switcher's list. */
  businesses: Business[];
  /** The one being shown. `null` only when they own none. */
  active: Business | null;
};

export const getOwnerContext = cache(async (): Promise<OwnerContext> => {
  // Blocked before role, matching `auth_gate.dart:127`. A suspended owner reaching the
  // console would find every write refused with no explanation on screen.
  const account = await requireLiveAccount();

  // A visitor or a guest has no role to check yet. `?next=` brings them back here.
  if (account.state !== "registered") {
    redirect(
      sessionEndedRedirect("/business", (await cookies()).has(SESSION_ENDED_COOKIE)),
    );
  }

  // Symmetric with Discover sending an owner to `/business`: a customer, staff member or
  // admin who lands here goes to wherever their own role belongs. The two conditions are
  // disjoint, so the pair cannot loop.
  if (account.role !== "owner") {
    redirect(homeForRole(account.role));
  }

  const supabase = await createClient();
  const businesses = await fetchMyBusinesses(supabase, account.user.id);

  const saved = (await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value ?? null;
  const activeId = resolveActiveBusinessId(
    businesses.map((b) => b.id),
    saved,
  );

  return {
    userId: account.user.id,
    businesses,
    active: businesses.find((b) => b.id === activeId) ?? null,
  };
});

/*
 * There is deliberately no `requireActiveBusiness()` helper that redirects.
 *
 * The first attempt at one sent an owner with no salon to `/business` — which is itself a
 * page that would have called it, so an operator who created the account before the salon
 * got a redirect loop instead of a console. A layout cannot stand in for it either: in the
 * App Router the page renders *into* the layout, so its code runs whether or not the
 * layout goes on to use the result, and any side effect in it still fires.
 *
 * So each page branches explicitly — `if (!active) return <NoSalonYet />` — the same shape
 * the customer pages use for `account.state`. Two lines, no side effects, and the reason
 * a page is empty is visible in the page.
 */
