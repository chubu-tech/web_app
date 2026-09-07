import { Icons, IconSize } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * The quiet line that stands where a button is not yet honest — a port of
 * `../tho/app/lib/ui/widgets/action_hint.dart`.
 *
 * **Why a caption and not a disabled button.** A disabled Complete says no without saying
 * why, and the owner's next move is to tap it again. This says when it will work, which is
 * the only thing they actually need. Upstream reached for it when the booking time gate
 * (P0017) landed, for exactly that reason.
 *
 * It keeps the height of the buttons it stands among, so the row does not reflow as the
 * clock passes the appointment's start — a Cancel button that jumps up and then back down
 * again is its own small confusion. Hence `dense` rather than a `className`: the two live
 * heights are the detail page's 48px and the calendar card's 36px, and they are a choice
 * between two known rows, not an open parameter.
 *
 */
export function ActionHint({
  children,
  icon = "clock",
  dense = false,
}: {
  children: React.ReactNode;
  icon?: keyof typeof Icons;
  /** Match the 36px buttons on an owner calendar card rather than the 48px default. */
  dense?: boolean;
}) {
  const Glyph = Icons[icon];
  return (
    <p
      className={cn(
        "gap-xs text-caption text-muted-soft flex items-center",
        dense ? "min-h-9" : "min-h-12",
      )}
    >
      <Glyph className="shrink-0" style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
      <span>{children}</span>
    </p>
  );
}
