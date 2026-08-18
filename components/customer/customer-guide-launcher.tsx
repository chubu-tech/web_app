"use client";

import { GuideLauncher } from "@/components/guide/guide-launcher";
import { useCartBarVisible } from "@/components/customer/cart-bar";

/**
 * The guide button in the customer shell, where a cart bar can be under it.
 *
 * `GuideLauncher` takes `cartVisible` as a plain boolean so the console and the marketing
 * site — neither of which mounts `CartBar` — do not subscribe to the cart to be told `false`.
 * This is the one shell where the answer can change, so this is the one place that asks, and
 * it asks `CartBar`'s own predicate rather than re-deriving the rule.
 */
export function CustomerGuideLauncher() {
  const cartVisible = useCartBarVisible();
  return <GuideLauncher audience="customer" cartVisible={cartVisible} />;
}
