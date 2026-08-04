import { planFromString } from "../entitlements";
import type {
  Business,
  BusinessPhoto,
  BusinessType,
  CatalogService,
  Category,
  Hairstyle,
  Offer,
  Product,
  QueueJoinMode,
  Review,
  ServiceItem,
  StaffMember,
} from "../types/salon";
import type {
  Booking,
  BookingItem,
  BookingSource,
  BookingStatus,
  Payment,
  Slot,
  WorkingHour,
} from "../types/booking";
import { queueStatusFromWire, type QueueEntry } from "../types/queue";
import type { Conversation, Message } from "../types/chat";
import type { AppNotification } from "../types/notification";
import type {
  DashboardData,
  HeatCell,
  KpiSet,
  ServiceStat,
  StaffStat,
  TrendPoint,
} from "../types/analytics";
import type {
  ClientHistoryEntry,
  ClientSummary,
  LoyaltyBalance,
  LoyaltyEarnMode,
  LoyaltyProgram,
  LoyaltyRedemption,
  LoyaltyRedemptionStatus,
  LoyaltyReward,
  LoyaltyRewardType,
  Order,
  OrderItem,
  OrderStatus,
  PayrollRow,
  PlanChangeRequest,
  TaxEstimate,
} from "../types/back-office";

/**
 * Row → model mappers, one per table, ported from the `fromMap` factories in
 * `tho/app/lib/data/models.dart`.
 *
 * This is the **only** boundary where snake_case and ISO strings exist. Above it
 * everything is camelCase with real `Date`s, so no component has to wonder which
 * it is holding.
 *
 * Defaults match the Dart originals exactly — several of them are load-bearing
 * (`queue_enabled` defaults *true*, `plan` fails closed to `basic`).
 */

type Row = Record<string, unknown>;

const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;
const numOrNull = (v: unknown): number | null =>
  v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const dateOrNull = (v: unknown): Date | null =>
  typeof v === "string" ? new Date(v) : null;

export function toBusiness(m: Row): Business {
  return {
    id: m.id as string,
    name: m.name as string,
    description: str(m.description),
    addressText: str(m.address_text),
    // No `city`. The column exists, but on 8 of the 13 live salons it contradicts
    // the salon's own `address_text` — "Norzin Lam, Thimphu" filed under Paro,
    // "Zhung Lam, Phuentsholing" under Paro. `addressText` is the field the owner
    // actually maintains and the only one worth showing.
    phone: str(m.phone),
    coverUrl: str(m.cover_url),
    timezone: (str(m.timezone) ?? "Asia/Thimphu") as string,
    cancellationWindowHours: numOrNull(m.cancellation_window_hours) ?? 12,
    isActive: (m.is_active as boolean | null) ?? true,
    lat: numOrNull(m.lat),
    lng: numOrNull(m.lng),
    // Merged in a second pass by `withRating`; absent on the raw row.
    avgRating: numOrNull(m.avg_rating),
    reviewCount: numOrNull(m.review_count) ?? 0,
    plan: planFromString(str(m.plan)),
    businessType: ((str(m.business_type) ?? "salon") as BusinessType),
    serviceRadiusKm: numOrNull(m.service_radius_km),
    whatsappPhone: str(m.whatsapp_phone),
    // Defaults true — an owner opts *out* of the queue, not in.
    queueEnabled: (m.queue_enabled as boolean | null) ?? true,
    queueJoinMode: ((str(m.queue_join_mode) ?? "anywhere") as QueueJoinMode),
    reminderChannel: str(m.reminder_channel) ?? "push",
    // The owner console's settings form is the only reader of these three, added in 3b so a
    // field can show what is stored rather than an empty box over a real value. `null` is a
    // meaningful goal — the dashboard gauge reads it as "no target".
    monthlyRevenueGoal: numOrNull(m.monthly_revenue_goal),
    rebookingEnabled: (m.rebooking_enabled as boolean | null) ?? false,
    rebookingDays: numOrNull(m.rebooking_days) ?? 30,
  };
}

/**
 * Attach an aggregate rating.
 *
 * Separate from `toBusiness` and taking `avg` as an explicit nullable, because
 * an unrated salon must *clear* the field rather than keep a stale value — the
 * Dart original has the same carve-out for exactly this reason.
 */
export function withRating(
  b: Business,
  avg: number | null,
  count: number,
): Business {
  return { ...b, avgRating: avg, reviewCount: count };
}

export function toCategory(m: Row): Category {
  return {
    id: m.id as string,
    name: m.name as string,
    slug: m.slug as string,
    icon: str(m.icon),
  };
}

export function toServiceItem(m: Row): ServiceItem {
  return {
    id: m.id as string,
    name: m.name as string,
    description: str(m.description),
    durationMinutes: numOrNull(m.duration_minutes) ?? 30,
    price: numOrNull(m.price) ?? 0,
    isActive: (m.is_active as boolean | null) ?? true,
    imageUrl: str(m.image_url),
    gender: str(m.gender),
    catalogId: str(m.catalog_id),
    category: str(m.category),
  };
}

export function toStaffMember(m: Row): StaffMember {
  return {
    id: m.id as string,
    displayName: m.display_name as string,
    role: (str(m.role) ?? "barber") as string,
    isActive: (m.is_active as boolean | null) ?? true,
    profileId: str(m.profile_id),
    photoUrl: str(m.photo_url),
    businessId: str(m.business_id),
    // Both NOT NULL DEFAULT 0 in the table, so the fallback only covers a select that
    // named neither column — `fetchStaffById`'s narrow public projection does exactly
    // that, and 0 is the honest answer there rather than a missing field.
    commissionPct: numOrNull(m.commission_pct) ?? 0,
    baseSalaryNu: numOrNull(m.base_salary_nu) ?? 0,
  };
}

export function toCatalogService(m: Row): CatalogService {
  return {
    id: m.id as string,
    slug: m.slug as string,
    name: m.name as string,
    gender: m.gender as string,
    category: m.category as string,
    defaultImageUrl: str(m.default_image_url),
    defaultDurationMinutes: numOrNull(m.default_duration_minutes) ?? 30,
    defaultPrice: numOrNull(m.default_price) ?? 0,
  };
}

export function toWorkingHour(m: Row): WorkingHour {
  return {
    id: m.id as string,
    dayOfWeek: Number(m.day_of_week),
    startTime: m.start_time as string,
    endTime: m.end_time as string,
  };
}

/** `business_hours` uses open_time/close_time; staff hours use start/end. */
export function toBusinessHour(m: Row): WorkingHour {
  return {
    id: m.id as string,
    dayOfWeek: Number(m.day_of_week),
    startTime: m.open_time as string,
    endTime: m.close_time as string,
  };
}

export function toReview(m: Row): Review {
  const raw = Array.isArray(m.review_photos) ? (m.review_photos as Row[]) : [];
  return {
    id: m.id as string,
    rating: Number(m.rating),
    body: str(m.body),
    createdAt: new Date(m.created_at as string),
    // Sorted here rather than trusting the join: PostgREST makes no ordering
    // promise on an embedded resource, and the first photo the customer picked
    // should lead the strip.
    photoUrls: raw
      .slice()
      .sort((a, b) => (numOrNull(a.sort) ?? 0) - (numOrNull(b.sort) ?? 0))
      .map((p) => p.url as string)
      .filter(Boolean),
  };
}

export function toOffer(m: Row): Offer {
  const biz = (m.businesses ?? null) as Row | null;
  return {
    id: m.id as string,
    businessId: m.business_id as string,
    title: m.title as string,
    description: str(m.description),
    discountPct: numOrNull(m.discount_pct),
    startsOn: dateOrNull(m.starts_on),
    endsOn: dateOrNull(m.ends_on),
    isActive: (m.is_active as boolean | null) ?? true,
    businessName: biz ? str(biz.name) : null,
    businessCoverUrl: biz ? str(biz.cover_url) : null,
  };
}

export function toProduct(m: Row): Product {
  const biz = (m.businesses ?? null) as Row | null;
  return {
    id: m.id as string,
    businessId: m.business_id as string,
    name: m.name as string,
    priceNu: numOrNull(m.price_nu) ?? 0,
    description: str(m.description),
    photoUrl: str(m.photo_url),
    inStock: (m.in_stock as boolean | null) ?? true,
    isArchived: (m.is_archived as boolean | null) ?? false,
    sortOrder: numOrNull(m.sort_order) ?? 0,
    businessName: biz ? str(biz.name) : null,
  };
}

export function toBusinessPhoto(m: Row): BusinessPhoto {
  return { id: m.id as string, url: m.url as string };
}

/**
 * A booking with its embeds, ported from `Booking.fromMap`.
 *
 * `businesses` / `staff_members` / `customer` arrive as embedded objects, and
 * `booking_items` / `booking_attachments` as arrays. Every one is optional: the same
 * mapper serves a bare `create_booking` return (no embeds at all) and the fully
 * joined list read.
 */
export function toBooking(m: Row): Booking {
  const biz = (m.businesses ?? null) as Row | null;
  const staff = (m.staff_members ?? null) as Row | null;
  const customer = (m.customer ?? null) as Row | null;
  const rawItems = Array.isArray(m.booking_items) ? (m.booking_items as Row[]) : [];
  const rawAttachments = Array.isArray(m.booking_attachments)
    ? (m.booking_attachments as Row[])
    : [];

  return {
    id: m.id as string,
    status: (m.status as BookingStatus) ?? "pending",
    source: (str(m.source) ?? "app") as BookingSource,
    startTs: new Date(m.start_ts as string),
    endTs: new Date(m.end_ts as string),
    totalPrice: numOrNull(m.total_price) ?? 0,
    businessId: str(m.business_id) ?? undefined,
    staffMemberId: str(m.staff_member_id),
    businessName: biz ? str(biz.name) : null,
    businessAddress: biz ? str(biz.address_text) : null,
    businessCoverUrl: biz ? str(biz.cover_url) : null,
    staffName: staff ? str(staff.display_name) : null,
    customerProfileId: str(m.customer_profile_id),
    // The profile's own name wins over the walk-in snapshot, as the Dart does.
    customerName: (customer ? str(customer.full_name) : null) ?? str(m.customer_name),
    customerPhone: (customer ? str(customer.phone) : null) ?? str(m.customer_phone),
    customerAvatarUrl: customer ? str(customer.avatar_url) : null,
    customerNote: str(m.customer_note),
    items: rawItems.map(toBookingItem),
    // `url` is the column name, but the value is an object *path* in the private
    // bucket. The field is named for what it holds, not for where it is stored.
    attachmentPaths: rawAttachments
      .map((a) => str(a.url))
      .filter((p): p is string => p != null),
  };
}

export function toBookingItem(m: Row): BookingItem {
  return {
    id: (str(m.id) ?? `${m.service_id}-${m.service_name}`) as string,
    serviceId: str(m.service_id),
    name: (str(m.service_name) ?? "Service") as string,
    price: numOrNull(m.price) ?? 0,
    durationMinutes: numOrNull(m.duration_minutes) ?? 0,
  };
}

export function toSlot(m: Row): Slot {
  return {
    start: new Date(m.slot_start as string),
    end: new Date(m.slot_end as string),
  };
}

export function toPayment(m: Row): Payment {
  return {
    id: m.id as string,
    amountNu: numOrNull(m.amount_nu) ?? 0,
    kind: str(m.kind) ?? "payment",
    method: str(m.method) ?? "cash",
    createdAt: new Date(m.created_at as string),
  };
}

/**
 * A queue entry, ported from `QueueEntry.fromMap`.
 *
 * **Three read paths, three different row shapes**, and the differences are
 * load-bearing rather than cosmetic:
 *
 * 1. The `queue_active_line` RPC returns a flat, deliberately PII-free row —
 *    `service_minutes` and `serving_remaining_min` as plain columns, no
 *    `businesses` embed, and **no `business_id` at all**, because the caller named
 *    the shop in `p_business`. Hence `fallbackBusinessId`: without it every row
 *    from the one read the live view actually polls fails to map, and a 200
 *    response surfaces to the customer as "check your connection".
 * 2. A direct `queue_entries` read embeds `services(duration_minutes)` and
 *    `businesses(name)`.
 * 3. `join_queue` / `check_in_booking` return the bare row with no embeds.
 *
 * The embed wins over the flat column when both are present, and `serviceMinutes`
 * defaults to 20 — the same default `queue_active_line` coalesces to server-side,
 * so a service-less walk-in is costed identically on both sides.
 */
export function toQueueEntry(m: Row, fallbackBusinessId?: string): QueueEntry {
  const service = (m.services ?? null) as Row | null;
  const biz = (m.businesses ?? null) as Row | null;
  const embedded = service ? numOrNull(service.duration_minutes) : null;

  // The customer's profile, present only on the owner board's read — the customer's own
  // `queue_active_line` projection is deliberately PII-free, so these stay null there.
  // PostgREST returns an embed as an object or, on some shapes, a one-element array.
  const profileEmbed = m["profiles"];
  const profile = (Array.isArray(profileEmbed) ? profileEmbed[0] : profileEmbed) as
    | Row
    | null
    | undefined;

  return {
    id: m.id as string,
    businessId: str(m.business_id) ?? fallbackBusinessId ?? "",
    staffMemberId: str(m.staff_member_id),
    serviceId: str(m.service_id),
    customerProfileId: str(m.customer_profile_id),
    bookingId: str(m.booking_id),
    // The linked profile's name first, then the one typed at the counter.
    //
    // `queue_entries.customer_name` is populated **only** for a walk-in a staff member
    // added by hand, so reading it alone labels every customer who joined the line
    // themselves as "Walk-in" — which is exactly what the Flutter board does, avatar and
    // phone showing beside the wrong name. Null on the customer's own PII-free RPC path,
    // where no name is wanted anyway.
    customerName: (profile ? str(profile.full_name) : null) ?? str(m.customer_name),
    status: queueStatusFromWire(str(m.status)),
    priorityAt: dateOrNull(m.priority_at),
    joinedAt: new Date(m.joined_at as string),
    serviceMinutes: embedded ?? numOrNull(m.service_minutes) ?? 20,
    servingRemainingMinutes: numOrNull(m.serving_remaining_min) ?? 0,
    businessName: biz ? str(biz.name) : null,
    customerPhone: profile ? str(profile.phone) : null,
    customerAvatarUrl: profile ? str(profile.avatar_url) : null,
  };
}

/**
 * A notification row.
 *
 * `payload` is the event's own data, not a rendered message — `notificationText` in
 * `lib/notification-copy.ts` composes the words from it. Deliberately **not** normalised
 * or narrowed here: a new event type must be able to arrive with new fields and reach the
 * copy module intact rather than being flattened at this boundary.
 */
export function toNotification(m: Row): AppNotification {
  const payload = m.payload;
  return {
    id: m.id as string,
    eventType: str(m.event_type) ?? "notification",
    payload:
      payload != null && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {},
    createdAt: new Date(m.created_at as string),
    readAt: dateOrNull(m.read_at),
    bookingId: str(m.booking_id),
    orderId: str(m.order_id),
  };
}

export function toConversation(m: Row): Conversation {
  const biz = (m.businesses ?? null) as Row | null;
  return {
    id: m.id as string,
    businessId: m.business_id as string,
    customerProfileId: m.customer_profile_id as string,
    customerName: str(m.customer_name),
    businessName: biz ? str(biz.name) : null,
    businessCoverUrl: biz ? str(biz.cover_url) : null,
    lastMessage: str(m.last_message),
    lastMessageAt: dateOrNull(m.last_message_at),
    customerLastReadAt: dateOrNull(m.customer_last_read_at),
    businessLastReadAt: dateOrNull(m.business_last_read_at),
  };
}

export function toMessage(m: Row): Message {
  return {
    id: m.id as string,
    senderProfileId: m.sender_profile_id as string,
    body: (str(m.body) ?? "") as string,
    createdAt: new Date(m.created_at as string),
  };
}

export function toHairstyle(m: Row): Hairstyle {
  return {
    id: m.id as string,
    name: m.name as string,
    imageUrl: str(m.image_url),
    gender: str(m.gender),
  };
}

// ============================================================ 3c — analytics ===
//
// The dashboard arrives as one jsonb blob rather than a row set, so these read nested
// objects instead of columns. Every numeric goes through `num`: jsonb makes no distinction
// between `0` and `0.0`, and a `numeric(12,2)` sum comes back as a *string* once it passes
// what a JSON number can hold exactly — which is why the Dart reads all of them `as num`
// and why `numOrNull` is not enough on its own here (an absent key must be 0, not null).

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function toKpiSet(m: Row): KpiSet {
  return {
    revenue: num(m.revenue),
    revenuePrev: num(m.revenue_prev),
    bookings: num(m.bookings),
    bookingsPrev: num(m.bookings_prev),
    avgTicket: num(m.avg_ticket),
    avgTicketPrev: num(m.avg_ticket_prev),
    utilization: num(m.utilization),
    utilizationPrev: num(m.utilization_prev),
  };
}

export function toTrendPoint(m: Row): TrendPoint {
  return {
    bucketStart: new Date(m.bucket_start as string),
    revenue: num(m.revenue),
    bookings: num(m.bookings),
    appRevenue: num(m.app_revenue),
    walkInRevenue: num(m.walk_in_revenue),
  };
}

export function toStaffStat(m: Row): StaffStat {
  return {
    staffId: m.staff_id as string,
    name: m.name as string,
    revenue: num(m.revenue),
    bookings: num(m.bookings),
    pct: num(m.pct),
    avgRating: numOrNull(m.avg_rating),
  };
}

export function toServiceStat(m: Row): ServiceStat {
  return {
    serviceId: m.service_id as string,
    name: m.name as string,
    revenue: num(m.revenue),
    bookings: num(m.bookings),
    pct: num(m.pct),
  };
}

/** The RPC names the count `bookings`; the grid has no other number, so it is `count`. */
export function toHeatCell(m: Row): HeatCell {
  return { dow: num(m.dow), hour: num(m.hour), count: num(m.bookings) };
}

/**
 * The whole `analytics_dashboard` payload.
 *
 * Every list defaults to empty when its key is absent or null, so a salon in its first week
 * renders the low-data empty states instead of throwing — the same defensiveness
 * `DashboardData.fromMap` has, and the reason a brand-new salon's Insights tab is blank
 * rather than broken.
 */
export function toDashboardData(m: Row): DashboardData {
  const list = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);
  const obj = (v: unknown): Row => (v && typeof v === "object" ? (v as Row) : {});
  const goal = obj(m.goal);
  return {
    kpis: toKpiSet(obj(m.kpis)),
    revenue: list(m.revenue_series).map(toTrendPoint),
    retention: {
      newCustomers: num(obj(m.retention).new_customers),
      returningCustomers: num(obj(m.retention).returning_customers),
    },
    topStaff: list(m.top_staff).map(toStaffStat),
    topServices: list(m.top_services).map(toServiceStat),
    ops: {
      completed: num(obj(m.ops).completed),
      noShow: num(obj(m.ops).no_show),
      cancelled: num(obj(m.ops).cancelled),
    },
    // `monthly_goal` stays null rather than becoming 0: a goal of nothing and no goal at all
    // are the same state (the settings form stores 0 as null), and the gauge reads "—" for it.
    goal: {
      monthlyGoal: numOrNull(goal.monthly_goal),
      monthToDateRevenue: num(goal.month_to_date_revenue),
    },
  };
}

// ========================================================== 3c — back office ===

export function toClientSummary(m: Row): ClientSummary {
  const profileId = str(m.customer_profile_id);
  const displayName = (str(m.display_name) ?? "Guest") as string;
  const phone = str(m.phone);
  return {
    customerProfileId: profileId,
    displayName,
    phone,
    visits: num(m.visits),
    totalSpend: num(m.total_spend),
    lastVisit: dateOrNull(m.last_visit),
    nextUpcoming: dateOrNull(m.next_upcoming),
    hasNote: (m.has_note as boolean | null) ?? false,
    // The RPC groups by `coalesce(customer_profile_id::text, 'walkin:'||name||':'||phone)`
    // but only returns the id, so the walk-in half is rebuilt here. Two different walk-ins
    // with the same name and no phone collapse into one row server-side, so this key is as
    // unique as the row it labels — no more, and that is the RPC's decision, not ours.
    groupKey: profileId ?? `walkin:${displayName}:${phone ?? ""}`,
  };
}

export function toClientHistoryEntry(m: Row): ClientHistoryEntry {
  return {
    bookingId: m.booking_id as string,
    startTs: new Date(m.start_ts as string),
    status: (str(m.status) ?? "") as string,
    totalPrice: num(m.total_price),
    services: str(m.services),
  };
}

export function toOrderItem(m: Row): OrderItem {
  return {
    id: m.id as string,
    productId: str(m.product_id),
    nameSnapshot: m.name_snapshot as string,
    priceNuSnapshot: num(m.price_nu_snapshot),
    qty: num(m.qty),
    lineTotalNu: num(m.line_total_nu),
  };
}

/**
 * An order and its line items.
 *
 * Items are sorted by name here for the same reason `toReview` sorts photos: PostgREST makes
 * no ordering promise about an embedded resource, and a receipt whose lines reshuffle
 * between two loads of the same page looks like a different order.
 */
export function toOrder(m: Row): Order {
  const biz = (m.businesses ?? null) as Row | null;
  const items = (Array.isArray(m.order_items) ? (m.order_items as Row[]) : []).map(toOrderItem);
  items.sort((a, b) => a.nameSnapshot.localeCompare(b.nameSnapshot));
  return {
    id: m.id as string,
    businessId: m.business_id as string,
    customerProfileId: m.customer_profile_id as string,
    status: (str(m.status) ?? "new") as OrderStatus,
    totalNu: num(m.total_nu),
    note: str(m.note),
    declineReason: str(m.decline_reason),
    placedAt: new Date(m.placed_at as string),
    updatedAt: new Date((str(m.updated_at) ?? m.placed_at) as string),
    businessName: biz ? str(biz.name) : null,
    items,
  };
}

export function toLoyaltyProgram(m: Row): LoyaltyProgram {
  return {
    businessId: m.business_id as string,
    // Defaults match the column defaults, which matter because a salon with no row at all is
    // rendered from these: `is_active` false (a program is opt-in), 10 points, Nu 10.
    isActive: (m.is_active as boolean | null) ?? false,
    earnMode: (str(m.earn_mode) ?? "per_visit") as LoyaltyEarnMode,
    pointsPerVisit: num(m.points_per_visit ?? 10),
    nuPerPoint: num(m.nu_per_point ?? 10),
  };
}

export function toLoyaltyReward(m: Row): LoyaltyReward {
  return {
    id: m.id as string,
    businessId: m.business_id as string,
    name: m.name as string,
    description: str(m.description),
    rewardType: (str(m.reward_type) ?? "percent_discount") as LoyaltyRewardType,
    percentOff: numOrNull(m.percent_off),
    amountNu: numOrNull(m.amount_nu),
    serviceRef: str(m.service_ref),
    productRef: str(m.product_ref),
    pointCost: num(m.point_cost),
    isActive: (m.is_active as boolean | null) ?? true,
    isArchived: (m.is_archived as boolean | null) ?? false,
    sortOrder: num(m.sort_order),
  };
}

export function toLoyaltyBalance(m: Row): LoyaltyBalance {
  return { balance: num(m.balance), held: num(m.held), available: num(m.available) };
}

export function toLoyaltyRedemption(m: Row): LoyaltyRedemption {
  return {
    id: m.id as string,
    businessId: m.business_id as string,
    customerProfileId: m.customer_profile_id as string,
    rewardId: str(m.reward_id),
    nameSnapshot: m.name_snapshot as string,
    typeSnapshot: (str(m.type_snapshot) ?? "percent_discount") as LoyaltyRewardType,
    pointCost: num(m.point_cost),
    code: m.code as string,
    status: (str(m.status) ?? "pending") as LoyaltyRedemptionStatus,
    requestedAt: new Date(m.requested_at as string),
  };
}

export function toPayrollRow(m: Row): PayrollRow {
  return {
    staffMemberId: m.staff_member_id as string,
    displayName: m.display_name as string,
    completedBookings: num(m.completed_bookings),
    serviceRevenue: num(m.service_revenue),
    commissionPct: num(m.commission_pct),
    commission: num(m.commission),
    baseSalaryNu: num(m.base_salary_nu),
    totalPay: num(m.total_pay),
  };
}

export function toTaxEstimate(m: Row): TaxEstimate {
  return {
    turnover: num(m.turnover),
    assessable: num(m.assessable),
    incomeTax: num(m.income_tax),
    effectiveRate: num(m.effective_rate),
    gstRequired: (m.gst_required as boolean | null) ?? false,
    gstEstimate: num(m.gst_estimate),
    filingDeadline: new Date(m.filing_deadline as string),
  };
}

export function toPlanChangeRequest(m: Row): PlanChangeRequest {
  return {
    id: m.id as string,
    businessId: m.business_id as string,
    requestedBy: m.requested_by as string,
    requestedPlan: m.requested_plan as "growth" | "pro",
    note: str(m.note),
    status: (str(m.status) ?? "pending") as PlanChangeRequest["status"],
    createdAt: new Date(m.created_at as string),
  };
}
