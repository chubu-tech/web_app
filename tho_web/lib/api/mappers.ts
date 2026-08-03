import { planFromString } from "../entitlements";
import type {
  Business,
  BusinessPhoto,
  BusinessType,
  Category,
  Offer,
  Product,
  QueueJoinMode,
  Review,
  ServiceItem,
  StaffMember,
} from "../types/salon";
import type { WorkingHour } from "../types/booking";

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
