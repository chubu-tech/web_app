import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdjustPointsSheet } from "@/components/owner/adjust-points-sheet";
import { ClientNoteSheet } from "@/components/owner/client-note-sheet";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import {
  fetchClientBook,
  fetchClientHistory,
  fetchClientNote,
  fetchLoyaltyBalance,
  fetchLoyaltyProgram,
} from "@/lib/api/owner-back-office";
import { hasFeature } from "@/lib/entitlements";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";
import { formatNu } from "@/lib/utils";
import { whatsappUrl } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Client" };

/**
 * One client — a port of `tho/app/lib/business/clients/client_detail_screen.dart`.
 *
 * **The route parameter is a `profiles.id`, and only registered customers have one.** A walk-in
 * comes out of `client_book` with a null `customer_profile_id` and a synthesised group key, so
 * there is no page to open for them — the list renders them as plain rows rather than links, and
 * this route 404s anything it can't find in the book. That is stricter than the app, which
 * pushes the detail screen for a walk-in and then hides both of its sections.
 *
 * The roll-up is read from `client_book` rather than passed through navigation state: a page an
 * owner can bookmark has to be able to render itself, and the RPC is one call.
 *
 * **WhatsApp is offered whenever there is a number.** The app gates it on `Feature.deposits`,
 * which is a Pro entitlement about no-show cover and has nothing to do with messaging someone —
 * a gate on the wrong thing. The client book's own rows have always offered it ungated, so
 * gating it here would also make the same salon's two screens disagree.
 */
export default async function OwnerClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;
  if (!hasFeature(active.plan, "clientBook")) notFound();

  const { id } = await params;
  const supabase = await createClient();

  // The balance is read only when the salon actually runs a program: `loyalty_balance` would
  // answer 0/0/0 for a salon with no `loyalty_programs` row, and a "0 points" card on a salon that
  // has never offered loyalty is a statement about a scheme that doesn't exist.
  const runsLoyalty = hasFeature(active.plan, "loyalty");
  const [book, history, note, program] = await Promise.all([
    fetchClientBook(supabase, active.id),
    fetchClientHistory(supabase, active.id, id).catch(() => []),
    fetchClientNote(supabase, active.id, id).catch(() => ""),
    runsLoyalty ? fetchLoyaltyProgram(supabase, active.id).catch(() => null) : Promise.resolve(null),
  ]);
  const client = book.find((c) => c.customerProfileId === id);
  if (!client) notFound();

  const balance = program
    ? await fetchLoyaltyBalance(supabase, active.id, id).catch(() => null)
    : null;

  const wa = whatsappUrl(client.phone, `Hi ${client.displayName}, this is ${active.name}.`);

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <Link
        href="/business/clients"
        className="text-caption text-muted hover:text-ink gap-xs mb-md inline-flex items-center"
      >
        <Icons.back style={{ width: IconSize.xxs, height: IconSize.xxs }} aria-hidden />
        Client book
      </Link>

      <div className="border-hairline bg-canvas p-base mb-lg rounded-md border">
        <h1 className="text-display-lg text-ink font-medium">{client.displayName}</h1>
        {client.phone ? <p className="text-body-sm text-muted">{client.phone}</p> : null}

        <dl className="gap-sm mt-md flex flex-wrap">
          <Stat label={`${client.visits} ${client.visits === 1 ? "visit" : "visits"}`} />
          <Stat label={`${formatNu(client.totalSpend)} spent`} />
          <Stat
            label={
              client.lastVisit
                ? `Last visit ${dayLabel(client.lastVisit)}`
                : "No visits yet"
            }
          />
          {client.nextUpcoming ? (
            <Stat label={`Booked ${dayLabel(client.nextUpcoming)}`} accent />
          ) : null}
        </dl>

        {client.phone || wa ? (
          <div className="gap-sm mt-base flex flex-wrap">
            {client.phone ? (
              <a
                href={`tel:${client.phone.replace(/\s/g, "")}`}
                className="border-hairline text-title text-ink hover:bg-surface-soft gap-sm px-base inline-flex min-h-11 items-center rounded-sm border font-medium"
              >
                <Icons.phone
                  style={{ width: IconSize.xxs, height: IconSize.xxs }}
                  aria-hidden
                />
                Call
              </a>
            ) : null}
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="border-hairline text-title text-ink hover:bg-surface-soft gap-sm px-base inline-flex min-h-11 items-center rounded-sm border font-medium"
              >
                <Icons.send
                  style={{ width: IconSize.xxs, height: IconSize.xxs }}
                  aria-hidden
                />
                WhatsApp
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      {balance ? (
        <AdjustPointsSheet
          businessId={active.id}
          customerProfileId={id}
          clientName={client.displayName}
          balance={balance}
        />
      ) : null}

      <div className="mb-sm flex items-center justify-between">
        <SectionHeader title="Private note" />
        <ClientNoteSheet
          businessId={active.id}
          customerProfileId={id}
          initialNote={note}
          clientName={client.displayName}
        />
      </div>
      <p className={note ? "text-body-md text-ink mb-lg" : "text-body-sm text-muted mb-lg"}>
        {note || "No note yet."}
      </p>

      <SectionHeader title="History" />
      {history.length === 0 ? (
        <p className="text-body-sm text-muted">
          No bookings on record — which for someone in your book means their visits predate the
          app, or were taken at the counter under a different name.
        </p>
      ) : (
        <ul className="gap-md flex flex-col">
          {history.map((h) => (
            <li
              key={h.bookingId}
              className="border-hairline-soft bg-canvas p-md rounded-md border"
            >
              <Link
                href={`/business/bookings/${h.bookingId}`}
                className="gap-sm flex items-start"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-title text-ink block font-medium">
                    {dayLabel(h.startTs)}
                  </span>
                  <span className="text-body-sm text-muted block truncate">
                    {h.services ?? "Service"} · {formatNu(h.totalPrice)}
                  </span>
                </span>
                <StatusPill status={h.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <dd
      className={`text-caption px-md py-sm rounded-full ${
        accent ? "bg-rausch/10 text-rausch-cta font-semibold" : "bg-surface-soft text-body"
      }`}
    >
      {label}
    </dd>
  );
}

function dayLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Thimphu",
  }).format(d);
}
