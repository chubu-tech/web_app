import { Button } from "@/components/ui/button";

/**
 * Sign out.
 *
 * **A form POST to `/auth/sign-out`, not a client `auth.signOut()`.** Three reasons, and the first
 * two are defects this replaced:
 *
 * 1. **The old version could not clear `tho_active_business`.** That cookie is `httpOnly`, so
 *    browser JavaScript cannot reach it — only a route handler can send it back expired. It was
 *    therefore never cleared by anything, and sat for a year on whatever machine had been used.
 * 2. **The old version could lock itself.** It set `busy` and had no `catch`, so a failed
 *    `signOut()` — offline, or a 5xx from GoTrue — left the button disabled with a spinner for
 *    ever. "I can't log out" had two separate causes; this was the second one.
 * 3. It works with JavaScript still loading, which is the same reason the salon switcher POSTs a
 *    form rather than calling the client.
 *
 * Being a server component now, it can also be dropped straight into the owner header's collapse
 * panel, which is the surface that was missing entirely — see `components/owner/owner-nav.tsx`.
 * `variant` and `fullWidth` are props because the placements want different shapes: a block
 * button on `/profile`, a quiet row in a nav panel, a red one at the foot of the owner's
 * settings hub.
 *
 * **`destructive` is a tint on an existing variant, not a sixth `Button` variant.** The kit's
 * five are a port of `theme.dart`'s button themes and adding to them is a design-system change;
 * this is the same treatment already used for Delete in `offer-list.tsx` — `--color-error-text`
 * on an otherwise ordinary button. Worth saying out loud that signing out is not destructive in
 * the sense Delete is: nothing is lost and the way back is to sign in again. It is styled this
 * way because it is the one control on a page of settings that ends the session, and that is
 * worth making unmistakable.
 */
export function SignOutButton({
  variant = "outlined",
  fullWidth = true,
  label = "Sign out",
  destructive = false,
}: {
  variant?: "outlined" | "quiet";
  fullWidth?: boolean;
  label?: string;
  destructive?: boolean;
}) {
  return (
    <form action="/auth/sign-out" method="post">
      <Button
        type="submit"
        variant={variant}
        fullWidth={fullWidth}
        className={
          destructive
            ? "text-error-text border-error-text/30 hover:bg-error-soft hover:text-error-text-hover"
            : undefined
        }
      >
        {label}
      </Button>
    </form>
  );
}
