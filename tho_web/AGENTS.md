<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tho — the web app

The Bhutan Salons product in a browser: customers book chairs and join walk-in
queues, owners run their salon, staff see their day. Next.js 16 (App Router),
React 19, Tailwind 4, TypeScript.

**Status: Phase 2e (places and people).** Browse, sign in, book, reschedule, cancel,
review, take a place in a walk-in line, read notifications, message a salon, find a shop
on the map, read a stylist's profile and edit your own all work against the real database.
Next: **2f** products, orders and loyalty. Then owner, then staff.

The original 2d covered eight surfaces at once — about four times the size of 2c — so it
was split three ways, ordered by value per line rather than by the old sequence: the
seeded customer has 35 notifications and 3 conversations, while **one** salon sells
products and **one** runs a loyalty programme.

## This repo owns no data

The database is the **`bsalons` Supabase project**, shared with:

| Repo | What it is |
| --- | --- |
| `chubu-tech/tho` (`../tho`) | The Flutter app + **all** migrations. **The source of truth for product behaviour, tokens and copy.** |
| `chubu-tech/admin_dashboard` (`../admin`) | The internal operator console. Not part of this app; `admin` users are sent there. |
| `../landing_page` | The public marketing site. Different design language on purpose — see below. |

**Never write SQL here.** Schema changes belong in `../tho/supabase/migrations/`.
Nothing in Phase 1 needed any: all 40 non-admin `SECURITY DEFINER` RPCs are
already granted to `authenticated`.

2e is the one milestone that has needed a migration, and it went upstream where it
belongs — `20260804000001` + `20260804000002` in `../tho`, closing a privilege
escalation this app's profile editor would otherwise have been built on top of. See
**Editing a profile** below.

## Non-negotiables

- **Every write goes through an RPC.** `create_booking`, `cancel_booking`,
  `join_queue`, `place_order` and the rest authorise the caller themselves. Do
  not `.insert()`/`.update()` a table the app doesn't already write directly
  (favourites, follows, attachments).
- **The client is never the authority.** Guest limits, plan gating and role checks
  are all enforced server-side. `lib/booking-guards.ts` exists only to turn a
  rejection someone would have hit anyway into a sentence they see first — never
  treat a pass there as permission.
- **No service-role key, ever.** This app acts only as its signed-in user. That
  is the entire security model.
- **`../tho` is upstream.** Mirror it; never the reverse. When behaviour here
  disagrees with the Flutter app, the Flutter app is right.

## Auth

`/sign-in` and `/sign-up` are **routes**; the guest wall is a **sheet**. They do
different jobs and both are needed:

- A route is bookmarkable, survives a refresh, works with a password manager, and is
  where the confirmation email lands (`app/auth/confirm/route.ts`). Without one an
  existing customer could not sign in at all — `upgradeGuest` only converts an
  *anonymous* session, and this project requires email confirmation, so it cannot
  produce a signed-in user in one step.
- The sheet keeps a half-finished booking on screen. It also offers "already have an
  account", which the Flutter app has no equivalent of and which is what a returning
  customer on the web usually needs.

`?next=` is attacker-controlled, so it goes through `safeNext` (`lib/next-path.ts`)
and is reduced to a same-origin path or dropped. **Never follow it raw** — a sign-in
page that forwards anywhere is a phishing tool. Its tests are the spec.

Sign-up is customer-only until the owner console exists; an owner or staff member who
signs in lands on Discover rather than a route that isn't built.

## The account model

Three states, in `lib/auth.ts`:

- **anonymous** — no session. Reads everything RLS allows `anon`: approved
  salons, services, hours, reviews. This is what a visitor from a search result
  or a QR scan gets, and it must keep working.
- **guest** — a real *anonymous* Supabase session. Same reads, plus favourites
  and follows persist. The server refuses anything that commits them.
- **registered** — everything unlocked.

Upgrading a guest keeps the **same user id**, which is why their saved salons
survive sign-up. That is why anonymous sessions were chosen over public anon-key
reads.

**Create the guest session lazily.** `signInAnonymously()` mints a real
`auth.users` row; doing it on arrival or in `proxy.ts` would create one per
crawler hit. Call `ensureGuestSession` from the first action that needs an
identity. The Flutter app can be eager because an install is a person — the open
web is not the same problem.

Role comes from `profiles.role`, resolved **server-side** in `lib/session.ts`.
Not from a JWT claim, and not in a client component — the app had to work around
token refreshes re-firing a client-side role fetch (`auth_gate.dart:37-45`); on
the server there is no refresh to race.

Guest restrictions surface as a **dialog at the point of action**, never a
redirect. Losing someone's place mid-booking to a login page is worse than
asking in situ.

## Time

**One fixed zone: `Asia/Thimphu`, UTC+6, no DST.** `lib/time.ts` mirrors the
constant the Flutter app hardcodes and the `at time zone` comparison the RPCs do.

**Do not add a timezone library.** It would introduce DST handling the database
does not have. Matching the backend exactly matters more than generality the
product will never use.

## Design

`app/globals.css` is a one-to-one port of `../tho/app/lib/ui/tokens.dart`. Add a
token there rather than hardcoding a hex, radius or duration in a component.

Two rules that are decisions, not styling:

1. **`--color-rausch-cta` (#E00B41) for filled buttons with white text.** White on
   `--color-rausch` (#FF385C) is 3.53:1 and fails WCAG AA; the deeper hue is
   4.89:1. Using rausch for a filled CTA reintroduces a bug that was already
   fixed once.
2. **One shadow tier** (`shadow-card`). A surface has it or nothing — there are no
   progressive elevation tiers.

Stars are **always** `--color-star`, ratings only. Light mode only; there is no
dark mode in DESIGN.md and the canvas is always pure white.

**Do not borrow from `../landing_page`.** Its cream canvas and editorial type are
a deliberate marketing-only layer that the product does not use.

**Desktop is new design work**, not a port. The Flutter screens are phone-only.
`../tho/DESIGN.md:518-537` gives the breakpoints (`tablet` 744 / `desktop` 1128 /
`wide` 1440) and the rule: *always reduce columns, never reflow rows*.

## Ported logic

`lib/time.ts`, `lib/calendar-logic.ts`, `lib/booking-guards.ts`,
`lib/discover-logic.ts`, `lib/recommendations.ts`, `lib/salon-filters.ts` and
`lib/whatsapp.ts` are ports of the Dart originals, and their tests are ports of
`../tho/app/test/*_test.dart` with the same cases and expectations. **Keep them in
step**: if either platform changes a rule, both suites should change together. A
silent off-by-one in Thimphu day bounds would corrupt every calendar view.

Three places diverge from the Dart **on purpose**, all commented at the call site:

1. **Availability and opening hours are judged in Thimphu time**, not the device's
   (`recommendations.ts`, `salon-copy.ts`). The app reads `DateTime.now()` locally,
   which is sound on a phone in Bhutan and wrong in a browser that can be anywhere.
2. **A service with no recorded `gender` counts as "might suit"** (`api/discovery.ts`).
   SQL `IN` never matches NULL, and 24 of 31 live services have no gender — filtering
   strictly dropped 8 of the 10 salons that have any services at all.
3. **One plausibility guard, measured from one point** (`geo.ts`). The app has two
   150 km checks with *different* reference points — `_resolveLocation` from the Thimphu
   centre, `MapTab.effectiveCenter` from the nearest located salon — so the map can
   believe a fix Discover has already rejected, and the two then disagree about where
   you are while both say "near you". `mapCenter` takes the same `Fix` as everything
   else. The one `map_logic_test.dart` case that changes answer is pinned with its
   reason in `geo.test.ts`.

## The UI kit

`components/ui/` are ports of `../tho/app/lib/ui/widgets/` and
`customer/detail_sections.dart`. Reuse them; don't restyle a one-off.

- **Icons come from `components/ui/icons.ts`, never `lucide-react` directly.** One
  name per concept, mirroring `../tho/app/lib/ui/icons.dart` — that indirection is
  the whole point, and it's what stops `haircut` becoming three spellings.
- Sizes come from `IconSize`, chosen by the **role** a glyph plays. `md` is the
  default.
- **The type scale needs no new tokens.** `theme.dart`'s `titleMd`/`titleSm`/
  `buttonMd`/`buttonSm` differ from what's in `globals.css` only by *weight*:
  `text-title font-semibold` / `text-title font-medium` / `text-title font-medium` /
  `text-caption font-medium`. The rausch 10% tints are `bg-rausch/10`.
- `Sheet` is **not** a port: it adds Escape, a focus trap, focus restoration,
  `role="dialog"` and a scroll lock. The app's sheets and the admin console's mobile
  nav lack all of that. Build every modal on it rather than starting over.
- `SelectTile` wraps a real `<input type="radio">`, and `Chip`/`SegmentedControl`
  carry `aria-pressed`/`role="tab"`. Keep new controls real elements.
- `CoverImage` and `Avatar` fall back to a seeded gradient monogram on error. That
  is both the port of Flutter's `errorBuilder` **and** the safety net for an image
  host missing from `next.config.ts`'s `remotePatterns`.

## The nav shows only what exists

`components/customer/destinations.ts` holds all five tabs and the drawer items with
a `ready` flag. A destination appears only when its route does, so no tab ever leads
somewhere unfinished — flip the flag in the milestone that lands the route. Same rule
for links inside pages: `SpecialistCard` takes an optional `href` for exactly this
reason.

The queue is **not** a destination and should not become one: it is contextual chrome
(`InLineBar`, shown only while a place is actually held), which is what the app's
queue FAB is too. A permanent tab for something you are in for twenty minutes a month
would be a tab that is nearly always a dead end.

## Booking

- **The idempotency key belongs to the caller.** `create_booking` catches its own
  unique violation and returns the booking that key already made, so one key per
  confirm attempt held across retries makes a double-click safe — and a fresh key per
  press is exactly what produces two bookings.
- **A service and a stylist are not independent.** `compute_availability` and
  `create_booking` both require the pair in `service_staff` and raise otherwise. The
  picker only offers stylists who perform the chosen service, and `/salon/[id]/book`
  404s on a pair that isn't real. Without this, 2 of Norzin's 5 live services led to a
  slot grid that could only error — the Flutter app still has that gap.
- **Reference photos go to the private `booking-media` bucket as object *paths*,**
  never URLs, uploaded only *after* the booking exists, and read back through 1-hour
  signed URLs. `next.config.ts` must allow `/storage/v1/object/**` — not just
  `/object/public/**` — or `next/image` throws during render and takes the page with
  it.
- **The confirmation sheet stays until dismissed.** It replaced a snackbar that
  vanished while the screen was being popped. Do not regress it to a toast.
- Errors are mapped by `errcode`, not message text — see `lib/api/booking-errors.ts`.

## The walk-in queue

**Two routes, two different jobs, and their names are not interchangeable:**
`/q/<businessId>` **joins**, `/queue/<entryId>` **watches**. `/q/<id>` is the printed
QR's target and its shape is fixed by `QueueDeepLink.businessIdFrom` in `../tho`, which
parses both the custom scheme and `https://<host>/q/<id>` — one poster, both clients.
Renaming it breaks every QR already on a counter.

- **Arriving at `/q/<id>` counts as a scan** (`p_via_qr`); joining from the salon
  page's card does not. That mirrors the app's deep-link handler. A forwarded URL is
  the known weakness and the app shares it — `qr_only` is a nudge to be in the shop,
  not an attestation.
- **`p_via_qr` is always sent explicitly.** `join_queue` has two overloads and the
  4-arg one delegates with `false`; the intent belongs at the call site, not in a
  migration.
- **`queue_active_line`, never a table read.** A customer's RLS-scoped read of
  `queue_entries` returns only their own row, which makes position and ETA compute as
  "#1 · 0 min" against a one-element list. The RPC's projection is PII-free and omits
  `business_id`, so `toQueueEntry` takes a fallback — without it every row from the one
  read the live view polls fails to map, and a 200 surfaces as "check your connection".
- **`line: null` means unknown; `[]` means empty.** Keep them apart all the way to
  `QueueWaitBadge`. The RPC is revoked from `anon`, so *unknown* is the ordinary state
  for a signed-out visitor — rendering it as "0 waiting · ~0 min" advertises an instant
  walk-in on nothing but a permission error.
- **A service and a stylist ARE independent here** — the opposite of booking.
  `join_queue` only checks that each belongs to the salon; it never consults
  `service_staff`. Do not copy the booking picker's narrowing into the join form.
- **P0004 means two different things.** "Scan the shop's QR" from `join_queue`,
  "outside the check-in window" from `check_in_booking`. `lib/api/queue-errors.ts` maps
  by (RPC, code) for that reason; one shared table would be wrong half the time.
- Nothing here can *call* the next customer — that is the owner board, Phase 3. The
  salon runs its line in the Flutter app while the customer holds their place here.

**Nothing promises a notification.** The app's card says "we'll notify you"; every
`queue_your_turn` row in the outbox is `failed` with "no deliverable channel", and
`devices` has no rows, so that promise is kept by nothing on any platform. The web card
says the page updates itself instead — and 2d's inbox is now where those events actually
reach someone.

Web Push stays deferred by decision, not by difficulty: `devices` plus the existing worker
would accept an FCM **web** token with no change in `../tho`, but delivery needs a Firebase
web config and an `FCM_SERVICE_ACCOUNT` secret that do not exist. If it lands, the strings
to change are in `QueuePositionCard` and the join form's projection note.

## The inbox

**Notification copy is composed, not read out of the row.** Two systems in `../tho`
disagree about it and only one is right:

- The worker's `compose()` (`supabase/functions/process-notifications/index.ts:54`)
  switches **exactly** on `event_type` and returns a title *and* a body with the payload
  interpolated.
- The app's `notificationStyleFor()` matches **loosely** with `contains`, title only — and
  `booking_no_show` falls through to `['confirm','creat','book']`, because it contains
  **"book"**, so a missed appointment reads "Appointment confirmed!" over a green tick.

`lib/notification-copy.ts` keeps the loose chain for icon/accent/filter **with that hole
closed**, and ports `compose()` for the words. **Order in the chain is behaviour** — every
rearrangement is a change, and the tests pin the sequence.

The app also renders `payload['message']`, a key the server has never written, so its rows
show a bare title on all 35 live notifications. Compose from the payload's real fields
(`start_ts`, `points`, `balance`, `reason`) instead. That is also why there is **no
notification detail route**: the row already holds everything a detail page could show.

- **`lib/` imports nothing from `components/`.** `notificationStyle` returns an icon
  *name* from a closed union, and the list component maps it exhaustively — so a name with
  no glyph is a type error, not a blank square.
- **`fetchMyConversations` filters on `customer_profile_id`.** `conversations_select`
  OR-matches customer *or* business member, so leaning on RLS alone (as the app does) puts
  a salon's customer threads in an owner's personal inbox. `/messages/[id]` refuses a
  member for the same reason. Same correction `fetchMyActiveEntries` needed in 2c.
- **`conversations` and `messages` are written directly**, the only tables besides
  `booking_attachments` that are. Their insert policies are the authority and there is no
  RPC to route through. Both require `private.is_real_user()`, so the guest wall goes in
  front of starting a thread — never after the refusal.
- **The thread is marked read once, on open — never on the poll.**
  `mark_conversation_read` stamps `now()`, so polling it would rewrite the timestamp every
  3 seconds and the salon's side would never see a stable "last read".
- **"Now" is handed in from the server page**, not read during a client render: relative
  ages and the TODAY/YESTERDAY boundary both need it, and two renders must not disagree.
- Polling cadence lives in `usePollTick` — 3s a thread, 4s a queue place, 10s a wait badge,
  30s the nav badges. Hidden tabs don't poll; returning to one refreshes at once.

## The map

`/map` is one route with **two components and a hard boundary between them**.
`salon-map.tsx` is the only file that touches leaflet and is the only thing loaded with
`ssr: false` — `MapContainer` reads `window` while constructing. Everything else (search,
the desktop rail, the preview card) renders server-side and works while ~150 KB of map is
still arriving.

- **Leaflet owns the DOM inside a marker**, so a bubble cannot be a React component; it is
  an HTML string handed to `L.divIcon`. That is why the seeded gradient lives in
  `lib/monogram.ts` rather than inside `CoverImage` — the bubble and the card sit on the
  same screen and must agree about which gradient is Norzin.
- The cover is an `<img alt="">` layered **over** the gradient, not a `background-image`.
  A background would hide the monogram whenever it loaded; a failed `<img>` with an empty
  alt renders nothing and reveals the gradient. `CoverImage`'s `onError` behaviour with no
  JavaScript in an injected string.
- **`app/globals.css` carries the only component CSS in the project**, at the bottom:
  greyscale tiles, the bubble, the user dot. All three target DOM leaflet generates, which
  no utility class can reach.
- **Attribution is rendered and the app does not render it.** OSM's tile usage policy
  requires visible credit and rules out bulk use; a public website is exactly what it is
  written for. Real traffic needs a paid tile host, not a bigger cache.
- **Selection is derived, never reset in an effect.** `Choice` is `{ query, id }` — the
  stamp is what lets `id: null` mean "cleared by tapping the map" while still letting a new
  search fall back to the nearest, which is what `didUpdateWidget` does. Panning is the one
  effect, because it is a call into an imperative library.
- The height subtracts chrome directly (`100svh` minus the tab bar or the top nav): a
  leaflet container needs a definite height, and `main` is a flex child of a `min-h-full`
  column. While `InLineBar` is up, the map page scrolls by that bar's height — accepted, in
  writing, rather than measuring chrome at runtime for one route.

## Following a stylist

`/stylist/[id]` is a port of `staff_profile_screen.dart`, and two things about it are not
obvious from the Dart:

- **The page 404s unless the salon is visible.** `staff_select` lets `anon` read active
  staff of an `is_active` business and does **not** require `status = 'approved'`, which
  `businesses_select` does — so a *pending* salon's staff row is public while its own page
  correctly 404s. There is a live example (`Karma Lhendup` at `Highland Barbers`). Read the
  staff row, then the business, and refuse what the salon page refuses.
- **`staff_follow_summary` is a definer view**, created without `security_invoker` and
  granted to `anon`. That is the only reason a follower count exists: `follows_select` is
  `follower_profile_id = auth.uid()`, so an RLS-scoped read could only count your own. Do
  not read its sibling `business_rating_summary` as equivalent — that one *does* set
  `security_invoker=true`.
- **A guest may follow.** `follows_insert` requires no `private.is_real_user()`, so
  following sits with favouriting rather than with booking: nobody is committed, and an
  upgrade keeps the user id. No wall.
- Reviews carry **no reviewer name**, as in the app — `profiles_select` will not hand
  another customer's row over, so it is not available to ask for.

Both follow functions were written in Phase 1 against the wrong column names
(`profile_id` for `follower_profile_id`, `follower_count` for `followers`) and never
called, so nothing caught them until the button existed. Press a new write against the
live database before believing its shape.

## Editing a profile

**`profiles` is written directly, because there is no RPC** — no `update_my_profile`
exists in any migration, so `profiles_update` (`id = (select auth.uid())`) is the
authority, exactly as `messages_insert` is for a message. `lib/api/profile.ts` sends a
**four-column whitelist**: `full_name`, `phone`, `avatar_url`, `updated_at`.

That whitelist used to be the *only* thing standing anywhere. Until
`20260804000002_profiles_updatable_columns` in `../tho`, `authenticated` held table-wide
UPDATE on `profiles`, `profiles_update` constrained only the row, there was no trigger,
and `private.is_admin()` reads `profiles.role` — so **any signed-in user could
`set role = 'admin'`** and unlock 8 RLS read policies plus all 21 `admin_*` RPCs.
Demonstrated against the live database, then closed by revoking the table-wide grant and
handing back only those four columns. Two lessons worth keeping:

- **A column-level `REVOKE` cannot carve an exception out of a table-level `GRANT`.** The
  first attempt (`20260804000001`) reported success and changed nothing. Only
  `has_table_privilege` distinguishes the two states; `has_column_privilege` is true either
  way. `supabase/tests/profiles_privilege_test.sql` pins both.
- **`phone` is the SMS destination** the outbox worker looks for, and the app has no way to
  set it. Editing it here is the divergence; the honest limits are in the doc comment — the
  `auth.users → profiles` sync is one-way, and no gateway exists, so no copy promises a
  message.

**There is no `/settings`.** The app's screen is two switches nothing reads plus two facts;
the facts are an About block on `/profile` and the switches are not ported. `destinations.ts`
says so where the entry used to be.

## Uploading to the `media` bucket

Two rules, both learned by measurement rather than from the schema:

- **The caller's uid is the first path segment.** `media_auth_insert` requires
  `(storage.foldername(name))[1] = auth.uid()`, so any other layout is refused — including
  the layout the *seed* used (`avatar/<uid>.jpg`), which only worked because the seed ran
  as the service role. A path copied from live data is not proof of a legal path.
- **A fresh path per upload, never `upsert: true`.** Building 2e's avatar upload found
  that **every** upload to `media` was failing for any non-service-role user, in the
  Flutter app as well as here — `Api.uploadImage` passes `upsert: true` unconditionally,
  so avatars, covers, business photos, staff photos, service images and review photos all
  returned *403 "new row violates row-level security policy"* for paths the INSERT policy
  plainly allows.

  The cause: `20260720000001` dropped the bucket's broad SELECT policy to stop
  enumeration, reasoning that the app never calls `storage.list()`. Two write paths list
  implicitly — an upsert becomes `insert … on conflict do update`, which Postgres permits
  only when the conflicting row is *selectable*; and `remove()` resolves its prefixes
  under RLS, so with nothing selectable it deleted nothing and returned **200 with `[]`**.
  A silent no-op is why replaced photos were orphaning.

  `20260804000003_media_own_object_select` in `../tho` restores a SELECT **scoped to the
  caller's own folder** — narrower than what was dropped, so enumeration stays closed —
  and `supabase/tests/media_storage_policies_test.sql` pins both halves. `tho_web` still
  uses unique paths, because they are better than an upsert anyway: a new path is its own
  cache key, so nothing needs a `?v=`, and two writes can never race.

Measure a storage write against the live bucket before believing it. Both of these looked
correct in review, and one of them had been shipping broken for four migrations.

## The nav's rule below 744

`TABS` — the five the app has — are the **only** things in the bottom bar. `SECONDARY`
joins the top nav at ≥744 and appears as rows on `/profile` below it, which is what the
app's drawer is. Both come off `destinations.ts`, so the nav and Profile cannot disagree
about what exists.

The original flattening put `SECONDARY` in the bar too. That was right at four items and
broke the moment Chats and Notifications landed — nine destinations do not fit on a 390px
bar at a usable tap size. The **Profile tab carries a dot** when anything under it is
unread, so nothing arrives unannounced on a phone.

Badge counts come from `useInboxCounts`, client-side and polled: the shell already does
`getAccount()` and a `queue_entries` read per page, and two more server reads to render a
small number is the wrong trade. Nothing is fetched for a guest or a visitor — neither can
hold a thread or receive a notification.

## Live data is messier than it looks

Check assumptions against it before trusting a column:

- **`businesses.city` contradicts `address_text` on 8 of 13 live salons**
  ("Norzin Lam, Thimphu" filed under Paro). `addressText` is the field owners
  actually maintain; the mapper deliberately omits `city`.
- 24 of 31 services have no `gender`; 4 salons have no cover; 1 has a gallery;
  0 have offers; 0 are `home_based`/`mobile`, so the coverage-line branch has no
  live example and is covered by unit tests instead.
- Two rows named `Test 01`/`Test 2` are live and approved, so they appear in the
  catalogue. That's a data cleanup in the admin console, not something to filter out
  here.
- **Norzin lists 5 services but its stylists perform 3.** `service_staff` is the
  authority on what is bookable, not `services`.
- No salon is on **Pro** (10 basic, 3 growth), so the Pro-gated hairstyle picker never
  appears on live data. Its gate is covered by unit tests instead.
- **Only Norzin can actually run a queue.** Three salons are on Growth, but `Test 01`
  and `Zhiwaling Spa & Hair` have 0 staff and 0 services, so their join form has nothing
  to pick — it says so rather than offering an unsubmittable form. And every salon is
  `queue_join_mode = 'anywhere'`, so `queueLockState`'s `needs_scan` branch has no live
  example either; unit tests are its only coverage.
- **The inbox is the best-seeded surface in the app.** `customer@bhutansalons.test` has 35
  notifications across 9 event types with 5 unread, and 3 conversations — one of which was
  opened and never written in, which is the live example for "an empty thread is never
  unread". Two of the notifications are `booking_no_show`, the rows the app mislabels.
- **No `payments`, `offers` or `review_photos` rows exist at all**, so the receipt's
  payments block, the offers section and the review photo strip have no live example — all
  three are covered by unit tests instead.
- **11 of the 13 approved salons have coordinates.** The two without are on Discover and
  absent from the map, which is what its "once they add a location" copy is for. `Test 01`
  and `Test 2` are **6 m apart**, so their bubbles overlap at every zoom and they are the
  live example of `nearestTo`'s tie-break.
- **The specialist surfaces are the thinnest data in the product**: 21 visible staff but
  `staff_photos` has **2 rows platform-wide** and `follows` has **3**, so both empty states
  are the normal path. `Sonam Dorji` at Norzin is the only full example — 3 reviews, 1
  follower, 1 photo.
- **1 of 17 profiles has an avatar and 2 have a phone**, both seeded. The app cannot set a
  phone at all, which is why every notification fails with "no deliverable channel".
- **The local `../tho` checkout can be behind the live schema.** Two migrations were
  applied on 2026-08-03 (`register_device_rpc`, `booking_reminder_mute`) with no file in the
  local `supabase/migrations/`; they turned out to be on `origin/main`, **8 commits ahead**
  of the local `main`. Fetch before concluding that something is missing upstream — and
  note that the same fetch shows FCM push delivery, multi-service bookings and final
  pricing have landed in the app, all of which this repo mirrors and none of which it has
  yet.
- Seeded logins exist and are email-confirmed — `customer@bhutansalons.test` and
  friends, password in `../tho/supabase/seed.sql`. Useful for verification; the app's
  dev quick-login chips are deliberately **not** ported to the web.
  `owner@bhutansalons.test` owns Norzin **and** is the counterparty on the customer's
  thread, which makes it the right account to check the owner-inbox leak with.

## Verify

```bash
npm run dev
npm run build     # also typechecks
npm run lint
npm run test      # ported pure logic
```

A clean build, lint and test run is the bar. Note `overrides.typescript-eslint`
in `package.json` pins 8.65.0: upstream published a version depending on
`@typescript-eslint/utils@8.66.0`, which does not exist. Remove the pin once that
is consistent again.
