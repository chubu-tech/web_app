import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionCard } from "@/components/ui/section-card";
import { SectionHeader } from "@/components/ui/section-header";
import { fetchBusinessById } from "@/lib/api/discovery";
import { fetchLoyaltyBalance } from "@/lib/api/owner-back-office";
import { fetchLoyaltyTransactions, fetchMyRedemptions } from "@/lib/api/shop";
import { dateLabel } from "@/lib/clock";
import {
  isPendingEvent,
  mergeLoyaltyTimeline,
  streakFrom,
  type LoyaltyEvent,
} from "@/lib/loyalty";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { LoyaltyRedemption, LoyaltyTransaction } from "@/lib/types/back-office";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Points at this salon",
  robots: { index: false, follow: false },
};

/**
 * One salon's loyalty standing — a port of `LoyaltyDetailScreen` in
 * `tho/app/lib/customer/loyalty/loyalty_detail_screen.dart`.
 *
 * **This page exists because the record was unreachable.** Every redemption and every ledger
 * movement was already stored and already readable by the customer who owned it —
 * `loyalty_transactions` is append-only and its select policy admits `auth.uid()` — but nothing
 * in the site ever asked, so a confirmed reward vanished the moment it was confirmed.
 *
 * ## And it closes a worse hole
 *
 * A pending redemption **holds** its points, and `/rewards/[id]` — the only screen showing the
 * code, and the only place with the Cancel that releases the hold — was reachable from exactly
 * one line: the tap that created it. Back out before reaching the counter and the points were
 * held, the code unreachable, and `expired` is in the status enum with nothing in the schema
 * ever setting it. Listing the pending redemption here is what makes them recoverable.
 *
 * That is not hypothetical on this database. One customer at Norzin has 50 points earned across
 * five visits, all 50 held by a claim made three days ago and still pending — so `/rewards`
 * shows them **0 points** with no way to see why or to get them back.
 *
 * ## Its own segment under `/rewards`, not `/rewards/[id]`
 *
 * That route is a redemption code and stays one; a printed or messaged link to a code must not
 * start resolving to something else. `/rewards/salon/{id}` is two segments, so the two never
 * compete.
 *
 * Reads throw to `app/(customer)/error.tsx` rather than collapsing into an empty state — the
 * repo's rule, and the sharpest case for it: "you have no points" and "we could not read your
 * points" are opposite claims about somebody's money.
 */
export default async function SalonLoyaltyPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const account = await getAccount();

  if (account.state !== "registered") {
    return (
      <Shell>
        <EmptyState
          icon={Icons.reward}
          title="Rewards need an account"
          message="Points are tied to a real account, so this is one of the few things a visitor can't do."
          action={
            <Link
              href={`/sign-${account.state === "guest" ? "up" : "in"}?next=/rewards/salon/${businessId}`}
            >
              <Button>{account.state === "guest" ? "Create an account" : "Sign in"}</Button>
            </Link>
          }
        />
      </Shell>
    );
  }

  const supabase = await createClient();
  // Four independent reads for one screen, started together.
  const [business, balance, redemptions, txns] = await Promise.all([
    fetchBusinessById(supabase, businessId),
    fetchLoyaltyBalance(supabase, businessId, account.user.id),
    fetchMyRedemptions(supabase, account.user.id, businessId),
    fetchLoyaltyTransactions(supabase, account.user.id, businessId),
  ]);
  if (!business) notFound();

  const events = mergeLoyaltyTimeline({ txns, redemptions });
  // The clock is read here rather than inside `streakFrom`, which takes `now` so the window
  // boundary stays testable to the day.
  const streak = streakFrom(txns, new Date());
  const pending = events.find(isPendingEvent);
  const pendingRedemption = pending?.kind === "redemption" ? pending.redemption : null;

  if (balance.balance === 0 && events.length === 0) {
    return (
      <Shell name={business.name}>
        <EmptyState
          icon={Icons.gift}
          title="Nothing yet"
          message="Points from your next visit here will show up on this page."
          action={
            <Link href={`/salon/${businessId}`}>
              <Button variant="outlined">Open {business.name}</Button>
            </Link>
          }
        />
      </Shell>
    );
  }

  return (
    <Shell name={business.name}>
      <SectionCard>
        <p className="flex items-end">
          <span className="text-display-lg text-ink font-semibold tabular-nums">
            {balance.available}
          </span>
          <span className="text-body-sm text-muted ml-xs pb-1">points to spend</span>
        </p>

        {/*
          A held figure with no stated cause is the whole complaint: the customer sees a number
          lower than they expect and has nothing to reconcile it against. So the hold is never
          shown as a bare subtraction — it names the reward and goes to its code.
        */}
        {balance.held > 0 && pendingRedemption ? (
          <Link
            href={`/rewards/${pendingRedemption.id}`}
            className="border-hairline mt-md pt-md gap-md hover:bg-surface-soft -mx-2 flex items-center rounded-sm border-t px-2 py-2"
          >
            <Icons.gift
              className="text-rausch shrink-0"
              style={{ width: IconSize.sm, height: IconSize.sm }}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="text-title text-ink block font-medium tabular-nums">
                {balance.held} points held
              </span>
              <span className="text-body-sm text-muted block">
                for {pendingRedemption.nameSnapshot} — show the code at the counter
              </span>
            </span>
            <Icons.chevronRight
              className="text-muted-soft shrink-0"
              style={{ width: IconSize.sm, height: IconSize.sm }}
              aria-hidden
            />
          </Link>
        ) : balance.held > 0 ? (
          /* Held with nothing pending to point at should be impossible — `loyalty_balance` sums
             pending redemptions and this page read both. Stated anyway rather than leaving the
             gap between the two numbers unexplained. */
          <p className="text-body-sm text-muted mt-md tabular-nums">
            {balance.held} of your {balance.balance} points are held by a claim.
          </p>
        ) : null}
      </SectionCard>

      {/*
        A lapsed run is never shown: `streakFrom` returns nothing once the most recent visit is
        older than the window, because "3 visits in a row" beside a date in the past is
        advertising a failure. The useful half is the date, not the count.
      */}
      {streak ? (
        <SectionCard className="mt-md">
          <div className="gap-md flex items-center">
            <Icons.streak
              className="text-rausch shrink-0"
              style={{ width: IconSize.md, height: IconSize.md }}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-title text-ink font-medium">
                {streak.length === 1 ? "Your run has started" : `${streak.length} visits in a row`}
              </p>
              <p className="text-body-sm text-muted">
                Visit by {dateLabel(streak.keepBy)} to keep it going
              </p>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {events.length > 0 ? (
        <>
          <SectionHeader title="History" as="h2" className="mt-lg mb-sm" />
          <ul className="gap-sm flex flex-col">
            {events.map((e) => (
              <li key={e.kind === "redemption" ? e.redemption.id : e.transaction.id}>
                <EventRow event={e} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Shell>
  );
}

function Shell({ name, children }: { name?: string; children: React.ReactNode }) {
  return (
    <div className="px-base py-lg tablet:px-lg mx-auto w-full max-w-[720px]">
      <Link
        href="/rewards"
        className="text-caption text-muted hover:text-ink gap-xs mb-md inline-flex items-center"
      >
        <Icons.back style={{ width: IconSize.xxs, height: IconSize.xxs }} aria-hidden />
        My rewards
      </Link>
      <h1 className="text-display-lg text-ink mb-lg font-medium">{name ?? "My rewards"}</h1>
      {children}
    </div>
  );
}

/** A redemption, or a bare ledger movement. Only a pending redemption is an action. */
function EventRow({ event }: { event: LoyaltyEvent }) {
  if (event.kind === "transaction") return <TxnRow txn={event.transaction} />;
  return <RedemptionRow redemption={event.redemption} />;
}

function RedemptionRow({ redemption }: { redemption: LoyaltyRedemption }) {
  const pending = redemption.status === "pending";
  const { label, tone } = REDEMPTION_STATE[redemption.status];
  const body = (
    <>
      <Icons.reward
        className={cn("shrink-0", tone)}
        style={{ width: IconSize.sm, height: IconSize.sm }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="text-title text-ink block truncate font-medium">
          {redemption.nameSnapshot}
        </span>
        <span className="text-body-sm text-muted block">
          {label} · {dateLabel(redemption.requestedAt)}
        </span>
      </span>
      {/* U+2212, not a hyphen — this is a quantity going down, not a dash. */}
      <span
        className={cn(
          "text-title shrink-0 font-medium tabular-nums",
          pending ? "text-rausch-cta" : "text-muted",
        )}
      >
        −{redemption.pointCost}
      </span>
      {pending ? (
        <Icons.chevronRight
          className="text-muted-soft shrink-0"
          style={{ width: IconSize.sm, height: IconSize.sm }}
          aria-hidden
        />
      ) : null}
    </>
  );

  if (!pending) return <div className={ROW}>{body}</div>;
  return (
    <Link href={`/rewards/${redemption.id}`} className={cn(ROW, "hover:bg-surface-soft")}>
      {body}
    </Link>
  );
}

function TxnRow({ txn }: { txn: LoyaltyTransaction }) {
  const earned = txn.points >= 0;
  const reason = txn.reason?.trim();
  return (
    <div className={ROW}>
      <Icons.success
        className={cn("shrink-0", earned ? "text-success-text" : "text-muted")}
        style={{ width: IconSize.sm, height: IconSize.sm }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="text-title text-ink block font-medium">{txnTitle(txn, earned)}</span>
        <span className="text-body-sm text-muted block truncate">
          {[reason, dateLabel(txn.createdAt)].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span
        className={cn(
          "text-title shrink-0 font-medium tabular-nums",
          earned ? "text-success-text" : "text-muted",
        )}
      >
        {earned ? "+" : "−"}
        {Math.abs(txn.points)}
      </span>
    </div>
  );
}

const ROW = "border-hairline bg-canvas p-md gap-md flex items-center rounded-md border";

const REDEMPTION_STATE: Record<LoyaltyRedemption["status"], { label: string; tone: string }> = {
  pending: { label: "Waiting at the counter", tone: "text-rausch" },
  confirmed: { label: "Reward taken", tone: "text-success-text" },
  cancelled: { label: "Cancelled", tone: "text-muted" },
  expired: { label: "Expired", tone: "text-muted" },
};

function txnTitle(txn: LoyaltyTransaction, earned: boolean): string {
  if (txn.kind === "earn") return "Points earned";
  if (txn.kind === "redeem") return "Points spent";
  return earned ? "Points added by the salon" : "Points removed by the salon";
}
