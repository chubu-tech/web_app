import type { LucideIcon } from "lucide-react";
import { IconSize } from "./icons";
import { cn } from "@/lib/utils";

/**
 * The centred empty/error placeholder used on every list and async surface, ported
 * from `tho/app/lib/ui/widgets/empty_state.dart`: a soft icon disc, a title, a
 * supporting line, and an optional action.
 *
 * `action` is a node, not a callback, so this works from a server component.
 */
export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-xl py-xxl text-center",
        className,
      )}
    >
      <div className="bg-surface-soft flex size-32 items-center justify-center rounded-full">
        <Icon
          className="text-muted"
          style={{ width: IconSize.hero, height: IconSize.hero }}
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
      <p className="text-title text-ink mt-base font-semibold">{title}</p>
      {message ? (
        <p className="text-body-sm text-muted mt-sm max-w-prose">{message}</p>
      ) : null}
      {action ? <div className="mt-lg">{action}</div> : null}
    </div>
  );
}
