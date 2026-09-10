import type { Metadata } from "next";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { QueueBoard } from "@/components/owner/queue-board";
import { fetchBusinessQueue } from "@/lib/api/owner";
import { fetchClientBook } from "@/lib/api/owner-back-office";
import { fetchServices, fetchStaff } from "@/lib/api/salon";
import { hasFeature } from "@/lib/entitlements";
import { getOwnerContext } from "@/lib/owner/context";
import { qrSvg, queueScanUrl } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";
import type { QueueEntry } from "@/lib/types/queue";
import { runsQueue } from "@/lib/types/salon";

export const metadata: Metadata = { title: "Queue" };

/**
 * The owner's side of the walk-in line.
 *
 * This is the half of the queue the product has been missing: since 2c a customer has been
 * able to take a place in Norzin's line from the web, and **nothing on any web surface could
 * call them**. AGENTS.md said so in as many words.
 *
 * **`runsQueue` gates everything, and it is one condition: the owner's own switch.** It used
 * to be two — the switch AND a plan entitlement — and the plan half is gone from both
 * clients: `20260902000003_queue_for_all_plans.sql` removed it from `join_queue`,
 * `check_in_booking` and `queue_active_line`, so `queue_enabled` is the only control and a
 * Basic salon that switches it on gets a board the server will serve. A plan term here would
 * now hide a live surface, which is the opposite of the bug it was written to avoid.
 *
 * When it is off, **nothing is read at all** — not the line, not the roster, not the
 * services. A locked board that still costs four queries and then a request every four
 * seconds is a locked board in name only.
 */
export default async function OwnerQueuePage() {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const open = runsQueue(active);
  const supabase = await createClient();

  const [entries, staff, services, clientProfileIds] = open
    ? await Promise.all([
        fetchBusinessQueue(supabase, active.id),
        // Active only — an inactive barber cannot be called, and an inactive service should
        // not be offered to a walk-in. `{ activeOnly: true }` is the default and this is the
        // first caller in the repo that has ever wanted anything else to be possible.
        fetchStaff(supabase, active.id),
        fetchServices(supabase, active.id),
        /*
          Who in the line has a client record to open.

          **The board cannot work this out for itself.** `/business/clients/[id]` 404s on a
          profile that is not in `client_book`, and `client_book` is built from `bookings` — so
          somebody who walked in off the street and has never booked here has no page, and a
          link to one would be the dead end `destinations.ts` exists to prevent.

          Read here, once, rather than per row: the board polls every four seconds and this
          does not change on that cadence. Gated on the feature because the RPC raises `P0001`
          below Growth, and a failure costs the links and nothing else.
        */
        hasFeature(active.plan, "clientBook")
          ? fetchClientBook(supabase, active.id)
              .then((book) =>
                book
                  .map((c) => c.customerProfileId)
                  .filter((id): id is string => id != null),
              )
              .catch(() => [] as string[])
          : Promise.resolve([] as string[]),
      ])
    : [[] as QueueEntry[], [], [], [] as string[]];

  const link = open ? await queueScanUrl(active.id) : "";
  const svg = link ? await qrSvg(link) : null;

  return (
    <QueueBoard
      business={active}
      staff={staff}
      services={services}
      initialEntries={entries}
      queueLink={link}
      queueQrSvg={svg}
      runsQueue={open}
      clientProfileIds={clientProfileIds}
    />
  );
}
