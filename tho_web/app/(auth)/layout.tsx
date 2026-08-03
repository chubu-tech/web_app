import Link from "next/link";
import { Icons, IconSize } from "@/components/ui/icons";

/**
 * The auth pages have no customer shell — no tab bar, no top nav.
 *
 * Deliberate: this is a single-purpose page, and the navigation would offer ways to
 * wander off mid-task. The one route out is the explicit "Browse without an account"
 * on the form itself, which is the app's own affordance (THO-24).
 */
export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="px-base py-xl flex flex-1 items-center justify-center">
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
          <p className="text-display-xl text-ink mt-lg font-bold">Tho</p>
        </div>
        {children}
      </div>
    </main>
  );
}
