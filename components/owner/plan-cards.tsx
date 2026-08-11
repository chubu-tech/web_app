"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { requestPlanChange } from "@/lib/api/owner-back-office";
import type { Plan } from "@/lib/entitlements";
import { PLAN_TIERS, planRank } from "@/lib/plans";
import { createClient } from "@/lib/supabase/client";
import type { PlanChangeRequest } from "@/lib/types/back-office";

/**
 * The three tiers, and the way out of the one you are on — a port of
 * `tho/app/lib/business/plans/plans_screen.dart`, **with the upgrade request put back**.
 *
 * ## Why the request exists here and not in the app
 *
 * `bddb23f` deleted `Api.requestUpgrade`, the paywall's CTA and the operator's WhatsApp link from
 * the Flutter app, citing App Store Review Guideline 3.1.1 — no button or other call to action
 * steering a customer toward a purchase made outside in-app purchase — and Google Play's payments
 * policy says much the same. What is left there is a price list with a current-plan badge.
 *
 * A website is distributed through neither store and bound by neither rule.
 * `plan_change_requests` and its owner-insert policy stayed in the database with **no writer in
 * either client**, so this is a gap only a browser can fill. Nothing about the *gate* changes: an
 * operator still flips `businesses.plan`, and `entitlements.ts` is still the only thing that
 * decides what is unlocked.
 *
 * ## Three things the request has to get right
 *
 * **1. There is no cancel, because there cannot be.** `plan_change_requests` has an INSERT policy
 * and a SELECT policy and nothing else, so the table-wide UPDATE and DELETE grants are dead — and
 * not with an error: an owner's `update … set status='cancelled'` **succeeds having affected 0
 * rows**, because with no policy for the command the rows aren't visible to it. A "withdraw"
 * button would therefore report success and change nothing, which is worse than no button. So the
 * copy says an operator will be in touch and that there is nothing to cancel.
 *
 * **2. A second press must not file a second row.** Because nothing can be tidied up, duplicates
 * accumulate for good — and already have: this salon carries **two** pending `pro` requests and a
 * pending `growth` request, all written by the old app flow before it was removed.
 * `requestPlanChange` reads first and returns the existing pending row instead of inserting.
 *
 * **3. A pending request for the plan you already have is stale, not progress.** Norzin is on
 * `growth` and holds a pending `growth` request. Rendering that as "Requested — we'll be in touch"
 * would tell an owner their upgrade is coming when it already came, so it is called out as
 * already applied.
 */
export function PlanCards({
  businessId,
  userId,
  currentPlan,
  requests,
}: {
  businessId: string;
  userId: string;
  currentPlan: Plan;
  /** Every request for this salon, newest first — including `done` and `cancelled` ones. */
  requests: PlanChangeRequest[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Plan | null>(null);
  const current = planRank(currentPlan);

  const pendingFor = (plan: Plan) =>
    requests.find((r) => r.requestedPlan === plan && r.status === "pending") ?? null;

  async function request(plan: "growth" | "pro") {
    setBusy(plan);
    try {
      const { created } = await requestPlanChange(createClient(), {
        businessId,
        requestedBy: userId,
        requestedPlan: plan,
      });
      toast.success(
        created
          ? "Request sent. We'll be in touch to arrange payment."
          : "You already have a request in for that — we'll be in touch.",
      );
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("requestPlanChange", caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className="gap-md flex flex-col">
      {PLAN_TIERS.map((tier) => {
        const rank = planRank(tier.plan);
        const isCurrent = rank === current;
        const isUpgrade = rank > current;
        const pending = pendingFor(tier.plan);
        // A pending request for a tier at or below the current one has already been honoured —
        // an operator moved the plan and nobody closed the row. Live on this salon right now.
        const stale = pending != null && rank <= current;

        return (
          <li
            key={tier.plan}
            className={`bg-canvas p-base rounded-lg border ${
              tier.highlighted ? "border-rausch border-2" : "border-hairline"
            }`}
          >
            {tier.highlighted ? (
              <p className="bg-rausch text-on-primary text-badge mb-sm inline-block rounded-full px-2 py-0.5 font-semibold">
                MOST POPULAR
              </p>
            ) : null}

            <div className="gap-sm flex items-baseline">
              <h2 className="text-display-sm text-ink flex-1 font-semibold">{tier.name}</h2>
              <p className="text-title text-ink font-medium tabular-nums">{tier.priceLabel}</p>
            </div>
            <p className="text-body-sm text-muted">{tier.tagline}</p>

            <ul className="border-hairline-soft mt-md pt-md gap-sm flex flex-col border-t">
              {tier.features.map((f) => (
                <li key={f.label} className="gap-sm flex items-start">
                  {f.soon ? (
                    <Icons.clock
                      className="text-muted mt-[2px] shrink-0"
                      style={{ width: IconSize.xxs, height: IconSize.xxs }}
                      aria-hidden
                    />
                  ) : (
                    <Icons.check
                      className="text-rausch mt-[2px] shrink-0"
                      style={{ width: IconSize.xxs, height: IconSize.xxs }}
                      aria-hidden
                    />
                  )}
                  <span className="text-body-sm text-body flex-1">{f.label}</span>
                  {f.soon ? (
                    <span className="bg-surface-strong text-badge text-muted shrink-0 rounded-full px-2 py-0.5 font-semibold">
                      soon
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="mt-base">
              {isCurrent ? (
                <>
                  <p className="bg-surface-soft text-title text-muted py-md rounded-sm text-center font-medium">
                    Current plan
                  </p>
                  {/*
                    The stale case, and it is live: this salon is on `growth` and holds a pending
                    `growth` request from before the app's request flow was removed. Saying nothing
                    would be fine; saying "Requested" would tell an owner an upgrade is coming when
                    it already came.
                  */}
                  {stale ? (
                    <p className="text-caption-sm text-muted mt-sm">
                      You asked for this on {dayLabel(pending.createdAt)}{" "}
                      and it has since been applied — the request just wasn&apos;t closed off
                      afterwards.
                    </p>
                  ) : null}
                </>
              ) : isUpgrade ? (
                pending ? (
                  <p className="bg-surface-soft text-body-sm text-body py-md px-base rounded-sm">
                    <strong className="text-ink">Requested {dayLabel(pending.createdAt)}.</strong>{" "}
                    We&apos;ll be in touch to arrange payment. There is nothing more to do — and
                    nothing to cancel, so leave it with us.
                  </p>
                ) : (
                  <Button
                    fullWidth
                    busy={busy === tier.plan}
                    onClick={() => void request(tier.plan as "growth" | "pro")}
                  >
                    Request {tier.name}
                  </Button>
                )
              ) : stale ? (
                <p className="text-caption-sm text-muted">
                  You asked for this on {dayLabel(pending.createdAt)}{" "}
                  and it has since been applied — the request just wasn&apos;t closed off.
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function dayLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Thimphu",
  }).format(d);
}
