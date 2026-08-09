import Link from "next/link";
import { BrandLockup } from "@/components/ui/brand-lockup";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";

/**
 * The 404 — and the reason it sits at the **root** rather than in `app/(customer)/`.
 *
 * ## A route group is not a not-found boundary
 *
 * The first attempt put this in `app/(customer)/not-found.tsx`, reasoning that it would
 * inherit the customer shell the way every page in that group does. It never rendered once.
 * Layouts resolve through route groups; **`not-found` boundaries resolve by URL path**, and
 * `(customer)` contributes no path segment — so for `/salon/[id]` the lookup walks
 * `app` → `salon` → `[id]` and the group is skipped entirely. Every `notFound()` in the
 * eleven customer routes that call it escalated to Next's built-in page. Verified from the
 * RSC payload, which named it: `"pagePath":"__next_builtin__not-found.js"`, with an inline
 * `system-ui` stack and `background:#fff`.
 *
 * At the root it catches both cases that matter, and the second is the common one on a
 * website: a deliberate `notFound()`, and **any unmatched URL** — a typo, a stale link, a
 * crawler guessing paths. That one has no segment at all, so nothing but a root boundary
 * can ever answer it.
 *
 * ## Its own header, and no session read
 *
 * A root boundary renders inside `app/layout.tsx` **only** — the `(customer)` layout is not
 * in the tree, so `CustomerHeader` is not above it. Hence the wordmark row here rather than
 * a bare page: a dead end with no way out is the actual failure being fixed.
 *
 * It deliberately does **not** call `getAccount()` to render the real nav. That would read
 * cookies, turn the one static route in the build into a dynamic one, and start the inbox
 * poll on an error page — to decide whether a header says "Sign in". `data-shell="customer"`
 * still puts it on the cream canvas, so it reads as this site either way. (The typeface is
 * no longer part of that — Inter comes from `--font-sans` at `:root` on every route.)
 *
 * Owner routes get their own at `app/business/not-found.tsx`; `business` **is** a real URL
 * segment, so that boundary resolves normally and keeps the console's own chrome.
 */
export default function NotFound() {
  return (
    <div data-shell="customer" className="bg-canvas flex min-h-full flex-col">
      <header className="border-hairline-soft px-base tablet:px-lg flex h-[var(--header-height)] shrink-0 items-center border-b">
        {/* The same lockup `CustomerHeader` renders, and now literally the same component.
            It was duplicated here on the reasoning that this boundary sits outside the
            customer layout (see above) — true of the *layout*, and no reason to copy the
            markup. The two had already drifted: this copy's tile did not tilt on hover.

            No `priority`: the mark on an error page is not worth a preload hint. */}
        <BrandLockup />
      </header>
      <main className="flex-1">
        <div className="px-base py-xxl tablet:px-lg mx-auto w-full max-w-[560px]">
          <EmptyState
            icon={Icons.searchEmpty}
            title="This page isn't here"
            message="The link may be old, or the salon may have stopped taking bookings. Everything that is open is on Discover."
            action={
              <Link href="/">
                <Button>Find a salon</Button>
              </Link>
            }
          />
        </div>
      </main>
    </div>
  );
}
