"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import {
  createReward,
  updateReward,
  type RewardValue,
} from "@/lib/api/owner-back-office";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { createClient } from "@/lib/supabase/client";
import type { LoyaltyReward, LoyaltyRewardType } from "@/lib/types/back-office";

/**
 * One reward on the menu — a port of
 * `tho/app/lib/business/loyalty/reward_edit_sheet.dart`.
 *
 * ## The shape is a constraint, so it is modelled as a union
 *
 * `loyalty_rewards_shape` is a four-branch CHECK: `percent_discount` needs `percent_off` and
 * `amount_nu` **null**; `fixed_discount` the exact reverse; `free_service` and `free_product`
 * need both null. `RewardValue` in the data layer is a discriminated union over exactly those
 * four, so an impossible reward cannot be built — the constraint becomes a backstop rather than
 * the thing that catches the mistake.
 *
 * That also fixes the failure mode the app has on **edit**: switching a reward from "20% off" to
 * "Nu 100 off" has to clear `percent_off`, and a payload that only sets the new field leaves the
 * old one in place, which is precisely what the CHECK refuses. `rewardPayload` writes all four as
 * explicit nulls every time.
 *
 * Field-level validation mirrors the rest: `point_cost > 0`, `percent_off` 1–100, `amount_nu > 0`.
 * A reward that costs 0 points is not a reward, it is a permanent discount.
 */

const TYPES: { value: LoyaltyRewardType; label: string }[] = [
  { value: "percent_discount", label: "% off" },
  { value: "fixed_discount", label: "Nu off" },
  { value: "free_service", label: "Free service" },
  { value: "free_product", label: "Free goodie" },
];

export function RewardFormSheet({
  businessId,
  reward,
  onClose,
}: {
  businessId: string;
  reward: LoyaltyReward | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(reward?.name ?? "");
  const [description, setDescription] = useState(reward?.description ?? "");
  const [type, setType] = useState<LoyaltyRewardType>(reward?.rewardType ?? "percent_discount");
  const [percent, setPercent] = useState(
    reward?.percentOff == null ? "" : String(reward.percentOff),
  );
  const [amount, setAmount] = useState(reward?.amountNu == null ? "" : String(reward.amountNu));
  const [serviceRef, setServiceRef] = useState(reward?.serviceRef ?? "");
  const [productRef, setProductRef] = useState(reward?.productRef ?? "");
  const [cost, setCost] = useState(reward ? String(reward.pointCost) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Null with a message set — the four branches each validate their own one field. */
  function buildValue(): RewardValue | null {
    switch (type) {
      case "percent_discount": {
        const pct = Number.parseInt(percent.trim(), 10);
        if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
          setError("Enter a percentage between 1 and 100.");
          return null;
        }
        return { rewardType: "percent_discount", percentOff: pct };
      }
      case "fixed_discount": {
        const nu = Number.parseInt(amount.trim(), 10);
        if (!Number.isFinite(nu) || nu <= 0) {
          setError("Enter a Nu amount above zero.");
          return null;
        }
        return { rewardType: "fixed_discount", amountNu: nu };
      }
      case "free_service": {
        const ref = serviceRef.trim();
        if (!ref) {
          setError("Name the free service.");
          return null;
        }
        return { rewardType: "free_service", serviceRef: ref };
      }
      case "free_product": {
        const ref = productRef.trim();
        if (!ref) {
          setError("Name the free goodie.");
          return null;
        }
        return { rewardType: "free_product", productRef: ref };
      }
    }
  }

  async function save() {
    setError(null);
    const trimmed = name.trim();
    const points = Number.parseInt(cost.trim(), 10);
    if (!trimmed) {
      setError("Give the reward a name.");
      return;
    }
    if (!Number.isFinite(points) || points <= 0) {
      setError("A reward has to cost at least one point.");
      return;
    }
    const value = buildValue();
    if (!value) return;

    setSaving(true);
    const fields = {
      name: trimmed,
      description: description.trim() || null,
      pointCost: points,
      value,
    };
    try {
      const supabase = createClient();
      if (reward) {
        await updateReward(supabase, reward.id, fields);
      } else {
        await createReward(supabase, businessId, fields);
      }
      toast.success("Reward saved.");
      onClose();
      router.refresh();
    } catch (caught) {
      setError(ownerErrorMessage("saveReward", caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={reward ? "Edit reward" : "Add reward"}
      footer={
        <Button fullWidth busy={saving} onClick={() => void save()}>
          Save reward
        </Button>
      }
    >
      <div className="gap-base flex flex-col">
        <Field
          label="Reward name"
          value={name}
          onChange={setName}
          placeholder="e.g. 5 visits, free haircut"
        />

        <fieldset>
          <legend className="text-caption text-muted mb-sm font-medium">What they get</legend>
          <div className="gap-sm flex flex-wrap">
            {TYPES.map((t) => (
              <Chip
                key={t.value}
                label={t.label}
                selected={type === t.value}
                onClick={() => setType(t.value)}
              />
            ))}
          </div>
        </fieldset>

        {/* One field per type, and only one: the other three columns are written null. */}
        {type === "percent_discount" ? (
          <Field
            label="Percent off (1–100)"
            value={percent}
            onChange={setPercent}
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
          />
        ) : null}
        {type === "fixed_discount" ? (
          <Field
            label="Nu off"
            value={amount}
            onChange={setAmount}
            type="number"
            inputMode="numeric"
            min={1}
          />
        ) : null}
        {type === "free_service" ? (
          <Field
            label="Free service"
            value={serviceRef}
            onChange={setServiceRef}
            placeholder="e.g. Haircut"
          />
        ) : null}
        {type === "free_product" ? (
          <Field
            label="Free goodie"
            value={productRef}
            onChange={setProductRef}
            placeholder="e.g. Hair serum"
          />
        ) : null}

        <Field
          label="Point cost"
          value={cost}
          onChange={setCost}
          type="number"
          inputMode="numeric"
          min={1}
        />
        <Field
          label="Description (optional)"
          value={description}
          onChange={setDescription}
          placeholder="Any conditions worth saying out loud"
        />

        <p className="text-caption-sm text-muted">
          The name and value are copied onto a redemption when a customer claims it, so editing
          this later never changes what somebody has already been promised.
        </p>

        {error ? <p className="text-body-sm text-error-text">{error}</p> : null}
      </div>
    </Sheet>
  );
}
