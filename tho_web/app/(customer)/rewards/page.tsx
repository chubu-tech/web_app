import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { fetchMyLoyaltySummary } from "@/lib/api/shop";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "My rewards",
  robots: { index: false, follow: false },
};

/**
 * Points across every salon — a port of `MyRewardsScreen` in
 * `tho/app/lib/customer/loyalty/my_rewards_screen.dart`.
 *
 * **`my_loyalty_summary` decides what is worth listing, and its filter is worth knowing:** a salon
 * appears only when the available balance is **non-zero** *or* a redemption is pending. So a customer
 * who has spent everything sees the empty state rather than a row of zeroes, and a salon they have
 * never earned at never appears. That is a deliberate collapse and this page does not fight it — it
 * just has to be honest that "no points yet" can also mean "no points left".
 *
 * `next_reward_*` is the cheapest reward they cannot yet afford, so it is null in two different
 * situations: an empty reward menu, and a customer who can already afford everything. The second
 * deserves saying out loud.
 */
export default async function MyRewardsPage() {
  const account = await getAccount();

  if (account.state !== "registered") {
    return (
      <Shell>
        <EmptyState
          icon={Icons.reward}
          title="Rewards need an account"
          message="Points are tied to a real account, so this is one of the few things a visitor can't do."
          action={
            <Link href={`/sign-${account.state === "guest" ? "up" : "in"}?next=/rewards`}>
              <Button>{account.state === "guest" ? "Create an account" : "Sign in"}</Button>
            </Link>
          }
        />
      </Shell>
    );
  }

  const supabase = await createClient();
  const entries = await fetchMyLoyaltySummary(supabase).catch(() => []);

  if (entries.length === 0) {
    return (
      <Shell>
        <EmptyState
          icon={Icons.reward}
          title="No points yet"
          message="Salons running a loyalty programme give you points for each visit. Yours will show up here — as will anything you have left after redeeming."
          action={
            <Link href="/">
              <Button variant="outlined">Find a salon</Button>
            </Link>
          }
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <ul className="gap-md flex flex-col">
        {entries.map((entry) => {
          const hasNext =
            entry.nextRewardName != null &&
            entry.nextRewardCost != null &&
            entry.nextRewardCost > 0;
          const progress = hasNext
            ? Math.min(Math.max(entry.available / entry.nextRewardCost!, 0), 1)
            : 1;
          return (
            <li key={entry.businessId}>
              <Link
                href={`/salon/${entry.businessId}`}
                className="border-hairline-soft p-base gap-base hover:bg-surface-soft flex items-center rounded-md border"
              >
                <Ring progress={progress} />
                <span className="min-w-0 flex-1">
                  <span className="text-title text-ink block truncate font-medium">
                    {entry.businessName}
                  </span>
                  <span className="text-display-sm text-ink block font-semibold tabular-nums">
                    {entry.available} points
                  </span>
                  <span className="text-body-sm text-muted block truncate">
                    {hasNext
                      ? `${entry.nextRewardCost! - entry.available} more → ${entry.nextRewardName}`
                      : "Enough for everything on their menu"}
                  </span>
                </span>
                <Icons.chevronRight
                  className="text-muted-soft shrink-0"
                  style={{ width: IconSize.sm, height: IconSize.sm }}
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-caption-sm text-muted mt-lg">
        Open a salon to see its rewards and claim one. Points are held when you claim and spent when
        the salon confirms.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <h1 className="text-display-lg text-ink mb-lg font-medium">My rewards</h1>
      {children}
    </div>
  );
}

/** The small progress ring beside each salon. 40px, so it is a dial rather than a chart. */
function Ring({ progress }: { progress: number }) {
  const stroke = 12;
  const r = (100 - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="size-10 shrink-0 -rotate-90" aria-hidden>
      <circle
        cx={50}
        cy={50}
        r={r}
        fill="none"
        stroke="var(--color-surface-strong)"
        strokeWidth={stroke}
      />
      <circle
        cx={50}
        cy={50}
        r={r}
        fill="none"
        stroke="var(--color-rausch)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${progress * c} ${c}`}
      />
    </svg>
  );
}
