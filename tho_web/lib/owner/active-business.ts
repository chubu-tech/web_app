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
