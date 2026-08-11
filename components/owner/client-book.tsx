import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import {
  CLIENT_SEGMENTS,
  CLIENT_SORTS,
  REGULAR_VISITS,
  clientBookStats,
  clientInSegment,
  clientMatchesQuery,
  isLapsed,
  sortClients,
  type ClientSegment,
  type ClientSort,
} from "@/lib/analytics";
import type { ClientSummary } from "@/lib/types/back-office";
import { whatsappUrl } from "@/lib/whatsapp";
import { formatNu } from "@/lib/utils";

/**
 * The salon's client book — a port of
 * `tho/app/lib/business/clients/client_book_screen.dart`.
 *
 * A server component. The search box, the five segment chips and the four sort orders are all
 * **links carrying `?q=&segment=&sort=`**, not client state — the same call `/business/insights`
 * makes with `?period=` and the calendar made with `?d=&view=` in 3a. A filtered book is worth
 * linking to ("look at our lapsed regulars"), and reloading it should not empty the filters.
 *
 * ## Two things this screen exists for
 *
 * **Lapsed is the number that costs money.** It is the only figure in the strip that gets a
 * colour, because it is the only one that is bad news: regulars who are overdue and have
 * nothing booked. And it is measured against **the salon's own rebooking window**
 * (`businesses.rebooking_days`), not a constant — a barber whose customers come monthly and a
 * colourist whose come quarterly do not share one idea of "overdue".
 *
 * **Reaching someone is one press.** `tel:` and WhatsApp sit on the row, because the reason to
 * open the book is usually to contact a person, and that used to mean opening a detail screen,
 * copying a number and leaving the app by hand.
 *
 * ## Walk-ins are not links
 *
 * `client_book` returns a null `customer_profile_id` for anyone the salon knows only from the
 * counter, and groups them by name and phone. There is nothing to open: `client_history` takes
 * a profile id, and `client_notes.customer_profile_id` is `not null`. So a walk-in row is a
 * row, and it says why.
 */
export function ClientBook({
  clients,
  businessName,
  lapsedAfterDays,
  now,
  query,
  segment,
  sort,
}: {
  clients: ClientSummary[];
  businessName: string;
  lapsedAfterDays: number;
  now: Date;
  query: string;
  segment: ClientSegment;
  sort: ClientSort;
}) {
  const stats = clientBookStats(clients, { lapsedAfterDays, now });
  const rows = sortClients(
    clients
      .filter((c) => clientMatchesQuery(c, query))
      .filter((c) => clientInSegment(c, segment, { lapsedAfterDays, now })),
    sort,
  );

  const href = (over: { q?: string; segment?: string; sort?: string }) => {
    const params = new URLSearchParams();
    const q = over.q ?? query;
    const s = over.segment ?? segment;
    const o = over.sort ?? sort;
    if (q) params.set("q", q);
    if (s !== "all") params.set("segment", s);
    if (o !== "recent") params.set("sort", o);
    const qs = params.toString();
    return qs ? `/business/clients?${qs}` : "/business/clients";
  };

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[860px] tablet:px-lg">
      <h1 className="text-display-lg text-ink mb-xs font-medium">Client book</h1>
      <p className="text-body-sm text-muted mb-lg">
        Everyone who has ever booked with {businessName}, and who has quietly stopped.
      </p>

      {/*
        A GET form, so search works with JavaScript disabled and the result is a real URL.
        `segment` and `sort` ride along as hidden fields — otherwise submitting the search would
        silently reset the tab the owner is looking at.
      */}
      <form action="/business/clients" method="get" className="mb-base gap-sm flex">
        <label className="sr-only" htmlFor="client-search">
          Search by name or phone
        </label>
        <input
          id="client-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search by name or phone"
          className="border-hairline text-body-md text-ink placeholder:text-muted-soft focus:border-ink px-base min-h-12 flex-1 rounded-sm border outline-none"
        />
        {segment !== "all" ? <input type="hidden" name="segment" value={segment} /> : null}
        {sort !== "recent" ? <input type="hidden" name="sort" value={sort} /> : null}
        <button
          type="submit"
          className="border-hairline text-title text-ink hover:bg-surface-soft px-base min-h-12 rounded-sm border font-medium"
        >
          Search
        </button>
      </form>

      {/* The four headline counts. Only `lapsed` is coloured — see the module comment. */}
      <dl className="border-hairline-soft bg-surface-soft py-md mb-md divide-hairline-soft flex divide-x rounded-md">
        <Cell label="Clients" value={stats.total} />
        <Cell label="Regulars" value={stats.regulars} />
        <Cell label="Booked in" value={stats.booked} />
        <Cell label="Lapsed" value={stats.lapsed} bad={stats.lapsed > 0} />
      </dl>

      <nav aria-label="Segment" className="-mx-base px-base mb-md overflow-x-auto">
        <ul className="gap-sm flex">
          {CLIENT_SEGMENTS.map((s) => {
            const count = clients.filter((c) =>
              clientInSegment(c, s.value, { lapsedAfterDays, now }),
            ).length;
            const on = s.value === segment;
            return (
              <li key={s.value}>
                <Link
                  href={href({ segment: s.value })}
                  aria-current={on ? "true" : undefined}
                  className={`text-caption inline-flex min-h-11 items-center rounded-full border px-4 font-semibold whitespace-nowrap ${
                    on
                      ? "bg-ink text-on-primary border-ink"
                      : "border-hairline text-ink hover:bg-surface-soft"
                  }`}
                >
                  {s.label} {count}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="gap-sm mb-md flex flex-wrap items-center">
        <span className="text-caption-sm text-muted">Sort</span>
        {CLIENT_SORTS.map((s) => (
          <Link
            key={s.value}
            href={href({ sort: s.value })}
            aria-current={s.value === sort ? "true" : undefined}
            className={`text-caption px-xs py-xs ${
              s.value === sort ? "text-rausch-cta font-bold" : "text-muted font-medium"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {clients.length === 0 ? (
        <EmptyState
          icon={Icons.people}
          title="No clients yet"
          message="Clients appear here after their first booking with you."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Icons.searchEmpty}
          title={query ? "No matches" : `Nobody in ${labelFor(segment).toLowerCase()}`}
          message={query ? undefined : "Try another tab."}
        />
      ) : (
        <ul className="gap-md flex flex-col">
          {rows.map((c) => (
            <ClientRow
              key={c.groupKey}
              client={c}
              lapsed={isLapsed(c, { lapsedAfterDays, now })}
              businessName={businessName}
              now={now}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Cell({ label, value, bad = false }: { label: string; value: number; bad?: boolean }) {
  return (
    <div className="px-sm min-w-0 flex-1 text-center">
      <dd
        className={`text-title font-semibold tabular-nums ${bad ? "text-error-text" : "text-ink"}`}
      >
        {value}
      </dd>
      <dt className="text-caption-sm text-muted">{label}</dt>
    </div>
  );
}

function labelFor(segment: ClientSegment): string {
  return CLIENT_SEGMENTS.find((s) => s.value === segment)?.label ?? "All";
}

function ClientRow({
  client,
  lapsed,
  businessName,
  now,
}: {
  client: ClientSummary;
  lapsed: boolean;
  businessName: string;
  now: Date;
}) {
  const isRegular = client.visits >= REGULAR_VISITS;
  const walkIn = client.customerProfileId == null;
  const wa = whatsappUrl(client.phone, `Hi ${client.displayName}, this is ${businessName}.`);

  const body = (
    <>
      <Avatar name={client.displayName} size={44} />
      <span className="min-w-0 flex-1">
        <span className="gap-xs flex flex-wrap items-center">
          <span className="text-title text-ink truncate font-medium">{client.displayName}</span>
          {isRegular ? <Tag label="Regular" tone="good" /> : null}
          {lapsed ? <Tag label="Lapsed" tone="bad" /> : null}
          {walkIn ? <Tag label="Walk-in" tone="muted" /> : null}
          {client.hasNote ? (
            <Icons.note
              className="text-muted"
              style={{ width: IconSize.xxs, height: IconSize.xxs }}
              aria-label="Has a private note"
            />
          ) : null}
        </span>
        <span className="text-body-sm text-muted block">
          {client.visits} {client.visits === 1 ? "visit" : "visits"} ·{" "}
          {formatNu(client.totalSpend)}
        </span>
        {/*
          A booked-in client's NEXT visit beats their last one — it is what staff need before
          the door opens, so it takes the accent and the last-visit line steps aside.
        */}
        <span
          className={`text-caption-sm block truncate ${
            client.nextUpcoming ? "text-rausch-cta" : "text-muted"
          }`}
        >
          {client.nextUpcoming
            ? `Booked ${bookedLabel(client.nextUpcoming)}`
            : lastVisitLabel(client.lastVisit, now)}
        </span>
      </span>
    </>
  );

  return (
    <li className="border-hairline-soft bg-canvas rounded-md border">
      <div className="p-md gap-md flex items-center">
        {walkIn ? (
          <div className="gap-md flex min-w-0 flex-1 items-center">{body}</div>
        ) : (
          <Link
            href={`/business/clients/${client.customerProfileId}`}
            className="gap-md hover:bg-surface-soft -m-xs p-xs flex min-w-0 flex-1 items-center rounded-sm"
          >
            {body}
          </Link>
        )}
        {client.phone ? (
          <a
            href={`tel:${client.phone.replace(/\s/g, "")}`}
            aria-label={`Call ${client.displayName}`}
            className="text-ink hover:bg-surface-soft grid size-11 shrink-0 place-items-center rounded-full"
          >
            <Icons.phone style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
          </a>
        ) : null}
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`WhatsApp ${client.displayName}`}
            className="text-ink hover:bg-surface-soft grid size-11 shrink-0 place-items-center rounded-full"
          >
            <Icons.send style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
          </a>
        ) : null}
        {!walkIn && !client.phone && !wa ? (
          <Icons.chevronRight
            className="text-muted-soft shrink-0"
            style={{ width: IconSize.sm, height: IconSize.sm }}
            aria-hidden
          />
        ) : null}
      </div>
    </li>
  );
}

function Tag({ label, tone }: { label: string; tone: "good" | "bad" | "muted" }) {
  const cls =
    tone === "good"
      ? "bg-success-soft text-success-text"
      : tone === "bad"
        ? "bg-error-soft text-error-text"
        : "bg-surface-strong text-muted";
  return (
    <span className={`text-badge px-sm rounded-full py-[1px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

/** Relative for a recent visit, an absolute date further out, and a fallback for never. */
function lastVisitLabel(d: Date | null, now: Date): string {
  if (!d) return "No visits yet";
  const days = Math.floor(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) /
      86_400_000,
  );
  if (days === 0) return "Last visit today";
  if (days === 1) return "Last visit yesterday";
  if (days > 1 && days < 30) return `Last visit ${days} days ago`;
  return `Last visit ${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Thimphu",
  }).format(d)}`;
}

function bookedLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Thimphu",
  }).format(d);
}
