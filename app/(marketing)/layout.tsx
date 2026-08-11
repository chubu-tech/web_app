import { WaitlistProvider } from "@/components/marketing/waitlist-provider";

/**
 * The public marketing site's shell — `/`, `/waitlist`, `/privacy`.
 *
 * ## Why this exists at all
 *
 * Before the merge these three pages were their own Next application and their root layout
 * carried `WaitlistProvider`. There can be exactly one root layout now, and it is shared with
 * 60-odd product routes that have no use for a waitlist modal — so the provider moved down
 * here, to the group that actually opens it. A customer reading their bookings does not
 * download a modal host for a marketing call to action.
 *
 * ## It is a route group, so it adds no path segment
 *
 * `app/(marketing)/page.tsx` is `/`, not `/marketing`. That is the whole point: the landing
 * page stays the public-facing homepage while the product keeps its own URLs, and the two
 * only meet at the root layout.
 *
 * ## No `data-shell` wrapper
 *
 * The customer group sets `data-shell="customer"` and the console sets `data-shell="owner"`,
 * both of which re-point colour variables at `:root`'s values. The marketing pages are what
 * that editorial layer was copied *from*, so they want the base tokens exactly as declared —
 * `app/marketing-tokens.css` supplies the rest, and adding a shell attribute here would
 * re-skin them against themselves.
 */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <WaitlistProvider>{children}</WaitlistProvider>;
}
