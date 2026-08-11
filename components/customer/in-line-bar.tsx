import Link from "next/link";
import { Icons, IconSize } from "@/components/ui/icons";
import { fetchMyActiveEntries } from "@/lib/api/queue";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * "You're in line at …" — the way back to a place already taken.
 *
 * This is the web's answer to the app's floating action button
 * (`customer_home.dart:134`), which turns into a live queue chip once the customer is
 * in a line. A FAB is a phone affordance; a slim bar under the nav does the same job
 * across the breakpoints, and unlike the app's version it is present on **every**
 * customer page — so wandering into a salon page mid-wait cannot lose the thread.
 *
 * **Registered users only, and one indexed read.** Guests and anonymous visitors
 * cannot hold a place (`join_queue` refuses them), so there is nothing to look up and
 * no query is issued for them. `idx_queue_customer` covers the lookup.
 *
 * A customer can genuinely be in **two** lines at once — `join_queue`'s
 * already-in-queue guard is scoped to one business. The bar names the oldest place,
 * which is the one closest to being called, and says so plainly when there is more
 * than one rather than silently picking.
 */
export async function InLineBar() {
  const account = await getAccount();
  if (account.state !== "registered") return null;

  const supabase = await createClient();
  const entries = await fetchMyActiveEntries(supabase, account.user.id).catch(() => []);
  const first = entries[0];
  if (!first) return null;

  const label =
    entries.length > 1
      ? `You're in ${entries.length} lines`
      : first.businessName
        ? `You're in line at ${first.businessName}`
        : "You're in line";

  return (
    <Link
      href={`/queue/${first.id}`}
      className="bg-rausch-cta text-on-primary hover:bg-rausch-cta-pressed px-base py-sm gap-sm flex items-center justify-center"
    >
      <Icons.timer
        style={{ width: IconSize.xs, height: IconSize.xs }}
        aria-hidden
        className="shrink-0"
      />
      <span className="text-caption font-medium">{label}</span>
      <Icons.forward
        style={{ width: IconSize.xs, height: IconSize.xs }}
        aria-hidden
        className="shrink-0"
      />
    </Link>
  );
}
