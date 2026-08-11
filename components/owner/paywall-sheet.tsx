"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import type { Feature } from "@/lib/entitlements";
import { FEATURE_COPY, planTierFor } from "@/lib/plans";

/**
 * What a locked feature is, and which tier it belongs to — a port of
 * `tho/app/lib/business/plans/paywall_sheet.dart`.
 *
 * **An explanation, not a checkout.** The app's version carried a "Request upgrade" button
 * that recorded a lead and opened the operator's WhatsApp; `bddb23f` removed all of it,
 * citing App Store Review Guideline 3.1.1 — no in-app call to action toward a purchase made
 * outside the store.
 *
 * A website is bound by neither store's rules, so 3c put the request back — **at
 * `/business/plans`, not here.** The tiers are side by side there, an owner can see what
 * they would get and what it costs, and a request has context; a "Request upgrade" button in
 * a sheet raised by pressing something else is a decision taken in the wrong place. So this
 * sheet says what the feature is, names the tier, and points at the price list.
 *
 * Copy and prices both come from `lib/plans.ts` — the single place pricing lives, which is
 * what stops this sheet and the plans page quoting different numbers at the same owner.
 */
export function PaywallSheet({
  open,
  onClose,
  feature,
}: {
  open: boolean;
  onClose: () => void;
  feature: Feature;
}) {
  const { tier, title, blurb } = FEATURE_COPY[feature];
  const card = planTierFor(tier);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="gap-sm flex flex-col">
          <Link href="/business/plans" onClick={onClose}>
            <Button fullWidth>See plans</Button>
          </Link>
          <Button variant="quiet" fullWidth onClick={onClose}>
            Not now
          </Button>
        </div>
      }
    >
      <div className="gap-base flex flex-col">
        <Icons.unlocked
          className="text-rausch"
          style={{ width: IconSize.lg, height: IconSize.lg }}
          aria-hidden
        />
        <p className="text-body-md text-muted">{blurb}</p>

        <div className="bg-surface-soft p-base gap-sm flex items-center rounded-sm">
          <span className="text-title text-ink flex-1 font-medium">{card.name}</span>
          <span className="text-title text-ink font-medium tabular-nums">{card.priceLabel}</span>
        </div>

        <p className="text-body-sm text-muted">Part of the {card.name} plan.</p>
      </div>
    </Sheet>
  );
}
