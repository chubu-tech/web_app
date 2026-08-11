import { cn } from "@/lib/utils";

/**
 * Loading placeholders, ported from `tho/app/lib/ui/widgets/app_skeleton.dart`.
 *
 * The Dart runs a `ShaderMask` sweep; here it is one CSS animation
 * (`shimmer`, defined in `globals.css`), which `prefers-reduced-motion` already
 * neutralises app-wide.
 */

export function Skeleton({
  className,
  ...rest
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-sm",
        // A three-stop gradient at twice the width, slid by the keyframe — the
        // CSS equivalent of the Dart's ShaderMask sweep over a grey block.
        "bg-[linear-gradient(90deg,var(--color-surface-strong)_35%,var(--color-surface-soft)_50%,var(--color-surface-strong)_65%)]",
        "bg-[length:200%_100%]",
        className,
      )}
      {...rest}
    />
  );
}

/** A grid of card-shaped placeholders — the loading state for a salon list. */
export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading salons"
      className="gap-base grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-3 wide:grid-cols-4"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="border-hairline-soft overflow-hidden rounded-md border">
          <Skeleton className="h-[150px] rounded-none" />
          <div className="p-base">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-sm h-3 w-56" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A stack of row-shaped placeholders — the app's `SkeletonList`. */
export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading" className="gap-base flex flex-col">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="gap-base flex items-start">
          <Skeleton className="size-14 shrink-0 rounded-md" />
          <div className="flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-sm h-3 w-56" />
          </div>
        </div>
      ))}
    </div>
  );
}
