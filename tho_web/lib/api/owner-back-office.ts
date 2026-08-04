import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation } from "../types/chat";
import type { Offer, Product } from "../types/salon";
import type {
  ClientHistoryEntry,
  ClientSummary,
  LoyaltyBalance,
  LoyaltyEarnMode,
  LoyaltyProgram,
  LoyaltyRedemption,
  LoyaltyReward,
  LoyaltyRewardType,
  Order,
  OrderStatus,
  PayrollRow,
  PlanChangeRequest,
  TaxEstimate,
} from "../types/back-office";
import {
  toClientHistoryEntry,
  toClientSummary,
  toConversation,
  toLoyaltyBalance,
  toLoyaltyProgram,
  toLoyaltyRedemption,
  toLoyaltyReward,
  toOffer,
  toOrder,
  toPayrollRow,
  toPlanChangeRequest,
  toProduct,
  toTaxEstimate,
} from "./mappers";

/**
 * The owner **back office** — clients, product orders, the storefront, offers, loyalty,
 * payroll, tax and the subscription request. Split from `owner.ts` (the salon's day) and
 * `owner-setup.ts` (the salon's configuration) on the same principle: three files that each
 * answer one question beat one file every owner call lands in.
 *
 * Four things run through it.
 *
 * **1. An RPC wherever the rule is not expressible client-side.** `client_book` and
 * `client_history` hold a plan gate; `set_order_status` holds the state machine and enqueues
 * the customer's notification; `adjust_points` refuses an adjustment that would go negative
 * and stamps `created_by`; `confirm_redemption` resolves a code and moves points atomically;
 * `payroll_report` and `tax_estimate` are Pro-gated and do arithmetic that must match what an
 * accountant sees. Only the five owner-configured tables are written directly, and those have
 * no RPC at all.
 *
 * **2. `updated_at` is stamped by hand on every direct write.** None of these tables carries
 * a `set_updated_at` trigger — `products`, `offers`, `loyalty_programs`, `loyalty_rewards`
 * and `client_notes` all leave it to the writer, exactly as `api.dart` does. Forget it and
 * the row silently claims it was last touched when it was created.
 *
 * **3. Upserts need the conflicting row to be *selectable*.** PostgREST resolves an
 * `onConflict` by reading the existing row first, so an upsert against a table whose SELECT
 * policy hides it fails with a confusing insert error — the trap that cost 2e a day on the
 * `media` bucket. Checked for both upserts here: `loyalty_programs_select_member` and
 * `loyalty_rewards_select_member` each admit a member, and `client_notes_rw_owner` is `ALL`,
 * so all three are satisfied.
 *
 * **4. Nothing writes a status column an operator owns.** `plan_change_requests.status` sits
 * in the `authenticated` insert grant and `pcr_insert`'s WITH CHECK does not constrain it, so
 * an owner *could* file a request already marked `done`. `requestPlanChange` leaves it to the
 * column default. See that function for why there is no update path either.
 */

/* --------------------------------------------------------------------------
   Client book. Growth+, gated in SQL.
   -------------------------------------------------------------------------- */

/**
 * The salon's client roster — one row per customer, rolled up across their bookings.
 *
 * **Plan-gated server-side**, unlike the analytics RPCs: `client_book` raises
 * `P0001 'client book not available'` for a salon that is not on growth or pro. So the
 * paywall here is real, and the page must render the locked state *instead of* calling, not
 * after a failure.
 *
 * Authorised with `is_business_member`, so a linked stylist can read the book too — which is
 * the intent (staff are the people who need to know who is a regular), and a wider door than
 * the owner-only tables below.
 *
 * Walk-ins come back with a null `customer_profile_id`, grouped by name and phone. Two
 * different walk-ins called "Karma" with no phone are one row; that is the RPC's decision,
 * and there is nothing this side can do about it.
 */
export async function fetchClientBook(
  supabase: SupabaseClient,
  businessId: string,
): Promise<ClientSummary[]> {
  const { data, error } = await supabase.rpc("client_book", { p_business: businessId });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toClientSummary);
}

/**
 * One customer's whole history at this salon, newest first — every status, including the
 * cancelled and no-show bookings the roll-up excludes from `visits`.
 *
 * Registered customers only: the parameter is a profile id, so a walk-in has nothing to pass.
 */
export async function fetchClientHistory(
  supabase: SupabaseClient,
  businessId: string,
  customerProfileId: string,
): Promise<ClientHistoryEntry[]> {
  const { data, error } = await supabase.rpc("client_history", {
    p_business: businessId,
    p_customer: customerProfileId,
  });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toClientHistoryEntry);
}

/** The salon's private note about a customer. Empty string when there is none. */
export async function fetchClientNote(
  supabase: SupabaseClient,
  businessId: string,
  customerProfileId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("client_notes")
    .select("note")
    .eq("business_id", businessId)
    .eq("customer_profile_id", customerProfileId)
    .maybeSingle();
  if (error) throw error;
  return (data?.note as string | null) ?? "";
}

/**
 * Write the note. Upsert on the composite primary key `(business_id, customer_profile_id)` —
 * there is no `id` column, so the pair *is* the row.
 *
 * `client_notes` already carries **column-level** INSERT/UPDATE grants (the four columns
 * below and nothing else), so this is one of the tables where a stray field would fail the
 * whole statement with `42501`. There are no other fields to be stray, which is why it reads
 * as an ordinary upsert.
 */
export async function setClientNote(
  supabase: SupabaseClient,
  businessId: string,
  customerProfileId: string,
  note: string,
): Promise<void> {
  const { error } = await supabase.from("client_notes").upsert(
    {
      business_id: businessId,
      customer_profile_id: customerProfileId,
      note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,customer_profile_id" },
  );
  if (error) throw error;
}

/* --------------------------------------------------------------------------
   Product orders.
   -------------------------------------------------------------------------- */

/**
 * The salon's orders, newest first, filtered to the statuses one inbox segment covers.
 *
 * `orders` has **no INSERT or UPDATE grant** for `authenticated` at all — only SELECT — so
 * every write goes through `place_order` (2f) or `set_order_status`. That is the shape every
 * table should have had, and the reason nothing in this file patches an order directly.
 */
export async function fetchOwnerOrders(
  supabase: SupabaseClient,
  businessId: string,
  statuses: OrderStatus[],
): Promise<Order[]> {
  let query = supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("business_id", businessId);
  if (statuses.length > 0) query = query.in("status", statuses);
  const { data, error } = await query.order("placed_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toOrder);
}

/** One order for its detail page. RLS scopes it to the caller's own salon or own purchase. */
export async function fetchOrderById(
  supabase: SupabaseClient,
  id: string,
): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toOrder(data as Record<string, unknown>) : null;
}

/** How many orders are waiting, for the Insights card's badge and the hub's one-liner. */
export async function countNewOrders(
  supabase: SupabaseClient,
  businessId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "new");
  if (error) throw error;
  return count ?? 0;
}

/**
 * Move an order along.
 *
 * The RPC owns the state machine (`new → ready → collected`, and `declined` from either of
 * the first two) and enqueues the customer's notification as a side effect, which is the
 * reason it cannot be a plain UPDATE even if the grant existed. `canOwnerTransition` in
 * `lib/analytics.ts` mirrors those rules so the UI offers only the moves that will succeed.
 *
 * **A decline needs a reason** — the RPC raises without one, and the customer's
 * `order_declined` notification carries it.
 */
export async function setOrderStatus(
  supabase: SupabaseClient,
  orderId: string,
  status: OrderStatus,
  reason?: string | null,
): Promise<Order> {
  const { data, error } = await supabase.rpc("set_order_status", {
    p_order: orderId,
    p_status: status,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  // The RPC returns the row itself, without its items — the caller already holds those.
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  return toOrder(row ?? {});
}

/* --------------------------------------------------------------------------
   The storefront.
   -------------------------------------------------------------------------- */

/**
 * Every product the salon still has, sold-out ones included.
 *
 * `is_archived = false` is the owner's view: archiving is this table's delete, because an
 * `order_items` row references a product by id and removing one would erase what a past order
 * *was*. The same reason services are deactivated rather than deleted.
 *
 * The order is `sort_order` then `name`, matching `Api.productsForBusiness` — and `sort_order`
 * has no editor in either client, so in practice it is the seed's ordering plus alphabetical.
 */
export async function fetchOwnerProducts(
  supabase: SupabaseClient,
  businessId: string,
): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toProduct);
}

export type ProductFields = {
  name: string;
  priceNu: number;
  description: string | null;
  photoUrl: string | null;
};

/**
 * Create or edit a product.
 *
 * Two statements rather than an upsert: an upsert with no id is an insert with extra
 * ceremony, and one with an id would need `id` in the payload, which makes it possible to
 * write a row belonging to another salon and rely on RLS to catch it. An explicit
 * `.eq("id")` update says what it means.
 *
 * Every field is sent on edit, nulls included, so a description or a photo can be *cleared* —
 * the same correction `updateService` needed in 3b, where the app's `if (x != null)` spread
 * quietly refuses to un-set a field.
 */
export async function createProduct(
  supabase: SupabaseClient,
  businessId: string,
  fields: ProductFields,
): Promise<void> {
  const { error } = await supabase.from("products").insert({
    business_id: businessId,
    name: fields.name,
    price_nu: fields.priceNu,
    description: fields.description,
    photo_url: fields.photoUrl,
  });
  if (error) throw error;
}

export async function updateProduct(
  supabase: SupabaseClient,
  productId: string,
  fields: ProductFields,
): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({
      name: fields.name,
      price_nu: fields.priceNu,
      description: fields.description,
      photo_url: fields.photoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);
  if (error) throw error;
}

/** Sold out / back in stock. The only product write a customer's view reacts to instantly. */
export async function setProductStock(
  supabase: SupabaseClient,
  productId: string,
  inStock: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({ in_stock: inStock, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) throw error;
}

/** Archive — this table's delete. Reversible, which is what makes the Undo honest. */
export async function setProductArchived(
  supabase: SupabaseClient,
  productId: string,
  archived: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({ is_archived: archived, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) throw error;
}

/* --------------------------------------------------------------------------
   Offers.
   -------------------------------------------------------------------------- */

/**
 * Every offer the salon has, newest first — **including paused, lapsed and not-yet-started.**
 *
 * `offers_member_read` returns all of them where `offers_public_read` filters to the live
 * window, and that difference is the point: an owner editing promotions needs to see the one
 * that stopped running last week, which is usually the reason they opened the page.
 *
 * **Worth knowing about this table's write policy.** `offers_member_write` is `ALL` using
 * `private.is_business_member` — not `is_business_owner`, which every other owner-configured
 * table uses. So a stylist with a linked login can create, edit and hard-delete offers, and
 * `offers_public_read` puts them on the salon page and in the customer home feed. Measured,
 * and reported upstream rather than fixed here; the console only ever calls these as the
 * owner, so nothing below relies on the wider door.
 */
export async function fetchOwnerOffers(
  supabase: SupabaseClient,
  businessId: string,
): Promise<Offer[]> {
  const { data, error } = await supabase
    .from("offers")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toOffer);
}

export type OfferFields = {
  title: string;
  description: string | null;
  discountPct: number | null;
  /** `YYYY-MM-DD` or null. A `date` column, so no time and no timezone. */
  endsOn: string | null;
};

export async function createOffer(
  supabase: SupabaseClient,
  businessId: string,
  fields: OfferFields,
): Promise<void> {
  const { error } = await supabase.from("offers").insert({
    business_id: businessId,
    title: fields.title,
    description: fields.description,
    discount_pct: fields.discountPct,
    ends_on: fields.endsOn,
  });
  if (error) throw error;
}

export async function updateOffer(
  supabase: SupabaseClient,
  offerId: string,
  fields: OfferFields,
): Promise<void> {
  const { error } = await supabase
    .from("offers")
    .update({
      title: fields.title,
      description: fields.description,
      discount_pct: fields.discountPct,
      ends_on: fields.endsOn,
      updated_at: new Date().toISOString(),
    })
    .eq("id", offerId);
  if (error) throw error;
}

/** Pause or resume. Paused keeps the row, which is how a seasonal offer comes back. */
export async function setOfferActive(
  supabase: SupabaseClient,
  offerId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("offers")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", offerId);
  if (error) throw error;
}

/**
 * Delete an offer, for real.
 *
 * The one **hard** delete in the whole owner console. Nothing references an offer — no
 * booking, no order, no history — so there is nothing to orphan, and a promotion that ran
 * last winter is clutter rather than a record. The confirm dialog says it is permanent
 * because it is; pause is the reversible option and sits next to it.
 */
export async function deleteOffer(supabase: SupabaseClient, offerId: string): Promise<void> {
  const { error } = await supabase.from("offers").delete().eq("id", offerId);
  if (error) throw error;
}

/* --------------------------------------------------------------------------
   Loyalty.
   -------------------------------------------------------------------------- */

/**
 * The salon's program, or null when it has never been configured.
 *
 * Null and "switched off" are different states and the form distinguishes them: null means no
 * row, so the first save is an insert with the column defaults visible in the fields;
 * `is_active: false` means a configured program deliberately paused.
 */
export async function fetchLoyaltyProgram(
  supabase: SupabaseClient,
  businessId: string,
): Promise<LoyaltyProgram | null> {
  const { data, error } = await supabase
    .from("loyalty_programs")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) throw error;
  return data ? toLoyaltyProgram(data as Record<string, unknown>) : null;
}

/**
 * Save the program. Upsert on `business_id`, which is the table's whole primary key — one
 * program per salon, enforced by the schema rather than by convention.
 *
 * **Not plan-gated in SQL.** `loyalty_programs_write_owner` checks ownership and stops, and
 * `loyalty_programs_select_public` publishes any active program regardless of plan — so a
 * Basic salon can switch loyalty on today and customers will see it. Loyalty is a Growth
 * entitlement in `entitlements.ts`, so the console gates it, and that gate is the only one
 * there is. Reported upstream.
 */
export async function upsertLoyaltyProgram(
  supabase: SupabaseClient,
  businessId: string,
  fields: {
    isActive: boolean;
    earnMode: LoyaltyEarnMode;
    pointsPerVisit: number;
    nuPerPoint: number;
  },
): Promise<void> {
  const { error } = await supabase.from("loyalty_programs").upsert(
    {
      business_id: businessId,
      is_active: fields.isActive,
      earn_mode: fields.earnMode,
      points_per_visit: fields.pointsPerVisit,
      nu_per_point: fields.nuPerPoint,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" },
  );
  if (error) throw error;
}

/**
 * The reward menu.
 *
 * Archived rows are always excluded — that is this table's delete — and `activeOnly` is the
 * difference between the owner's view (paused rewards visible, because the owner paused them)
 * and the customer's.
 */
export async function fetchLoyaltyRewards(
  supabase: SupabaseClient,
  businessId: string,
  { activeOnly = false }: { activeOnly?: boolean } = {},
): Promise<LoyaltyReward[]> {
  let query = supabase
    .from("loyalty_rewards")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_archived", false);
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("point_cost", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toLoyaltyReward);
}

/**
 * A reward's value, in the one shape `loyalty_rewards_shape` permits.
 *
 * That CHECK is a four-branch disjunction: `percent_discount` needs `percent_off` **and**
 * `amount_nu` null; `fixed_discount` the exact reverse; the two free-* types need both null.
 * Modelling it as a discriminated union means an impossible reward cannot be constructed, so
 * the constraint is a backstop rather than the thing that catches a mistake.
 */
export type RewardValue =
  | { rewardType: "percent_discount"; percentOff: number }
  | { rewardType: "fixed_discount"; amountNu: number }
  | { rewardType: "free_service"; serviceRef: string }
  | { rewardType: "free_product"; productRef: string };

export type RewardFields = {
  name: string;
  description: string | null;
  pointCost: number;
  value: RewardValue;
};

function rewardPayload(fields: RewardFields) {
  const v = fields.value;
  return {
    name: fields.name,
    description: fields.description,
    point_cost: fields.pointCost,
    reward_type: v.rewardType as LoyaltyRewardType,
    // The three that don't apply are written as explicit nulls, not omitted: on an edit that
    // changes the type, leaving the old value in place is exactly what the CHECK refuses.
    percent_off: v.rewardType === "percent_discount" ? v.percentOff : null,
    amount_nu: v.rewardType === "fixed_discount" ? v.amountNu : null,
    service_ref: v.rewardType === "free_service" ? v.serviceRef : null,
    product_ref: v.rewardType === "free_product" ? v.productRef : null,
    updated_at: new Date().toISOString(),
  };
}

export async function createReward(
  supabase: SupabaseClient,
  businessId: string,
  fields: RewardFields,
): Promise<void> {
  const { error } = await supabase
    .from("loyalty_rewards")
    .insert({ business_id: businessId, ...rewardPayload(fields) });
  if (error) throw error;
}

export async function updateReward(
  supabase: SupabaseClient,
  rewardId: string,
  fields: RewardFields,
): Promise<void> {
  const { error } = await supabase
    .from("loyalty_rewards")
    .update(rewardPayload(fields))
    .eq("id", rewardId);
  if (error) throw error;
}

export async function setRewardActive(
  supabase: SupabaseClient,
  rewardId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("loyalty_rewards")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", rewardId);
  if (error) throw error;
}

/**
 * Archive or restore a reward.
 *
 * `isActive` is passed back on restore rather than assumed `true`: a reward that was paused
 * when it was removed should come back paused, or the Undo would quietly publish something
 * the owner had switched off.
 */
export async function setRewardArchived(
  supabase: SupabaseClient,
  rewardId: string,
  archived: boolean,
  isActive?: boolean,
): Promise<void> {
  const patch: Record<string, unknown> = {
    is_archived: archived,
    updated_at: new Date().toISOString(),
  };
  if (!archived && isActive !== undefined) patch.is_active = isActive;
  const { error } = await supabase.from("loyalty_rewards").update(patch).eq("id", rewardId);
  if (error) throw error;
}

/** Pending redemptions — the queue an owner works through at the counter. */
export async function fetchPendingRedemptions(
  supabase: SupabaseClient,
  businessId: string,
): Promise<LoyaltyRedemption[]> {
  const { data, error } = await supabase
    .from("loyalty_redemptions")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "pending")
    .order("requested_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toLoyaltyRedemption);
}

/**
 * Honour a redemption, by id from the list or by the code the customer reads out.
 *
 * The RPC takes either and upper-cases the code itself, so the input needs no normalising —
 * and it takes a row lock (`for update`) before checking the status, so two tills confirming
 * the same code cannot both succeed.
 */
export async function confirmRedemption(
  supabase: SupabaseClient,
  businessId: string,
  { redemptionId, code }: { redemptionId?: string | null; code?: string | null },
): Promise<void> {
  const { error } = await supabase.rpc("confirm_redemption", {
    p_business: businessId,
    p_redemption: redemptionId ?? null,
    p_code: code ?? null,
  });
  if (error) throw error;
}

/** Decline one. Either side may — the RPC admits the customer or the owner. */
export async function cancelRedemption(
  supabase: SupabaseClient,
  redemptionId: string,
): Promise<void> {
  const { error } = await supabase.rpc("cancel_redemption", { p_redemption: redemptionId });
  if (error) throw error;
}

/** A customer's points at this salon: earned, held by pending redemptions, and spendable. */
export async function fetchLoyaltyBalance(
  supabase: SupabaseClient,
  businessId: string,
  customerProfileId: string,
): Promise<LoyaltyBalance> {
  const { data, error } = await supabase.rpc("loyalty_balance", {
    p_business: businessId,
    p_customer: customerProfileId,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  return toLoyaltyBalance(row ?? {});
}

/**
 * Hand-adjust a customer's points — a goodwill gesture, or a correction.
 *
 * Owner only, and the RPC insists on a non-empty reason because the row it writes is the only
 * record of why the number moved. It also refuses an adjustment that would take the **balance**
 * (not the spendable figure) below zero, so a deduction larger than what they hold fails with
 * a sentence rather than leaving a negative account.
 */
export async function adjustPoints(
  supabase: SupabaseClient,
  businessId: string,
  customerProfileId: string,
  points: number,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("adjust_points", {
    p_business: businessId,
    p_customer: customerProfileId,
    p_points: points,
    p_reason: reason,
  });
  if (error) throw error;
}

/* --------------------------------------------------------------------------
   Payroll and tax. Both Pro, enforced in SQL.
   -------------------------------------------------------------------------- */

/**
 * Per-staff pay for a date range.
 *
 * `payroll_report` raises `P0001 'payroll requires Pro'` on any other plan — a real gate, not
 * a client-side one — and no salon on the platform is Pro, so the locked card is the only
 * state this has live. The commission arithmetic is
 * `round(completed revenue × commission_pct / 100, 2) + base_salary_nu`, and both inputs come
 * from `staff_members`, whose pay columns are out of the owner's UPDATE grant since
 * `20260805000001` and only reachable through `set_staff_pay`.
 *
 * The range is half-open — `>= from`, `< to` — so a month is the 1st to the 1st.
 */
export async function fetchPayroll(
  supabase: SupabaseClient,
  businessId: string,
  from: Date,
  to: Date,
): Promise<PayrollRow[]> {
  const { data, error } = await supabase.rpc("payroll_report", {
    p_business: businessId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toPayrollRow);
}

/**
 * A year's estimated tax position. Pro, enforced in SQL
 * (`P0001 'tax report requires Pro'`).
 *
 * Turnover counts completed bookings **and collected orders**, both bucketed by
 * `Asia/Thimphu` — so the storefront is in the figure, and an order collected at 01:00 local
 * on 1 January belongs to the new year rather than the old one.
 */
export async function fetchTaxEstimate(
  supabase: SupabaseClient,
  businessId: string,
  year: number,
): Promise<TaxEstimate> {
  const { data, error } = await supabase.rpc("tax_estimate", {
    p_business: businessId,
    p_year: year,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
  return toTaxEstimate(row ?? {});
}

/* --------------------------------------------------------------------------
   Plan change requests.
   -------------------------------------------------------------------------- */

/** This salon's requests, newest first. `pcr_select` scopes them to the salon's owner. */
export async function fetchPlanRequests(
  supabase: SupabaseClient,
  businessId: string,
): Promise<PlanChangeRequest[]> {
  const { data, error } = await supabase
    .from("plan_change_requests")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toPlanChangeRequest);
}

/**
 * Ask an operator to move this salon to a higher tier.
 *
 * **The only writer of this table in either client.** `bddb23f` deleted
 * `Api.requestUpgrade`, the paywall's CTA and the operator link from the Flutter app, citing
 * App Store Review Guideline 3.1.1 — no in-app call to action toward a purchase made outside
 * in-app purchase. The table and its insert policy stayed. A website is bound by neither
 * store's rules, so this is the gap a browser fills; see `lib/plans.ts` for the full note.
 *
 * **It reads before it writes, and that is not an optimisation.** There is no UPDATE policy
 * and no DELETE policy on `plan_change_requests`, so the table-wide grants are dead and *a
 * request can never be withdrawn or tidied up by anyone but an operator*. A blind insert on
 * every press would therefore accumulate rows forever — which has already happened: Norzin
 * carries two pending `pro` requests and a pending `growth` request for the plan it is
 * already on, all written by the old app flow. So an existing pending row for the same plan
 * is returned as-is, and nothing new is filed.
 *
 * Measured, and worse than it reads: an owner's `update … set status='cancelled'` does not
 * raise `42501` — it **succeeds having affected 0 rows**, because with RLS on and no policy for
 * the command the rows are simply not visible to it. So a "withdraw" button would report success
 * and change nothing at all, which is the strongest possible reason not to offer one.
 *
 * `status` is deliberately absent from the payload. It sits in the `authenticated` insert
 * grant and `pcr_insert`'s WITH CHECK does not constrain it, so an owner *could* file a
 * request already marked `done` — which would hide it from the operator's queue. The column
 * default is `pending` and that is what this writes.
 */
export async function requestPlanChange(
  supabase: SupabaseClient,
  {
    businessId,
    requestedBy,
    requestedPlan,
    note,
  }: {
    businessId: string;
    requestedBy: string;
    requestedPlan: "growth" | "pro";
    note?: string | null;
  },
): Promise<{ request: PlanChangeRequest; created: boolean }> {
  const { data: existing, error: findError } = await supabase
    .from("plan_change_requests")
    .select("*")
    .eq("business_id", businessId)
    .eq("requested_plan", requestedPlan)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) {
    return { request: toPlanChangeRequest(existing as Record<string, unknown>), created: false };
  }

  const { data, error } = await supabase
    .from("plan_change_requests")
    .insert({
      business_id: businessId,
      // `pcr_insert` requires this to equal `auth.uid()`, so it is the caller's own id and
      // never a parameter a form could tamper with.
      requested_by: requestedBy,
      requested_plan: requestedPlan,
      note: note ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return { request: toPlanChangeRequest(data as Record<string, unknown>), created: true };
}

/* --------------------------------------------------------------------------
   The owner's message threads.
   -------------------------------------------------------------------------- */

/**
 * The salon's conversations, most recent activity first.
 *
 * **Filtered on `business_id`, and that is the mirror of a correction 2d had to make.**
 * `conversations_select` OR-matches *customer or business member*, so leaning on RLS alone —
 * as `Api.myConversations()` does — hands a user who is both an owner and a customer one
 * merged list. `fetchMyConversations` filters on `customer_profile_id` to keep the salon's
 * threads out of a personal inbox; this filters on `business_id` to keep personal threads out
 * of the salon's. Same bug, opposite end.
 *
 * A salon whose owner also owns other salons matters here: the filter is the **active**
 * salon's id, not a list, so the console never shows nine salons' threads in one pile.
 *
 * `nullsFirst: false` keeps a thread nobody has written in at the bottom. Three of the five
 * live threads have a null `last_message_at`.
 */
export async function fetchOwnerConversations(
  supabase: SupabaseClient,
  businessId: string,
): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*, businesses(name, cover_url)")
    .eq("business_id", businessId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toConversation);
}
