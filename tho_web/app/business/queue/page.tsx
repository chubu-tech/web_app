import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { QueueBoard } from "@/components/owner/queue-board";
import { fetchBusinessQueue } from "@/lib/api/owner";
import { fetchServices, fetchStaff } from "@/lib/api/salon";
import { getOwnerContext } from "@/lib/owner/context";
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
 * **`runsQueue` gates everything, and it is two conditions not one.** `queueEnabled &&
 * hasFeature(plan, "walkInQueue")` — the plan *and* the owner's own switch. The app's board
 * checks only the plan, so a Growth salon that turned the queue off still gets a live
 * polling board with a working Call next while `join_queue` refuses its customers with
 * `P0001`. Reading the salon's own switch is the fourth documented divergence from the Dart.
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

  const [entries, staff, services] = open
    ? await Promise.all([
        fetchBusinessQueue(supabase, active.id),
        // Active only — an inactive barber cannot be called, and an inactive service should
        // not be offered to a walk-in. `{ activeOnly: true }` is the default and this is the
        // first caller in the repo that has ever wanted anything else to be possible.
        fetchStaff(supabase, active.id),
        fetchServices(supabase, active.id),
      ])
    : [[] as QueueEntry[], [], []];

  const link = open ? await queueLinkFor(active.id) : "";
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
    />
  );
}

/**
 * The URL the printed QR encodes — this deployment's own `/q/<businessId>`.
 *
 * Built from the request rather than an env var so it is right in every environment without
 * one more thing to configure, and so a QR generated from a preview deployment points at
 * that preview instead of silently at production.
 */
async function queueLinkFor(businessId: string): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/q/${businessId}`;
}

/**
 * The QR as an inline SVG string.
 *
 * Rendered here rather than in the browser: it costs no client bundle, it prints as vectors
 * at any paper size, and it is on screen before any JavaScript has run. Error correction
 * level M is the encoder's default and the right trade for a code that will be printed and
 * then photographed under salon lighting.
 *
 * A failure returns null rather than throwing — the sheet still shows the link, which is the
 * part that actually has to be right.
 */
async function qrSvg(link: string): Promise<string | null> {
  try {
    return await QRCode.toString(link, {
      type: "svg",
      margin: 1,
      // Drawn to fill its container; the width only sets the SVG's intrinsic ratio.
      width: 220,
      color: { dark: "#222222", light: "#ffffff" },
    });
  } catch {
    return null;
  }
}
