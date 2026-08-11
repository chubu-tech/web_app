# Feature parity — THO app (`../tho`) vs THO Web (`tho_web`)

Audited **2026-08-11** against `../tho/app/lib` and `tho_web` (71 route entries, 639 tests
across 30 files).

**Every client-facing RPC in the schema is now called.** The five the app calls and this does
not are three `admin_*`, one retired and one deferred by decision — see below.

## Twice a batch behind, and how

This document has now been wrong in the same way twice, which is worth stating before any of its
claims are trusted again.

The **2026-08-06** audit missed the 2026-08-07 batch: ~30 migrations introducing moderation,
legal, account deletion and the staff-invite handshake. The **2026-08-10** rewrite fixed that and
then missed the *next* one — two migrations and fourteen app commits dated 2026-08-08 and
2026-08-09 that reworked Discover. It opened by claiming *"the app calls 54 RPCs, tho_web calls
48, all six of the rest are accounted for"*; the real figures were 55 / 48 / **seven**, and the
unlisted seventh, `salons_available_today`, was the only client-facing RPC in the whole schema
with no web caller.

Both times the miss had the same shape: the audit window was set from the *previous* audit's date
rather than from `git log`. §7 lists every correction.

## The measure that does the work

Screen-by-screen matching is the weaker test — a web page can look equivalent and call nothing.
**The sharp test is the RPC diff**, and it is one command:

```bash
grep -ohE "rpc\('[a-z_]+'" ../tho/app/lib/data/api.dart | sed "s/rpc('//;s/'//" | sort -u > /tmp/app
grep -rohE 'rpc\("[a-z_]+"' lib/ | sed 's/rpc("//;s/"//' | sort -u > /tmp/web
comm -23 /tmp/app /tmp/web
```

The app calls **55** distinct RPCs. `tho_web` calls **50**. All five of the rest are accounted
for, and none is a gap:

| RPC | Status |
| --- | --- |
| `link_staff_member` | **Retired, correctly.** `ee413c6` replaced it with the invite handshake; it has no caller in the app either. Calling it would let an owner convert a stranger's account into their stylist without asking — the defect that commit removed. |
| `register_device` | Push notifications, deferred by decision — the in-app inbox is the channel. Delivery needs a Firebase web config and an `FCM_SERVICE_ACCOUNT` that exist for no platform. |
| `admin_content_reports`, `admin_resolve_report`, `admin_remove_reported_content` | The app ships an **in-app admin moderation queue** (`moderation/admin_reports_screen.dart`, reachable from `profile_screen.dart:192`). Not a gap here: this repo sends `admin` users to `../admin`. Worth knowing it exists, because the 2026-08-06 audit filed all `admin_*` RPCs as "belong to `../admin`" without noticing three of them have a Flutter screen. |

**`record_payment` and `salons_available_today` moved off this list on 2026-08-11** — the first
because Norzin going Pro made it exercisable, the second because it had never been noticed. Both
are §1.

---

## 1. Closed by this project

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

### The unabsorbed Discover rework (Batch A, 2026-08-11)

Two migrations and fourteen app commits from 2026-08-08/09 that **no previous audit saw**.

| # | Capability | Where it lives |
| --- | --- | --- |
| A1 | **`salons_available_today`** — one round trip for what every salon can offer today, replacing the app's abandoned N+1 (`earliestSlotsFor`: a services read, a staff read, then one `compute_availability` per stylist per salon) | `fetchSalonsAvailableToday`, `toSalonAvailability`, `SalonAvailability` |
| A2 | **"Available today"** row — next slot vs live walk-in wait, ranked on one scale, distance as tiebreak | `lib/available-today.ts` (18 tests), `AvailableTodayRow` |
| A3 | **"Book again"** — resolves a past booking against the salon's **current** menu and opens the flow at the right step, with a note when a service has gone | `lib/rebook.ts` (22 tests), `BookAgainRow`, `startRebook` |
| A4 | **`/salons`** with Nearest / Top-rated chips, replacing an expand-in-place grid that had no sort and no URL | `app/(customer)/salons/`, `AllSalonsList`, `sortedBy` |
| A5 | **Service-step gender chips**, seeded from Discover's filter through `?gender=` | `filterByGender`, `GENDER_SERVICE_KINDS` shared with `serviceGenders` |

The `queue_line` the RPC returns is deliberately **raw**, not a computed wait: the estimate comes
from the same `queueShopSummary` the join sheet uses, so a card reading *"Walk in · ~15 min"*
cannot disagree with the sheet the customer opens next. Two implementations of one estimate is
the bug that shape avoids.

`GENDER_SERVICE_KINDS` is the same correction in miniature: Discover's server-side query and the
booking step's chips were separate literals, which is exactly how they would have come to
disagree about what "Women" admits.

### Correctness and consent (Batch B, 2026-08-11)

| # | What was wrong | Fix |
| --- | --- | --- |
| B1 | **`/bookings/[id]/reschedule` had no ownership check.** `bookings_select` OR-matches business membership, so a salon member could open a customer's reschedule flow and move their appointment — and it made the detail page's disabled button bypassable by URL. The **seventh** instance of the OR-policy rule. | `notFound()` on `customerProfileId !== account.user?.id`, matching its sibling |
| B2 | Customer order notifications were dead ends behind a comment reading *"until 2f"* — which shipped. *"Your order is ready for pickup"* had nothing to press. | `/orders/[id]` |
| B3 | The stylist page's back link sent `?tab=Specialists`, a parameter **nothing reads** | `#team` |
| B4 | A product card linked to the salon root, so the customer landed above the fold and had to hunt for the shelf | `#shop` |
| B8 | **The Basic stylist cap's refusal read as "please try again"**, on an action that can never succeed. `20260807000004` made the cap a trigger; `owner-errors.ts` had no `P0001` case for `saveStaff`/`createStaff`, and the Active checkbox flipped inactive → active with no check at all. | The server's own sentence passes through; the checkbox is guarded by `otherActiveCount` |
| N1 | **The server composes notification copy now** (`20260807000020`/`…21`, by trigger, branching on audience) and `tho_web` ignored both columns, re-composing the words from a premise those migrations invalidated. Measured: all 92 rows carry `title` and `body`, and the owner voice this repo invented is already upstream. | The row's words win; the local composer is the fallback and keeps the icon/accent/filter chain, which has no server equivalent |

### The money writer (Batch C, 2026-08-11)

**`record_payment` — the last owner write in the app with no web equivalent.** Skipped through
three slices because it refuses any salon that is not `pro` and none was; Norzin is, so the
editable branch has one real example and the other sixteen salons keep the refusal path honest.
`recordPayment` + `RecordPaymentSheet`, gated on the same `deposits` entitlement the app gates
its own button on.

A refund is **entered as a positive number** and the kind carries the direction, because asking
an owner to type a minus sign to give money back is a trap the sign would be forgotten from.

Two blocks the app has and this did not: *"No payments recorded yet."* and the **retained-deposit
pill** on a no-show. `depositNu` counts deposits only, net of refunds — a balance handed over
after the cut is not no-show cover, and naming the total paid would name a figure the
entitlement has nothing to do with.

**And a real bug, which only a writer could expose.** `outstandingNu` negated a refund's amount,
but `record_payment` stores it **negative** — so a refund *increased* what the customer appeared
to have paid. Measured on the first live row: a Nu 1,200 booking with a Nu 400 deposit and a Nu
150 refund read **Outstanding Nu 650** against a signed sum of 250, so the truth was 950. Wrong
for three slices; the doc comment on `fetchBookingPayments` asserted the opposite of the truth
about `total_paid`, and the tests encoded the same wrong assumption as the code. Nothing could
catch it while `payments` had zero rows platform-wide.

Also: the insights header states its active-stylist count (`insights_tab.dart:110`), and the
calendar's List cap went 200 → 500 — the app is unbounded, so any cap is a divergence; at 500 it
is unreachable (the busiest live salon has 56 bookings) while the guard stays.

### The error and loading layer (Batch D, 2026-08-11)

**There was no `error.tsx` anywhere in the app**, and the consequence was not that failures
crashed — it was that seven list routes *avoided* crashing by catching every read into `[]` and
branching on length. **A Supabase outage rendered "No upcoming appointments — book a salon and it
will show up here" to somebody with four bookings.**

Four boundaries on one shared `ErrorState`: the customer group, the console, the staff shell, and
a root `global-error.tsx`. Three things worth knowing:

- **`unstable_retry()`, never `reset()`.** Both are handed to an `error.tsx` in Next 16 and they
  are not interchangeable: `reset()` re-renders *without re-fetching*, so it cannot recover a
  Server Component error — which is every failure this app produces. A `reset()` button would
  have been a Try-again that provably could not work. Proved by measurement: retry recovered in
  1000ms, a round trip.
- **A route group's `error.tsx` does catch**, unlike `not-found.tsx`. Verified with a
  throw-on-first-render, because this repo has been burned by the opposite —
  `app/(customer)/not-found.tsx` never rendered once, since `not-found` resolves by URL path and
  the group contributes no segment.
- **`global-error.tsx` uses inline styles and not one Tailwind class.** It replaces the root
  layout, so it arrives without the stylesheet — and a last-resort boundary that needs the
  pipeline which just broke has a shared failure mode. **Not exercised**: reaching it means
  throwing from the root layout, and the revert risk outweighed the value.

`fetchMyFavourites` needed the *reader* fixed as well: it destructured `data` and dropped
`error`, so its catch was dead code and a permission failure already rendered as "Nothing saved
yet". **Third instance of that shape** after the `payments` receipt and the `businesses` anon
grant — an empty result that is also a plausible answer.

`loading.tsx` for all three shells. Every route reads cookies, so all of them are dynamic and
none had a Suspense boundary; the skeleton primitives existed and were used only inside client
components, where the data was already in flight.

### Presentation (Batch E, 2026-08-11)

Morning / Afternoon / Evening grouping in **both** slot surfaces (`dayPartOf`, `groupByDayPart`,
in Thimphu time — A1-11 upstream: a chip labelled 22:30 must not be filed under Morning because
the viewer is six hours behind) · `noSlotsForSelection`, which distinguishes *"the day is full"*
from *"your basket needs one unbroken block"* and only suggests fewer services when there is more
than one to drop · inline **Cancel** and **Leave a review** on the booking card
(`booking_rich_card.dart:329`), extracted into two shared components so the card and the detail
page cannot drift · **View upcoming** on the empty archive · the **relative-day chip** on the
detail page, with `relativeDayLabel` moved to `lib/` and taking `now` as an argument ·
a **confetti burst** at the two peaks the app celebrates.

The celebration diverges in one place, deliberately: the app plays it when Redeem is *pressed*,
which on the web is a `router.push` that would cut the burst off mid-flight — and it would be
celebrating a request rather than a reward. It fires here when the salon **confirms**, which is
the same instant the copy flips to *"Enjoy your reward."* Only on the transition, never on a
revisit.

### What the closing sweep found (2026-08-11)

Sixty-four route entries, three roles, two passes each — all clean. Every named flow verified
against a figure computed from SQL **first**. Three things the sweep produced that the green gate
could not:

- **A bug in Batch B's own stylist cap.** On a Basic salon the Active checkbox unticked and then
  **disabled itself**, so an owner could not restore the value they had just removed without
  reloading. It affects all nine Basic salons, every one of which is already over the cap. The
  guard was reading local state only, which makes an *undo* indistinguishable from an
  *activation*; it now also requires the saved row to be inactive. Both branches were then driven
  on screen — the paywall still refuses a genuinely new active stylist, with the sentence naming
  the cap and offering *See plans*.
- **A prediction that lost to the database, correctly.** The gender-chip check was computed from
  `services` and failed: two of Norzin's five have **no active stylist in `service_staff`**, so the
  booking flow never lists them and discloses them instead. The page was right and the expectation
  was wrong. Recorded because it is the discipline working, not a near-miss.
- **A restore that the server refused.** Deactivating a stylist to reach the paywall branch could
  not be undone — `staff_members_basic_cap` blocks the reactivation, the very rule being tested.
  The way back was a momentary plan lift, since the trigger reads `businesses.plan` at write time
  and there is no trigger on `businesses`. **A write is only restorable if the inverse write is
  also legal.** Check that before making it, not after.

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

**Owner.** All **ten** of the app's drawer items are reachable and all five tabs are live:
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


**Five more, found by the 2026-08-11 sweep and in no previous list:**

10. **The app's create-salon form cannot work at all.** `Api.createBusiness` does
    `.insert(…).select().single()`, and the live `businesses_select` requires
    `status = 'approved'` on its public branch while `private.is_business_member` is `STABLE` —
    so the `RETURNING` cannot see the row being inserted and fails RLS. `createBusiness` here
    splits the insert and the read back. This changes how to read "parity" on that screen
    entirely.
11. **The paywall sheet offers a way onward.** `paywall_sheet.dart:168` ends at *"Close"*;
    `components/owner/paywall-sheet.tsx` links to `/business/plans`.
12. **Queue rows link to a client record only when one exists.** `queue_board.dart:562` pushes
    `ClientDetailScreen` for any entry with a profile id and then hides both of its sections;
    here the link appears only when the profile is in `client_book` **and** the salon has the
    feature.
13. **The printed QR works without the app.** `queue_links.dart:36` emits
    `bhutansalons://q/<id>` — a custom scheme, useless to a customer with no install. The
    console prints `https://<host>/q/<id>`, which `QueueDeepLink.businessIdFrom` also parses.
    **Consequence worth knowing: a QR printed from the app and one printed from the console are
    different codes**, and only the web one works for somebody without the app.
14. **The map pin can be placed by hand.** `business_settings_tab.dart:147` offers only *"Use my
    location"*; `pin-picker.tsx` offers tap, drag, GPS and Clear.

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

**A1-08 — the cancellation rule is shown on no screen in the booking flow.** Upstream's own
argument for *blocking* a late cancellation rather than charging for one is that the customer is
never shown the window before committing: it first appears **after** the booking exists. On
`tho_web` that is still true — `booking-confirmed-sheet.tsx` states it at confirmation, which is
after. It has never been in a batch, and now that the rule bites it is better founded than it
was: `/salon/[id]/book`'s summary rail is where it belongs, beside the price the customer is
about to commit to.

**`global-error.tsx` is unexercised.** It follows the documented shape and typechecks, but
reaching it means throwing from the root layout and that was not attempted. Know before relying
on it.

**Five surfaces still have no live example**, so their populated states rest on unit tests and on
writes that were made and then removed: `offers` (0 rows), `staff_time_off` (0 rows and no Dart
file references it — an owner cannot mark a holiday on any platform), `content_reports`,
`user_blocks` and `staff_invites`. `payments` is back to 0 by design after Batch C's verification.

Two more, found by the closing sweep and both narrower than they look:

- **`loyalty_redemptions` is 0 rows platform-wide**, so `/rewards/[id]` has no populated example
  and `RedemptionCode` — including the confetti on the confirm transition — rests on its tests. The
  route's *refusal* is swept: a missing id returns the 404 page rather than throwing.
- **"Available today" has no live walk-in example.** `salons_available_today` returns
  `queue_line: []` for every salon, so `availableLabel`'s *"Walk in · ~N min"* branch is
  tests-only. The **slot** branch is now verified end to end: Norzin's Tuesday close was moved to
  23:30 for one run, the RPC returned `next_slot 2026-08-11 12:30:00+00`, and the badge read
  **Today 18:30** — Thimphu, not the headless browser's UTC 12:30, which is the A1-11 bug the port
  exists to avoid. Hours restored to 18:00 immediately after.

**The anon grant** is §8, and it is the one thing here that cannot be fixed from this repo.

---

## 6. Live data, as of 2026-08-11

Verification depends on these, and several changed under this project.

- **17 businesses, 14 approved.** Plans across all 17: **basic 13 / growth 3 / pro 1**;
  across the approved 14: basic 10 / growth 3 / pro 1.
- **Norzin Salon & Spa is on `pro`.** It was `growth` for most of this project's life. That
  single row is the only live example on the far side of every Pro gate — `payroll_report`,
  `tax_estimate`, `set_staff_pay`, the hairstyle picker — all of which previously raised
  `P0001` for every account that existed.
- `owner@bhutansalons.test` owns **nine** salons, which is what makes the salon switcher
  load-bearing rather than theoretical.
- **`payments` is 0 rows, and now deliberately so.** Batch C's verification created a deposit and
  a refund on Norzin's no-show booking, proved the owner ledger and the customer receipt agree
  (both read Nu 950 outstanding), and removed both. The writer is live; the table is empty. Do not
  assume a live example exists.
- **All 93 `notifications` rows carry server-composed `title` and `body`**, branching on audience.
  `lib/notification-copy.ts` is a fallback, not the source.
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

## 7. Corrections

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


### To the 2026-08-10 rewrite — that is, to this document

11. **"The app calls 54 RPCs, tho_web calls 48, all six of the rest are accounted for."** It was
    55 / 48 / **seven**. The unlisted one was `salons_available_today`.
12. **The 2026-08-08/09 window was missed entirely** — two migrations and fourteen app commits.
    §1's Batch A block is what was owed.
13. **"Every sheet in the app has an equivalent"** was false while `record_payment_sheet.dart`
    had none, which §5 of the same document conceded two screens later. Both are now true.
14. **"Eleven drawer items."** Ten (`business_home.dart:190-245`). The eleventh is the sign-out
    footer, which is not a destination. `components/owner/destinations.ts` said eleven too.
15. **§2 claimed Discover was at parity.** Two of its rows did not exist.
16. **§2 claimed "my bookings with segments, cancel, reschedule"** — cancel and review existed
    only on the detail route; the list card had no actions at all until Batch E.
17. **§3 listed nine "web is ahead" places and `AGENTS.md` listed six.** Neither included the
    five now numbered 10–14, the most consequential being that the app cannot create a salon.
18. **The staff booking detail was filed as plain parity.** The app's staff view also carries the
    payments ledger and a working **Adjust points** — `adjust_points` authorises any business
    member. Deliberately **not** matched: a stylist reading a salon's payment records and moving
    a customer's points balance is broader access than the role needs. A divergence, recorded
    here rather than a gap.

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
