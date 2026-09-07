import type { SupabaseClient, User } from "@supabase/supabase-js";
import { jwtIsAnonymous } from "./jwt-claims";

/**
 * The account model, ported from `tho/app/lib/auth/` and `data/api.dart`.
 *
 * Three states, and the difference between the middle two is the whole design:
 *
 * - **No session** — a first-time visitor. Can read everything RLS allows for
 *   `anon`: approved salons, their services, hours, reviews.
 * - **Guest** — a real *anonymous* Supabase session. Reads work identically, and
 *   favourites/follows persist, but the server refuses anything that commits
 *   them: booking, joining a queue, ordering, redeeming, messaging.
 * - **Registered** — email confirmed, everything unlocked.
 *
 * The guest tier exists so that upgrading keeps the **same user id**, which is
 * why a guest's saved salons survive sign-up. That is the reason the app chose
 * anonymous sessions over public anon-key reads, and it applies here too.
 *
 * The server is the authority: `private.is_real_user()` checks `is_anonymous`,
 * so a guest that bypasses this UI still gets rejected by the RPC. Everything
 * here is for telling someone *before* they fill in a form.
 */

export type Role = "customer" | "staff" | "owner" | "admin";

/**
 * The part of the `profiles` row that routing depends on — **not just the role**.
 *
 * A port of `tho/app/lib/auth/account_state.dart`, and it exists for the reason that
 * file spells out: `role` alone cannot answer *"should this session still work at all"*.
 * Upstream's audit found a deleted account keeping a fully working session and creating
 * a confirmed booking (A2-01), and suspension read by nothing anywhere (A2-04). The
 * server refuses those writes now, but a refusal nobody can interpret is its own
 * failure — you land on Discover, press Book, and get *"the slot may have just been
 * taken"*.
 */
export type AccountState = {
  role: Role;
  deletedAt: Date | null;
  suspendedAt: Date | null;
  /** Null **while suspended** means indefinitely — not "not suspended". */
  suspendedUntil: Date | null;
};

/**
 * Mirrors `private.is_user_blocked` on the server: suspended, and either open-ended or
 * with an end still in the future. **A suspension that has run out is not a suspension**
 * — reading `suspended_at` alone would strand someone whose ban expired last month.
 */
export function isSuspended(s: AccountState, now: Date = new Date()): boolean {
  if (s.suspendedAt == null) return false;
  return s.suspendedUntil == null || s.suspendedUntil.getTime() > now.getTime();
}

export function isDeleted(s: AccountState): boolean {
  return s.deletedAt != null;
}

/** Either terminal state. Deletion is tested first everywhere, because the copy differs. */
export function isBlocked(s: AccountState, now: Date = new Date()): boolean {
  return isDeleted(s) || isSuspended(s, now);
}

export type Account =
  | { state: "anonymous"; user: null }
  | { state: "guest"; user: User }
  | { state: "registered"; user: User; role: Role; account: AccountState }
  /**
   * A session with **no readable `profiles` row**, which is deliberately its own state
   * rather than a shrug.
   *
   * `getAccount` used to end `(data?.role as Role) ?? "customer"`, so *"I could not read
   * the profile"* and *"this person is a customer"* were the same answer — meaning any
   * future tightening of `profiles` RLS would silently demote every owner and stylist to
   * the customer shell, with nothing logged and nothing shown. Upstream hit exactly this
   * and calls it A2-08. **An unknown must not be routed on.**
   */
  | { state: "unavailable"; user: User };

/** True when there is no session, or the session is anonymous. */
export function isGuestUser(user: User | null): boolean {
  return user === null || user.is_anonymous === true;
}

/**
 * Create a guest session, if there isn't one already.
 *
 * **Call this lazily** — from the first action that needs an identity, never on
 * page load and never from the proxy. Each call that actually signs in creates a
 * row in `auth.users`; doing it eagerly on a public website would mint one per
 * crawler visit. The Flutter app can be eager because an install is a person.
 */
export async function ensureGuestSession(
  supabase: SupabaseClient,
): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) return null;
  return data.user;
}

/**
 * What became of an attempt to turn a guest into a registered account.
 *
 * Three outcomes, not a boolean, because the middle two need different words and a
 * different button — and conflating them is what produced the defect below.
 */
export type GuestUpgrade =
  /** The session itself now proves a real account. Retry whatever they were doing. */
  | "ready"
  /** The account exists; this project requires the email round-trip before it is real. */
  | "awaitingEmailConfirmation"
  /** The account is real but this browser could not finish signing in to it. */
  | "sessionStale";

/**
 * Turn the current guest into a registered user, keeping the same user id — so anything they
 * saved as a guest survives.
 *
 * **`refreshSession` is the whole fix, and it is not optional.** `auth.updateUser()` does
 * *not* re-issue the access token: gotrue copies the new user into the existing session and
 * keeps the old JWT. So `getUser()` reports the new email while every RPC still reads
 * `is_anonymous: true` from the claim and refuses with `P0010`. Before this, the customer
 * met *"Create an account to book"* **after** creating one, as often as they retried — the
 * defect upstream fixed in `e71dfa0`, and this repo had it in the same shape.
 *
 * The judgement is made from **the claim in the refreshed token**, not from the user record,
 * because the claim is what `private.is_real_user()` reads. The two can no longer disagree.
 *
 * The profile name is written **after** the refresh, so it goes out under the new token. A
 * failure there costs the name, never the account — and `handle_user_meta_update`
 * (`20260902000004`) fills a blank `profiles.full_name` from the auth metadata anyway, so
 * this is the fast path rather than the only one.
 */
export async function upgradeGuest(
  supabase: SupabaseClient,
  email: string,
  password: string,
  fullName?: string,
): Promise<{ ok: boolean; outcome: GuestUpgrade; error?: string }> {
  const { error } = await supabase.auth.updateUser({
    email,
    password,
    data: fullName ? { full_name: fullName } : undefined,
  });
  if (error) {
    return { ok: false, outcome: "sessionStale", error: friendlyAuthError(error) };
  }

  const outcome = await resumeUpgrade(supabase);

  if (fullName && outcome === "ready") {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      // Best-effort: the account is already made, so a failed name write must not report the
      // upgrade as failed. `handle_new_user` cannot have set it — that trigger is AFTER
      // INSERT and an anonymous user's INSERT carries no metadata, which is why the salon
      // used to see "Guest" on a booking somebody had put their name to.
      const { error: nameError } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", data.user.id);
      if (nameError) {
        // Swallowed on purpose, and recoverable: `handle_user_meta_update`
        // (`20260902000004`) fills a blank `profiles.full_name` from the auth metadata this
        // upgrade just wrote, so the name still lands even when this write does not.
      }
    }
  }

  return { ok: true, outcome };
}

/**
 * Re-check whether this browser's session now proves a real account, **writing nothing**.
 *
 * This is what the wall's "Continue" calls. It has to be separate from
 * {@link upgradeGuest} for one reason: a second `updateUser` would try to create the account
 * again, and the person tapping Continue has already got one.
 */
export async function resumeUpgrade(supabase: SupabaseClient): Promise<GuestUpgrade> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) return "sessionStale";

  const claim = jwtIsAnonymous(data.session?.access_token);
  // `null` means the token could not be read — fall back to the user record rather than
  // treating "I could not tell" as an answer either way.
  const isGuest = claim ?? isGuestUser(data.user ?? null);

  return isGuest ? "awaitingEmailConfirmation" : "ready";
}

/**
 * Keep raw exception text out of the UI.
 *
 * A direct port of `_friendly` in `email_sign_in_screen.dart:137-155`. Matching
 * on message substrings is fragile, but it is what the app does and these are the
 * five failures people actually hit — a shared, well-judged mapping is worth more
 * than each surface inventing its own.
 */
export function friendlyAuthError(error: unknown): string {
  const s = String(
    typeof error === "object" && error !== null && "message" in error
      ? (error as { message: unknown }).message
      : error,
  ).toLowerCase();

  if (
    s.includes("already registered") ||
    s.includes("already been registered") ||
    // gotrue's newer wording, and the code it sends with it. A guest hitting this has an
    // account under a *different* user id, so upgrading this session can never reach it —
    // which is why the sentence has to say "sign out", not "try signing in".
    s.includes("email_exists") ||
    s.includes("already in use")
  ) {
    return "That email already has an account. Sign out and sign in with it instead.";
  }
  if (
    s.includes("invalid email") ||
    s.includes("email_address_invalid") ||
    // gotrue's actual wording for a malformed address, and the reason
    // `lib/credentials.ts` validates before the round trip: this arrives as a message
    // about the *request* ("invalid format") rather than about what the person typed.
    s.includes("unable to validate email")
  ) {
    return "That email address doesn't look right.";
  }
  if (s.includes("anonymous")) {
    // `manual_linking_disabled`, or an anonymous session the project will not upgrade.
    return "Guest accounts can't be upgraded right now. Please sign in instead.";
  }
  if (s.includes("invalid login") || s.includes("invalid credentials")) {
    return "Wrong email or password.";
  }
  if (s.includes("email not confirmed")) {
    return "Please confirm your email first — check your inbox.";
  }
  if (s.includes("password") && s.includes("6")) {
    return "Password must be at least 6 characters.";
  }
  if (s.includes("network") || s.includes("socket") || s.includes("timed out")) {
    return "Network trouble — check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}

/**
 * What a guest is stopped from doing, phrased as the action they attempted.
 *
 * The app shows these in a sheet at the point of action rather than redirecting
 * — losing someone's place mid-booking to a login page is worse than asking in
 * situ. Mirror that: a dialog, not a route change.
 */
export const GUEST_ACTIONS = {
  book: "book this appointment",
  queue: "join the queue",
  message: "message this salon",
  order: "place this order",
  redeem: "redeem this reward",
  save: "save your bookings",
} as const;

export type GuestAction = keyof typeof GUEST_ACTIONS;

/**
 * Where each role belongs after signing in.
 *
 * **Every branch returns a route that exists.** It used to point `staff` at `/staff`
 * and `owner` at `/business` before either was built, which meant the one caller had
 * to second-guess it — and the fallback it used (`/?tools=app`) was read by nothing,
 * so the "note instead of a 404" it promised never rendered and an owner silently
 * landed on Discover. 3a builds `/business`, so that branch is now true, and Phase 4
 * builds `/staff` — which was the single line this comment said would change when it
 * did. Before it, a linked stylist signed in and landed on customer Discover with no
 * route to their own book at all: the app's whole staff role had no web equivalent.
 *
 * This is a **landing** decision, not an authorisation one. Scoping is
 * `businesses.owner_id`, `staff_members.profile_id` and RLS; `profiles.role` only
 * decides where someone is sent.
 */
export function homeForRole(role: Role): string {
  switch (role) {
    case "owner":
      return "/business";
    case "staff":
      return "/staff";
    case "admin":
    case "customer":
      // Admins use the separate operator console; there is nothing for them
      // here, so they land on the customer side like anyone else.
      //
      // `/discover`, not `/`. The merge gave `/` to the marketing site, so signing a
      // customer in and sending them to the homepage would land them on a page inviting
      // them to download an app they are already using. Discover is the product home.
      return CUSTOMER_HOME;
  }
}

/**
 * Where the customer side begins — **a constant because more than one place has to agree
 * on it**, and the last time they disagreed the page broke for everybody signed in.
 *
 * Discover turns away anyone whose home is elsewhere, so its guard is
 * `home !== CUSTOMER_HOME`. When the marketing merge moved Discover from `/` to
 * `/discover`, that guard still read `home !== "/"` — which is *true* for a customer, so
 * the page redirected to itself. Every signed-in customer got the shell with an empty
 * middle, because the loop meant the page body never rendered at all.
 *
 * Anything navigating to the customer home builds its URL from this: the four `router.push`
 * calls in `components/customer/discover.tsx` were left pointing at `/` by the same merge,
 * which sent a filter change to the marketing homepage.
 */
export const CUSTOMER_HOME = "/discover";
