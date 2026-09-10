import type { LucideIcon } from "lucide-react";
import { IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * An overflow menu — the "…" button's list of actions, as a sheet.
 *
 * **A sheet, not a popup.** The Flutter original of every one of these is a `PopupMenuButton`.
 * A popup on the web needs its own outside-click handling, Escape, focus trap and focus
 * restore — the five things `Sheet` already has and that `collapse-nav.tsx` documents the
 * marketing site getting wrong. So there is one modal implementation in this app rather than
 * two, and the menu is a list of ordinary buttons inside it.
 *
 * **Why it is in the kit rather than beside its first caller.** It was written inside
 * `components/customer/thread-safety-menu.tsx` and the owner's offer row wanted the same thing:
 * a row's destructive action, off the face of the row and behind a deliberate second tap. Two
 * private copies of a modal list is exactly how the two of them drift into looking like
 * different controls for the same gesture.
 *
 * The trigger stays with the caller — `aria-label` and placement are local decisions — and this
 * owns only what is inside.
 */
export function MenuSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** What the menu is about: the thing being acted on, or the subject the actions share. */
  title: string;
  /** `MenuItem`s. */
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <ul className="p-base gap-sm flex flex-col">{children}</ul>
    </Sheet>
  );
}

/**
 * One action in a `MenuSheet`.
 *
 * **The hint is not decoration.** These rows carry the actions kept off a screen's surface
 * because they are irreversible or far-reaching, and the menu is the last place to say what one
 * does before it is tapped. A row whose consequence is not obvious from three words should
 * carry a line that makes it obvious.
 */
export function MenuItem({
  icon: Icon,
  label,
  hint,
  tone = "default",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  /** `danger` tints the glyph, for an action that ends something. The label stays in ink. */
  tone?: "default" | "danger";
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="border-hairline-soft p-base gap-md hover:bg-surface-soft focus-visible:outline-ink flex w-full items-start rounded-md border text-left focus-visible:outline-2"
      >
        <Icon
          className={cn("mt-0.5 shrink-0", tone === "danger" ? "text-error-text" : "text-ink")}
          style={{ width: IconSize.sm, height: IconSize.sm }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="text-title text-ink block font-medium">{label}</span>
          {hint ? <span className="text-body-sm text-muted mt-xxs block">{hint}</span> : null}
        </span>
      </button>
    </li>
  );
}
