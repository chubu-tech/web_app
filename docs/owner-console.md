## The owner console

`/business` is a **second role-scoped shell**, not a section of the customer app.
`lib/owner/context.ts` is the one gate and the one read it shares — wrapped in React's
`cache`, so the layout's salon switcher and the page inside it resolve the same salon from a
single query.

**Role decides where you land; `owner_id` decides what you can touch.** Nothing in the console
treats `profiles.role` as permission: `private.is_business_owner(b)` is
`businesses.owner_id = auth.uid()`, every read filters on `owner_id`, and every write is an RPC
that checks `private.is_business_member` itself. `role = 'owner'` with no salon gets an honest
empty state, never a crash.

**An owner lands here; public pages stay public.** The Flutter app is a hard role switch
(`auth_gate.dart` → one shell per role, no way across) but it has no URLs. So `/` redirects an
owner to `/business` and the nav offers owner destinations only — while `/salon/<id>`,
`/q/<id>` and `/stylist/<id>` still render for them, because those are pages any anonymous
visitor can already read and an owner's own printed QR is one of them. `/` is the **only**
customer route that turns an owner away, because it is the only one they are *sent* to.

### An OR-matched policy is never a scope

The single most repeated bug in this repo, and 3a found the third and fourth instances:

| Read | Policy | What an unfiltered read returns to an owner |
| --- | --- | --- |
| `fetchMyBookings` | `customer_profile_id = auth.uid() OR is_business_member(...)` | **their salons' 78 bookings** under "My bookings" |
| `/bookings/[id]` | same | a customer's name, phone and note as if it were the owner's own appointment, with a Cancel that works |
| `fetchMyConversations` | `conversations_select` OR-matches | (fixed in 2d) |
| `fetchMyActiveEntries` | `queue_select_*` | (fixed in 2c) |

Both new ones are fixed the same way — an explicit `.eq()` and, on the detail page, the same
`notFound()` refusal `/messages/[id]` already had. **Check the policy before trusting a
`fetchMy…` name**, and pass the id in rather than leaning on RLS.

### `businesses` had the same hole `profiles` did

`authenticated` held table-wide INSERT and UPDATE on **all 35 columns** of `businesses`, no
trigger, gated only by `private.is_business_owner(id)` — which is true for your own salon. So
an owner could run `set plan = 'pro'` (every paid feature, unpaid) or `set status = 'approved'`
(listed publicly, past operator review), and `businesses_insert` checks only `owner_id`, so a
create-salon form could mint an already-approved Pro salon. Demonstrated live, then closed by
`20260804000004_business_owner_updatable_columns` in `../tho`: revoke both verbs, grant back the
21 columns an owner legitimately edits. `plan`, `status`, `is_active`, `suspended_at`, the four
review columns, `timezone` and `late_fee_amount` are out of reach; `owner_id` is insertable and
not updatable. The withheld columns' **defaults are the safe values** (`basic`, `pending`),
which is what makes an INSERT grant sufficient. 50 assertions in
`supabase/tests/business_privilege_test.sql`.

### The owner queue board

- **A direct table read, not `queue_active_line`.** That RPC is what a *customer* polls and its
  projection is PII-free by design — no name, no phone, no avatar, no `called_at` — so a board
  whose whole job is to say who is in the chair cannot be built on it. `fetchBusinessQueue`
  reads `queue_entries` and joins `profiles`, which `profiles_select` permits because a member
  may read a customer **in their queue**, not merely one who has booked.
- **`full_name` is in that join and is not in the app's.** Both clients label a row
  `customerName ?? 'Walk-in'`, but `queue_entries.customer_name` is populated *only* for a
  walk-in typed in at the counter — so the Flutter board shows **"Walk-in"** for every customer
  who joined the line themselves, avatar and phone beside the wrong name. Found by putting a
  real customer in the line and looking at the board.
- **Always send a name when adding a walk-in.** `join_queue` files an entry as anonymous only
  when the caller is a member **and** `p_name` is non-blank; with a blank name it sets
  `customer_profile_id` to the *caller*. The app's Name field is optional, so an owner who
  leaves it empty puts **themselves** in their own queue, and a second blank add raises `P0003`
  "you are already in this queue". Proved both shapes against the live RPC.
- **The board gates on `runsQueue`, not the plan.** `queueEnabled && hasFeature(plan,
  'walkInQueue')` — the app checks only the plan, so a Growth salon that switched the queue off
  still gets a live polling board with a working Call next while `join_queue` refuses its
  customers. Every live salon has `queue_enabled = true`, so the switched-off case has **no live
  example** and `lib/types/salon.test.ts` is its only coverage.
- **Polling is forced, not chosen.** The `supabase_realtime` publication contains **zero
  tables**, so a Postgres-Changes subscription would connect, succeed, and deliver nothing for
  ever. 4s, matching the app. A locked board polls nothing at all.
- Optimistic Call-next is safe **only** because `orderedFor` reproduces
  `private.queue_claim_front`'s ordering exactly — priority-then-FIFO. It is not a guess about
  which row is next; it is the same rule.
- **There is no "close the line" and no un-call.** No bulk RPC exists, `serving` can only go to
  `done`/`no_show`, and closing means `queue_enabled = false` (which blocks only *new* joins)
  plus one `set_queue_status` per row. Real gaps, not omissions.

### The booking lifecycle

`set_booking_status` accepts **only** `confirmed`, `completed` and `no_show`, and refuses any
booking already outside `pending`/`confirmed`. So a finished booking gets no buttons rather than
buttons that raise. Cancelling is its own RPC, and Undo is a third — `reconcile_booking` is the
only call with **no transition validation**, which is exactly why it can put a terminal booking
back and why nothing else uses it.

**`pending` is unreachable on this platform.** `create_booking` hard-codes `'confirmed'` and
there are zero `pending` rows, so the Confirm button is ported because the app has it and the
enum allows it — but the only way to reach it is `reconcile_booking`. Do not go looking for the
bug that "Confirm never shows".

**Completing a booking is not a display change.** `handle_booking_status_event` awards loyalty
points (growth/pro, deduped by a unique index) and queues a review request; `no_show` and
`cancelled` cancel pending reminders. Verified by reading the ledger, not the pill.

### Two divergences worth knowing

- **`/business` is the Calendar, not Insights.** The app's tab 0 is Insights because a phone
  shell needs a landing tab; an owner opening a browser at nine wants the day. Insights takes
  `/business/insights` in 3c and this stays the calendar.
- **The selected day, view and list segment live in the URL.** The app loses all three on a tab
  switch; here `?d=&view=&seg=` is reloadable, shareable and back-button-correct.
  `salon-filters.ts`'s `fromParams`/`toParams` is the pattern.

Plan gating is `lib/entitlements.ts` — **gate on a `Feature`, never a plan string.** Prices and
per-feature paywall copy live in `lib/plans.ts`, the one place pricing exists, so the sheet and
`/business/plans` cannot quote different numbers at the same owner. The sheet stays an explanation
and points at the price list; the **request** lives on `/business/plans`, where the tiers are side
by side (see `components/owner/plan-cards.tsx` for the 3.1.1 story and the three things the
request has to get right).

**Those two files are a published claim, so re-check them against `entitlements.dart` when the app
moves.** They went four days out of step in August 2026 in the worst direction: `Feature.priorityPlacement`
was deleted upstream as a claim with no implementation behind it (audit A3-04 — nothing ever called
`has()` on it, and there is no plan term in the recommender), and **this repo went on selling
"Priority placement"** in the console's paywall *and* on `/for-salons`, which renders `PLAN_TIERS`
bullets on an indexable page. A build, a lint and 639 green tests did not notice, because nothing
asserted what the tier sets *contain*. `lib/entitlements.test.ts` now does, in both directions —
including that no feature exists here which the app does not have.

Two consequences worth keeping:

- **A feature list is not documentation, it is a price.** Payment is off-app and an operator flips
  `businesses.plan`, so there is no refund path; a wrong bullet is a wrong charge.
- **`lib/plans.ts` deliberately diverges from `plans_config.dart` in one label.** The app's Pro card
  still says "Deposits & no-show cover"; no-show cover is not built (`late_fee_amount` defaults to 0
  and is referenced by no function), so this says "Deposits & payments on a booking". Divergences
  from upstream copy are normally forbidden — this one is documented at the call site because the
  alternative is publishing something untrue.

**Not every gate is real, and this paragraph was wrong about which.** It used to say the Insights
paywall was client-side only, on the measured grounds that `analytics_dashboard` and
`analytics_peak_heatmap` never read `businesses.plan`. **`20260807000005_analytics_plan_gate`
added that read to both** — in the very batch Phase 5 absorbed — so they now raise `P0001` below
growth in the same auth → authz → plan order every sibling uses. No client change was needed
(`app/business/insights/page.tsx` skips the call on Basic anyway), but do not repeat the old
claim.

So: **five of the six locked surfaces are gated in SQL** — `client_book`, `payroll_report`,
`tax_estimate` and now both analytics RPCs. The remaining one is **Loyalty, and only partly**:
`loyalty_programs_write_owner` checks ownership and stops, and `loyalty_programs_select_public`
publishes any active program regardless of tier — but the feature *is* gated at the point of use,
because `request_redemption` refuses unless the programme is active **and** the plan is
growth/pro (`20260729000003_loyalty_rpcs.sql:88`). A customer cannot redeem at a Basic salon.

The upstream batch added four more server-side gates, all following the same pattern and none with
a surface here yet: `upsert_promo_code` / `expire_promo_code` / `record_order_payment` /
`product_analytics` re-check growth+, and the seven pack RPCs re-derive `businesses.plan = 'pro'`.
The rule they all confirm is the one this section exists for: **the client check is never the
gate**, so a locked surface is safe to *draw* wrong and never safe to *rely* on.

### `staff_members` had it too — the third instance

Same shape a third time (3b): table-wide INSERT and UPDATE on all 12 columns, gated only by
`is_business_owner`. Two RPCs exist to control two of those columns and both were bypassable —
`set_staff_pay` refuses any salon that is not `pro` ("payroll requires Pro"), and
`link_staff_member` requires an email that resolves to a real `auth.users` row and sets
`profiles.role = 'staff'`. Demonstrated live on a **growth** salon: the direct writes landed
while the RPC refused the same pay in the same session. `profile_id` is the worse of the two —
`is_business_member` admits an active `staff_members.profile_id`, so writing it hands a third
party read access to every booking and phone number in the salon.

Closed by `20260805000001_staff_owner_updatable_columns`: UPDATE is `display_name`, `is_active`,
`photo_url`, `updated_at` and nothing else; INSERT adds `business_id` and `role` because
`Api.createStaff` names them. 35 assertions in `supabase/tests/staff_privilege_test.sql`.

**Three tables, one lesson: RLS constrains the row, never the column.** Before putting a form
on a table, check `has_table_privilege` — not `has_column_privilege`, which answers true either
way while the table-level grant is held.
