import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { JoinQueueForm } from "@/components/customer/join-queue-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { fetchBusinessById } from "@/lib/api/discovery";
import { fetchActiveEntryForBusiness, fetchActiveLine } from "@/lib/api/queue";
import { fetchServices, fetchStaff } from "@/lib/api/salon";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { QueueEntry } from "@/lib/types/queue";

/**
 * The shop's QR target.
 *
 * **`[id]` is a business id, and `/q/<id>` is not a shape this repo chose.** It is
 * fixed by `QueueDeepLink.businessIdFrom` in
 * `../tho/app/lib/business/queue/queue_links.dart`, which already parses both
 * `bhutansalons://q/<id>` and `https://<host>/q/<id>` — so one printed QR works for
 * the app and the browser. Do not rename this route.
 *
 * Not to be confused with `/queue/[entryId]`: **`/q/<businessId>` joins, and
 * `/queue/<entryId>` watches.**
 *
 * **Arriving here counts as a scan** (`viaQr`), exactly as the app's deep-link
 * handler treats an incoming link. A forwarded URL is the known weakness of that,
 * and it is the app's weakness too — `qr_only` is a nudge to be in the shop, not an
 * attestation, and the honest place to note that is here rather than behind a
 * referrer heuristic that would break real scans.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const business = await fetchBusinessById(supabase, id).catch(() => null);
  return {
    title: business ? `Join the queue at ${business.name}` : "Join the queue",
    // A QR poster is scanned in a shop, not indexed. Nothing here should rank.
    robots: { index: false, follow: false },
  };
}

export default async function JoinQueuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const business = await fetchBusinessById(supabase, id);
  if (!business) notFound();

  const account = await getAccount();
  /**
   * Any session at all, guest included.
   *
   * A guest cannot *join* — `join_queue` refuses them with P0010 — but they can read
   * the live line, and upgrading keeps the **same** user id, so showing them the form
   * and meeting them with the wall on the button is strictly better than sending them
   * to `/sign-in`. Only a visitor with no session at all gets the sign-in prompt,
   * because `queue_active_line` is revoked from `anon` and a form with no wait and a
   * button that cannot work is worse than saying so.
   */
  const hasSession = account.user != null;
  const registeredId = account.state === "registered" ? account.user.id : null;

  // Already holding a place here? Re-scanning the same QR while waiting is a
  // "where am I?" gesture, not a second join — send them to their position.
  if (registeredId) {
    const mine = await fetchActiveEntryForBusiness(supabase, registeredId, id).catch(
      () => null,
    );
    if (mine) redirect(`/queue/${mine.id}`);
  }

  const [services, staff, line] = await Promise.all([
    fetchServices(supabase, id),
    fetchStaff(supabase, id),
    // `queue_active_line` is revoked from `anon`, so this simply fails for a
    // signed-out visitor. Caught on its own, and `null` reaches the badge as
    // "Wait unknown" rather than a fabricated zero.
    fetchActiveLine(supabase, id).catch(() => null as QueueEntry[] | null),
  ]);

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[560px] tablet:px-lg">
      {/* A visitor with no session at all is told up front, rather than filling in
          the whole form and meeting a wall at the end. The live wait is unavailable
          to them anyway — `queue_active_line` is revoked from `anon`. */}
      {!hasSession ? (
        <div className="border-hairline-soft p-base rounded-md border">
          <EmptyState
            icon={Icons.queue}
            title={`Join the line at ${business.name}`}
            message="Sign in to see the current wait and take your place. It keeps the shop's list accurate, so they know who is waiting."
            action={
              <Link href={`/sign-in?next=${encodeURIComponent(`/q/${id}`)}`}>
                <Button>Sign in to join</Button>
              </Link>
            }
          />
          <p className="text-body-sm text-muted mt-base text-center">
            <Link href={`/salon/${id}`} className="text-rausch-cta font-medium underline">
              View {business.name}
            </Link>{" "}
            to book a time instead.
          </p>
        </div>
      ) : (
        <div className="border-hairline-soft bg-canvas shadow-card rounded-lg border">
          <JoinQueueForm
            business={business}
            services={services}
            staff={staff}
            viaQr
            initialLine={line}
          />
        </div>
      )}
    </div>
  );
}
