import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardData, Granularity, HeatCell } from "../types/analytics";
import { toDashboardData, toHeatCell } from "./mappers";

/**
 * The two analytics RPCs, ported from the analytics section of
 * `tho/app/lib/data/api.dart`.
 *
 * ## The plan gate here is cosmetic, and that is worth saying out loud
 *
 * `analytics_dashboard` authorises with `private.is_business_owner(p_business_id)` and
 * validates `p_granularity` against its own four-value list — **and never looks at
 * `businesses.plan`.** Neither does `analytics_peak_heatmap`. Full analytics is a Growth
 * entitlement (`Feature.fullAnalytics`), so a Basic owner who calls either RPC directly
 * receives the complete payload: revenue series, retention split, top services, staff
 * leaderboard, ops rates, goal, heatmap.
 *
 * So every gate on these numbers lives in the client, in both clients, and
 * `hasFeature(plan, "fullAnalytics")` in `/business/insights` decides only what is *drawn*.
 * That is a monetisation gap rather than a data leak — it is the owner's own salon either
 * way — which is why 3c reports it upstream instead of changing the RPC. Do not describe the
 * Insights paywall as enforced anywhere in the UI or in a comment; it isn't.
 *
 * The second consequence is smaller and immediate: because the payload is not tiered, a
 * Basic salon's Insights page must **not fetch** the dashboard at all. Requesting data the
 * page has already decided not to render would be a round trip for nothing, and would put a
 * successful full-analytics response in the network log of a salon that hasn't paid for it.
 */

/**
 * The whole dashboard in one round trip.
 *
 * `p_anchor` is left to the RPC's own default (today in the salon's timezone). Passing a date
 * would mean deciding *whose* today — the browser's or the salon's — and the server already
 * resolves `businesses.timezone` for exactly this reason.
 */
export async function fetchDashboard(
  supabase: SupabaseClient,
  businessId: string,
  granularity: Granularity,
): Promise<DashboardData> {
  const { data, error } = await supabase.rpc("analytics_dashboard", {
    p_business_id: businessId,
    p_granularity: granularity,
  });
  if (error) throw error;
  return toDashboardData((data ?? {}) as Record<string, unknown>);
}

/**
 * The peak-hours grid over a rolling window, **independent of the period selector**.
 *
 * 90 days is the app's own figure. It is a separate RPC and a separate read because the
 * question is different: the period pills ask "how did this month go", the heatmap asks
 * "when is the shop busy", and the second answer would be noise at a one-week window.
 *
 * `analytics_peak_heatmap` has **no caller in the Flutter app** — `insights_tab.dart`
 * comments out both the field and the card (THO-55) — so this is the first live use of it.
 */
export async function fetchPeakHeatmap(
  supabase: SupabaseClient,
  businessId: string,
  days = 90,
): Promise<HeatCell[]> {
  const { data, error } = await supabase.rpc("analytics_peak_heatmap", {
    p_business_id: businessId,
    p_days: days,
  });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toHeatCell);
}
