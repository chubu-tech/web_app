"use client";

import { useSyncExternalStore } from "react";

/**
 * What the customer has already watched land, remembered on their own device — a port of
 * `tho/app/lib/customer/loyalty/seen_stamps.dart`.
 *
 * There is no server-side notion of "seen", and inventing one would mean a write every time a
 * salon page opened. So the count last looked at lives in `localStorage`, in the same shape the
 * app keeps in `shared_preferences`: one value, read once, written once.
 *
 * Nothing here is readable by the salon. That is deliberate — the record of what a customer has
 * seen is theirs.
 */

/** Namespace, so these are recognisable in a dump of the store and cannot collide. */
const PREFIX = "tho.loyalty.stamps.seen";

/**
 * The key for one customer's card at one salon.
 *
 * It carries **both** ids, and both are load-bearing. A salon-only key would show one person's
 * new stamps to whoever picked up the phone next and — worse, because it is silent — would
 * suppress a real customer's celebration because a previous account in that browser had already
 * "seen" that count. Browsers get shared; this is not hypothetical.
 */
export function seenStampsKey(accountId: string, businessId: string): string {
  return `${PREFIX}:${accountId}:${businessId}`;
}

/**
 * What a load of the card should do: which stamp to start animating from, and whether this is
 * the load that completes the card.
 *
 * Stamps below `animateFrom` are already at rest; stamps from `animateFrom` up to the current
 * filled count arrive one after another. Pure over its inputs, so both decisions are testable
 * without a DOM or a clock.
 *
 * `lastSeen` is `null` for a customer who has never had this card on screen — which is not the
 * same as zero. Zero means they watched an empty card; `null` means they have never looked, and
 * only the second one suppresses every arrival.
 */
export function stampArrival({
  lastSeen,
  filled,
  total,
}: {
  lastSeen: number | null;
  filled: number;
  total: number;
}): { animateFrom: number; celebrate: boolean } {
  const now = filled < 0 ? 0 : filled;

  // A first-ever load presents at rest. Someone opening the page to check something else must
  // not be congratulated for a visit they made in June.
  if (lastSeen == null) return { animateFrom: now, celebrate: false };

  /*
    Clamped DOWN, never up. Spending points — or an owner correcting them — lowers the filled
    count, and without this the stored value strands itself above the new one: redeem at a full
    five-stamp card and the next four stamps land in silence. That fault presents to the customer
    as "the animation stopped working" and is near-impossible to diagnose from that report.
  */
  const seen = lastSeen < 0 ? 0 : Math.min(lastSeen, now);

  // Only the load that takes the card from incomplete to complete celebrates. Re-opening a card
  // that was already full is a card at rest.
  return { animateFrom: seen, celebrate: total > 0 && now >= total && seen < total };
}

/* -------------------------------------------------------------------------- */

/**
 * The stored count for this card, read **once per page view**.
 *
 * `useSyncExternalStore` for the reason `use-cart.ts` gives: `localStorage` is unreadable during
 * the server render, and a `useEffect` that reads it and calls `setState` is the render-effect-
 * render cascade the lint rule exists to prevent. The server snapshot is `null` — "never looked",
 * so the server renders the card at rest — and React swaps in the real value after hydration with
 * no mismatch warning and no flash.
 *
 * **The value is latched, and that is the whole difference from the cart.** The card writes the
 * new count as soon as it has presented it; if the snapshot then re-read `localStorage`, the next
 * render would find `animateFrom` equal to `filled` and cancel the arrival it had just started.
 * So the first read per key wins for the life of the page, and the write goes past it.
 *
 * There is deliberately no subscription: nothing else in this tab moves this value, and another
 * tab moving it mid-animation is not an event worth reacting to.
 *
 * **What the latch costs**, stated rather than left to be discovered: it holds for the life of
 * the page, so a customer who fills a card, claims it, comes back and *then* earns a point —
 * all without a reload — sees that stamp appear at rest instead of arriving. It takes a salon
 * completing a booking in the middle of that sequence, and any reload clears it. The alternative
 * is writing through to the latch, which is worse in a way that is not rare at all: `getSnapshot`
 * is called on every render, so the next re-render after the write would find `animateFrom` equal
 * to `filled` and snap a run of stamps that was still mid-flight.
 */
export function useSeenStamps(key: string | null): number | null {
  return useSyncExternalStore(
    subscribe,
    () => (key == null ? null : latchedRead(key)),
    () => null,
  );
}

const latched = new Map<string, number | null>();

function latchedRead(key: string): number | null {
  const hit = latched.get(key);
  if (hit !== undefined) return hit;
  const value = parse(readLocal(key));
  latched.set(key, value);
  return value;
}

function parse(raw: string | null): number | null {
  if (raw == null) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) ? n : null;
}

/** Records that `filled` stamps have now been presented. Idempotent, and never negative. */
export function writeSeenStamps(key: string, filled: number): void {
  writeLocal(key, String(Math.max(0, Math.trunc(filled))));
}

function subscribe(): () => void {
  return () => {};
}

/**
 * `localStorage` throws in Safari private mode and when a quota is exceeded, and a stamp
 * animation is never worth taking a page down for — so both accessors swallow. The degradation
 * is a card that arrives at rest, which is the same thing a first-ever visit gets.
 */
function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode or quota — the card still draws, it just animates again next time */
  }
}
