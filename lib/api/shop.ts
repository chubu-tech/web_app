import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LoyaltyProgram,
  LoyaltyRedemption,
  LoyaltyReward,
  Order,
} from "../types/back-office";
import type { Product } from "../types/salon";
import {
  toLoyaltyProgram,
  toLoyaltyRedemption,
  toLoyaltyReward,
  toOrder,
  toProduct,
} from "./mappers";

/**
 * The customer's side of the shop and the loyalty programme — the other end of what 3c gave the
 * owner. `place_order` and `request_redemption` were the last two customer-facing RPCs in the
 * schema with no caller in this app.
 *
 * Three things run through it.
 *
 * **1. RLS does the plan filtering, so nothing here checks a plan.**
 * `products_select_public` is `in_stock AND NOT is_archived AND EXISTS (… b.plan IN
 * ('growth','pro'))`, so a Basic salon's products are simply not returned to a customer. A
 * `.eq("plan", …)` here would be a second, weaker copy of a rule the database already enforces —
 * and `products` has no `plan` column to filter on anyway.
 *
 * **2. Reads are filtered on the caller even where RLS would allow more.** `orders_select_customer`
 * OR-matches `orders_select_owner`, so leaning on RLS alone — as `Api.myOrders()` does — hands an
 * owner their *salon's* orders inside "My Orders". This is the third instance of that shape:
 * `fetchMyConversations` needed the same correction for `conversations`, and `fetchMyActiveEntries`
 * for `queue_entries`. Measured on the seeded data: the owner would see all three of Norzin's.
 *
 * **3. An idempotency token belongs to the caller and is reused across retries.** Both write RPCs
 * take one and return the existing row when it matches. `place_order`'s callers hold theirs for the
 * life of a cart; `request_redemption`'s hold theirs for the life of an attempt. Minting a fresh
 * one per press is what defeats the guard — see `requestRedemption` below, where the Flutter app
 * does exactly that.
 */

/** Everything the browse and the Shop tab need: the salon's name for a cross-salon card. */
const PRODUCT_SELECT = "*, businesses(name)";

/**
 * Every buyable product across every salon, newest first.
 *
 * **No search parameter, and no pagination.** The whole catalogue is loaded once and the name match
 * happens in the browser, alongside the price range and the sort — because Discover already filters
 * *salons* that way, and one search box serving two segments has to behave the same in both. It also
 * costs no round trip per keystroke.
 *
 * **This is now the last unbounded catalogue read on any platform, and the comparison it used to
 * draw is gone.** It said "unlike `Api.products`", which sent the term as a server-side `ilike`;
 * `ec8b8ce` **deleted** `Api.products` in favour of `browseProducts`, a paginated, sorted,
 * searched read over the `product_cards` view with `.range()`. Do not go looking for the method
 * this used to compare itself to.
 *
 * The trade still holds while the catalogue is small — 4 products live — but it is no longer a
 * considered divergence, just the older design. When the shop is ported (`PARITY.md` §5.1) this is
 * the first read to replace, and `lib/product-filter.ts`'s pipeline note changes with it.
 */
export async function fetchProducts(supabase: SupabaseClient): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("in_stock", true)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toProduct);
}

// One salon's buyable products is `fetchProductsForBusiness` in `lib/api/salon.ts`, which the salon
// page has used since 2c — the Shop tab and `/cart`'s re-price both call that rather than a second
// copy of the same query here.

/* --------------------------------------------------------------------------
   Orders.
   -------------------------------------------------------------------------- */

const ORDER_SELECT = "*, order_items(*), businesses(name)";

/**
 * Place the cart.
 *
 * **`clientToken` must be the same string across every retry of one order.** `place_order` looks up
 * `(business_id, customer_profile_id, client_token)` first and returns the existing row when it
 * finds one, so a request that committed server-side but timed out on the way back is safe to
 * repeat. A fresh token on the second press would miss that lookup and place a second order — which
 * is why the caller owns it and only `clearCart()` mints the next one.
 *
 * **The returned `total_nu` is authoritative.** The RPC computes it server-side; the cart's subtotal
 * never reaches it. So the confirmation shows the order's own figure, not the cart's.
 *
 * That figure is **no longer the sum of the lines**, and this doc comment used to say it was.
 * `20260814000005_place_order_checkout.sql` made it `subtotal − discount + delivery fee`, so an
 * order carrying a promo code or a delivery fee has a total that no addition of `products.price_nu`
 * reproduces. Nothing here breaks — this call places a pickup order at list price and gets a total
 * equal to the subtotal — but the arithmetic is the server's, not ours, and `OrderLines` is what
 * shows the breakdown when there is one.
 *
 * **Six of the RPC's ten arguments are not sent**, and that is the shape of the gap rather than a
 * bug: `p_fulfilment` (so every order this app places is `pickup`), `p_promo_code`,
 * `p_loyalty_redemption` and the three `p_delivery_*`. The 4-argument version was **dropped** when
 * the 10-argument one was created, so this call resolves only because all six have defaults — had
 * one not, every order on this platform would have failed at once. See `PARITY.md` §5.1.
 *
 * Raises `P0010` for a guest (`private.is_real_user()`), `P0001` when the salon is not on
 * growth/pro, and `P0002` when anything in the payload is no longer buyable.
 */
export async function placeOrder(
  supabase: SupabaseClient,
  {
    businessId,
    items,
    note,
    clientToken,
  }: {
    businessId: string;
    items: { product_id: string; qty: number }[];
    note?: string | null;
    clientToken: string;
  },
): Promise<Order> {
  const { data, error } = await supabase.rpc("place_order", {
    p_business: businessId,
    p_items: items,
    p_note: note ?? null,
    p_client_token: clientToken,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  return toOrder(row ?? {});
}

/**
 * The caller's own orders, newest first.
 *
 * **Filtered on `customer_profile_id`** — see the module note. `Api.myOrders()` omits this filter
 * and so shows an owner their salon's orders as if they had placed them.
 */
export async function fetchMyOrders(
  supabase: SupabaseClient,
  userId: string,
): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("customer_profile_id", userId)
    .order("placed_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toOrder);
}

/** One of the caller's orders. Scoped the same way, so an owner cannot open a customer's. */
export async function fetchMyOrderById(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .eq("customer_profile_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? toOrder(data as Record<string, unknown>) : null;
}

/**
 * Cancel an order.
 *
 * `set_order_status` allows a customer exactly one move — `new → cancelled` — and refuses anything
 * else with *"you can only cancel an order while it is new"*. `canCustomerCancel` in
 * `lib/analytics.ts` mirrors that, so the button only appears where the RPC will agree. Cancelling
 * enqueues `order_cancelled` for the salon's owner.
 */
export async function cancelMyOrder(supabase: SupabaseClient, orderId: string): Promise<Order> {
  const { data, error } = await supabase.rpc("set_order_status", {
    p_order: orderId,
    p_status: "cancelled",
    p_reason: null,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  return toOrder(row ?? {});
}

/* --------------------------------------------------------------------------
   Loyalty, from the customer's side.
   -------------------------------------------------------------------------- */

/**
 * A salon's programme as a **customer** sees it — null when there isn't one, or it is switched off.
 *
 * `loyalty_programs_select_public` admits only `is_active`, so an inactive programme reads as no
 * programme here, and the loyalty card renders nothing. That is the right collapse: a paused
 * programme and no programme look identical from outside, and neither should show a points balance.
 */
export async function fetchPublicLoyaltyProgram(
  supabase: SupabaseClient,
  businessId: string,
): Promise<LoyaltyProgram | null> {
  const { data, error } = await supabase
    .from("loyalty_programs")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data ? toLoyaltyProgram(data as Record<string, unknown>) : null;
}

/**
 * The rewards a customer can actually claim, cheapest first.
 *
 * `loyalty_rewards_select_public` already requires `is_active`, `not is_archived` **and** an active
 * programme on the salon, so the paused rewards an owner sees never appear here.
 */
export async function fetchPublicRewards(
  supabase: SupabaseClient,
  businessId: string,
): Promise<LoyaltyReward[]> {
  const { data, error } = await supabase
    .from("loyalty_rewards")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true })
    .order("point_cost", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toLoyaltyReward);
}

/**
 * Claim a reward, holding the points until the salon confirms.
 *
 * **`clientToken` is the caller's, and this is where the Flutter app gets it wrong.**
 * `request_redemption` looks the token up first and returns the existing redemption when it
 * matches — but `Api.requestRedemption` passes `clientToken ?? _uuid.v4()` and its only caller
 * passes nothing, so every call mints a fresh one. A retry after an ambiguous failure therefore
 * creates a *second* pending redemption, and each holds `point_cost`, so the customer's spendable
 * balance drops twice for one reward. Required here, not optional.
 *
 * Raises `P0010` for a guest, and `P0001` for *"loyalty program not available"*, *"reward not
 * available"* or *"insufficient points"* — each named, so each is passed through rather than
 * flattened.
 */
export async function requestRedemption(
  supabase: SupabaseClient,
  {
    businessId,
    rewardId,
    clientToken,
  }: { businessId: string; rewardId: string; clientToken: string },
): Promise<LoyaltyRedemption> {
  const { data, error } = await supabase.rpc("request_redemption", {
    p_business: businessId,
    p_reward: rewardId,
    p_client_token: clientToken,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  return toLoyaltyRedemption(row ?? {});
}

/** One redemption of the caller's, by id — what `/rewards/[id]` polls. */
export async function fetchMyRedemptionById(
  supabase: SupabaseClient,
  userId: string,
  redemptionId: string,
): Promise<LoyaltyRedemption | null> {
  const { data, error } = await supabase
    .from("loyalty_redemptions")
    .select("*")
    .eq("id", redemptionId)
    .eq("customer_profile_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? toLoyaltyRedemption(data as Record<string, unknown>) : null;
}

/** The caller's redemptions at one salon, newest first — used to spot a live claim on the card. */
export async function fetchMyRedemptions(
  supabase: SupabaseClient,
  userId: string,
  businessId: string,
): Promise<LoyaltyRedemption[]> {
  const { data, error } = await supabase
    .from("loyalty_redemptions")
    .select("*")
    .eq("business_id", businessId)
    .eq("customer_profile_id", userId)
    .order("requested_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toLoyaltyRedemption);
}

export type LoyaltySummaryEntry = {
  businessId: string;
  businessName: string;
  available: number;
  nextRewardName: string | null;
  nextRewardCost: number | null;
};

/**
 * Points across every salon — the `/rewards` list.
 *
 * **The RPC decides what counts as worth listing**, and its filter is worth knowing: a salon appears
 * only when the available balance is **non-zero** or a redemption is pending. So a customer who has
 * spent everything sees an empty state rather than a row of zeroes, and a salon they have never
 * earned at never appears at all. `next_reward_*` is the cheapest reward they cannot yet afford, or
 * null when they can afford everything.
 */
export async function fetchMyLoyaltySummary(
  supabase: SupabaseClient,
): Promise<LoyaltySummaryEntry[]> {
  const { data, error } = await supabase.rpc("my_loyalty_summary");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((m) => ({
    businessId: m.business_id as string,
    businessName: (m.business_name as string | null) ?? "Salon",
    available: Number(m.available ?? 0),
    nextRewardName: (m.next_reward_name as string | null) ?? null,
    nextRewardCost:
      m.next_reward_cost == null ? null : Number(m.next_reward_cost),
  }));
}
