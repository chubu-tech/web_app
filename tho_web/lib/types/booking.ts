/**
 * Booking-side types, ported from `tho/app/lib/data/models.dart`.
 *
 * Timestamps are `Date` in UTC. The DB hands back ISO strings; parse at the
 * edge in `lib/api/*` and keep `Date` everywhere above it, so no component ever
 * has to wonder whether a field is a string or a date.
 */

/** `public.booking_status` */
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

/** `public.booking_source` */
export type BookingSource = "app" | "walk_in" | "admin";

export type BookingItem = {
  id: string;
  serviceId: string | null;
  name: string;
  price: number;
  durationMinutes: number;
};

export type Booking = {
  id: string;
  status: BookingStatus;
  startTs: Date;
  endTs: Date;
  totalPrice: number;
  source?: BookingSource;
  businessId?: string;
  businessName?: string | null;
  businessAddress?: string | null;
  businessCoverUrl?: string | null;
  staffMemberId?: string | null;
  staffName?: string | null;
  customerProfileId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAvatarUrl?: string | null;
  customerNote?: string | null;
  items?: BookingItem[];
  attachmentUrls?: string[];
};

/**
 * A row of `business_hours` or a staff member's weekly hours.
 *
 * `dayOfWeek` is 0=Sunday. `startTime`/`endTime` are `HH:MM:SS` wall-clock in
 * Thimphu — not instants. A lunch break is the *gap* between two segments on the
 * same day, not a stored field.
 */
export type WorkingHour = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

/** One bookable slot from `compute_availability`. */
export type Slot = {
  start: Date;
  end: Date;
};
