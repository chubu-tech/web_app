/**
 * Which of an owner's salons the console is currently showing.
 *
 * A port of `resolveActiveBusinessId` in `tho/app/lib/business/business_home.dart`,
 * which is pure there for the same reason it is pure here — it is the one piece of the
 * salon switcher worth testing, and the seeded owner runs **nine** salons, so it is not
 * a hypothetical.
 *
 * **Where the choice is stored differs from the app, and had to.** The app keeps it in
 * `SharedPreferences['active_business_<uid>']`. Here the shell is a *server* component
 * that must know the active salon before it renders a single row, so client storage is
 * not available in time — it is an `httpOnly` cookie, and this function is what stops
 * that cookie being trusted. A forged value naming a salon the caller does not own
 * falls back to their first. RLS would refuse the data anyway; the point is that the
 * console must not *appear* to have switched.
 */

/** The cookie the console reads the active salon from. */
export const ACTIVE_BUSINESS_COOKIE = "tho_active_business";

/**
 * The cookie's attributes, in one place so the write and the clear cannot drift apart.
 *
 * That mattered: until sign-out was fixed, **nothing in the repo ever cleared this cookie** — it
 * was written with a one-year `maxAge` and `path: "/"` and simply stayed, so a till machine kept
 * sending a previous user's salon id on every request long after their session was gone. A browser
 * cannot clear it either, because it is `httpOnly`. Clearing it needs a Route Handler sending the
 * *same* name, path and protocol back with `maxAge: 0`, which is why these live beside the name
 * rather than being spelled out at each call site.
 *
 * Not a data leak — `resolveActiveBusinessId` filters against what the caller owns and RLS refuses
 * the rows regardless — but it is exactly the residue a sign-out is expected to clear.
 */
export const ACTIVE_BUSINESS_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
} as const;

/** A year: which salon you were last looking at is a preference, not a session. */
export const ACTIVE_BUSINESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The saved salon if it is still one of `ownedIds`, else the first, else `null` for an
 * owner with no salon at all — who gets the "no salon yet" state rather than a crash.
 *
 * `ownedIds` must arrive in a stable order (the console reads them `created_at, id`, as
 * the app does), or "the first" would move between requests.
 */
export function resolveActiveBusinessId(
  ownedIds: string[],
  saved: string | null | undefined,
): string | null {
  if (ownedIds.length === 0) return null;
  if (saved != null && ownedIds.includes(saved)) return saved;
  return ownedIds[0];
}
