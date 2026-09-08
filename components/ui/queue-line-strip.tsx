import { Icons } from "@/components/ui/icons";
import { orderedShopWide } from "@/lib/queue-logic";
import { isDeferred, type QueueEntry } from "@/lib/types/queue";
import { cn } from "@/lib/utils";

/**
 * The line itself, as a row of heads — a port of
 * `tho/app/lib/ui/widgets/queue_line_strip.dart`.
 *
 * **A position number on its own is a claim the customer has to take on trust**, and it
 * moves once every few minutes, which on a phone in a waiting room reads as nothing moving
 * at all. This shows the shop: the chairs that are cutting, the people between the customer
 * and one of them, and a couple who joined behind. When somebody is called, a pip goes and
 * the customer's own pip slides left — the same event they would otherwise have seen only
 * as "#4" quietly becoming "#3".
 *
 * **PII-free by construction, and that is not a compromise.** `queue_active_line`, the
 * projection this is drawn from, carries no names at all — there was never a choice to make
 * about showing other customers' identities. Heads in a line is exactly the amount of
 * information a shop's own waiting room gives you.
 *
 * ## Accessibility
 *
 * The pips are `aria-hidden` and the caption underneath is the text alternative — it is not
 * a summary of the picture, it *is* the same fact in words, which is why it is worth
 * rendering for everybody rather than hiding one of the two.
 *
 * ## Overflow, where this departs from the app
 *
 * Upstream wraps the row in `FittedBox(scaleDown)`: a wide line on a 320dp phone at a large
 * text scale would otherwise clip the customer's own pip off the end, and shrinking is
 * better than losing the one pip that matters.
 *
 * Here the row **scrolls instead**, centred by `mx-auto` inside an `overflow-x-auto`
 * container. Three reasons it is the better answer on the web rather than merely a
 * different one: nothing is ever clipped *or* shrunk below legibility; a long line stays
 * explorable by drag, which the app's scaled-down version is not; and the strip owns its own
 * overflow instead of the body, which is this repo's rule for every horizontal run.
 * `mx-auto` rather than `justify-center` is deliberate — centring a flex row makes its
 * overflow unreachable on the leading edge.
 */
export function QueueLineStrip({
  line,
  mine,
}: {
  /** The shop's whole active line, as `queue_active_line` returns it. */
  line: QueueEntry[];
  /** The caller's own entry, which must be in `line`. */
  mine: QueueEntry;
}) {
  const serving = line.filter((e) => e.status === "serving");
  const waiting = orderedShopWide(line);
  const at = waiting.findIndex((e) => e.id === mine.id);

  // Being served, or dropped out from under us mid-poll: there is no place in the waiting
  // line to draw, and the card above is already saying so.
  if (at < 0) return null;

  const ahead = waiting.slice(0, at);
  const hidden = Math.max(0, ahead.length - MAX_AHEAD);
  const shownAhead = ahead.slice(hidden);
  const behind = waiting.slice(at + 1, at + 1 + MAX_BEHIND);
  const held = isDeferred(mine);

  return (
    <div>
      <div className="scrollbar-none overflow-x-auto">
        <div aria-hidden className="gap-xs mx-auto flex w-max items-center">
          {serving.map((e) => (
            <ChairPip key={`cut-${e.id}`} />
          ))}
          {serving.length > 0 ? (
            /* The gap between the chairs and the line waiting for one. Without it the strip
               reads as one undifferentiated row of dots and the chairs stop meaning
               "already being served". */
            <span className="bg-hairline mx-xs h-3.5 w-px shrink-0" />
          ) : null}
          {hidden > 0 ? (
            <span className="text-badge text-muted-soft pr-xxs shrink-0 tabular-nums">
              +{hidden}
            </span>
          ) : null}
          {shownAhead.map((e) => (
            <WaitingPip key={e.id} entry={e} />
          ))}
          <MePip held={held} />
          {behind.map((e) => (
            <WaitingPip key={e.id} entry={e} behindMe />
          ))}
        </div>
      </div>
      <p className="text-body-sm text-muted mt-sm text-center">
        {caption({ held, aheadCount: ahead.length, cutting: serving.length })}
      </p>
    </div>
  );
}

/**
 * Beyond this many ahead, the rest collapse into a leading "+N". Eight pips is about as many
 * as read as a countable group rather than a texture, and the number is on the card above.
 */
const MAX_AHEAD = 8;

/**
 * A couple behind, no more. They are not information the customer needs — they are the
 * reason the customer is glad they joined when they did, which is worth three circles.
 */
const MAX_BEHIND = 3;

function caption({
  held,
  aheadCount,
  cutting,
}: {
  held: boolean;
  aheadCount: number;
  cutting: number;
}): string {
  // While held, the count ahead is not the fact that matters and is actively misleading —
  // the hold has put them last, so it would read as having lost their place.
  if (held) {
    return "You're holding your place — you keep it ahead of anyone who joined after you.";
  }
  const aheadPart = aheadCount === 0 ? "You're at the front" : `${aheadCount} ahead of you`;
  if (cutting === 0) return `${aheadPart} · no one in a chair yet`;
  return `${aheadPart} · ${cutting} ${cutting === 1 ? "chair" : "chairs"} cutting`;
}

/**
 * An occupied chair — larger and in the success colour, because it is the reassuring half of
 * the picture: the line has to be moving for a chair to be full.
 */
function ChairPip() {
  return (
    <span className="bg-success-soft grid size-6 shrink-0 place-items-center rounded-full">
      <Icons.haircut className="text-success-text" style={{ width: 14, height: 14 }} />
    </span>
  );
}

/**
 * Somebody else. Solid ahead of the customer, hollow behind them, and amber-ringed if they
 * have stepped out — which is also the explanation for why they are no longer counted ahead.
 */
function WaitingPip({ entry, behindMe = false }: { entry: QueueEntry; behindMe?: boolean }) {
  const held = isDeferred(entry);
  return (
    <span
      className={cn(
        "size-3 shrink-0 rounded-full border-[1.5px] border-transparent",
        held
          ? "border-star"
          : behindMe
            ? "border-hairline"
            : "bg-border-strong border-transparent",
      )}
    />
  );
}

function MePip({ held }: { held: boolean }) {
  return (
    <span
      className={cn(
        "text-badge px-sm shrink-0 rounded-full border-[1.5px] border-transparent py-[3px] font-semibold",
        // `rausch-cta`, where upstream uses `rausch`. This is 11px white text, so it needs
        // 4.5:1 — white on `#FF385C` is 3.53:1. The same substitution `Button` and the
        // product card make, for the same reason.
        held ? "border-star bg-surface-strong text-ink" : "bg-rausch-cta text-on-primary",
      )}
    >
      You
    </span>
  );
}
