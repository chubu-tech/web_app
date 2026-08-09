# Feature parity — THO app (`../tho`) vs THO Web (`tho_web`)

Audited 2026-08-06 against `../tho/app/lib` (160 Dart files) and `tho_web` (53 routes).

**Method.** Every Flutter screen, sheet and `Api` method was enumerated and matched to a
web route, component or `lib/api` function. Nothing was taken on trust — including
`AGENTS.md`'s own parity claims. Two checks did the real work:

1. **Screen-level.** Every `*_screen.dart` / `*_tab.dart` / `*_sheet.dart` against
   `app/**/page.tsx` and `components/{customer,owner}`.
2. **API-level.** All 137 `Api` methods against the ~190 exports in `lib/api/`. A
   capability with no web caller is a gap even when a screen looks equivalent.

Then each candidate gap was checked for **reachability in Flutter** — because a method
with no caller in the app is dead code, not a missing feature. That test removed two
false positives (below), which is exactly why it matters.

---

## ✅ Already implemented — parity confirmed

### Customer (25 routes)

| Feature | Flutter | Web |
| --- | --- | --- |
| Discover / browse salons | `customer_home.dart` | `/` |
| Filters (gender, category, rating, distance, price) | `filter_screen.dart` | filter rail + sheet on `/` |
| Salon detail | `business_detail_screen.dart` | `/salon/[id]` |
| Booking flow | `booking_screen.dart` | `/salon/[id]/book` |
| Booking confirmation | `booking_confirmed_sheet.dart` | `booking-confirmed-sheet.tsx` |
| My bookings + detail | `booking_detail_screen.dart` | `/bookings`, `/bookings/[id]` |
| Reschedule | `reschedule_screen.dart` | `/bookings/[id]/reschedule` |
| Cancel / check in / reminders | `booking_detail_screen.dart` | `booking-actions.tsx`, `reminder-toggle.tsx` |
| Review a booking | `review_sheet.dart` | `review-sheet.tsx` |
| Saved salons | `saved_screen.dart` | `/saved` |
| Map | `map_tab.dart` | `/map` |
| Stylist profile + follow | `staff_profile_screen.dart` | `/stylist/[id]` |
| Profile + edit | `profile_screen.dart` | `/profile`, `profile-editor.tsx` |
| Notifications | `notifications_screen.dart` | `/notifications` |
| Messages | `chat_list_screen.dart`, `chat_thread_screen.dart` | `/messages`, `/messages/[id]` |
| Join a walk-in queue | `join_queue_sheet.dart` | `/q/[id]` |
| Watch your place in line | `your_turn_screen.dart` | `/queue/[entryId]` |
| Products browse (cross-salon) | `products_browse.dart` | `/?tab=products` |
| Salon shop tab | `salon_shop_tab.dart` | `salon-shop.tsx` |
| Product detail | `product_sheet.dart` | `product-sheet.tsx` |
| Cart | `cart_sheet.dart` | `/cart` |
| My orders + detail + cancel | `my_orders_screen.dart` | `/orders`, `/orders/[id]` |
| Loyalty / rewards | `my_rewards_screen.dart` | `/rewards` |
| Redemption code | `redemption_code_screen.dart` | `/rewards/[id]` |
| Sign in / sign up / guest | `email_sign_in_screen.dart`, `guest_wall.dart` | `/sign-in`, `/sign-up`, guest sheet |

### Owner (26 routes)

Calendar and today's book · booking detail and full lifecycle · walk-in queue board with
Call next · counter walk-in · services · service catalogue · staff roster and editor ·
stylist hours · salon opening hours (incl. copy-to-days) · salon profile and map pin ·
create salon · insights (all nine cards) · peak heatmap · client book and client detail ·
client notes · product orders and detail · storefront / products · offers · loyalty
settings, rewards, redemption counter, adjust points · payroll · tax estimate · plan &
billing with paywall · salon message inbox · owner notification bell · sign out.

All of `adjust_points_sheet`, `client_note_sheet`, `copy_to_days_sheet`,
`reward_edit_sheet`, `product_edit_sheet`, `queue_qr_sheet`, `paywall_sheet` and
`add_walk_in_sheet` have web equivalents. Verified individually — these were candidate
gaps until the component list was checked.

### Where web is ahead (do not "fix" back)

Five analytics cards the app comments out · the plan-upgrade request the app deleted for
App Store 3.1.1 · an owner notification feed · locked plan states four app screens don't
draw · a cart that survives a closed tab and re-prices · a redemption code that polls
instead of asking for a manual refresh.

---

## ❌ Missing features

### 1. Staff role — the whole shell — ✅ IMPLEMENTED 2026-08-06

**Shipped**, with one piece left (below). `/staff` and `/staff/schedule` now exist, and
`homeForRole('staff')` returns `/staff`.

| Built | Where |
| --- | --- |
| `fetchMyStaffMember`, `fetchStaffBookings` | `lib/api/staff.ts` |
| The gate (redirects, `cache`d single read) | `lib/staff/context.ts` |
| Shell + header, two destinations, no hamburger | `app/staff/layout.tsx`, `components/staff/{staff-nav,destinations}` |
| Bookings, segmented Upcoming/Completed/Cancelled | `app/staff/page.tsx`, `components/staff/staff-bookings.tsx` |
| Schedule — profile, read-only weekly hours, portfolio | `app/staff/schedule/page.tsx` |
| "Not linked yet" state | `components/staff/not-linked.tsx` |

Reused rather than rebuilt: `bookingTab()` (the same status→segment mapping `_tabOf` uses),
`SegmentedControl`, `OwnerBookingCard`, `Avatar`, `PhotoStrip`, `SectionHeader`,
`fetchStaffWorkingHours`, `fetchStaffPhotos`, `SignOutButton`, `isCurrent`, `DAY_NAMES`.
Two small shared-component changes, both additive: `OwnerBookingCard` gained an optional
`href` (it hard-coded a console URL a stylist cannot open), and `AppHeader`'s `COLLAPSE`
map gained an `always` entry (two destinations need no collapse tier).

**Verified against SQL, not against itself.** Signed in as the seeded
`staff@bhutansalons.test` (linked to Norzin's *Sonam Dorji*): landed on `/staff`, header
read "Sonam Dorji", segments read **Upcoming 0 · Completed 23 · Cancelled 5**. SQL over
`bookings` grouped by stylist returns Sonam 0/23/5 and Tashi 0/19/5 — so the numbers are
exactly Sonam's, **not** Norzin's salon-wide 42/10. That check could have failed and
didn't, which is what proves the `.eq("staff_member_id", …)` scope. The gate was checked
in both directions: staff → `/staff`, and an owner opening `/staff` is bounced to
`/business`. At 512px both tabs stay visible with no hamburger and no overflow.

**Still outstanding — the booking detail route.** The app opens
`BusinessBookingDetailScreen` from the staff list, with its status actions. That screen's
web equivalent is `/business/bookings/[id]`, inside the console, which `getOwnerContext`
closes to a stylist — so the cards render with `href={null}` for now. A stylist sees the
time, customer, services, total and status on the card; what they cannot yet do is open a
booking to mark it completed or no-show. `set_booking_status` would permit it
(`is_business_member` admits an active linked stylist), so this is a route to add, not a
permission to obtain.

<details>
<summary>Original gap description</summary>

**Description.** `auth_gate.dart:84` routes `profiles.role = 'staff'` to `StaffHome`
(`staff/staff_home.dart`, 267 lines). A linked stylist gets a two-tab shell:

- **Bookings** — their own appointments only, segmented Upcoming / Completed / Cancelled,
  each opening the business booking detail with its status actions.
- **Schedule** — their avatar and name, their read-only weekly working hours, and their
  portfolio photos.
- An unlinked staff account gets a *"Not linked yet — ask your manager"* state with a
  "Check again" retry.

**Web today:** nothing. `homeForRole` (`lib/auth.ts:155`) returns `/` for `staff`, so a
stylist signs in and lands on the customer Discover page with no way to see their day.
There is no `/staff` route, no `components/staff/`, and no `fetchMyStaffMember` in
`lib/api/staff.ts`.

**Reuse available:** `bookingTab()` already implements the exact status→segment mapping
`_tabOf` uses; `SegmentedControl`, `OwnerBookingCard`, `hours-editor`'s display path,
`AppHeader`, `CollapseNavPanel` and the sign-out route all exist. The read is
`staff_members` filtered on `profile_id` + `is_active`, then `bookings` with an explicit
`.eq("staff_member_id", …)` — the scope must be the explicit filter, not RLS, because
`bookings_select` OR-matches `is_business_member` and would otherwise return the whole
salon's book (this repo's most repeated bug, four instances so far).

</details>

### 2. Customer multi-service booking

**Description.** `booking_screen.dart` takes `List<ServiceItem> services` and submits
`serviceIds: _serviceIds` — a customer can book several services in one appointment, and
the sheet shows a basket. The web flow books exactly one service at a time.

**Web today:** the owner side already has this (`owner/walk-in-form.tsx` builds a
basket); the customer side does not. `AGENTS.md` names this as the real remaining gap.
`create_booking` already accepts an array, so this is client work only.

### 3. Record a payment

**Description.** `payments/record_payment_sheet.dart` records a payment against a
booking. `Api.recordPayment` → the `record_payment` RPC.

**Web today:** `fetchBookingPayments` exists (the receipt reads payments) but there is
**no writer** — zero matches for `recordPayment` anywhere in `tho_web`. Pro-gated, and no
salon is on Pro, so it raises `P0001` for every live account and has no observable case
without an admin flipping a plan.

### 4. "Recommended for you" — full list

**Description.** `RecommendedScreen` (reachable from `customer_home.dart:834`) is a
dedicated screen showing the complete ranked list, beyond the home row's first few.

**Web today:** `RecommendedRow` renders a horizontal strip with **no** `seeAllHref` —
only `NearbyRow` has one (→ `/map`). Verified in `discover-rows.tsx:178`.

**Wrinkle worth knowing:** `rank()` needs the GPS fix, which only exists client-side, so
this cannot be a plain server-rendered route the way `/saved` is.

### 5. "Top rated" — full list

**Description.** `TopRatedScreen` (reachable from `customer_home.dart:863`), the complete
rating-sorted list.

**Web today:** `TopRatedRow` (`discover-rows.tsx:293`) has no `seeAllHref` either.
Unlike Recommended, `topRated()` is a pure rating sort with no location input, so this one
is server-renderable.

### 6. First-run onboarding

**Description.** `onboarding_screen.dart` (216 lines), shown from `app_root.dart:145` when
`startup.needOnboarding` — an intro carousel before first use.

**Web today:** nothing; zero matches for "onboarding".

### 7. In-app QR scanner

**Description.** `queue/scan_screen.dart` opens a camera scanner from Discover
(`customer_home.dart:108`) to read a salon's printed queue QR.

**Web today:** no scanner. `/q/[id]` handles the *destination* and `needsScan` is mapped,
but there is no way to scan from inside the site.

---

## Deliberately not ported — valid platform reasons, verified

| App feature | Why not, and the evidence |
| --- | --- |
| `settings_screen.dart` | Two `SharedPreferences` switches (`notif_reminders`, `notif_promos`). Grepped: **the only reads and writes of both keys are inside that one file** — nothing consumes them, and the screen's own copy admits "Push notifications are not switched on yet". Porting would ship two controls that change nothing. Its two *facts* are on `/profile` as an About block. |
| Push notifications (`registerDevice`) | Deferred by decision; the in-app inbox is the channel. Delivery needs a Firebase web config and an `FCM_SERVICE_ACCOUNT` that exist for no platform yet. |
| Bottom tab bars | A thumb strip glued to the viewport is a phone idiom; replaced by one sticky header plus a collapse nav. |
| Dev quick-login chips | Deliberately not shipped to a public website. |

## False positives — candidate gaps that are dead code in the app

Both have an `Api` method and **no caller anywhere in `../tho`**, so neither is a
user-facing feature:

- **`sendOtp` / `verifyOtp`** — phone OTP sign-in. Defined at `api.dart:106-109`, called
  by nothing; the only auth screen is email.
- **`earliestSlotsFor`** — defined at `api.dart:377`, referenced only by a *comment* in
  `recommendations.dart:124`.

Implementing either would be building something the app does not offer.
