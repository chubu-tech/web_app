import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The app's buttons, ported from the `FilledButton`/`OutlinedButton` themes in
 * `tho/app/lib/ui/theme.dart` and `ui/widgets/primary_button.dart`.
 *
 * **`filled` uses `--color-rausch-cta`, never `--color-rausch`.** White on
 * `#FF385C` measures 3.53:1 and fails WCAG AA; the deeper hue is 4.89:1. This is
 * an accessibility fix that was already made once in the app — using rausch for a
 * filled CTA reintroduces the bug.
 */

type Variant = "filled" | "outlined" | "quiet" | "pill" | "pillQuiet";

/*
  **The press state, which `--duration-fast` was always documented for and never got.**

  `globals.css` describes that token as "chip fills, **press scales**, colour swaps".
  The scale was in `primary_button.dart` and did not survive the port, so until now the
  only feedback any button in this app gave was `hover:` — which does not exist on the
  device most of this product is used on. Between tap and server response there was
  nothing at all.

  2% is the whole movement: enough to read as a press, small enough that a 48px control
  does not appear to jump. `transform` is named alongside the colours rather than left to
  `transition-colors`, and `disabled:active:scale-100` is what stops a blocked button —
  including a `busy` one, which is `disabled` — from acknowledging a press it is ignoring.
*/
const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-sm px-4 " +
  "text-title font-medium select-none " +
  "transition-[background-color,color,transform] duration-[var(--duration-fast)] " +
  "active:scale-[0.98] disabled:active:scale-100 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  filled:
    "bg-rausch-cta text-on-primary hover:bg-rausch-cta-pressed " +
    "disabled:bg-rausch-disabled disabled:text-on-primary",
  outlined:
    "border border-hairline text-ink bg-canvas hover:bg-surface-soft " +
    "disabled:text-muted-soft disabled:border-hairline-soft",
  quiet:
    "text-rausch-cta hover:bg-rausch/10 disabled:text-muted-soft " +
    "disabled:hover:bg-transparent",
  // The filter sheet's fully-rounded CTAs (`filter_screen.dart:422`).
  pill:
    "rounded-full h-13 bg-rausch-cta text-on-primary hover:bg-rausch-cta-pressed " +
    "disabled:bg-rausch-disabled",
  pillQuiet:
    "rounded-full h-13 bg-surface-soft text-rausch-cta hover:bg-surface-strong",
};

export type ButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  variant?: Variant;
  /** Shows a spinner and blocks the press. */
  busy?: boolean;
  fullWidth?: boolean;
};

export function Button({
  variant = "filled",
  busy = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      // While busy the button is blocked, but it keeps the CTA fill rather than
      // taking the pale disabled tint — otherwise the white spinner would sit on
      // pale pink and vanish. `primary_button.dart:29` overrides Flutter's
      // `disabledBackgroundColor` for exactly this reason.
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      className={cn(
        base,
        variants[variant],
        busy && "bg-rausch-cta text-on-primary disabled:bg-rausch-cta",
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {busy ? (
        <Loader2 className="size-5 animate-spin" aria-hidden />
      ) : (
        children
      )}
    </button>
  );
}
