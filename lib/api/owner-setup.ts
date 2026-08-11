import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntervalPayload } from "../hours";
import type { WorkingHour } from "../types/booking";
import type {
  Business,
  BusinessPhoto,
  CatalogService,
  ServiceItem,
  StaffMember,
} from "../types/salon";
import {
  toBusiness,
  toBusinessPhoto,
  toCatalogService,
  toServiceItem,
  toStaffMember,
  toWorkingHour,
} from "./mappers";
import { STAFF_PUBLIC_SELECT } from "./salon";

/**
 * Everything the owner console **sets up** — services, staff, hours, the salon itself.
 * Split from `owner.ts`, which is the salon's *day*: these are edited in bursts and then
 * left alone for weeks, and keeping them apart is what stops one file becoming the place
 * every owner call lives.
 *
 * Three rules run through the whole file.
 *
 * **1. An RPC wherever one exists**, and for a specific reason each time, not on
 * principle:
 *
 * - `set_staff_services` — the direct-insert policy is **wrong**. `service_staff_insert`
 *   checks `is_business_owner(services.business_id)` and never that the staff member
 *   belongs to the same salon, so a hand-written insert can map your service to *another
 *   salon's* stylist. The RPC derives the business from the staff row and filters services
 *   to it, so both sides are checked. Measured: the direct insert succeeds today.
 * - `set_staff_working_hours` — atomic replace with server-side validation of weekdays,
 *   inverted intervals and same-day overlaps. A client-side delete-then-insert could leave
 *   a stylist with no hours at all, which reads as "never available".
 * - `link_staff_member` / `unlink_staff_member` / `set_staff_pay` — each holds a check the
 *   client cannot: an email that must resolve to a real account, a `profiles.role` write,
 *   a `plan = 'pro'` gate.
 *
 * **2. Only granted columns are written.** Since `20260804000004` and `20260805000001`,
 * `businesses` and `staff_members` carry **column-level** INSERT/UPDATE grants rather than
 * table-wide ones, because RLS constrains the row and says nothing about the columns. Any
 * patch naming a withheld column fails the whole statement with `42501` — so
 * `updateBusiness` and `updateStaff` take narrow, named field sets rather than a loose
 * `Record<string, unknown>` the way `Api.updateBusiness` does. The type is the guard.
 *
 * **3. Uploads go under the caller's own uid.** See `uploadOwnerImage`.
 */

/* --------------------------------------------------------------------------
   Services.
   -------------------------------------------------------------------------- */

/** The global common-services catalogue, in menu order. Anon-readable. */
export async function fetchServiceCatalog(
  supabase: SupabaseClient,
): Promise<CatalogService[]> {
  const { data, error } = await supabase
    .from("service_catalog")
    .select("*")
    .order("sort", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toCatalogService);
}

export type ServiceFields = {
  name: string;
  durationMinutes: number;
  price: number;
  /** `'female' | 'male' | 'unisex'`. */
  gender: string | null;
  /** One of `SERVICE_CATEGORIES`, or null for a service that belongs in no group. */
  category: string | null;
  imageUrl: string | null;
};

export async function createService(
  supabase: SupabaseClient,
  businessId: string,
  fields: ServiceFields & { catalogId?: string | null },
): Promise<ServiceItem> {
  const { data, error } = await supabase
    .from("services")
    .insert({
      business_id: businessId,
      name: fields.name,
      duration_minutes: fields.durationMinutes,
      price: fields.price,
      gender: fields.gender,
      category: fields.category,
      image_url: fields.imageUrl,
      catalog_id: fields.catalogId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return toServiceItem(data as Record<string, unknown>);
}

/**
 * Edit a service.
 *
 * Every field is sent, including the nulls — `category` and `gender` must be *clearable*,
 * and the app's own `if (x != null)` spread quietly refuses to un-file a service, which is
 * a bug its own comment half-acknowledges.
 */
export async function updateService(
  supabase: SupabaseClient,
  serviceId: string,
  fields: ServiceFields,
): Promise<void> {
  const { error } = await supabase
    .from("services")
    .update({
      name: fields.name,
      duration_minutes: fields.durationMinutes,
      price: fields.price,
      gender: fields.gender,
      category: fields.category,
      image_url: fields.imageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", serviceId);
  if (error) throw error;
}

/**
 * Switch a service on or off.
 *
 * There is no delete affordance anywhere, and that is deliberate: `booking_items` rows
 * reference a service by id, so removing one would erase what a completed booking was
 * *for*. `services_delete` exists in the schema; nothing in either client calls it.
 */
export async function setServiceActive(
  supabase: SupabaseClient,
  serviceId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("services")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", serviceId);
  if (error) throw error;
}

/**
 * Turn a catalogue entry on for a salon: **reactivate** the row it already made if there
 * is one, else materialise a new service from the template.
 *
 * The two-step is the app's and it matters — without the lookup, an owner who switched a
 * catalogue service off and on again would end up with two rows of the same name, one of
 * them invisible.
 */
export async function enableCatalogService(
  supabase: SupabaseClient,
  businessId: string,
  entry: CatalogService,
): Promise<void> {
  const { data: existing, error: lookupError } = await supabase
    .from("services")
    .select("id")
    .eq("business_id", businessId)
    .eq("catalog_id", entry.id)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    await setServiceActive(supabase, (existing as { id: string }).id, true);
    return;
  }
  await createService(supabase, businessId, {
    name: entry.name,
    durationMinutes: entry.defaultDurationMinutes,
    price: entry.defaultPrice,
    gender: entry.gender,
    category: entry.category,
    imageUrl: entry.defaultImageUrl,
    catalogId: entry.id,
  });
}

/* --------------------------------------------------------------------------
   Staff.
   -------------------------------------------------------------------------- */

export async function createStaff(
  supabase: SupabaseClient,
  businessId: string,
  displayName: string,
): Promise<StaffMember> {
  const { data, error } = await supabase
    .from("staff_members")
    // `role` is named because `Api.createStaff` names it and the column is in the INSERT
    // grant. Nothing reads it for authorization — it is the subtitle on the salon page.
    .insert({ business_id: businessId, display_name: displayName, role: "staff" })
    // Named columns, because a bare `.select()` is `RETURNING *` — and no client role holds
    // table-level SELECT on `staff_members`, so the star failed the whole statement and
    // adding a stylist raised 42501 *after* the INSERT check had passed. See
    // `STAFF_PUBLIC_SELECT`.
    .select(STAFF_PUBLIC_SELECT)
    .single();
  if (error) throw error;
  return toStaffMember(data as unknown as Record<string, unknown>);
}

/**
 * The three fields an owner may change about a stylist.
 *
 * Not a loose patch: `profile_id`, `role`, `commission_pct` and `base_salary_nu` are out
 * of the UPDATE grant since `20260805000001`, and naming any of them would fail the whole
 * statement. Pay and linking go through their RPCs below.
 */
export async function updateStaff(
  supabase: SupabaseClient,
  staffId: string,
  fields: { displayName?: string; isActive?: boolean; photoUrl?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.displayName !== undefined) patch.display_name = fields.displayName;
  if (fields.isActive !== undefined) patch.is_active = fields.isActive;
  if (fields.photoUrl !== undefined) patch.photo_url = fields.photoUrl;

  const { error } = await supabase.from("staff_members").update(patch).eq("id", staffId);
  if (error) throw error;
}

/** The service ids this stylist performs. */
export async function fetchStaffServiceIds(
  supabase: SupabaseClient,
  staffId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("service_staff")
    .select("service_id")
    .eq("staff_member_id", staffId);
  if (error) throw error;
  return ((data ?? []) as { service_id: string }[]).map((r) => r.service_id);
}

/** Replace the whole set, atomically and with both sides validated. See the file note. */
export async function setStaffServices(
  supabase: SupabaseClient,
  staffId: string,
  serviceIds: string[],
): Promise<void> {
  const { error } = await supabase.rpc("set_staff_services", {
    p_staff_id: staffId,
    p_service_ids: serviceIds,
  });
  if (error) throw error;
}

export async function fetchStaffWorkingHours(
  supabase: SupabaseClient,
  staffId: string,
): Promise<WorkingHour[]> {
  const { data, error } = await supabase
    .from("staff_working_hours")
    .select("*")
    .eq("staff_member_id", staffId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toWorkingHour);
}

/**
 * Replace a stylist's entire week. An empty array **clears** their hours, which is the
 * only way to say "not working" — and, because `is_bookable_window` consults this table,
 * the one edit here that can make a stylist unbookable.
 */
export async function setStaffWorkingHours(
  supabase: SupabaseClient,
  staffId: string,
  intervals: IntervalPayload[],
): Promise<void> {
  const { error } = await supabase.rpc("set_staff_working_hours", {
    p_staff: staffId,
    p_intervals: intervals,
  });
  if (error) throw error;
}

/**
 * **`linkStaffMember` was here and is deliberately gone.**
 *
 * It called `link_staff_member`, which resolved an email against `auth.users` and set
 * `profiles.role = 'staff'` on the holder immediately — so an owner who knew or guessed
 * an address could replace a stranger's entire shell with no consent and no notice.
 * Upstream removed that RPC in `ee413c6` ("ask before making someone staff") and
 * `tho_web` was the last caller anywhere.
 *
 * Its replacement is the handshake in `lib/api/staff-invites.ts`: the owner invites, the
 * person accepts, and nothing about their account moves until they do. **Do not
 * reintroduce this as a shortcut** — the RPC may still exist on the database, and calling
 * it would re-open exactly the hole the migration closed.
 *
 * Unlinking stays, and is not the same shape: it only ever detaches an account that
 * already consented, and only from the owner's own salon.
 */
export async function unlinkStaffMember(
  supabase: SupabaseClient,
  staffId: string,
): Promise<void> {
  const { error } = await supabase.rpc("unlink_staff_member", { p_staff_id: staffId });
  if (error) throw error;
}

/**
 * Commission and base salary — **Pro only, enforced in SQL**.
 *
 * `set_staff_pay` raises `payroll requires Pro (P0001)` for any other plan. No salon on
 * the platform is on Pro, so this call has no live example; it is reachable and correct,
 * proved by flipping the plan inside a rolled-back transaction.
 */
export async function setStaffPay(
  supabase: SupabaseClient,
  staffId: string,
  commissionPct: number,
  baseSalaryNu: number,
): Promise<void> {
  const { error } = await supabase.rpc("set_staff_pay", {
    p_staff: staffId,
    p_commission_pct: commissionPct,
    p_base_salary: baseSalaryNu,
  });
  if (error) throw error;
}

/* --------------------------------------------------------------------------
   The salon's opening hours.
   -------------------------------------------------------------------------- */

/**
 * Replace the salon's opening hours — **the editor neither client has ever had.**
 * `business_hours` is read three times in the Flutter app and written nowhere; every live
 * row was seeded out of band.
 *
 * **There is no RPC for this table**, unlike staff hours, so it is two writes and the
 * order is the safety:
 *
 * 1. **upsert** every segment the owner kept or changed, on
 *    `(business_id, day_of_week, open_time)` — one statement covering both the inserts and
 *    the changed `close_time`s.
 * 2. **delete** the rows that are no longer in the week, by id.
 *
 * If (1) fails nothing changed. If (2) fails the salon is *too open* — visible, and
 * re-savable. What cannot happen is the state a delete-then-insert risks: a salon with no
 * hours at all, which every customer-facing surface renders as "closed all week".
 *
 * The upsert needs the conflicting row to be **selectable** — Postgres permits
 * `on conflict do update` only then. `business_hours_select` admits a business member, so
 * it is. Worth checking rather than assuming: the same requirement is exactly what made
 * every `media` bucket upload fail silently for four migrations.
 *
 * Removing every segment for a day deletes its rows, and that is the *only* way this table
 * says "closed" — there is no flag, and a missing row is what Norzin's Sunday is today.
 */
export async function setBusinessHours(
  supabase: SupabaseClient,
  businessId: string,
  intervals: IntervalPayload[],
  /** What is stored now, so the leftovers can be named by id rather than wiped. */
  existing: WorkingHour[],
): Promise<void> {
  if (intervals.length > 0) {
    const { error } = await supabase.from("business_hours").upsert(
      intervals.map((i) => ({
        business_id: businessId,
        day_of_week: i.day,
        open_time: i.start,
        close_time: i.end,
      })),
      { onConflict: "business_id,day_of_week,open_time" },
    );
    if (error) throw error;
  }

  // A row survives only if the saved week still opens that weekday at that time. Comparing
  // on `HH:MM` rather than the raw column, because Postgres hands back '09:00:00' and the
  // payload carries '09:00:00' — but a legacy row could hold '09:00' and would then be
  // deleted and re-inserted for no reason.
  const kept = new Set(intervals.map((i) => `${i.day}@${i.start.slice(0, 5)}`));
  const stale = existing
    .filter((h) => !kept.has(`${h.dayOfWeek}@${h.startTime.slice(0, 5)}`))
    .map((h) => h.id);

  if (stale.length > 0) {
    const { error } = await supabase.from("business_hours").delete().in("id", stale);
    if (error) throw error;
  }
}

/* --------------------------------------------------------------------------
   The salon itself.
   -------------------------------------------------------------------------- */

/** Exactly the columns in `businesses`' UPDATE grant that an owner form edits. */
export type BusinessFields = {
  name?: string;
  description?: string | null;
  addressText?: string | null;
  phone?: string | null;
  whatsappPhone?: string | null;
  coverUrl?: string | null;
  businessType?: string;
  serviceRadiusKm?: number | null;
  lat?: number | null;
  lng?: number | null;
  cancellationWindowHours?: number;
  monthlyRevenueGoal?: number | null;
  queueEnabled?: boolean;
  queueJoinMode?: string;
  rebookingEnabled?: boolean;
  rebookingDays?: number;
  reminderChannel?: string;
};

const BUSINESS_COLUMNS: Record<keyof BusinessFields, string> = {
  name: "name",
  description: "description",
  addressText: "address_text",
  phone: "phone",
  whatsappPhone: "whatsapp_phone",
  coverUrl: "cover_url",
  businessType: "business_type",
  serviceRadiusKm: "service_radius_km",
  lat: "lat",
  lng: "lng",
  cancellationWindowHours: "cancellation_window_hours",
  monthlyRevenueGoal: "monthly_revenue_goal",
  queueEnabled: "queue_enabled",
  queueJoinMode: "queue_join_mode",
  rebookingEnabled: "rebooking_enabled",
  rebookingDays: "rebooking_days",
  reminderChannel: "reminder_channel",
};

/**
 * Patch the salon.
 *
 * `plan`, `status`, `is_active`, `suspended_at`, the review columns and `timezone` are
 * **not** in the grant since `20260804000004` — an owner used to be able to set their own
 * plan to `pro` and their own status to `approved`. Naming any of them here would fail the
 * statement with `42501`, so the mapping above is the list of what a form may touch.
 */
export async function updateBusiness(
  supabase: SupabaseClient,
  businessId: string,
  fields: BusinessFields,
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, column] of Object.entries(BUSINESS_COLUMNS)) {
    const value = fields[key as keyof BusinessFields];
    if (value !== undefined) patch[column] = value;
  }

  const { error } = await supabase.from("businesses").update(patch).eq("id", businessId);
  if (error) throw error;
}

/**
 * Create a salon.
 *
 * `owner_id` must be named — `businesses_insert`'s check is `owner_id = auth.uid()` — and
 * is insertable for exactly that reason while not being updatable. Everything that decides
 * money or visibility takes its default: **`basic`** and **`pending`**. So a salon created
 * here is invisible to customers until an operator reviews it, which is the point.
 *
 * **The insert must not return the row, and that is not a style choice.** The live
 * `businesses_select` policy is
 *
 *   (is_active and deleted_at is null and status = 'approved')
 *     or private.is_business_member(id) or private.is_admin()
 *
 * A brand-new salon is `pending`, so the first branch is false; and
 * `private.is_business_member` is `STABLE`, so its subquery runs on the statement's own
 * snapshot and **cannot see the row the same statement is inserting**. `INSERT … RETURNING`
 * requires the new row to satisfy the SELECT policy, so it fails with *"new row violates
 * row-level security policy"* — a message that reads like the INSERT check when the INSERT
 * check passed perfectly well. Measured, twice: the same insert succeeds without RETURNING
 * and fails with it.
 *
 * **`Api.createBusiness` in the Flutter app does `.insert(…).select().single()`**, so it
 * cannot create a salon at all — which is consistent with there being no owner-created salon
 * in the database. Worth reporting upstream, along with the cause: **no migration in the repo
 * adds `status = 'approved'` to that policy.** It exists only on the live database, applied
 * out of band, so a rebuild from `supabase/migrations` would publish unreviewed salons *and*
 * make this function's problem disappear — two different behaviours from one schema.
 *
 * So: insert with no RETURNING, then read the row back in a **second** statement, which has
 * its own snapshot and can see it. The read is narrowed to this owner and this name, newest
 * first, because there is no id to ask for — `id` is deliberately not in the INSERT grant.
 *
 * There is no counterpart to this function. `businesses` has **no DELETE policy at all**, so
 * an owner cannot remove a salon they created — only an operator can.
 */
export async function createBusiness(
  supabase: SupabaseClient,
  ownerId: string,
  fields: { name: string; addressText: string | null; phone: string | null },
): Promise<Business> {
  const { error } = await supabase.from("businesses").insert({
    owner_id: ownerId,
    name: fields.name,
    address_text: fields.addressText,
    phone: fields.phone,
  });
  if (error) throw error;

  const { data, error: readError } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("name", fields.name)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) throw readError;
  if (!data) throw new Error("the salon was created but could not be read back");
  return toBusiness(data as Record<string, unknown>);
}

export async function fetchBusinessCategoryIds(
  supabase: SupabaseClient,
  businessId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("business_categories")
    .select("category_id")
    .eq("business_id", businessId);
  if (error) throw error;
  return ((data ?? []) as { category_id: string }[]).map((r) => r.category_id);
}

/**
 * Replace the salon's categories — **through the RPC.**
 *
 * This was a client-side delete-then-insert, and the comment above it said there was no RPC
 * to route through. There is: `set_business_categories(p_business_id, p_category_ids)`,
 * granted to `authenticated`, confirmed against the live catalogue. Three things the two
 * writes bought that one call does not have to:
 *
 * - **Atomicity.** A failed insert after a successful delete left the salon *uncategorised* —
 *   invisible under every category chip on Discover until the owner saved again. The RPC does
 *   both in one statement pair inside one function, so a failure changes nothing.
 * - **A real ownership check.** `business_categories`' policies were the only gate; the RPC
 *   checks `private.is_business_owner` itself and refuses otherwise, which is the
 *   CLAUDE.md rule every other set-write here already follows.
 * - **Category validation.** It inserts by joining `public.categories`, so an id that names
 *   nothing is dropped rather than raising a foreign-key error at the client.
 *
 * An empty array clears them, which is why there is no early return: the delete has to
 * happen even with nothing to insert, and the RPC's `array_length(...) is null` guard is what
 * makes that safe.
 */
export async function setBusinessCategories(
  supabase: SupabaseClient,
  businessId: string,
  categoryIds: string[],
): Promise<void> {
  const { error } = await supabase.rpc("set_business_categories", {
    p_business_id: businessId,
    p_category_ids: categoryIds,
  });
  if (error) throw error;
}

/* --------------------------------------------------------------------------
   Photos.
   -------------------------------------------------------------------------- */

/**
 * Upload an owner-side image to the public `media` bucket and return its URL.
 *
 * **The caller's uid is the first path segment**, exactly as `uploadAvatar` requires, and
 * this is where the Flutter app's photo paths are simply illegal: `business/<id>/cover.jpg`,
 * `service/<businessId>/<ts>.jpg` and `staff/<staffId>.jpg` all fail
 * `media_auth_insert`'s `(storage.foldername(name))[1] = auth.uid()`. Together with the
 * unconditional `upsert: true` in `Api.uploadImage`, that is why every owner photo upload
 * in the app has been failing since `20260720000001`.
 *
 * A salon's photos therefore live under the *owner's* folder rather than the salon's. That
 * is a real consequence — if a salon changed hands, its old photos would sit in the
 * previous owner's folder — and it is the layout the policy allows. The bucket is public,
 * so customers read them regardless of whose folder they are in.
 *
 * `label` only makes the path legible in the dashboard; uniqueness comes from the
 * timestamp, which also makes each upload its own cache key.
 */
export async function uploadOwnerImage(
  supabase: SupabaseClient,
  userId: string,
  blob: Blob,
  label: string,
  contentType = "image/jpeg",
  /** The URL being replaced, so its object can be removed once the new one exists. */
  previousUrl?: string | null,
): Promise<string> {
  const objectPath = `${userId}/${label}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("media")
    .upload(objectPath, blob, { contentType });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from("media").getPublicUrl(objectPath);

  const previous = mediaObjectPath(previousUrl);
  if (previous && previous !== objectPath && previous.startsWith(`${userId}/`)) {
    // Swallowed on purpose, and only attempted for a path inside the caller's own folder:
    // an orphaned file is untidy, a failed photo change is not.
    const { error: removeError } = await supabase.storage.from("media").remove([previous]);
    void removeError;
  }
  return publicUrl;
}

/** The object path for one of the bucket's public URLs, or null when it is not one. */
function mediaObjectPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = "/storage/v1/object/public/media/";
  const at = url.indexOf(marker);
  if (at === -1) return null;
  return decodeURIComponent(url.slice(at + marker.length).split("?")[0]!);
}

export async function addBusinessPhoto(
  supabase: SupabaseClient,
  businessId: string,
  url: string,
): Promise<void> {
  const { error } = await supabase
    .from("business_photos")
    .insert({ business_id: businessId, url });
  if (error) throw error;
}

export async function deleteBusinessPhoto(
  supabase: SupabaseClient,
  photoId: string,
): Promise<void> {
  const { error } = await supabase.from("business_photos").delete().eq("id", photoId);
  if (error) throw error;
}

/**
 * Portfolio photos **with their ids**, which the public read (`fetchStaffPhotos`) omits
 * because a customer only needs the URLs. `BusinessPhoto` is `{ id, url }` and serves both
 * photo tables — the shape, not the table, is what it names.
 */
export async function fetchStaffPhotoRows(
  supabase: SupabaseClient,
  staffId: string,
): Promise<BusinessPhoto[]> {
  const { data, error } = await supabase
    .from("staff_photos")
    .select("id, url")
    .eq("staff_member_id", staffId)
    .order("sort", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(toBusinessPhoto);
}

export async function addStaffPhoto(
  supabase: SupabaseClient,
  staffId: string,
  url: string,
): Promise<void> {
  const { error } = await supabase
    .from("staff_photos")
    .insert({ staff_member_id: staffId, url });
  if (error) throw error;
}

/**
 * Remove a portfolio photo.
 *
 * The app has no such affordance — `staff_edit_screen` only adds — but `staff_photos_delete`
 * allows it and a wrong photo on a public stylist page has to be removable. Note what is
 * *not* offered anywhere: reordering. Both photo tables carry a `sort` column with **no
 * UPDATE policy**, so the order is the insertion order until that changes.
 */
export async function deleteStaffPhoto(
  supabase: SupabaseClient,
  photoId: string,
): Promise<void> {
  const { error } = await supabase.from("staff_photos").delete().eq("id", photoId);
  if (error) throw error;
}
