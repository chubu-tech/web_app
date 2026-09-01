## Live data is messier than it looks

**Counted 2026-08-11, spot-checked 2026-08-18.** The database is shared and
has other people on it, so re-count rather than trusting a figure here that a decision depends
on. Check assumptions against it before trusting a column.

**Two figures below moved during a single hour on 2026-08-18** — `devices` 15 → 17, push sends
6 → 7 — because the app is now on real handsets and in use. For most of this repo's life the
database only changed when this repo changed it; that is over. `PARITY.md` §6 carries the
2026-08-18 counts.

- **17 businesses, 14 approved — but only 10 approved *and* active *and* not soft-deleted.** Plans
  across all 17: **basic 13 · growth 3 · pro 1**. The four `Test`-named rows are now `deleted_at`
  and inactive (one of them by `25aa9dcd` upstream, so a store reviewer could not tap into an empty
  salon), so a count of "approved" is no longer a count of what a visitor sees. Every public read
  here already filters all three columns.
- **Push notifications deliver.** 17 registered devices (14 android · 3 ios) and 7 `notifications`
  rows `sent` over the `push` channel, including a `queue_your_turn`. Several paragraphs in this
  file said push had never delivered a single message; each is corrected in place.
- **`offers` has its first row**, after being 0 platform-wide through every previous audit. The
  offers surfaces are no longer tests-only.
- **Every `notifications` row carries server-composed `title` and `body`** — 93 of 93, and the SQL
  branches on audience, so the same `booking_created` reads *"Booking confirmed / Your appointment
  is set for Fri 7 Aug, 09:00"* for the customer and *"New booking / A customer booked Fri 7 Aug,
  09:00"* for the salon. `20260807000020`/`…21` did that by trigger and backfilled. It is why
  `lib/notification-copy.ts` is a **fallback** now rather than the source — and why the note in it
  about the app rendering a `payload.message` key nothing writes describes history, not the
  present.
- **`payments` is 0 rows and that is deliberate.** Batch C's verification created a deposit and a
  refund on Norzin's no-show booking, proved both sides of the ledger, and removed them. The
  `record_payment` writer is live; the table is empty.
- **`businesses.city` contradicts `address_text` on 12 of the 14 approved salons**
  ("Norzin Lam, Thimphu" filed under Paro). `addressText` is the field owners
  actually maintain; the mapper deliberately omits `city`.
- 24 of 34 services have no `gender`; 5 approved salons have no cover; 1 has a gallery;
  **1 has an offer** (0 until 2026-08-18); 0 are `home_based`/`mobile`, so the coverage-line
  branch has no live example and is covered by unit tests instead.
- ~~Two rows named `Test 01`/`Test 2` are live and approved.~~ **All four `Test` rows are
  soft-deleted as of 2026-08-14** and no longer reach any public surface. The cleanup happened in
  the admin console, as this note asked. `PLACEHOLDER_NAME` in `lib/marketing/salons.ts` stays as
  the belt to that braces — an operator can approve anything, and the site is public.
- **Norzin lists 5 services but its stylists perform 3.** `service_staff` is the
  authority on what is bookable, not `services`.
- **One salon is on Pro** — Norzin — so the Pro-gated hairstyle picker, payroll, the tax
  estimate and staff pay all have exactly one live example each, and the locked branch is still
  what the other sixteen render. See **Exactly one salon is on Pro** above.
- **Only Norzin can actually run a queue**, and it is no longer one of the Growth salons. Three
  salons are on Growth, but `Test 01` and `Zhiwaling Spa & Hair` have 0 staff and 0 services, so
  their join form has nothing to pick — it says so rather than offering an unsubmittable form.
  And every salon is `queue_join_mode = 'anywhere'`, so `queueLockState`'s `needs_scan` branch
  has no live example either; unit tests are its only coverage.
- **The inbox is the best-seeded surface in the app.** `customer@bhutansalons.test` has **39
  notifications across 9 event types with 7 unread**, and 3 conversations — one of which was
  opened and never written in, which is the live example for "an empty thread is never
  unread". Two of the notifications are `booking_no_show`, the rows the app mislabels. The count
  grows whenever a booking is completed during verification; 92 notifications exist platform-wide.
- **`payments` is still 0 rows; `offers` has 1 as of 2026-08-18; `review_photos` has 1.** So the
  receipt's payments block still has no live example and rests on unit tests, while the offers
  section and the review photo strip each have one real row (both created by another client — see
  *The database has other people on it* below). Payments rows created during verification were
  removed with the rest of that run's state; do not assume one is there.
- **Only Norzin has a storefront, and it is unusually well seeded for it.** 4 products, one
  (`Beard Grooming Kit`) **sold out**, prices 280/320/450 so a price-range filter has three
  distinguishable values; 3 orders, one **`new`** (cancellable) and one **`ready`** (not) side by
  side, plus a third belonging to `as@gmail.com` — which is what makes the `/orders` leak check
  meaningful. `customer@` holds **20 points** against the only reward, which costs **50**, so
  `progressToNext` has a real target and *"30 more pts"* is the live state rather than a contrived
  one. Nothing about the shop needed inventing.
- **`loyalty_redemptions` starts at 0 rows and only the customer can create one.** So the owner's
  redemption counter had no live example until 2f, and its payload (`code`, `reward`) was
  unobservable — which is why `ownerNotificationText` could not use it before.
- **12 of the 14 approved salons have coordinates.** The two without are on Discover and
  absent from the map, which is what its "once they add a location" copy is for. `Test 01`
  and `Test 2` are **6 m apart**, so their bubbles overlap at every zoom and they are the
  live example of `nearestTo`'s tie-break.
- **The specialist surfaces are the thinnest data in the product**: 21 visible staff but
  `staff_photos` has **2 rows platform-wide** and `follows` has **3**, so both empty states
  are the normal path. `Sonam Dorji` at Norzin is the only full example — 3 reviews, 1
  follower, 1 photo.
- **2 of 29 profiles have an avatar and 2 have a phone.** The app cannot set a
  phone at all, which is why every notification fails with "no deliverable channel".
- **The local `../tho` checkout can drift behind the live schema.** Two migrations were applied
  on 2026-08-03 (`register_device_rpc`, `booking_reminder_mute`) before either had a file
  locally. Both are now on `main` and present, and the 9 previously-untracked files are
  committed. Fetch before concluding something is missing upstream. Of the three things that
  fetch brought, the old note here was wrong about two:
  - **Final launch pricing is already mirrored** — `lib/plans.ts` carries Nu 399 / 699 / 1,499
    and the no-free-tier rule, matching `plans_config.dart`.
  - **Multi-service bookings are mirrored on both sides now.**
    `components/owner/walk-in-form.tsx` builds a basket, and so does the customer wizard — four
    steps, URL-persisted, with an `ANY_STAFF` option the app lacks. (Not
    `add-walk-in-sheet.tsx`, which is the *queue* walk-in and single-service by design, because
    `join_queue` takes one `p_service_id`.) This bullet used to name the customer flow as the
    next slice; it shipped.
  - **FCM push is upstream and absent here**, deliberately — see the Web Push note.
- **`services.category` is filled on 3 of 34 rows**, so it cannot carry a taxonomy;
  `business_categories` has 16 rows across 9 salons and is the only populated one. Anything
  grouping services by category on live data would file everything under "Other".
- **`services_select` says nothing about the business** — it is
  `(is_active and deleted_at is null) or is_business_member(...)`, so a cross-salon
  `select services` returns services belonging to **pending and inactive** salons. Join
  `businesses!inner` and filter it. Second instance of this shape after `staff_select` on
  `/stylist/[id]`.
- **The customer's four active bookings now straddle the reminder gate** — three at Basic salons
  and one at Norzin, which is Pro. This bullet used to say the toggle had *no* live example,
  because every active booking sat on a Basic salon; it now has both answers **on one page**,
  which is what makes `canRemind` falsifiable rather than merely absent. Measured: the switch
  renders on the Norzin card only, and `set_booking_reminders(basic, true)` raises P0001 while
  muting the same booking is accepted.
- **`owner@bhutansalons.test` owns NINE salons**, not one — Norzin Salon & Spa on **pro** and
  eight on **basic**. That is a live example on both sides of every plan gate, and it is
  what makes the salon switcher load-bearing rather than theoretical.
- **Norzin now has a present as well as a past**, and this bullet used to say otherwise. 2 staff,
  5 services, 6 `business_hours` rows, and **56 bookings: completed 42 · cancelled 7 · no_show 5
  · confirmed 2**. The "0 confirmed" it reported was true when written. The owner calendar still
  has to be checked across two salons — week view unlocked on Norzin against May–June history,
  and a live day on a Basic salon where week is locked — but Norzin is no longer the salon with
  nothing live in it.
- **Sunday is how "closed" is spelled.** `business_hours` has no `is_closed` flag and no row for
  Norzin's Sunday, so `openMinutesForWeekday` returns null and `% booked` is *omitted* rather
  than shown as 0.
- **Norzin has 5 active services and only 3 are mapped to any staff.** `Blow Dry & Style` and
  `Hair Coloring` are mapped to nobody, so `compute_availability` rejects them — the live
  negative case for "the walk-in picker is deliberately not narrowed by `service_staff`".
- **The queue's live default is empty.** All **11** `queue_entries` on the platform are terminal
  (done 9 · left 1 · no_show 1) and belong to Norzin, and **not one has ever had a
  `booking_id`** — so check-in has never been exercised by anything. The two added since this was
  first written are verification entries that were run through to `done` rather than deleted.
- **`staff_time_off` has 0 rows platform-wide and no Dart file references it**, though
  `compute_availability` honours it. An owner cannot mark a holiday on any platform.
- **The money surface has exactly one live example, and it did not before.** Norzin is Pro, so
  `payroll_report`, `tax_estimate` and `set_staff_pay` succeed there and raise `P0001` on the
  other sixteen salons. `record_payment` is the exception: it still has **0 `payments` rows** and
  no writer in `tho_web`, so the ledger is read-only here and the only way to see a row is to
  create one. This bullet used to read *"No salon is on Pro… unverifiable without an admin
  flipping a plan first"* — that flip has happened.
- **Every public route 500s for `anon`, and it is a missing GRANT, not a policy.**
  `has_table_privilege('anon', …, 'SELECT')` is **false** for `public.businesses` **and**
  `public.staff_members`; it is true for `services`, `reviews`, `review_photos`, `business_hours`,
  `business_categories`, `categories`, `products` and `offers`. The error surfaces as
  `42501 permission denied for table businesses`, so earlier notes named only that one — fixing it
  alone would move the failure to `/stylist/[id]` and the salon page's team tab. **No signed-out
  path can be exercised until both are granted**, which means the anonymous account state, the
  guest wall's "before" side and the report control's guest refusal are all unverified. Needs a
  `GRANT` upstream; **never write SQL here.**
- **The database has other people on it.** During 3a's verification someone else created and
  cancelled a booking through another client, adding rows to `bookings`,
  `booking_status_events`, `booking_items` and `notifications` mid-run. Capture a `now()` marker
  before writing and scope every cleanup by it **and** by id — a count-based baseline will read
  as drift that is not yours.
- Seeded logins exist and are email-confirmed — `customer@bhutansalons.test` and
  friends, password in `../tho/supabase/seed.sql`. Useful for verification; the app's
  dev quick-login chips are deliberately **not** ported to the web.
  `owner@bhutansalons.test` is also the counterparty on the customer's thread, which makes it
  the right account to check the owner-inbox leak with in 3c.
