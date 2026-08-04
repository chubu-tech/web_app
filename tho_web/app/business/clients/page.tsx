import type { Metadata } from "next";
import { ClientBook } from "@/components/owner/client-book";
import { LockedTeaser } from "@/components/owner/insight-card";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { PaywallButton } from "@/components/owner/paywall-button";
import { fetchClientBook } from "@/lib/api/owner-back-office";
import type { ClientSegment, ClientSort } from "@/lib/analytics";
import { hasFeature } from "@/lib/entitlements";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Client book" };

/**
 * The salon's clients — a port of `tho/app/lib/business/clients/client_book_screen.dart`.
 *
 * **This page draws a locked state the app doesn't.** `ClientBookScreen` has no plan gate at
 * all: on a Basic salon it calls `client_book`, the RPC raises
 * `P0001 'client book not available'`, and the screen shows *"Couldn't load"* with a Retry that
 * can only fail again. Eight of this owner's nine salons are Basic, so that is the common case,
 * not the edge. Here the entitlement is checked first and the RPC is never called — which is
 * also why this is a real paywall rather than a cosmetic one, unlike Insights: the gate is in
 * the RPC too.
 */
export default async function OwnerClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; segment?: string; sort?: string }>;
}) {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  if (!hasFeature(active.plan, "clientBook")) {
    return (
      <div className="px-base py-lg mx-auto w-full max-w-[860px] tablet:px-lg">
        <h1 className="text-display-lg text-ink mb-lg font-medium">Client book</h1>
        <LockedTeaser
          title="Know who your regulars are"
          message="Visit counts, total spend, who is booked back in and who has quietly stopped coming — on Growth and Pro."
          action={<PaywallButton feature="clientBook" label="See plans" />}
        />
      </div>
    );
  }

  const { q, segment, sort } = await searchParams;
  const supabase = await createClient();
  const clients = await fetchClientBook(supabase, active.id);

  return (
    <ClientBook
      clients={clients}
      businessName={active.name}
      // The salon's own rebooking window is what "lapsed" means. `rebookingDays` defaults to 30
      // in the mapper, matching the column default, so a salon that has never set one still
      // gets a sensible line rather than everybody being lapsed or nobody being.
      lapsedAfterDays={active.rebookingDays}
      now={new Date()}
      query={q ?? ""}
      segment={asSegment(segment)}
      sort={asSort(sort)}
    />
  );
}

function asSegment(v: string | undefined): ClientSegment {
  return v === "regulars" || v === "lapsed" || v === "upcoming" || v === "walkIns" ? v : "all";
}

function asSort(v: string | undefined): ClientSort {
  return v === "spend" || v === "visits" || v === "name" ? v : "recent";
}
