import { cn } from "@/lib/utils";

/**
 * The live walk-in pill — `● 3 waiting · ~45 min` — ported from
 * `tho/app/lib/ui/widgets/queue_wait_badge.dart`.
 *
 * Shared by the salon page's walk-in card and the join form so the two surfaces
 * cannot phrase or colour the same fact differently.
 *
 * **A null `waiting` or `etaMinutes` reads "Wait unknown", never a zero.** That
 * distinction carries real weight here, and more on the web than in the app: a
 * signed-out visitor cannot call `queue_active_line` at all (it is revoked from
 * `anon`), so *unknown* is the ordinary state for anyone who has not signed in.
 * Rendering that as "0 waiting · ~0 min" would advertise an instant walk-in on
 * nothing but a permission error.
 *
 * `aria-live` because this is a number that changes underneath the reader while the
 * page sits open — the one thing on the card worth announcing.
 */
export function QueueWaitBadge({
  waiting,
  etaMinutes,
  className,
}: {
  waiting: number | null;
  etaMinutes: number | null;
  className?: string;
}) {
  const known = waiting != null && etaMinutes != null;

  const label = !known
    ? "Wait unknown"
    : waiting === 0
      ? "No queue · walk straight in"
      : `${waiting} waiting · ~${etaMinutes} min`;

  return (
    <span
      aria-live="polite"
      className={cn(
        "px-md py-sm gap-sm inline-flex max-w-full items-center rounded-full",
        known ? "bg-success-soft text-success-text" : "bg-hairline-soft text-muted",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          known ? "bg-success-text" : "bg-muted",
        )}
      />
      {/* The longest label is wider than a phone-width card, so it wraps rather
          than forcing a horizontal scroll — the Flutter original needs a
          FittedBox at both call sites for exactly this reason. */}
      <span className="text-caption min-w-0">{label}</span>
    </span>
  );
}
