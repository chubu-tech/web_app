import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LoyaltyProgram,
  LoyaltyRedemption,
  LoyaltyReward,
  LoyaltyTransaction,
  Order,
  OrderFulfilment,
  ProductReview,
} from "../types/back-office";
import type { PromoRefusal } from "../order-totals";
import type { Product, ProductCategory } from "../types/salon";
import {
  escapeOrFilterValue,
  PRODUCT_PAGE_SIZE,
  productSortColumns,
  type ProductSort,
} from "../product-filter";
import {
  toLoyaltyProgram,
  toLoyaltyRedemption,
  toLoyaltyReward,
  toLoyaltyTransaction,
  toOrder,
  toProduct,
  toProductCategory,
  toProductReview,
} from "./mappers";
import { oneRow } from "./one-row";

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
 * One page of the cross-salon storefront, through `product_cards` — a port of
 * `Api.browseProducts`.
 *
 * **This replaces `fetchProducts`, which was the last unbounded catalogue read on either
 * platform.** It selected every buyable product with no `.range()` at all, and its own note
 * said the trade "holds at four products and will not hold at four hundred". It does now
 * hold at four hundred, and every facet is applied by the **server across the whole
 * catalogue before paging** — which is the point: a filter over page one is not a filter,
 * and a sort over page one is a sort of the wrong twenty-four rows.
 *
 * The view already restricts to `in_stock` and `not is_archived`, so neither is repeated
 * here. It is `security_invoker` over `products_select_public`, so a guest sees exactly what
 * a registered customer sees and no plan check applies — which is why browse stays a **view
 * read and never a read RPC**: an RPC would need a grant to `anon`, and guest browsing is
 * the thing the whole storefront rests on.
 *
 * `range` is inclusive at both ends, and one extra row is asked for so the caller can tell
 * "this is the last page" from "there is more" without a second `count` query.
 */
export async function browseProducts(
  supabase: SupabaseClient,
  {
    search,
    categoryId,
    brandIds = [],
    minNu,
    maxNu,
    minRating,
    onSale = false,
    sort = "featured",
    offset = 0,
    limit = PRODUCT_PAGE_SIZE,
  }: {
    search?: string | null;
    categoryId?: string | null;
    brandIds?: string[];
    minNu?: number | null;
    maxNu?: number | null;
    minRating?: number | null;
    onSale?: boolean;
    sort?: ProductSort;
    offset?: number;
    limit?: number;
  } = {},
): Promise<{ products: Product[]; hasMore: boolean }> {
  let q = supabase.from("product_cards").select(PRODUCT_CARD_SELECT);
  if (categoryId) q = q.eq("category_id", categoryId);
  if (brandIds.length > 0) q = q.in("brand_id", brandIds);
  if (minNu != null) q = q.gte("price_nu", minNu);
  if (maxNu != null) q = q.lte("price_nu", maxNu);
  if (minRating != null) q = q.gte("rating_avg", minRating);
  if (onSale) q = q.gt("discount_pct", 0);

  const term = (search ?? "").trim();
  if (term !== "") {
    const v = escapeOrFilterValue(`%${term}%`);
    q = q.or(`name.ilike.${v},brand_name.ilike.${v}`);
  }

  // `nullsFirst: false` on every column — see `productSortColumns` for the one it changes
  // and why it is applied uniformly anyway.
  let ordered = q;
  for (const { column, ascending } of productSortColumns(sort)) {
    ordered = ordered.order(column, { ascending, nullsFirst: false });
  }

  // One past the page, then dropped. A `count: "exact"` would answer the same question and
  // cost a second scan of the filtered set on every page.
  const { data, error } = await ordered.range(offset, offset + limit);
  if (error) throw error;
  const rows = (data ?? []) as Record<string, unknown>[];
  return { products: rows.slice(0, limit).map(toProduct), hasMore: rows.length > limit };
}

/**
 * The cheapest and dearest price in a browse scope, for the filter sheet's range control.
 *
 * **Bounds cannot come from the loaded page**, which is the whole reason this exists: page
 * one is not the catalogue, so a slider built from it would be wrong and would silently
 * widen as the customer scrolled. Two indexed one-row reads instead.
 *
 * Carries the scope's category and brand filters but **not** its price filter — the bounds
 * are what the slider can travel between, not where it currently sits. Returns zeroes for a
 * scope with no products, which is the same shape `priceBounds` returns for an empty list
 * and which the sheet already handles by saying so rather than drawing a dead slider.
 */
export async function productPriceBounds(
  supabase: SupabaseClient,
  { categoryId, brandIds = [] }: { categoryId?: string | null; brandIds?: string[] } = {},
): Promise<{ lowest: number; highest: number }> {
  const scoped = () => {
    let q = supabase.from("product_cards").select("price_nu");
    if (categoryId) q = q.eq("category_id", categoryId);
    if (brandIds.length > 0) q = q.in("brand_id", brandIds);
    return q;
  };

  const [low, high] = await Promise.all([
    scoped().order("price_nu", { ascending: true }).limit(1).maybeSingle(),
    scoped().order("price_nu", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (low.error) throw low.error;
  if (high.error) throw high.error;

  const lowest = (low.data as { price_nu: number } | null)?.price_nu;
  const highest = (high.data as { price_nu: number } | null)?.price_nu;
  return { lowest: lowest ?? 0, highest: highest ?? 0 };
}

/**
 * The id behind a `?cat=` slug, or null.
 *
 * The strip's axis is a **slug** because a shared `?cat=hair-care` says what it is where a uuid
 * says nothing, but `product_cards` carries only `category_id` — so paging the browse on the
 * server means resolving one for the other. One indexed row read, and only when a slug is
 * actually present.
 *
 * **An unknown slug resolves to null, which narrows nothing.** That is the same answer
 * `ProductsBrowse` already gives a stale `?cat=` and the same rule `productFilterFromParams`
 * applies to a stale price bound: a hand-edited or since-deleted slug shows the whole catalogue
 * with no shelf selected, rather than an empty shelf that does not exist.
 */
export async function fetchProductCategoryIdBySlug(
  supabase: SupabaseClient,
  slug: string | null,
): Promise<string | null> {
  if (!slug) return null;
  const { data, error } = await supabase
    .from("product_categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Which categories actually have something buyable on them.
 *
 * **The category strip only offers shelves that are stocked**, and that rule used to be free:
 * the browse held the whole catalogue, so the set could be derived from it. Paging took that
 * away — upstream renders all eight tiles for exactly this reason, and cannot do otherwise.
 *
 * One `distinct`-shaped read buys the rule back, and buys it at any catalogue size. It
 * matters concretely: **every live product has a null `category_id`**, so without it the
 * strip would be eight doors onto eight empty rooms — a narrowing control whose every option
 * narrows to nothing, which the customer can only discover by trying one.
 */
export async function fetchStockedCategoryIds(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("product_cards")
    .select("category_id")
    .not("category_id", "is", null);
  if (error) throw error;
  return new Set(
    ((data ?? []) as { category_id: string | null }[])
      .map((r) => r.category_id)
      .filter((id): id is string => id != null),
  );
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
 * That figure is **no longer the sum of the lines**. `20260814000005_place_order_checkout.sql`
 * made it `subtotal − discount + delivery fee`, so an order carrying a promo code or a delivery
 * fee has a total that no addition of `products.price_nu` reproduces. `lib/order-totals.ts`
 * mirrors that arithmetic so a checkout can *show* the sum before committing to it — but the
 * mirror is a copy and this return value is the original.
 *
 * **All ten arguments now go.** Six used to be omitted, so every order this app placed was a
 * pickup at list price: no delivery, no promo code, no reward spent. They resolved only because
 * all six carry defaults — the 4-argument overload was **dropped** when the 10-argument one was
 * created, so had one lacked a default, every order on this platform would have failed at once.
 *
 * ## What the server checks that this cannot
 *
 * Each of the new arguments has a refusal behind it, and the client's job is to make each one
 * unreachable in the ordinary case rather than to duplicate the check:
 *
 * - `p_fulfilment` — `P0001` for anything but `pickup`/`delivery`, `P0001` again at a salon with
 *   `delivery_enabled` false, and `P0001` when a delivery arrives without an address *and* a
 *   phone. The checkout draws the toggle only when the salon delivers, and requires both fields.
 * - `p_promo_code` — `P0003`, with the reason in the sentence. `previewPromo` is what lets the
 *   customer find that out while they can still do something about it.
 * - `p_loyalty_redemption` — `P0004` when it is not theirs, not pending, already on another
 *   order, or **not a discount reward**. That last one is the live case: the only pending
 *   redemption on this platform is a `free_service`.
 *
 * Still raises `P0010` for a guest (`private.is_real_user()`), `P0001` when the salon is not on
 * growth/pro, and `P0002` when anything in the payload is no longer buyable.
 */
export async function placeOrder(
  supabase: SupabaseClient,
  {
    businessId,
    items,
    note,
    clientToken,
    fulfilment = "pickup",
    promoCode = null,
    loyaltyRedemptionId = null,
    deliveryAddress = null,
    deliveryPhone = null,
    deliveryNote = null,
  }: {
    businessId: string;
    items: { product_id: string; qty: number }[];
    note?: string | null;
    clientToken: string;
    fulfilment?: OrderFulfilment;
    /** As typed. The server upper-cases and trims before matching, so neither happens here. */
    promoCode?: string | null;
    loyaltyRedemptionId?: string | null;
    /** Required together on a delivery, and ignored by the server on a pickup. */
    deliveryAddress?: string | null;
    deliveryPhone?: string | null;
    deliveryNote?: string | null;
  },
): Promise<Order> {
  const { data, error } = await supabase.rpc("place_order", {
    p_business: businessId,
    p_items: items,
    p_note: note ?? null,
    p_client_token: clientToken,
    p_fulfilment: fulfilment,
    p_promo_code: promoCode,
    p_loyalty_redemption: loyaltyRedemptionId,
    p_delivery_address: deliveryAddress,
    p_delivery_phone: deliveryPhone,
    p_delivery_note: deliveryNote,
  });
  if (error) throw error;
  // `oneRow`, not a local ternary answering an empty object — `place_order` is
  // `returns orders`, so a null reaches `toOrder` as an order with no id rather than as an
  // error naming the RPC that produced it.
  return toOrder(oneRow(data, "place_order"));
}

/**
 * Every review of one product, newest first.
 *
 * `product_reviews_select_public` is `using (true)` for both `anon` and `authenticated` and the
 * table grant is there too (checked), so this works signed out — which it has to, because the
 * ratings are part of what a visitor is deciding on.
 *
 * **`product_cards` already carries `rating_avg` and `rating_count`**, so nothing needs this to
 * put a number on a card. It is for a detail surface that wants to show what people said, and it
 * is capped for that reason rather than paged: a product's reviews are a paragraph of evidence,
 * not a feed.
 */
export async function fetchProductReviews(
  supabase: SupabaseClient,
  productId: string,
  { limit = 20 }: { limit?: number } = {},
): Promise<ProductReview[]> {
  const { data, error } = await supabase
    .from("product_reviews")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toProductReview);
}

/**
 * What the caller has already said about the things in one order.
 *
 * Keyed by product id at the call site, because the uniqueness key is `(order_id, product_id)`:
 * one rating per product per order, so an order containing two shampoos has one rating for the
 * shampoo, and buying it again next month is a second, separate rating.
 *
 * **Filtered on the order, not on the caller**, and that is safe rather than lax: the policy is
 * public, so scoping by caller would buy nothing, and the page that uses this has already
 * established the order is theirs by reading it through `fetchMyOrderById`.
 */
export async function fetchMyProductReviewsForOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<ProductReview[]> {
  const { data, error } = await supabase
    .from("product_reviews")
    .select("*")
    .eq("order_id", orderId);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toProductReview);
}

/**
 * Rate a product that was actually bought.
 *
 * **The only door into `product_reviews`** — the table has no insert policy at all, so this
 * `security definer` function is the whole of how a rating comes to exist. It checks four things
 * the client cannot be trusted with: the order is the caller's (`42501`), it has reached
 * `collected` or `delivered` (`P0001`), the product was in it (`P0001`), and the rating is 1–5
 * (`P0001`). `canReviewOrder` mirrors the second of those so the form is not offered where it
 * would be refused.
 *
 * **It upserts on `(order_id, product_id)`**, so calling it again edits rather than duplicates.
 * That is the behaviour to build on: a customer who rated in haste can fix it, and the client
 * must load the existing rating as a starting value rather than showing empty stars over a
 * review that already exists.
 *
 * An empty body is stored as null, by the RPC's own `nullif(btrim(…), '')` — so a rating with
 * no words is a rating, not a review with an empty paragraph.
 */
export async function submitProductReview(
  supabase: SupabaseClient,
  {
    orderId,
    productId,
    rating,
    body,
  }: { orderId: string; productId: string; rating: number; body?: string | null },
): Promise<ProductReview> {
  const { data, error } = await supabase.rpc("submit_product_review", {
    p_order: orderId,
    p_product: productId,
    p_rating: rating,
    p_body: body ?? null,
  });
  if (error) throw error;
  return toProductReview(oneRow(data, "submit_product_review"));
}

/**
 * Count one view of a product — the trending signal.
 *
 * **Fire and forget, and it must stay that way.** Nothing on screen depends on it, so a failure
 * is swallowed by the caller rather than surfaced: a customer looking at a shampoo does not need
 * to be told that an analytics counter did not increment.
 *
 * **It needs a session** (`28000`), so a signed-out visitor contributes nothing and the call
 * should simply be skipped for one. That is a real hole in the signal rather than a detail —
 * guest browsing is the front door of this product — but it is the server's rule, and calling it
 * anyway would just produce a refused request per product view.
 *
 * **The server does not de-duplicate.** `product_view_daily` is a running counter upserted on
 * `(product_id, day)` in Thimphu time, so every call is another view. Throttling to once per
 * product per session is the *client's* job, and without it a customer flicking back and forth
 * between two products would invent a trend.
 *
 * The counts are owner-only to read (`product_view_daily_select_owner`), which is the right way
 * round: a public per-product view count is competitive intelligence no owner agreed to publish.
 */
export async function recordProductView(
  supabase: SupabaseClient,
  productId: string,
): Promise<void> {
  const { error } = await supabase.rpc("record_product_view", { p_product: productId });
  if (error) throw error;
}

/** What `preview_promo` answers: a discount, or the reason there isn't one. */
export type PromoPreview =
  | { valid: true; discountNu: number }
  | { valid: false; reason: PromoRefusal | string };

/**
 * Try a promo code against a subtotal, without committing to anything.
 *
 * **A read RPC, and one of the few in this repo** — justified because `promo_codes` is not
 * readable by a customer at all: its **only** select policy is `promo_codes_select_owner`
 * (`private.is_business_owner(business_id)`, checked), which is correct — a code list is a
 * marketing asset, and an enumerable one is a discount to whoever scrapes it. `preview_promo` is
 * `security definer` and returns exactly one number and one reason, so a customer can test the
 * code in their hand without being able to list anybody's.
 *
 * **It refuses rather than throws.** A wrong code is the ordinary case at a checkout, not an
 * exception, so an invalid one comes back as `{valid: false, reason}` and only a genuine failure
 * — no session, no network — throws. `promoRefusalMessage` turns the reason into the sentence;
 * the server composes none, and the two must not both try.
 *
 * **The discount it quotes is against the subtotal it was given**, so it has to be re-asked
 * whenever the cart changes. That is also why it cannot be trusted as the final figure: the
 * order's total is `place_order`'s, and a code that lapses between the preview and the press is
 * refused there with `P0003`.
 */
export async function previewPromo(
  supabase: SupabaseClient,
  { businessId, code, subtotalNu }: { businessId: string; code: string; subtotalNu: number },
): Promise<PromoPreview> {
  const { data, error } = await supabase.rpc("preview_promo", {
    p_business: businessId,
    p_code: code,
    p_subtotal_nu: subtotalNu,
  });
  if (error) throw error;
  const row = (data ?? {}) as Record<string, unknown>;
  return row.valid === true
    ? { valid: true, discountNu: Number(row.discount_nu ?? 0) }
    : { valid: false, reason: (row.reason as string) ?? "not_found" };
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
  return toOrder(oneRow(data, "set_order_status"));
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
  return toLoyaltyRedemption(oneRow(data, "request_redemption"));
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
