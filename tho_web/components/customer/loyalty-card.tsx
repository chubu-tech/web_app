"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { GuestWall } from "@/components/auth/guest-wall";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { requestRedemption } from "@/lib/api/shop";
import { shopErrorMessage } from "@/lib/api/shop-errors";
import { earnSentence, progressToNext, rewardValueLabel } from "@/lib/analytics";
import type { LoyaltyBalance, LoyaltyProgram, LoyaltyReward } from "@/lib/types/back-office";
import { createClient } from "@/lib/supabase/client";

/**
 * The salon's loyalty card — a port of `LoyaltyCard` in
 * `tho/app/lib/customer/loyalty/loyalty_card.dart`.
 *
 * **Rendered only when there is a live programme**, which the server decides:
 * `fetchPublicLoyaltyProgram` returns null for a salon with no row *or* a switched-off one, because
 * `loyalty_programs_select_public` admits only `is_active`. So the salon page can include this
 * unconditionally and a salon without loyalty shows nothing at all — not an empty card, and not a
 * zero balance, which would be a claim about a scheme that does not exist.
 *
 * **A visitor sees the rewards but no balance.** `loyalty_balance` needs a session, so the menu is
 * public and the number is not — which is the honest split, and it lets the rewards do the
 * advertising the programme exists for.
 *
 * ## The token, again
 *
 * `request_redemption` de-duplicates on `client_token`, and this is the call the Flutter app gets
 * wrong: `Api.requestRedemption` passes a fresh `_uuid.v4()` every time, so a retry after an
 * ambiguous failure creates a *second* pending redemption and holds the points twice. Here the token
 * is minted once per reward per mount and reused, so pressing Redeem twice resolves to one claim.
 */
export function LoyaltyCard({
  businessId,
  program,
  rewards,
  balance,
  signedIn,
  isGuest,
}: {
  businessId: string;
  /** Null when the salon has no active programme — then this renders nothing. */
  program: LoyaltyProgram | null;
  rewards: LoyaltyReward[];
  /** Null for a visitor: `loyalty_balance` needs a session. */
  balance: LoyaltyBalance | null;
  signedIn: boolean;
  isGuest: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [wall, setWall] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  // One token per reward, for the life of this mount — see the note above.
  const [tokens] = useState(() => new Map<string, string>());

  if (!program) return null;

  const available = balance?.available ?? 0;
  const { target, progress } = progressToNext(rewards, available);

  async function redeem(reward: LoyaltyReward) {
    if (!signedIn || isGuest) {
      setPending(reward.id);
      setWall(true);
      return;
    }
    setBusy(reward.id);
    try {
      let token = tokens.get(reward.id);
      if (!token) {
        token = crypto.randomUUID();
        tokens.set(reward.id, token);
      }
      const redemption = await requestRedemption(createClient(), {
        businessId,
        rewardId: reward.id,
        clientToken: token,
      });
      router.push(`/rewards/${redemption.id}`);
    } catch (caught) {
      toast.error(shopErrorMessage("redeem", caught));
      setBusy(null);
    }
  }

  return (
    <section className="mt-xl">
      <SectionHeader title="Loyalty" />

      <div className="border-hairline bg-canvas p-base gap-base mb-md flex flex-wrap items-center rounded-md border">
        <Ring progress={progress} value={available} showValue={balance != null} />
        <div className="min-w-0 flex-1">
          <p className="text-body-sm text-muted">{earnSentence(program)}</p>
          {balance == null ? (
            <p className="text-title text-ink mt-sm font-medium">
              Sign in to see your points here.
            </p>
          ) : target ? (
            <p className="text-title text-ink mt-sm font-medium">
              {target.pointCost - available} more to {target.name}
            </p>
          ) : rewards.length > 0 ? (
            <p className="text-title text-rausch-cta mt-sm font-medium">All rewards unlocked</p>
          ) : null}
          {balance != null && balance.held > 0 ? (
            <p className="text-caption-sm text-muted mt-xs">
              {balance.held} held by a reward you have already claimed.
            </p>
          ) : null}
        </div>
      </div>

      {rewards.length === 0 ? (
        <p className="text-body-sm text-muted">
          No rewards on the menu yet — your points are still adding up.
        </p>
      ) : (
        <ul className="gap-sm flex flex-col">
          {rewards.map((reward) => {
            const affordable = balance != null && available >= reward.pointCost;
            return (
              <li
                key={reward.id}
                className={`bg-canvas p-md gap-md flex items-center rounded-md border ${
                  affordable ? "border-rausch" : "border-hairline-soft"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="gap-xs flex flex-wrap items-center">
                    <span className="text-title text-ink truncate font-medium">{reward.name}</span>
                    {affordable ? (
                      <span className="bg-success-soft text-success-text text-badge gap-xxs inline-flex items-center rounded-full px-2 py-[1px] font-semibold">
                        <Icons.gift style={{ width: 11, height: 11 }} aria-hidden />
                        Ready
                      </span>
                    ) : null}
                  </span>
                  <span className="text-body-sm text-muted block">
                    {rewardValueLabel(reward)} · {reward.pointCost} pts
                  </span>
                </span>
                {affordable ? (
                  <Button
                    busy={busy === reward.id}
                    disabled={busy != null}
                    onClick={() => void redeem(reward)}
                    className="min-h-10 shrink-0 px-3"
                  >
                    Redeem
                  </Button>
                ) : (
                  <span className="text-body-sm text-muted shrink-0 tabular-nums">
                    {balance == null
                      ? `${reward.pointCost} pts`
                      : `${reward.pointCost - available} more pts`}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <GuestWall
        open={wall}
        onClose={() => setWall(false)}
        action="redeem"
        onUpgraded={() => {
          setWall(false);
          const reward = rewards.find((r) => r.id === pending);
          if (reward) void redeem(reward);
        }}
      />
    </section>
  );
}

/**
 * The points ring — an SVG arc, the same `stroke-dasharray` construction as the owner console's
 * `RadialGauge`. Not shared with it: that one is 132px with a percentage in the middle and this is
 * 96px with a count, and one component taking both would be two components with a flag.
 */
function Ring({
  progress,
  value,
  showValue,
}: {
  progress: number;
  value: number;
  showValue: boolean;
}) {
  const stroke = 10;
  const r = (100 - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = Math.min(Math.max(progress, 0), 1) * circumference;

  return (
    <div
      className="relative size-24 shrink-0"
      role="img"
      aria-label={showValue ? `${value} points` : "Points hidden until you sign in"}
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
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
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-display-sm text-ink font-semibold tabular-nums">
            {showValue ? value : "—"}
          </p>
          <p className="text-caption-sm text-muted">points</p>
        </div>
      </div>
    </div>
  );
}
