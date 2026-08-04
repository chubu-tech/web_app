import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QueuePosition } from "@/components/customer/queue-position";
import { HeroCircleButton } from "@/components/ui/detail-bits";
import { Icons } from "@/components/ui/icons";
import { fetchActiveLine, fetchQueueEntryById } from "@/lib/api/queue";
import { fetchStaff } from "@/lib/api/salon";
import { createClient } from "@/lib/supabase/server";
import type { QueueEntry } from "@/lib/types/queue";

export const metadata: Metadata = {
  title: "Your place in line",
  // A place in a queue is momentary and personal; there is nothing here to index.
  robots: { index: false, follow: false },
};

/**
 * One place in line, watched live.
 *
 * `[entryId]` is a **queue entry** id — not a business id. The two queue routes are
 * deliberately different things: **`/q/<businessId>` joins, `/queue/<entryId>`
 * watches.**
 *
 * RLS (`queue_select_customer`) scopes the read to the caller's own entry, so someone
 * else's id is simply not found and no ownership check is needed here. Terminal
 * entries still resolve on purpose: the page has to be able to say "you're all done"
 * rather than 404 on a place that has just been served.
 */
export default async function QueuePositionPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  const supabase = await createClient();

  const entry = await fetchQueueEntryById(supabase, entryId);
  if (!entry) notFound();

  const [staff, line] = await Promise.all([
    // Both the barber's name for the card and the roster size for the "Anyone" ETA
    // divisor. Best-effort: a failure costs a name, not the page.
    fetchStaff(supabase, entry.businessId).catch(() => []),
    fetchActiveLine(supabase, entry.businessId).catch(() => null as QueueEntry[] | null),
  ]);

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[560px] tablet:px-lg">
      <div className="mb-base">
        <HeroCircleButton
          icon={Icons.back}
          label="Back to the salon"
          href={`/salon/${entry.businessId}`}
        />
      </div>
      <QueuePosition
        entry={entry}
        initialLine={line}
        staffNames={Object.fromEntries(staff.map((s) => [s.id, s.displayName]))}
        // Defaults to 1 so an unresolved roster gives the undivided — pessimistic —
        // wait rather than an optimistic one.
        barberCount={staff.length > 0 ? staff.length : 1}
      />
    </div>
  );
}
