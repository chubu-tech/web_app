import type { Viewport } from "next";
import Link from "next/link";
import { Icons, IconSize } from "@/components/ui/icons";

export const viewport: Viewport = { themeColor: "#f6f3ee" };

/**
 * The auth pages have no shell — no nav, no header.
 *
 * Deliberate: this is a single-purpose page, and the navigation would offer ways to
 * wander off mid-task. The one route out is the explicit "Browse without an account"
 * on the form itself, which is the app's own affordance (THO-24).
 *
 * It carries `data-shell="customer"` all the same. These pages are customer-facing and
 * are reached from the customer header, so on the editorial cream canvas a white,
 * system-font sign-in page would be a visible seam at exactly the moment somebody is
 * deciding whether to trust the site with a password.
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main
      data-shell="customer"
      className="px-base py-xl bg-canvas flex flex-1 items-center justify-center"
    >
      <div className="w-full max-w-[420px]">
        <div className="mb-lg flex flex-col items-center">
          <Link
            href="/"
            aria-label="Tho — back to browsing"
            className="bg-rausch-cta flex size-16 items-center justify-center rounded-lg"
          >
            <Icons.haircut
              className="text-on-primary"
              style={{ width: IconSize.lg, height: IconSize.lg }}
              aria-hidden
            />
          </Link>
          {/* "THO", matching the header lockup and the marketing site's `brand.name`. This
              is the page the marketing site's "Sign in" lands on, so it is the one place a
              second spelling would be seen back-to-back with the first. */}
          <p className="text-display-xl text-ink mt-lg font-bold tracking-tight">THO</p>
        </div>
        {children}
      </div>
    </main>
  );
}
