import { Icons, IconSize } from "./icons";
import { cn } from "@/lib/utils";

/**
 * The customer's "your place in line" card, ported from
 * `tho/app/lib/ui/widgets/queue_position_card.dart`.
 *
 * Status-aware: `waiting` shows the position, the wait and who it is with; `serving`
 * shows a "you're up" state; **held** — stepped out, with the hold still running — shows
 * the hold counting down. Terminal statuses are not rendered here; the page shows its own
 * state once the entry drops out of the shop's active line.
 *
 * **A held place is a countdown, not a position.** The number that matters while somebody
 * is out of the shop is how long they have before the hold lapses, not where the hold has
 * temporarily put them — which is at the far end of the line, and would read as a demotion
 * rather than as the thing keeping their place. Their real position comes back the instant
 * they tap "I'm back", because the row never lost its `joinedAt`.
 *
 * **Two departures from the app, both deliberate:**
 *
 * 1. **No animated count-up.** The number changes on a 4-second poll, and a digit
 *    that rolls every few seconds turns the one fact the reader is watching into
 *    motion they have to wait out.
 * 2. **The "what happens next" line says the page updates itself, not that we will
 *    notify you.** The app promises a notification; every `queue_your_turn` row in
 *    the outbox is `failed` with "no deliverable channel", and no device is
 *    registered, so on the web that promise is one nothing keeps. When Web Push
 *    lands (2d) this copy is where it changes back.
 *
 * `businessName` is a separate prop rather than read off the entry, because the row
 * behind this card is re-sourced from `queue_active_line`, whose PII-free projection
 * carries no `businesses(name)` embed — thread it in from wherever the name was
 * first learned.
 */
export function QueuePositionCard({
  serving,
  position,
  etaMinutes,
  businessName,
  staffName,
  heldMinutes = null,
}: {
  serving: boolean;
  position: number;
  etaMinutes: number;
  businessName?: string | null;
  staffName?: string | null;
  /**
   * Minutes left on a step-out hold, or null when the customer is present.
   *
   * Rounded up by `deferredMinutesLeft`, so one second left reads "1m" — on a countdown
   * somebody is racing, "0m" is the difference between having a place and not.
   */
  heldMinutes?: number | null;
}) {
  // Serving wins if both were somehow true. `set_queue_deferral` raises `P0018` unless the
  // entry is `waiting`, so it cannot be — but the card must not render two states at once
  // if the server ever disagrees with that.
  const held = !serving && heldMinutes != null;

  return (
    <div className="border-hairline-soft bg-canvas shadow-card p-lg rounded-lg border text-center">
      {businessName ? (
        <p className="text-title text-muted mb-base font-medium">{businessName}</p>
      ) : null}

      <div
        className={cn(
          "mx-auto flex size-24 flex-col items-center justify-center rounded-full",
          serving
            ? "bg-success-soft"
            : held
              ? "border-star bg-surface-strong border-2"
              : "bg-surface-soft",
        )}
      >
        {serving ? (
          <Icons.haircut
            className="text-success-text"
            style={{ width: IconSize.xl, height: IconSize.xl }}
            aria-hidden
          />
        ) : held ? (
          <>
            <Icons.timer
              className="text-star"
              style={{ width: IconSize.md, height: IconSize.md }}
              aria-hidden
            />
            <span className="text-title text-ink mt-xxs tabular-nums">{heldMinutes}m</span>
          </>
        ) : (
          <span className="text-display-xl text-ink tabular-nums">#{position}</span>
        )}
      </div>

      {/* `#3` alone is a number, not an answer: the line under it says what the
          number means, and the one under that says how long — in words, because
          "~25 min" is a figure the reader still has to read as "roughly". */}
      <p
        aria-live="polite"
        className={cn(
          "mt-base",
          serving ? "text-display-lg text-ink font-medium" : "text-title text-ink font-medium",
        )}
      >
        {serving
          ? "You're up now!"
          : held
            ? "Your place is held"
            : position <= 1
              ? "You're next in line"
              : `You're #${position} in line`}
      </p>
      <p className={cn("mt-xxs text-muted", held ? "text-body-sm" : "text-body-md")}>
        {serving
          ? "Head over to the counter."
          : held
            ? `For the next ${heldMinutes} min. Come back inside that and you keep your place ahead of anyone who joined after you.`
            : etaMinutes <= 0
              ? "Any moment now"
              : `About ${etaMinutes} min to wait`}
      </p>

      {/* Suppressed while held: "with Sonam · about 25 min" beside a countdown reads as
          two different waits, and only one of them is the one being raced. */}
      {staffName && !held ? (
        <p className="text-body-sm text-muted mt-sm">with {staffName}</p>
      ) : null}

      {/* What happens next, unprompted. Without it this is a status display and the
          reader has to guess whether they must keep watching it — which, in a
          waiting room, they will. */}
      <div
        className={cn(
          "px-base py-sm gap-sm mt-base flex items-start rounded-md text-left",
          serving ? "bg-success-soft" : held ? "bg-surface-strong" : "bg-surface-soft",
        )}
      >
        {serving ? (
          <Icons.success
            className="text-success-text mt-0.5 shrink-0"
            style={{ width: IconSize.sm, height: IconSize.sm }}
            aria-hidden
          />
        ) : (
          <Icons.timer
            className={cn("mt-0.5 shrink-0", held ? "text-star" : "text-muted")}
            style={{ width: IconSize.sm, height: IconSize.sm }}
            aria-hidden
          />
        )}
        <p className={cn("text-body-sm", serving ? "text-success-text" : "text-body")}>
          {nextStep(serving, held, position)}
        </p>
      </div>
    </div>
  );
}

/** The one sentence telling the customer what to do, or not do, now. */
function nextStep(serving: boolean, held: boolean, position: number): string {
  if (serving) return "It's your turn — head to the chair.";
  // Names the control and says the shop already knows — the two things somebody standing
  // outside a barber's needs to be sure of before they walk anywhere.
  if (held) return "Tap I'm back the moment you return — the shop can see you stepped out.";
  if (position <= 1) return "You're next. Stay close — the shop will call you shortly.";
  return "Keep this page open — it updates on its own as the line moves.";
}
