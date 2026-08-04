import { hasFeature, type Plan } from "../entitlements";

/**
 * Salon-side types, ported from `tho/app/lib/data/models.dart`.
 *
 * Timestamps are `Date` in UTC — parse ISO strings in `lib/api/*` and keep
 * `Date` above that boundary.
 */

/** `businesses.business_type` — a CHECK on text, not an enum. */
export type BusinessType = "salon" | "barber" | "home_based" | "mobile";

/** Whether a queue can be joined from the salon page or only by scanning on site. */
export type QueueJoinMode = "anywhere" | "qr_only";

export type Business = {
  id: string;
  name: string;
  description: string | null;
  addressText: string | null;
  phone: string | null;
  coverUrl: string | null;
  timezone: string;
  cancellationWindowHours: number;
  isActive: boolean;
  lat: number | null;
  lng: number | null;
  /** Merged from `business_rating_summary`; null when never rated. */
  avgRating: number | null;
  reviewCount: number;
  plan: Plan;
  businessType: BusinessType;
  /** How far a travelling business will go, in km. Null for a fixed shopfront. */
  serviceRadiusKm: number | null;
  /** E.164 for `wa.me`. Null hides the WhatsApp action. */
  whatsappPhone: string | null;
  /** Owner switch for the walk-in queue, independent of the plan gate. */
  queueEnabled: boolean;
  queueJoinMode: QueueJoinMode;
  reminderChannel: string;
  /**
   * The dashboard gauge's target. **Null means "no goal"** and the gauge shows an em dash —
   * which is why the settings form stores a typed 0 as null rather than as a literal zero.
   */
  monthlyRevenueGoal: number | null;
  /** Nudge lapsed customers to book again, after this many days since their last visit. */
  rebookingEnabled: boolean;
  rebookingDays: number;
};

export function hasLocation(
  b: Pick<Business, "lat" | "lng">,
): b is Pick<Business, "lat" | "lng"> & { lat: number; lng: number } {
  return b.lat != null && b.lng != null;
}

/**
 * True for the two types with no walk-in shopfront: the stylist works from home,
 * or travels to the customer. Both show a coverage line instead of an address
 * and hide Directions.
 */
export function travels(b: Pick<Business, "businessType">): boolean {
  return b.businessType === "home_based" || b.businessType === "mobile";
}

/**
 * True when the salon both *may* run a queue (plan) and *wants* to (switch).
 * Both halves matter — an owner can turn it off on a plan that allows it.
 */
export function runsQueue(b: Pick<Business, "queueEnabled" | "plan">): boolean {
  return b.queueEnabled && hasFeature(b.plan, "walkInQueue");
}

/** True when a customer must scan the shop's QR on site to take a place. */
export function queueIsQrOnly(b: Pick<Business, "queueJoinMode">): boolean {
  return b.queueJoinMode === "qr_only";
}

export type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
};

export type ServiceItem = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  isActive: boolean;
  imageUrl: string | null;
  /** 'male' | 'female' | 'unisex' | null. Null groups under OTHER. */
  gender: string | null;
  catalogId: string | null;
  /** The salon's own grouping ('Hair', 'Grooming', …). Null = ungrouped. */
  category: string | null;
};

export type StaffMember = {
  id: string;
  displayName: string;
  role: string;
  isActive: boolean;
  /** Non-null once an owner has linked a login to this staff row. */
  profileId: string | null;
  photoUrl: string | null;
  businessId: string | null;
  /**
   * Pro-plan payroll inputs, both defaulting to 0.
   *
   * Only `set_staff_pay` can write them — it refuses any salon that is not on `pro`, and
   * since `20260805000001` the columns are not in the owner's UPDATE grant either, so the
   * paywall holds on both paths. Read here so the staff editor can show what is set
   * rather than an empty field over a stored value.
   */
  commissionPct: number;
  baseSalaryNu: number;
};

/**
 * A template from the global common-services catalogue (`service_catalog`).
 *
 * Read-only for everyone — `service_catalog_read` is `using (true)` and there is no write
 * policy at all. Turning one on for a salon **materialises a `services` row** from it
 * (`enableCatalogService`), which is why `ServiceItem.catalogId` exists: it is what makes
 * the switch in the catalogue know it is already on.
 */
export type CatalogService = {
  id: string;
  slug: string;
  name: string;
  /** `'male' | 'female' | 'unisex'` — NOT NULL here, unlike `ServiceItem.gender`. */
  gender: string;
  /** One of `ServiceItem`'s categories. NOT NULL here. */
  category: string;
  defaultImageUrl: string | null;
  defaultDurationMinutes: number;
  defaultPrice: number;
};

/**
 * Every category a service may be filed under, in menu order — `ServiceItem.categories`
 * in `models.dart`, and exactly the values `services_category_check` allows. A service may
 * also be filed under none, which is why the chip row clears on a second tap.
 */
export const SERVICE_CATEGORIES = [
  "Hair",
  "Grooming",
  "Skin",
  "Spa",
  "Nails",
  "Makeup",
  "Other",
] as const;

/** `businesses.business_type`, with the label each one shows. */
export const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: "salon", label: "Salon" },
  { value: "barber", label: "Barber shop" },
  { value: "home_based", label: "Home-based" },
  { value: "mobile", label: "Mobile / I travel" },
];

/** `services.gender` and `service_catalog.gender`, with the label each one shows. */
export const SERVICE_GENDERS: { value: string; label: string }[] = [
  { value: "female", label: "Women" },
  { value: "male", label: "Men" },
  { value: "unisex", label: "Unisex" },
];

export function isLinked(s: Pick<StaffMember, "profileId">): boolean {
  return s.profileId != null;
}

export type Review = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: Date;
  /**
   * Populated only when the query joins `review_photos`. Empty on any path that
   * selects a plain `*`, which renders as no thumbnail strip rather than an
   * error.
   *
   * Sort client-side rather than trusting the join's row order: PostgREST makes
   * no ordering promise on an embedded resource, and the first photo the
   * customer picked should lead the strip.
   */
  photoUrls: string[];
};

export type Offer = {
  id: string;
  businessId: string;
  title: string;
  description: string | null;
  discountPct: number | null;
  startsOn: Date | null;
  endsOn: Date | null;
  isActive: boolean;
  /** Only when the query joins `businesses(name, cover_url)` — the home feed
   *  needs to name the salon; the salon page already knows it. */
  businessName: string | null;
  businessCoverUrl: string | null;
};

/** Days until an offer lapses, or null when it is open-ended. */
export function offerDaysLeft(offer: Pick<Offer, "endsOn">, now = new Date()): number | null {
  if (!offer.endsOn) return null;
  const ms = offer.endsOn.getTime() - now.getTime();
  return Math.ceil(ms / 86_400_000);
}

/** "Ends today" / "2 days left" / null when open-ended. */
export function offerEndsLabel(offer: Pick<Offer, "endsOn">, now = new Date()): string | null {
  const d = offerDaysLeft(offer, now);
  if (d == null) return null;
  if (d <= 0) return "Ends today";
  return `${d} day${d === 1 ? "" : "s"} left`;
}

export type Product = {
  id: string;
  businessId: string;
  name: string;
  priceNu: number;
  description: string | null;
  photoUrl: string | null;
  inStock: boolean;
  isArchived: boolean;
  sortOrder: number;
  /** Only on the cross-salon browse, which joins the salon name. */
  businessName: string | null;
};

export type BusinessPhoto = {
  id: string;
  url: string;
};

/** A style from the global hairstyle catalogue (Pro-plan booking flow). */
export type Hairstyle = {
  id: string;
  name: string;
  imageUrl: string | null;
  gender: string | null;
};
