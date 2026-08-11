import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { fetchMyStaffMember } from "../api/staff";
import { homeForRole } from "../auth";
import { requireLiveAccount } from "../session";
import { createClient } from "../supabase/server";
import type { StaffMember } from "../types/salon";

/**
 * Which stylist is signed in — the one gate and the one read the staff shell shares.
 *
 * A sibling of `lib/owner/context.ts`, deliberately parallel rather than parameterised: the
 * two shells resolve *different things* (a salon versus a staff row) and only look alike in
 * outline. Where they genuinely agree is `homeForRole`, and both call it.
 *
 * **Wrapped in React's `cache`**, so the layout's header and the page inside it resolve the
 * same stylist from a single `staff_members` read. Without it every `/staff` request would
 * read the row twice and the two copies could disagree.
 *
 * **Role decides where you land; the staff row decides what you can see.** Nothing here
 * treats `profiles.role = 'staff'` as permission. The authority is
 * `private.is_business_member`, which admits an *active* `staff_members.profile_id` — so
 * `role` only chooses the shell, and an owner who deactivates a stylist revokes the access
 * itself. A `staff` role with no linked row is not an error: it gets the app's "Not linked
 * yet" state, the same way `role = 'owner'` with no salon gets an empty console.
 */

export type StaffContext = {
  userId: string;
  /** The caller's own staff row. `null` until an owner links them. */
  me: StaffMember | null;
};

export const getStaffContext = cache(async (): Promise<StaffContext> => {
  // Blocked before role, matching `auth_gate.dart:127`: a suspended stylist must meet
  // the explanation, not an empty rota they cannot act on.
  const account = await requireLiveAccount();

  // A visitor or a guest has no role to check yet. `?next=` brings them back here.
  if (account.state !== "registered") {
    redirect(`/sign-in?next=${encodeURIComponent("/staff")}`);
  }

  // Symmetric with `/business` turning away a non-owner: a customer, owner or admin who
  // lands here goes wherever their own role belongs. The conditions are disjoint, so the
  // pair cannot loop.
  if (account.role !== "staff") {
    redirect(homeForRole(account.role));
  }

  const supabase = await createClient();
  const me = await fetchMyStaffMember(supabase, account.user.id);

  return { userId: account.user.id, me };
});
