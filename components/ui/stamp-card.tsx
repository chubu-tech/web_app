"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfettiBurst } from "@/components/ui/confetti-burst";
import { Icons } from "@/components/ui/icons";
import { seenStampsKey, stampArrival, useSeenStamps, writeSeenStamps } from "@/lib/seen-stamps";
import { cn } from "@/lib/utils";

/**
 * A salon's loyalty programme drawn the way the corner shop draws it — a row of stamps, filled
 * for the visits banked and empty for the visits to go, with the reward named underneath. A port
 * of `tho/app/lib/ui/widgets/stamp_card.dart`.
 *
 * It shows what the points ledger already holds; `stampCardFor` in `lib/loyalty.ts` decides
 * whether a programme can be drawn this way at all, and everything it refuses keeps the ring.
 *
 * ## Stamps arriving are an event
 *
 * A stamp that was earned since the customer last looked **lands**, one every 60ms, and the one
 * that completes the card is followed by a burst. What they have already watched arrive is at
 * rest — see `lib/seen-stamps.ts`, which is also where the two ways of getting that wrong are
 * written down.
 *
 * The decision is read through `useSeenStamps`, so the server renders the card at rest and React
 * swaps the real value in after hydration. That is `useSyncExternalStore` rather than a
 * `useEffect` that reads `localStorage` and calls `setState`, which is the cascade
 * `react-hooks/set-state-in-effect` exists to stop and which `use-cart.ts` already solved this
 * way.
 *
 * ## The row wraps, and the dots do not scale
 *
 * Twelve stamps do not fit one line on a 320px screen, so they wrap — the one strip in this
 * sweep that is not a horizontal scroller, because a card is a shape to take in at a glance and
 * half of one off the edge is not. The dot size is fixed for the same reason while the labels
 * under it still scale with the reader's setting: a row whose job is to be countable must not
 * grow itself off the screen.
 */
export function StampCard({
  filled,
  total,
  rewardName,
  accountId,
  businessId,
  onClaim,
  claiming = false,
}: {
  /** Stamps banked. Never greater than `total` — `stampCardFor` clamps it. */
  filled: number;
  /** Stamps on the card. */
  total: number;
  /** The reward the card leads to, named so the customer knows what they are collecting. */
  rewardName: string;
  /**
   * The signed-in account, or null for a visitor.
   *
   * Null means nothing is remembered and nothing arrives, which is right: a visitor has no
   * balance, so every stamp on screen is a zero.
   */
  accountId: string | null;
  businessId: string;
  /** Claiming what a completed card has earned. The salon page's own redeem path — never a second. */
  onClaim?: () => void;
  claiming?: boolean;
}) {
  const key = accountId ? seenStampsKey(accountId, businessId) : null;
  const lastSeen = useSeenStamps(key);
  const { animateFrom, celebrate } = stampArrival({ lastSeen, filled, total });
  const arriving = Math.max(0, filled - animateFrom);
  const complete = total > 0 && filled >= total;

  // Written once this load has been handed to the browser, so the next open is at rest —
  // including the load that has just clamped a stale count down.
  useEffect(() => {
    if (key) writeSeenStamps(key, filled);
  }, [key, filled]);

  /*
    The burst waits for the last stamp to land, so it reads as a response to the card filling
    rather than as decoration that happened to start at the same time. `setState` inside a timer
    is not `setState` in an effect: the effect arms a clock, and the clock is the event.
  */
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    if (!celebrate) return;
    const timer = setTimeout(() => setBurst(true), arriving * STAGGER_MS + 320);
    return () => clearTimeout(timer);
  }, [celebrate, arriving]);

  return (
    <div
      className={cn(
        "p-md rounded-md border",
        complete ? "bg-rausch-soft border-rausch" : "bg-canvas border-hairline",
      )}
    >
      {burst ? <ConfettiBurst onDone={() => setBurst(false)} /> : null}

      {/* One graphic with one name, the way `Ring` on the salon page already does it. A list
          whose every item is hidden would announce as an empty list carrying a label. */}
      <div
        role="img"
        aria-label={`${filled} of ${total} stamps collected`}
        className="gap-sm flex flex-wrap"
      >
        {Array.from({ length: total }, (_, i) => {
          const isFilled = i < filled;
          return (
            <span
              /* The key carries the state as well as the position, so a stamp that flips from
                 empty to filled becomes a NEW element and its animation actually plays. Reuse the
                 element and a one-shot animation never runs — upstream's own note. */
              key={`${i}-${isFilled}`}
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full",
                /* `rausch`, not `rausch-cta`. The substitution this repo makes everywhere else is
                   for small white *text* needing 4.5:1; a 16px glyph is a graphical object at
                   3:1, which white on `#FF385C` clears. And the complete card's own edge is
                   `border-rausch`, so the other crimson here would read as two shades by
                   mistake. */
                isFilled ? "bg-rausch" : "bg-surface-soft border-hairline border",
                isFilled && i >= animateFrom && "animate-stamp-in",
              )}
              style={
                isFilled && i >= animateFrom
                  ? { animationDelay: `${(i - animateFrom) * STAGGER_MS}ms` }
                  : undefined
              }
            >
              {isFilled ? (
                <Icons.check
                  className="text-on-primary"
                  style={{ width: 16, height: 16 }}
                  aria-hidden
                />
              ) : null}
            </span>
          );
        })}
      </div>

      <p className="text-title text-ink mt-md font-medium">{rewardName}</p>
      <p className={cn("text-body-sm mt-xxs", complete ? "text-rausch-cta" : "text-muted")}>
        {remainingLine(filled, total)}
      </p>

      {complete && onClaim ? (
        <Button busy={claiming} fullWidth onClick={onClaim} className="mt-md">
          Claim reward
        </Button>
      ) : null}
    </div>
  );
}

/**
 * One stamp lands every 60ms — the same cadence the reward rows use, so the whole loyalty
 * section moves at one speed.
 */
const STAGGER_MS = 60;

/** The gap, stated so the customer never has to subtract. */
function remainingLine(filled: number, total: number): string {
  const left = total - filled;
  if (left <= 0) return "Card full — your reward is ready";
  return `${left} ${left === 1 ? "visit" : "visits"} to go`;
}
