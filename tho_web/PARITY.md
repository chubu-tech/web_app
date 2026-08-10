# Feature parity — THO app (`../tho`) vs THO Web (`tho_web`)

Audited **2026-08-10** against `../tho/app/lib` (183 Dart files, `Api` with 152 methods and 5
getters) and `tho_web` (70 route entries, 559 tests across 28 files).

Supersedes the 2026-08-06 audit, which was a batch behind: between 2026-08-07 and 2026-08-09
upstream landed six commits and ~30 migrations (`20260807000002` … `20260807000036`) that
introduced a whole moderation, legal and account-deletion layer plus a staff-invite consent
handshake. Eight of that audit's rows are now wrong, and §7 lists every correction — including
two figures the audit itself got wrong before anything changed.

## The measure that does the work

Screen-by-screen matching is how the 2026-08-06 audit was built, and it is the weaker test: a
web page can look equivalent and call nothing. **The sharp test is the RPC diff** — every
`.rpc(...)` in `../tho/app/lib/data/api.dart` against every `.rpc(...)` in `tho_web/lib`. That
is what found the eleven-RPC hole the last audit opened with, and it is reproducible in one
command.

The app calls **54** distinct RPCs. `tho_web` calls **48** of them. All six of the rest are
accounted for:

| RPC | Status |
| --- | --- |
| `link_staff_member` | **Retired, correctly.** `ee413c6` replaced it with the invite handshake; it has no caller in the app either. Calling it would let an owner convert a stranger's account into their stylist without asking — the defect that commit removed. |
| `record_payment` | **A real gap, and its premise changed.** See §5. |
| `register_device` | Push notifications, deferred by decision — the in-app inbox is the channel. Delivery needs a Firebase web config and an `FCM_SERVICE_ACCOUNT` that exist for no platform. |
| `admin_content_reports`, `admin_resolve_report`, `admin_remove_reported_content` | The app ships an **in-app admin moderation queue** (`moderation/admin_reports_screen.dart`, reachable from `profile_screen.dart:192`). Not a gap here: this repo sends `admin` users to `../admin`. Worth knowing it exists, because the last audit filed all `admin_*` RPCs as "belong to `../admin`" without noticing three of them have a Flutter screen. |

Reproduce:

```bash
grep -ohE "rpc\('[a-z_]+'" ../tho/app/lib/data/api.dart | sed "s/rpc('//;s/'//" | sort -u > /tmp/app
grep -rohE 'rpc\("[a-z_]+"' lib/ | sed 's/rpc("//;s/"//' | sort -u > /tmp/web
comm -23 /tmp/app /tmp/web
```

---

## 1. Closed since 2026-08-06

Every gap the audit found. Nothing on this list is outstanding.

### Safety, consent and compliance (Batch 1)

| # | Capability | Where it lives |
| --- | --- | --- |
| M1 | Staff **invite** — send, pending state, revoke | `lib/api/staff-invites.ts`, `components/owner/staff-link-card.tsx` |
| M2 | **Accept / decline** an invite to a chair | `components/customer/staff-invite-prompt.tsx`, mounted on `app/(customer)/page.tsx` |
| M3 | **Delete your account** — typed confirm, retention disclosure | `lib/api/account.ts`, sheets on `/profile` and `/business/settings` |
| M4 | **Blocked / suspended** terminal screen and session end | `app/account/blocked/page.tsx`, the gate in `lib/session.ts` |
| M5 | **Terms gate** before a first review and a first message | `components/ui/terms-gate.tsx`, called at both write sites |
| M6 | **Report** content — all five targets | `components/ui/report-sheet.tsx`, `report-button.tsx` |
| M7 | **Block / unblock**, and a blocked-users list | `components/customer/thread-safety-menu.tsx`, `/profile/blocked` |
| M8 | Terms, Privacy, Content policy, Help | `app/(customer)/legal/{terms,privacy,content-policy}`, `/help` |
| P1 | `link_staff_member` **removed** | `lib/api/owner-setup.ts` — see the RPC table above |

**One deviation from the plan, deliberate.** The plan called for a route at `/staff/invite`.
The prompt is a component on Discover instead: a pending invite belongs where the person
already is, and a customer who has been invited has no reason to know a `/staff` URL exists.
There is no `app/staff/invite/page.tsx` and that is not an omission.

### The role gaps (Batch 2)

| # | Capability | Where |
| --- | --- | --- |
| M9 | Staff **booking detail** — complete / no-show / cancel / note / photos / call / WhatsApp | `app/staff/bookings/[id]/page.tsx`, `fetchStaffBookingById` |
| M10 | Notification **paging** past the first 100 | `lib/api/notifications.ts`, `notification-list.tsx` |
| P6 | Staff pay **prefills** what is saved | `app/business/staff/[id]/page.tsx` reads `payroll_report` |

`fetchStaffBookingById` carries an explicit `.eq("staff_member_id", …)` — the **sixth**
instance of "an OR-matched policy is never a scope". `bookings_select` admits
`is_business_member`, and `private.is_business_member` admits an active
`staff_members.profile_id`, so a linked stylist is a member of the whole salon.

`components/owner/booking-detail.tsx` is the shared body, rendered by both
`/business/bookings/[id]` and `/staff/bookings/[id]`. The old audit's "this is a route to add,
not a permission to win" was right.

### Ergonomics and list routes (Batch 3)

| # | Capability | Where |
| --- | --- | --- |
| P2 | **Inline booking actions** on the owner cards | `components/owner/inline-booking-actions.tsx` |
| P3 | **Payments ledger** on the owner booking detail | `components/owner/booking-money.tsx` |
| P4 | **Adjust points** reachable from a booking | same |
| P5 | Queue rows **link to the client record** | `components/owner/queue-board.tsx` |
| P7 | `setBusinessCategories` through the **atomic RPC** | `lib/api/owner-setup.ts` |
| M11 | **`/recommended`** | `app/(customer)/recommended`, `components/customer/recommended-list.tsx` |
| M12 | **`/top-rated`** | `app/(customer)/top-rated` |
| M13 | In-app **QR scanner** | `app/(customer)/scan`, `components/customer/qr-scanner.tsx`, `lib/queue-deep-link.ts` |

Both list routes run **the same functions unbounded** — the same `rank()` call with the same
inputs, and `topRated(businesses, businesses.length)` — rather than an approximation. That is
what makes the new `seeAllHref` links truthful, and it was verified by the first five ids on
`/recommended` matching Discover's row exactly.

**M13 carried a caveat and it still stands.** The Flutter app **disables its own scanner on
web** (`customer_home.dart:72-75`, `_explainScanUnavailable:184-230`) and says *"Scanning needs
the app"* — so before this, `tho_web` matched Flutter-web exactly. A phone camera opens
`/q/<id>` directly, so most arrivals never pass through `/scan`. It was built as decided and it
works; it is the least load-bearing thing in that batch.

Two defects surfaced while building P3, both now fixed and neither in the original audit:

- **`fetchBookingPayments` read the `payments` table directly**, and `payments_select_owner`
  is the only policy on it — so the ledger worked for the salon and returned `[]` for the
  person who had paid, silently, because the read dropped `error`. Now routed through
  `booking_payments`, which authorises the salon **or** the payer. This is the defect
  `20260807000033` exists to fix.
- **`Payment.kind` was typed against a vocabulary the CHECK forbids.** The doc comment named
  `'payment'`; the constraint allows `deposit | balance | full | refund`. Tests asserted with
  the forbidden value. Nothing caught it because `payments` has zero rows.

### Logic re-sync (Batch 3b)

The 2026-08-07 batch changed server *rules*, so ported pure logic could offer what the server
refuses. All five re-synced, each with tests, and **all five confirmed live on the database
first** (`pg_get_functiondef` over the six functions) rather than trusted from the local
checkout.

| Rule | What was out of step | Fix |
| --- | --- | --- |
| `cancellation_window` (`…032`) | The page rendered *"Free cancellation has closed"* **and a working Cancel button beneath it** — the exact defect the migration names, carried verbatim. Reschedule too. | `cancellationWindow()` in `lib/booking-guards.ts`, shared by `/bookings/[id]` and its reschedule route; both actions **disabled, not hidden**; the route refuses so the button is not URL-bypassable |
| `merge_touching_working_hours` (`…034`) | `addStretch` used `start = rows.last.endMin`, the shape that amputates the day. `bookingsOutsideHours` judged raw segments, so it would warn about bookings that fit the day once saved. | `bookableStretches()` — the SQL's gaps-and-islands merge, running maximum and all; the "+" button leaves a 60-minute break |
| `bookable_window_midnight` (`…036`) | The editor clamped a stretch's end to 23:59 **on display**, so a stored `24:00:00` showed as 23:59 and the next keystroke wrote that back. | `endInputValue` / `endMinutesFromInput` carry midnight as `00:00` losslessly, with a visible note |
| `reject_past_start` (`…035`) | No client reading; P0016 fell through to *"the slot may have just been taken"* — plausible and wrong. | `"pastStart"` in `blockForSlot`, checked first as the server checks it first; `now` passed in |
| `reminders_require_plan` (`…024`) | In step, with one inversion: `canRemind` read a **null** plan as Basic and hid a working control. | `canRemind` moved to `lib/types/booking.ts`; a null plan offers the switch and the server refuses if that guess was wrong |

`lib/api/booking-errors.ts` was missing **four** codes the app has had all along — P0013
(suspended), P0014 (idempotency mismatch), P0015, P0016 — so each rendered as its generic
fallback. The table now mirrors `bookingFailureMessage` in `booking_guards.dart`.

---

## 2. Implemented and confirmed at parity

**Customer.** Discover, shared search, all five filter facets, product filters, category chips,
offers row, nearby row, map, favourites, salon detail with all five tabs, message / WhatsApp /
call / directions / share, walk-in card, gallery, loyalty card, stylist profile and follow,
**multi-service booking** (4 steps, URL-persisted, plus an `ANY_STAFF` option the app lacks),
notes, reference photos, hairstyle, retry-safe confirm, confirmation sheet, my bookings with
segments, cancel, reschedule, check-in, reminders, receipt with deposits and outstanding,
cancellation deadline, queue join / watch / leave, deep link, shop, cart, orders, rewards,
redemption code, saved, profile edit, sign in / up / guest upgrade, notifications with filters
and mark-read, the four legal pages, report, block, blocked list, delete account, `/scan`,
`/recommended`, `/top-rated`.

**Owner.** All eleven of the app's drawer items are reachable and all five tabs are live:
calendar day / week / list with the week paywall, booking detail and the full lifecycle plus
inline actions, the payments ledger, queue board with Call next, counter walk-in, services,
catalogue, products, staff roster and editor, staff invites, stylist hours, salon opening
hours, salon profile and pin, gallery, create salon, insights with all nine cards, client book
and detail, product orders, offers, loyalty and its redemption counter, payroll, tax estimate,
plans with the upgrade request, bell, inbox, salon switcher, sign out, delete account.

**Staff.** Shell, own-bookings segments (scope proved by SQL), schedule, booking detail.

Every sheet in the app has an equivalent: `adjust_points_sheet`, `client_note_sheet`,
`copy_to_days_sheet`, `reward_edit_sheet`, `product_edit_sheet`, `queue_qr_sheet`,
`paywall_sheet`, `add_walk_in_sheet`, `report_sheet`, `block_sheet`, `delete_account_sheet`,
`staff_invite_prompt`.

---

## 3. Where the web is ahead — do not "fix" any of these back

Nine places, each because upstream removed or never built something a browser can carry.

1. **Five analytics cards.** `insights_tab.dart` comments out New vs returning, Top services,
   Staff leaderboard, Completion & no-shows and Peak hours (THO-55). `analytics_dashboard`
   returns all of it on every call, so the app pays for the data and discards it.
2. **The plan-upgrade request.** `bddb23f` deleted `Api.requestUpgrade` citing App Store
   Guideline 3.1.1. A website is bound by neither store's rules.
3. **An owner notification feed, in an owner's voice.** `booking_created` means opposite things
   to a customer and to a salon.
4. **Locked plan states four app screens don't draw.** `ClientBookScreen`, `PayrollScreen`,
   `TaxReportScreen` and `LoyaltySettingsScreen` have no plan check, so on an unentitled salon
   they call the RPC and render *"Couldn't load"* — a plan limit dressed as a network fault.
5. **A cart that outlives the tab and re-prices itself.**
6. **A redemption code that polls** instead of asking the customer to press Refresh at the till.
7. **The salon opening-hours editor** (`/business/hours`). `api.dart` reads `business_hours` in
   four places and has **no writer** — there is no `setBusinessHours` anywhere in `../tho`, so
   **neither** upstream client can edit a salon's opening hours. The 2026-08-06 audit filed
   this under "implemented parity"; it is a web-only capability.
8. **`deleteStaffPhoto`.**
9. **`fetchActiveEntryForBusiness`**, which corrects a cross-salon bug in the app's
   `myActiveQueueEntry`.

---

## 4. Deliberately not ported — reasons verified, not assumed

| App feature | Why not |
| --- | --- |
| `settings_screen.dart` | Two `SharedPreferences` switches (`notif_reminders`, `notif_promos`). The only reads and writes of both keys are inside that one file, and its own copy admits *"Push notifications are not switched on yet"*. Its two **facts** are an About block on `/profile`. |
| First-run onboarding (`onboarding_screen.dart`, 216 lines) | Declined: it would block first paint for search arrivals and QR scans, the two ways people reach a website, and bhutansalons.com already orients. |
| Promo "Claim" | Fake in Flutter — a SnackBar that persists nothing. |
| Push notifications (`register_device`) | Deferred by decision. If it lands, register through the **RPC**, never a direct `devices` insert — it deletes another profile's claim on the same token, which is what stops a resold handset receiving the previous owner's appointments. |
| The in-app admin moderation queue | `admin` users are sent to `../admin`. |
| Bottom tab bars | A thumb strip glued to the viewport is a phone idiom; replaced by one sticky header plus a collapse nav. |
| Dev quick-login chips | Not shipped to a public website. |

### Dead code in the app — building any of these would build something the app does not offer

**Eight** `Api` methods have no caller anywhere in `../tho`, transitively included:
`sendOtp`, `verifyOtp` (phone OTP; the only auth screen is email), `earliestSlotsFor`
(referenced by a *comment* in `recommendations.dart:124`), `deleteBookingPhotos`,
`myBusiness`, `setStaffActive`, `linkStaffMember` (superseded), and `analyticsPeakHeatmap`
(whose only reference is a **commented-out** line, `insights_tab.dart:88`).

---

## 5. What genuinely remains

**`record_payment` — a writer, and the reason to skip it has expired.**
`payments/record_payment_sheet.dart:50` records a payment against a booking; `tho_web` reads
payments and cannot write one. This was skipped on the grounds that it is Pro-gated with zero
rows and therefore unexercisable. **Norzin Salon & Spa is now `pro`** — one live salon, so the
editable branch has a real example for the first time. `payments` is still 0 rows, so anything
built here must create its own first row. Re-deciding this is a scoping call, not a technical
one; nothing about it is blocked.

**A1-08 — the cancellation rule is shown on no screen in the booking flow.** Upstream's own
argument for *blocking* a late cancellation rather than charging for one is that the customer is
never shown the window before committing: it first appears **after** the booking exists. On
`tho_web` that is still true — `booking-confirmed-sheet.tsx` states it at confirmation, which is
after. Not one of the five re-synced rules and not in any batch, but now that the rule bites it
is a better-founded gap than it was.

---

## 6. Live data, as of 2026-08-10

Verification depends on these, and several changed under this project.

- **17 businesses, 14 approved.** Plans across all 17: **basic 13 / growth 3 / pro 1**;
  across the approved 14: basic 10 / growth 3 / pro 1.
- **Norzin Salon & Spa is on `pro`.** It was `growth` for most of this project's life. That
  single row is the only live example on the far side of every Pro gate — `payroll_report`,
  `tax_estimate`, `set_staff_pay`, the hairstyle picker — all of which previously raised
  `P0001` for every account that existed.
- `owner@bhutansalons.test` owns **nine** salons, which is what makes the salon switcher
  load-bearing rather than theoretical.
- **`payments` is still 0 rows.** Rows created during Batch 3's verification were removed with
  the rest of that run's state; do not assume a live example exists.
- **`review_photos` has 1 row** (created 2026-08-05, by another client — the database has other
  people on it). The review photo strip is no longer without a live case.
- Still zero: `offers`, `staff_time_off`, `loyalty_redemptions`, `content_reports`,
  `user_blocks`, `staff_invites`. The whole Batch 1 moderation surface has **no live rows**, so
  its empty states are the normal path and its populated states were proved by writing and
  restoring.
- 29 profiles, 34 services, 21 active stylists, 22 reviews, 84 bookings, 11 queue entries (all
  terminal: done 9 / left 1 / no_show 1), 92 notifications, 16 `business_categories`, 74
  `business_hours`, 108 `staff_working_hours`, 2 `staff_photos`, 3 `follows`.
- `customer@bhutansalons.test`: **39 notifications, 7 unread, 3 conversations**, and four
  active bookings — three at Basic salons and one at Norzin. That split is what makes the
  reminder-toggle gate falsifiable on one page.
- **Not one day in `staff_working_hours` holds more than a single segment**, so the touching-pair
  merge rewrote nothing and governs future writes only.
- 24 of 34 services have no `gender`; `services.category` is filled on **3**; 12 of the 14
  approved salons have coordinates; 5 have no cover; `city` contradicts `address_text` on 12.
- **Nine Basic salons have two active stylists**, so the seed is over the client-side Basic cap
  and `staff_insert` has no count check.

---

## 7. Corrections to the 2026-08-06 audit

Recorded because that document was trusted while stale, and two of its errors were arithmetic
rather than drift.

1. **"137 `Api` methods" → 152** (plus 5 getters). It was already wrong at 147 when re-counted
   mid-project; the 2026-08-07 batch added the rest.
2. **"Two false positives" → eight**, not ten. The mid-project figure of ten included
   `allBusinessHours` and `allBusinessCategories`, which are **reachable** — `recommendedForYou`
   calls both, and `customer_home.dart:404` calls it. Counting callers outside `api.dart` and
   stopping there is what produced the over-count.
3. **The salon opening-hours editor** was filed under implemented parity. It is a place the web
   is ahead: `../tho` has no writer for `business_hours` at all (§3.7).
4. **"Staff booking detail is outstanding"** — shipped (M9).
5. **"Customer multi-service booking is a gap"** — it was already shipped when the audit was
   written; the web flow takes a basket and adds an `ANY_STAFF` option the app lacks.
6. **"Recommended / Top rated have no `seeAllHref`"** — both rows link to real routes now.
7. **"No in-app QR scanner"** — `/scan` exists, with the deep-link parser ported and 12 tests.
8. **"`record_payment` is unexercisable"** — Norzin is Pro (§5).
9. **The `admin_*` RPCs were filed wholesale as belonging to `../admin`.** Three of them have a
   reachable Flutter screen. The conclusion is unchanged; the reasoning was wrong.
10. **"51 routes / 27 test files / 486 tests"** → 70 route entries, 28 test files, 559 tests.
    An earlier report of "69 routes" was a miscount of the same tree.

---

## 8. Known blocker, unrelated to this work

**Every public route 500s for `anon`.** `has_table_privilege('anon', …, 'SELECT')` is **false**
for `public.businesses` **and** `public.staff_members` — the live database is missing both
grants, and the error surfaces as `42501 permission denied for table businesses`. Every other
table a public page needs (`services`, `reviews`, `review_photos`, `business_hours`,
`business_categories`, `categories`, `products`, `offers`) is granted.

Two consequences: no signed-out path can be exercised at all, and `/stylist/[id]` and the salon
page's team tab would still fail on `staff_members` after `businesses` is fixed. Earlier notes
named only `businesses`; both are missing. This needs a `GRANT` upstream — **never write SQL in
this repo.**
