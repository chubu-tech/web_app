import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { JoinQueueForm } from "@/components/customer/join-queue-form";
import { OpenInApp } from "@/components/customer/open-in-app";
import { ScanActions } from "@/components/customer/scan-actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { fetchBusinessById } from "@/lib/api/discovery";
import { fetchActiveEntryForBusiness, fetchActiveLine } from "@/lib/api/queue";
import { fetchProductsForBusiness, fetchServices, fetchStaff } from "@/lib/api/salon";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { QueueEntry } from "@/lib/types/queue";
import { runsQueue } from "@/lib/types/salon";

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

/**
 * One read of the salon row per request, shared with `generateMetadata` below.
 *
 * A poster in a shop is scanned by somebody standing at the counter, so this route's
 * latency is the one a customer feels most directly — and reading the same row twice in
 * one request is the cheapest thing here to stop doing. See *Per-request reads must be
 * memoised* in `AGENTS.md`; `getAccount` and `createClient` already carry this.
 */
const loadBusiness = cache(async (id: string) => {
  const supabase = await createClient();
  return fetchBusinessById(supabase, id);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const business = await loadBusiness(id).catch(() => null);
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

  const business = await loadBusiness(id);
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

  /**
   * Does this salon actually take walk-ins?
   *
   * `queueEnabled && hasFeature(plan, "walkInQueue")` — the salon's own switch *and* the
   * plan, the same pair the owner's board gates on. Nine of the ten live salons fail it,
   * and before this page became a hub that meant nine salons could not have a poster at
   * all: the only thing the destination did was refuse them with `P0001`.
   */
  const queueOpen = runsQueue(business);

  const [services, staff, line, products] = await Promise.all([
    // Only the walk-in form uses these two, so they are skipped entirely on a salon
    // without a queue — which is most of them.
    queueOpen ? fetchServices(supabase, id) : Promise.resolve([]),
    queueOpen ? fetchStaff(supabase, id) : Promise.resolve([]),
    // `queue_active_line` is revoked from `anon`, so this simply fails for a
    // signed-out visitor. Caught on its own, and `null` reaches the badge as
    // "Wait unknown" rather than a fabricated zero.
    queueOpen
      ? fetchActiveLine(supabase, id).catch(() => null as QueueEntry[] | null)
      : Promise.resolve(null),
    /*
      Gated on the salon having products, not on its plan allowing them — the same test
      the salon page's own Shop tab uses. A plan that permits an empty shelf is not a shop,
      and a row leading to one is the dead end `destinations.ts` exists to prevent.

      Caught into `[]`: a failed read costs the shop row, and the rest of the page — which
      is the part somebody standing at a counter needs — is unaffected.
    */
    fetchProductsForBusiness(supabase, id).catch(() => []),
  ]);

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[560px] tablet:px-lg">
      {/*
        Above both branches, because the offer is the same either way: whether or not
        this person can join in the browser, the app is the better place to wait. It
        renders nothing on a desktop, and nothing at all until hydration — so the join
        form below is never blocked on it. See `open-in-app.tsx` for why a popup is the
        right shape here and why the OS hand-off does not already cover it.
      */}
      <OpenInApp businessId={id} salonName={business.name} />

      {/*
        The walk-in line, when there is one, is the page's primary content: somebody who
        scanned a code taped to a counter is standing in the shop, and taking their place
        is the thing they came to do. Everything else follows underneath.
      */}
      {queueOpen ? (
        !hasSession ? (
          /* A visitor with no session at all is told up front, rather than filling in the
             whole form and meeting a wall at the end. The live wait is unavailable to them
             anyway — `queue_active_line` is revoked from `anon`. */
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
        )
      ) : (
        /* No walk-in line here. The scan is still a arrival at this salon, so it opens on
           the salon's own name rather than on a refusal — the poster promised nothing more
           specific than "this is us". */
        <header className="mb-lg text-center">
          <h1 className="text-heading font-semibold">{business.name}</h1>
          {/* Named from what this salon actually has. The shop clause was unconditional
              for one build and offered a shop to a salon with no products — the exact
              dead end `ScanActions` gates its own row against. */}
          <p className="text-body-md text-muted mt-1">
            {products.length > 0
              ? "Book a time, browse the shop, or see what they do."
              : "Book a time, or see what they do."}
          </p>
        </header>
      )}

      <ScanActions
        businessId={id}
        salonName={business.name}
        hasShop={products.length > 0}
        queueShownAbove={queueOpen}
      />
    </div>
  );
}
