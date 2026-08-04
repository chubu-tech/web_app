/**
 * Which navigation destination a path belongs to.
 *
 * Extracted from `components/customer/destinations.ts` in 3a, when the owner console
 * became the second thing that needed it. It moved rather than being copied because of
 * two cases a per-role copy gets wrong:
 *
 * - **A page reached from a destination but having none of its own.** `/salon/123` is
 *   opened from Discover, so Discover should stay lit. The customer version hard-coded
 *   `/salon` inside the helper; a second role hard-coding a third role's paths is how a
 *   shared helper stops being one. That exception is `alsoMatches` data now.
 * - **A destination that is the prefix of a sibling.** The owner console is the first
 *   place this happens: `/business` is the calendar and `/business/queue` is a separate
 *   tab, so plain prefix matching lights both. That is what `exact` is for.
 *
 * Lives in `lib/` and not beside the destination lists because it must not import an
 * icon: `lib/` never imports from `components/`, which is why the full `Destination`
 * type (icon and all) stays there and only the matching shape comes here.
 */

export type NavMatch = {
  href: string;
  /**
   * Match `href` itself and nothing below it. Set on a destination that is the prefix
   * of another one — a section root whose children are separate tabs. Paths below it
   * that should still light it up go in `alsoMatches`.
   *
   * `/` is always treated as exact whatever this says: prefix-matching the root would
   * claim every path in the app, so there is no other sensible reading of it.
   */
  exact?: boolean;
  /**
   * Extra path prefixes that also light this destination up — for pages reached
   * *from* it that have no destination of their own.
   */
  alsoMatches?: string[];
};

/** True when `pathname` belongs to `destination`. */
export function isCurrent(destination: NavMatch, pathname: string): boolean {
  const { href, exact = false, alsoMatches = [] } = destination;

  if (alsoMatches.some((prefix) => underPrefix(prefix, pathname))) return true;
  if (exact || href === "/") return pathname === href;

  return underPrefix(href, pathname);
}

/**
 * `prefix` itself, or a path below it — never a sibling that merely starts with the
 * same letters, so `/queue` does not claim `/queued-up`.
 */
function underPrefix(prefix: string, pathname: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
