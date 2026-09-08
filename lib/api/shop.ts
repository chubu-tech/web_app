import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LoyaltyProgram,
  LoyaltyRedemption,
  LoyaltyReward,
  LoyaltyTransaction,
  Order,
} from "../types/back-office";
import type { Product, ProductCategory } from "../types/salon";
import {
  toLoyaltyProgram,
  toLoyaltyRedemption,
  toLoyaltyReward,
  toLoyaltyTransaction,
  toOrder,
  toProduct,
  toProductCategory,
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

/**
 * The `product_cards` columns every customer-facing product surface reads.
 *
 * **Named, not `*`.** The view holds table-level `SELECT` for `anon` — unlike `businesses`,
 * whose grants are per column — so `*` would in fact work here for a signed-out visitor.
 * Naming them anyway is the rule stated in `AGENTS.md` and it buys something concrete: a
 * column added to the view later cannot start arriving in every card payload unasked.
 *
 * `business_name`, `discount_pct`, `rating_avg`, `rating_count` and `trending_views` are
 * the view's own — computed or joined there — and are the reason this is not a table read.
 * The view already restricts to `in_stock` and `not is_archived`, so neither is repeated by
 * its callers.
 *
 * **One string literal, deliberately, rather than an array joined at runtime.** The client
 * here is untyped, so `.select()` resolves its row type by *parsing the select string at
 * the type level*; hand it anything but a literal and every caller's rows come back as
 * `GenericStringError[]`. Reformatting this into something more readable is a compile
 * error, not a style change.
 */
export const PRODUCT_CARD_SELECT =
  "id,business_id,business_name,name,price_nu,compare_at_nu,discount_pct,description,volume,ingredients,how_to_use,tags,hair_types,concerns,in_stock,is_archived,sort_order,created_at,brand_id,brand_name,category_id,category_name,photo_url,rating_avg,rating_count,trending_views";

/**
 * Every buyable product across every salon, newest first.
 *
 * **Now `product_cards`, not `products`.** The old read was the bare table plus a
 * `businesses(name)` join, which is why every card in this app was missing the rating, the
 * markdown and the brand — not because the data was absent, but because the query never
 * asked the view that computes it. The view also applies `in_stock` and `not is_archived`
 * itself, so the two `.eq()` filters that used to be here are gone rather than duplicated.
 *
 * **Still no search parameter and still no pagination**, and that is now the only thing
 * separating this from the app's `browseProducts`. The whole catalogue is loaded once and
 * the name match happens in the browser, alongside the price range and the sort, because
 * Discover owns one search box serving two segments and it has to behave the same in both.
 *
 * That trade holds at four products and will not hold at four hundred. Replacing it means
 * server-side `search` / `categoryId` / `minNu` / `maxNu` / `onSale` / `sort` / `.range()`
 * and a "Load more", which drags in the sort model and the category filter — so it lands
 * with the rest of the shop rework (`PARITY.md` §5.1) rather than here. **Do not "fix" it
 * in the meantime by adding a bare `.limit()`**: a silently truncated catalogue with no way
 * to reach the rest is a worse failure than a slow one, and it is invisible in review.
 */
export async function fetchProducts(supabase: SupabaseClient): Promise<Product[]> {
  const { data, error } = await supabase
    .from("product_cards")
    .select(PRODUCT_CARD_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toProduct);
}

/**
 * The eight shelves of the product taxonomy, in the order the owner-facing seed set.
 *
 * `product_categories` is read by neither `lib/` nor `components/` today, which is why
 * `20260902000002`'s icon repoint — scissors and a settings cog off `hair-care`, `styling`
 * and `tools` — was invisible on the web. `icon` is a glyph **name**, resolved at runtime
 * by `categoryGlyph`, and an unrecognised one falls back rather than dropping the category:
 * that is what lets the data migration ship before the client that knows the new names.
 *
 * Top level only. `parent_id` exists for a future sub-taxonomy and every live row is null;
 * filtering on it here means a child category added later cannot silently double the strip.
 */
export async function fetchProductCategories(
  supabase: SupabaseClient,
): Promise<ProductCategory[]> {
  const { data, error } = await supabase
    .from("product_categories")
    .select("id,name,slug,icon,sort")
    .is("parent_id", null)
    .order("sort", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toProductCategory);
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

/**
 * The caller's points ledger at one salon, newest first — every earn, spend and adjustment.
 *
 * **The one loyalty table the web has never read.** `loyalty_transactions` is append-only and its
 * migration calls it *"the source of truth + audit trail"*; `loyalty_transactions_select` already
 * admits `customer_profile_id = auth.uid()`, so the customer's own history has been readable all
 * along and nothing ever asked. That is what made a confirmed reward vanish the moment it was
 * confirmed.
 *
 * Scoped to the caller explicitly rather than leaning on RLS alone, for the reason
 * `fetchMyRedemptionById` gives: the policy also admits the salon's staff, which is right for the
 * owner's console and wrong on a page about one customer.
 */
export async function fetchLoyaltyTransactions(
  supabase: SupabaseClient,
  userId: string,
  businessId: string,
): Promise<LoyaltyTransaction[]> {
  const { data, error } = await supabase
    .from("loyalty_transactions")
    .select("id,business_id,kind,points,booking_id,redemption_id,order_id,reason,created_at")
    .eq("business_id", businessId)
    .eq("customer_profile_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toLoyaltyTransaction);
}

/**
 * Every claim of the caller's still waiting at a counter, across all salons, in one read.
 *
 * **A deliberate departure from the app**, which issues one `myRedemptions` per salon in the
 * summary list and documents that N+1 as the price of staying migration-free. No migration is
 * needed for either shape: the same policy that admits one salon's rows admits them all, so the
 * business filter was the only thing making it N reads. One round trip, whatever the customer's
 * history looks like.
 *
 * Pending is the only status worth the read. A pending redemption **holds** its points, so it is
 * the one that explains a balance lower than the customer expects.
 */
export async function fetchMyPendingRedemptions(
  supabase: SupabaseClient,
  userId: string,
): Promise<LoyaltyRedemption[]> {
  const { data, error } = await supabase
    .from("loyalty_redemptions")
    .select("*")
    .eq("customer_profile_id", userId)
    .eq("status", "pending")
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
