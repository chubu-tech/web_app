"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QueueWaitBadge } from "@/components/ui/queue-wait-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { Sheet } from "@/components/ui/sheet";
import { queueShopSummary } from "@/lib/queue-logic";
import type { QueueEntry } from "@/lib/types/queue";
import type { Business, ServiceItem, StaffMember } from "@/lib/types/salon";
import { JoinQueueForm } from "./join-queue-form";

/**
 * "Walk in today" on the salon page — the shop's current wait and a route into the
 * line. A port of `_walkInCard` in
 * `tho/app/lib/customer/business_detail_screen.dart:429`.
 *
 * **The caller decides whether to render this at all**, on `runsQueue(business)` —
 * the plan gate *and* the owner's switch, because an entitled salon that turned its
 * queue off must not advertise a line `join_queue` would refuse.
 *
 * The badge's figures come from a **server-read** snapshot, so the card has numbers on
 * first paint; polling starts only once the sheet is open. Nobody reading a salon page
 * is watching for their turn.
 *
 * Joining from here is **not** a scan (`viaQr={false}`), which is what makes a
 * `qr_only` salon show "Scan to join" in the sheet instead of a button that fails.
 */
export function WalkInCard({
  business,
  services,
  staff,
  initialLine,
  hasSession,
}: {
  business: Business;
  services: ServiceItem[];
  staff: StaffMember[];
  /** `null` means the line is unknown — a failed read, or no session to read it with. */
  initialLine: QueueEntry[] | null;
  hasSession: boolean;
}) {
  /** A fresh number per opening, used as the sheet's `key` so the form starts clean. */
  const [session, setSession] = useState<number | null>(null);

  const summary = initialLine
    ? queueShopSummary({
        line: initialLine,
        barberCount: staff.length > 0 ? staff.length : 1,
      })
    : null;

  return (
    <section className="border-hairline-soft bg-canvas shadow-card p-base mt-lg rounded-md border">
      <SectionHeader title="Walk in today" as="h2" />
      <QueueWaitBadge
        waiting={summary?.waiting ?? null}
        etaMinutes={summary?.etaMinutes ?? null}
      />

      <div className="mt-md">
        {hasSession ? (
          <Button variant="outlined" fullWidth onClick={() => setSession((n) => (n ?? 0) + 1)}>
            Join queue
          </Button>
        ) : (
          // No session means no live wait (`queue_active_line` is revoked from
          // `anon`) and no way to join (`join_queue` needs a real account). Say that
          // rather than opening a form that can only end at a wall.
          <Link
            href={`/sign-in?next=${encodeURIComponent(`/salon/${business.id}`)}`}
            className="border-hairline text-ink bg-canvas text-title hover:bg-surface-soft flex min-h-12 items-center justify-center rounded-sm border font-medium"
          >
            Sign in to join the queue
          </Link>
        )}
      </div>

      <Sheet
        key={session ?? "closed"}
        open={session != null}
        onClose={() => setSession(null)}
        title="Join the queue"
      >
        <JoinQueueForm
          business={business}
          services={services}
          staff={staff}
          viaQr={false}
          initialLine={initialLine}
          onDone={() => setSession(null)}
        />
      </Sheet>
    </section>
  );
}
