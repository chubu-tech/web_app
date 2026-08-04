<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tho — the web app

The Bhutan Salons product in a browser: customers book chairs and join walk-in
queues, owners run their salon, staff see their day. Next.js 16 (App Router),
React 19, Tailwind 4, TypeScript.

**Status: Phase 2c (queue).** Browse, sign in, book, reschedule, cancel, review, and
take a place in a walk-in line all work against the real database. Next: 2d products,
loyalty, chat, notifications, settings, map. Then owner, then staff.

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

Two places diverge from the Dart **on purpose**, both commented at the call site:

1. **Availability and opening hours are judged in Thimphu time**, not the device's
   (`recommendations.ts`, `salon-copy.ts`). The app reads `DateTime.now()` locally,
   which is sound on a phone in Bhutan and wrong in a browser that can be anywhere.
2. **A service with no recorded `gender` counts as "might suit"** (`api/discovery.ts`).
   SQL `IN` never matches NULL, and 24 of 31 live services have no gender — filtering
   strictly dropped 8 of the 10 salons that have any services at all.

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
says the page updates itself instead. When Web Push lands (2d), `QueuePositionCard` is
where the copy changes back.

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
- Seeded logins exist and are email-confirmed — `customer@bhutansalons.test` and
  friends, password in `../tho/supabase/seed.sql`. Useful for verification; the app's
  dev quick-login chips are deliberately **not** ported to the web.

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
