<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tho — the web app

The Bhutan Salons product in a browser: customers book chairs and join walk-in
queues, owners run their salon, staff see their day. Next.js 16 (App Router),
React 19, Tailwind 4, TypeScript.

**Status: Phase 3a (the owner's day).** The customer role works end to end — browse, sign
in, book, reschedule, cancel, review, take a place in a walk-in line, read notifications,
message a salon, find a shop on the map, read a stylist's profile and edit your own. And now
**an owner signs in to their own console**: today's book, the whole lifecycle of a booking,
the live walk-in board, and booking someone in at the counter.

3a is the first of three owner slices. Next: **3b** setup (services, staff, hours, the salon
profile) and **3c** the back office (insights, client book, orders, loyalty, plan). **2f** —
the customer shop — is still outstanding and now sits behind them.

The original 2d covered eight surfaces at once — about four times the size of 2c — so it
was split three ways, ordered by value per line rather than by the old sequence: the
seeded customer has 35 notifications and 3 conversations, while **one** salon sells
products and **one** runs a loyalty programme. The owner side was split the same way and for
the same reason: **16 surfaces**, so 3a took only the ones an owner touches every day.

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

Two milestones have needed a migration, and both went upstream where they belong — and both
were the same class of bug, found the same way: by being the first client to put an editor on
a table.

- `20260804000001` + `20260804000002` — **any signed-in user could make themselves an
  admin.** See **Editing a profile**.
- `20260804000004` — **any owner could put their own salon on Pro and approve it past
  review.** See **The owner console** below.

Both are worth reading before adding a write anywhere: the pattern is that RLS constrains the
*row* and says nothing about the *columns*, so a table-wide `GRANT` is the whole gate.

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

**An explicit `?next=` wins; the role picks the default.** Someone who signed in halfway
through a booking gets their booking back whatever their role — that is what `next` is for.
Only a bare `/` lets `homeForRole` decide, which is what lands an owner on `/business`. The
rule is in `landAfterAuth` *and* in `app/auth/confirm/route.ts`, because a confirmation email
is the one sign-in path that used to skip the role check entirely.

`homeForRole` now returns only routes that exist. It used to name `/business` and `/staff`
before either was built, so its one caller second-guessed it with `/?tools=app` — a parameter
nothing read, which is why the "note instead of a 404" that comment promised never rendered
and an owner silently landed on Discover. `staff` still resolves to `/` until Phase 4, and
that single line is what changes when it lands.

Sign-up stays customer-only, and now for a better reason than "it isn't built": an owner is
onboarded by an operator who creates the account *and* the salon together, and
`businesses.status` defaults to `pending` review. A self-served owner would land on a console
with no salon in it.

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
- **The owner board can now call the next customer** — `/business/queue`, added in 3a. Until
  then the salon had to run its line in the Flutter app while the customer held their place
  here, which is the hole 3a closed.

**Nothing promises a notification.** The app's card says "we'll notify you"; every
`queue_your_turn` row in the outbox is `failed` with "no deliverable channel", and
`devices` has no rows, so that promise is kept by nothing on any platform. The web card
says the page updates itself instead — and 2d's inbox is now where those events actually
reach someone.

Web Push stays deferred by decision, not by difficulty: `devices` plus the existing worker
would accept an FCM **web** token with no change in `../tho`, but delivery needs a Firebase
web config and an `FCM_SERVICE_ACCOUNT` secret that do not exist. If it lands, the strings
to change are in `QueuePositionCard` and the join form's projection note.

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

Plan gating is `lib/entitlements.ts` — **gate on a `Feature`, never a plan string.** The paywall
is informational and ends in `Close`, which is upstream's shape after App Store Guideline 3.1.1
took its CTA out. **3c puts the request back**, because a website is the channel that rule
leaves open and `plan_change_requests` still has an owner-insert policy and no writer.

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

## The nav's rule below 744, for both roles

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

**The owner shell mirrors this with two deliberate differences.**
`components/owner/destinations.ts` is a parallel module rather than one parameterised list,
because the two navs differ in more than their items: the owner header carries a salon switcher
instead of a wordmark, has no "Sign in" CTA and shows no `InLineBar`. And **the owner header
never hides** — the customer's is `hidden tablet:block`, but this one holds the switcher and the
seeded owner runs **nine** salons, so switching has to work on a phone at the till.

What they genuinely share is `lib/nav.ts`. `isCurrent` moved there in 3a with tests, because the
owner console is the first place a destination is the **prefix of a sibling** — `/business` is
the calendar and `/business/queue` is its own tab, so plain prefix matching lights both. That is
what `exact` is for, and `alsoMatches` is what keeps a parent lit on the pages it opens
(`/salon/*` for Discover, `/business/bookings/*` for the calendar) without a shared helper
hard-coding one role's paths.

**The active salon is a cookie, not `localStorage`.** The app uses
`SharedPreferences['active_business_<uid>']`, but the owner shell is a *server* component that
must know the salon before it renders a row. `tho_active_business` is `httpOnly`, and
`resolveActiveBusinessId` (ported, tested) is what stops it being trusted: a forged value naming
someone else's salon falls back to their first. RLS would refuse the rows anyway; the point is
that the console must not *appear* to have switched.

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
- **`owner@bhutansalons.test` owns NINE salons**, not one — Norzin Salon & Spa on **growth**
  and eight on **basic**. That is a live example on both sides of every plan gate, and it is
  what makes the salon switcher load-bearing rather than theoretical.
- **The growth salon has no present, only a past.** Norzin: 2 staff, 5 services, 6
  `business_hours` rows, and **52 bookings that are all terminal** (completed 42 · cancelled 5 ·
  no_show 5) — **0 confirmed**. All four of the owner's `confirmed` bookings sit on *basic*
  salons, and only one is in the future. So the owner calendar has to be checked across two
  salons: week view unlocked on Norzin against May–June history, and a live day on a basic salon
  where week is locked.
- **Sunday is how "closed" is spelled.** `business_hours` has no `is_closed` flag and no row for
  Norzin's Sunday, so `openMinutesForWeekday` returns null and `% booked` is *omitted* rather
  than shown as 0.
- **Norzin has 5 active services and only 3 are mapped to any staff.** `Blow Dry & Style` and
  `Hair Coloring` are mapped to nobody, so `compute_availability` rejects them — the live
  negative case for "the walk-in picker is deliberately not narrowed by `service_staff`".
- **The queue's live default is empty.** All 9 `queue_entries` on the platform are terminal
  (done 7 · left 1 · no_show 1) and belong to Norzin, and **not one has ever had a
  `booking_id`** — so check-in has never been exercised by anything.
- **`staff_time_off` has 0 rows platform-wide and no Dart file references it**, though
  `compute_availability` honours it. An owner cannot mark a holiday on any platform.
- **No salon is on Pro**, so `record_payment`, `payroll_report`, `tax_estimate` and
  `set_staff_pay` raise `P0001` for every account that exists. With **0 `payments` rows**, the
  whole money surface is unverifiable without an admin flipping a plan first.
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
