<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tho — the web app

The Bhutan Salons product in a browser: customers book chairs and join walk-in
queues, owners run their salon, staff see their day. Next.js 16 (App Router),
React 19, Tailwind 4, TypeScript.

**Status: all three roles complete, and current with `../tho` as of 2026-08-10.** The
customer role works end to end — browse, sign in, book, reschedule, cancel, review, take a place in
a walk-in line, read notifications, message a salon, find a shop on the map, read a stylist's
profile, edit your own, and now **buy things**: a cross-salon products browse, a salon's Shop tab, a
cart that survives a closed tab and re-prices itself against the shelf, a cash-on-collection order
with tracking and cancel, and loyalty from points to a redemption code that flips to *"Enjoy your
reward"* the moment the till confirms it. An owner signs in to a console that covers the whole of
the app's owner side:
today's book, the booking lifecycle, the live walk-in board and the counter walk-in (3a);
services, the catalogue, the team, stylist hours, the salon's opening hours, its profile and map
pin, and creating a salon (3b); and the back office — **insights with all nine cards**, the client
book, product orders, the storefront, offers, loyalty and its redemption counter, the salon's
message inbox and notification bell, payroll, the tax estimate, and plan & billing **with the
upgrade request put back** (3c).

**All five owner tabs are live and nothing is left of the app's eleven-item drawer.** 2f closed the
other end of what 3c reads: `place_order` and `request_redemption` were the last two customer-facing
RPCs in the schema with no caller here, and Norzin's storefront, order inbox and loyalty programme
now all have a customer on the far side of them.

**Phase 4 is done: the staff role is complete.** `/staff`, `/staff/schedule` and
`/staff/bookings/[id]` are all three destinations the app has, and `homeForRole('staff')`
returns a route that exists — before this, a linked stylist signed in and landed on customer
Discover with no way to reach their own book at all. `lib/staff/context.ts` is the gate (a
deliberate sibling of `lib/owner/context.ts`, not a parameterisation of it), and the scope is an
explicit `.eq("staff_member_id", …)` in **both** `fetchStaffBookings` and
`fetchStaffBookingById` — the **fifth and sixth** instances of the OR-policy leak, since
`bookings_select` admits `is_business_member` and a linked stylist is one. Proved by SQL: the
shell shows Sonam Dorji's 0/23/5, not Norzin's salon-wide 42/10.

The booking detail is a **shared body**, not a second implementation:
`components/owner/booking-detail.tsx` takes `{ booking, photoUrls, back, afterBill }` and is
rendered by `/business/bookings/[id]` and `/staff/bookings/[id]` alike. The console route was
never reachable by a stylist (`getOwnerContext` closes it), which is why this needed a route
rather than a permission.

**Phase 5 closed the 2026-08-07 upstream batch** — moderation, legal, account deletion, the
staff-invite consent handshake, the role gaps, the ergonomics gaps, and a re-sync of ported
logic against five changed server rules. `PARITY.md` is the audit: what shipped, what is
deliberately not ported, and the two things that genuinely remain.

Two shared components took additive changes for this and are worth knowing about:
`OwnerBookingCard` takes an optional `href` (it hard-coded a console URL), and `AppHeader`'s
`COLLAPSE` map has an `always` tier, because two destinations have nothing to collapse.

### Where the web is now ahead of the app

Six places, each because upstream removed or never built something a browser can carry. Do not
"fix" any of them back:

1. **Five analytics cards.** `insights_tab.dart` comments out New vs returning, Top services,
   Staff leaderboard, Completion & no-shows and Peak hours (THO-55), calling them *"working
   features expected back"*. `analytics_dashboard` returns all of that data on **every** call and
   `analytics_peak_heatmap`'s only reference in `../tho` is a **commented-out** line
   (`insights_tab.dart:88`), so the app pays for the payload and discards it while `tho_web` is
   the only client that draws the heatmap.
2. **The upgrade request.** `bddb23f` deleted `Api.requestUpgrade` and the paywall CTA citing App
   Store Guideline 3.1.1. A website is bound by neither store's rules;
   `plan_change_requests` had no writer at all. See `components/owner/plan-cards.tsx`.
3. **An owner notification feed and an owner voice for it.** `lib/notification-copy.ts` now has
   two copy tables chosen by audience, because `booking_created` means opposite things to a
   customer and to a salon.
4. **Locked states four screens don't draw.** `ClientBookScreen`, `PayrollScreen`,
   `TaxReportScreen` and `LoyaltySettingsScreen` have no plan check, so on an unentitled salon
   they call the RPC and render *"Couldn't load"* — a plan limit dressed as a network fault.
5. **A cart that outlives the tab, and re-prices itself.** `CartController` is an in-memory
   `ChangeNotifier` that dies with the app; a browser tab closes far more casually, so this one
   persists — and therefore has to reconcile with the shelf before it shows a total. See
   **The cart is persistent, so it must re-price** below.
6. **A redemption code that updates itself.** `RedemptionCodeScreen` makes the customer press
   *"Refresh status"* while standing at the till; this polls, so the screen changes by itself the
   moment somebody behind the counter confirms it. Measured at one poll interval on live data.

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

Three milestones have needed a migration, all went upstream where they belong, and all three
were the **same class of bug**, found the same way: by being the first client to put an editor on
a table.

- `20260804000001` + `20260804000002` — **any signed-in user could make themselves an
  admin.** See **Editing a profile**.
- `20260804000004` — **any owner could put their own salon on Pro and approve it past
  review.** See **The owner console** below.
- `20260805000001` — **any owner could set payroll their plan does not include, and attach any
  account as staff of their salon.** See **`staff_members` had it too**.

Read one of them before adding a write anywhere: RLS constrains the *row* and says nothing about
the *columns*, so a table-wide `GRANT` is the whole gate. And check `has_table_privilege`, not
`has_column_privilege` — the latter answers true either way while the table grant is held.

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

`app/globals.css` ports `../tho/app/lib/ui/tokens.dart` for colour, radii and motion. Add a
token there rather than hardcoding a hex, radius or duration in a component.

**The type scale is no longer that port**, and deliberately so. `theme.dart`'s `AppText` is
14px titles, 12px secondary text, 11px captions and leading from 1.18 to 1.29 — the numbers
THO-57 arrived at for a phone at arm's length, and the wrong numbers for a browser window.
The web scale is 16px prose at 1.6, a 15px UI voice, 13px captions and per-step tracking;
`--text-badge` is the one step that held its size. Same class of divergence as the
breakpoints and the editorial canvas: the Flutter screens are phone-only, so their metrics
are not the web's. All 762 call sites resolve through the ten tokens, so the scale exists in
exactly one place and re-tuning it changes no class strings.

Two rules that are decisions, not styling:

1. **`--color-rausch-cta` (#E00B41) for filled buttons with white text.** White on
   `--color-rausch` (#FF385C) is 3.53:1 and fails WCAG AA; the deeper hue is
   4.89:1. Using rausch for a filled CTA reintroduces a bug that was already
   fixed once.
2. **One shadow tier** (`shadow-card`). A surface has it or nothing — there are no
   progressive elevation tiers.

Stars are **always** `--color-star`, ratings only. Light mode only; there is no
dark mode in DESIGN.md and the canvas is always pure white.

### Two token systems, one file, and a rule

This used to say *"do not borrow from `../landing_page`"*. **That changed deliberately, for the
customer side only.** The 25 customer routes render in the marketing site's editorial layer —
cream `#f6f3ee` canvas, slab radii — so a visitor arriving from the marketing site sees one
continuous product. The 26 owner routes keep the product tokens, because a dense operational
console loses legibility on an editorial canvas.

**The typeface is no longer part of that split.** Both shells are Inter, and so are
`../landing_page` and the Flutter app, so the only thing `[data-shell="customer"]` still
decides is colour. What the two shells disagree about is the canvas, not the letters.

The mechanism is a scoped variable override: `[data-shell="customer"]` on the customer group's
wrapper re-points three variables, and because **every generated colour utility resolves through
`var()`** (verified in the compiled stylesheet: `.bg-canvas { background-color:
var(--color-canvas) }`) that re-skins 86 call sites — 62 customer, **24 in the shared
`components/ui` kit** — with no class strings changed, and the kit adapts to whichever shell
renders it. Three traps, all load-bearing:

- **`--font-sans` is the typeface, and it is deliberately NOT in this scope.** This bullet
  used to say the opposite — *"`font-family`, not `--font-sans`"* — because the scope block
  set DM Sans directly. Preflight declares `font-family: var(--default-font-family)` on
  `html, :host` **only**, and that resolves `--font-sans` at `:root`, so a descendant
  override does nothing. The old note read that correctly and drew the wrong conclusion:
  it made the typeface a property of one shell, which is why the console spent its whole
  life on the visitor's OS font. `--font-sans` is now set in `@theme` and reaches every
  route; this scope is colour only.
- **`body:has([data-shell="customer"])` is what makes the viewport cream**, because
  `body { background: var(--color-canvas) }` resolves the variable *on body*. Without it iOS
  overscroll shows white.
- **Never `@theme inline`.** It substitutes declared values into utilities instead of `var()`,
  which would make the whole scope block a silent no-op.

> **The rule for adding a token:** override a shared name only when both shells mean the same
> *role* and differ only in *value*. When they mean different *sizes*, add a new name.

`--radius-slab` versus `--radius-md` is the live example: 2rem and 14px are different
*sizes*, not one value in two flavours, so they are two names and each element opts into the
one it wants.

The rule also settled an argument that no longer exists. There used to be four
`--text-editorial-*` clamps here, kept out of `--text-display-*` because the latter was a
19px section title in the product and a 30–48px headline on the marketing site — genuinely
different roles, so genuinely different names. Both sides of that are gone: the editorial
clamps were never referenced by any component, and the product scale has been rebuilt for
the web. The rule stands; that illustration of it does not.

Also: `@theme` output is **usage-pruned**. A token no utility and no rule references is not
emitted at all, which is why the chrome heights live outside it.

**A comment is not invisible to Tailwind, and neither is this file.** The scanner is
content-based and does not parse JS or Markdown — it matches candidates in *any* non-ignored
source, so a class-shaped string in prose gets compiled. A `pb-` arbitrary value wrapping
`env(` + an ellipsis + `)` — written in a doc comment as shorthand for the real utility —
generated an invalid rule and took the dev server down with *"Unexpected token Delim('.')"*,
while `npm run build` passed.

It happened **twice**: first in `chat-thread.tsx`, then in the sentence you are reading, which
described the hazard by quoting it and so reproduced it. Two rules, not one:

- Keep bracket utilities out of code comments.
- In prose, never write a utility prefix immediately followed by `[`. Describe the shape in
  words, as above, or quote only the part inside the brackets. An ellipsis is not a safe
  placeholder — `.` is what the CSS parser chokes on.

**A route group is not a `not-found` boundary.** Layouts resolve *through* route groups;
`not-found.tsx` resolves by **URL path**, and `(customer)` contributes no path segment. So
`app/(customer)/not-found.tsx` never rendered once — for `/salon/[id]` the boundary lookup
walks `app` → `salon` → `[id]`, skips the group, finds nothing, and falls back to Next's
built-in page. It was written, it looked right, and it was dead code. The RSC payload is what
proved it, naming `"pagePath":"__next_builtin__not-found.js"` with an inline `system-ui` stack
and `background:#fff`.

The 404s therefore live at **`app/not-found.tsx`** (root) and **`app/business/not-found.tsx`**
(`business` *is* a real segment, so that one resolves normally and renders inside
`OwnerLayout`, keeping the console's chrome). Two consequences worth knowing:

- The root boundary renders in `app/layout.tsx` **only** — the `(customer)` layout is not in
  the tree, so it carries its own `data-shell="customer"` wrapper and wordmark. Without them a
  404 is a dead end with no navigation.
- **Only a root boundary can answer an unmatched URL**, which has no segment to look up — and
  on a website that is the *common* 404, not the rare one.

Do not verify a `notFound()` page with `curl`: Next ships it as a client-rendered error
fallback, so the markup is in the RSC payload and `data-shell` appears only as escaped
`data-shell\":\"customer\"` until React hydrates. The computed style of the live DOM is the
only honest check.

**Inter, on every route — and it took two tries to get there.** The first attempt declared
`--font-inter` in `app/layout.tsx` with a comment claiming `globals.css` owned the stack;
nothing referenced the variable, so `--default-font-family` resolved to Tailwind's system
stack and **tho_web rendered in the OS font on all 51 routes**. That loader was deleted,
DM Sans was added, and it was applied in the `[data-shell="customer"]` block — which fixed
the 25 customer routes and left the 26 console routes exactly where they were.

Both failures are the same failure: the typeface was never set where the cascade actually
reads it. `--font-sans` in `@theme` is that place, because it resolves at `:root`, the same
element `inter.variable` lands on. Two consequences worth keeping:

- **Never set `font-family` in a shell scope again.** It looks like it works, because the
  shell you are testing goes right.
- **If `inter.variable` ever moves off `<html>`** onto a layout's `<div>`, `--font-sans`
  resolves to nothing at `:root` and the whole app falls back to the system stack — the
  original bug, silently. Measure `getComputedStyle(document.documentElement).fontFamily`
  on a console route, not a customer one.

Bricolage Grotesque and Instrument Serif went with the rewrite. `--font-display`,
`--font-serif` and the four `--text-editorial-*` clamps were declared and **no component
ever referenced any of them**, so two webfonts were loading for call sites that never
existed.

**Desktop is new design work**, not a port. The Flutter screens are phone-only.
`../tho/DESIGN.md:518-537` gives the breakpoints (`tablet` 744 / `desktop` 1128 /
`wide` 1440) and the rule: *always reduce columns, never reflow rows*.

## Ported logic

`lib/time.ts`, `lib/calendar-logic.ts`, `lib/booking-guards.ts`,
`lib/discover-logic.ts`, `lib/recommendations.ts`, `lib/salon-filters.ts`, `lib/hours.ts` and
`lib/whatsapp.ts` are ports of the Dart originals, and their tests are ports of
`../tho/app/test/*_test.dart` with the same cases and expectations. **Keep them in
step**: if either platform changes a rule, both suites should change together. A
silent off-by-one in Thimphu day bounds would corrupt every calendar view.

Four places diverge from the Dart **on purpose**, all commented at the call site:

1. **Availability and opening hours are judged in Thimphu time**, not the device's
   (`recommendations.ts`, `salon-copy.ts`). The app reads `DateTime.now()` locally,
   which is sound on a phone in Bhutan and wrong in a browser that can be anywhere.
2. **A service with no recorded `gender` counts as "might suit"** (`api/discovery.ts`).
   SQL `IN` never matches NULL, and 24 of 31 live services have no gender — filtering
   strictly dropped 8 of the 10 salons that have any services at all.
3. **`lib/hours.ts` is 24-hour**, where `hours_model.dart` has `formatMinutes12` ("8:30 am")
   for the design mock. Every time in `tho_web` is `HH:MM`, and `<input type="time">` — which
   replaces Flutter's `showTimePicker` — reads and writes 24-hour, so a gap pill saying "1:00 pm"
   beside an input saying "13:00" would be worse than diverging from the mock. The three
   affected test cases port as 24-hour equivalents, including the 1440 boundary.
4. **One plausibility guard, measured from one point** (`geo.ts`). The app has two
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

2f flipped the last two flags — `/orders` and `/rewards`, both in `SECONDARY`, so they join the top
nav at ≥744 and appear as rows on `/profile` below it. **Every customer destination now exists.**
The **cart** is deliberately not one: like the queue it is contextual chrome (`CartBar`, shown only
while something is actually in it), and a permanent tab for an empty cart would be a tab that is
nearly always a dead end. It is a **route** rather than a sheet, though — the third time this app
has made that call — because a cart must survive a reload and a back button.

The queue is **not** a destination and should not become one: it is contextual chrome
(`InLineBar`, shown only while a place is actually held), which is what the app's
queue FAB is too. A permanent tab for something you are in for twenty minutes a month
would be a tab that is nearly always a dead end.

`components/owner/destinations.ts` is the same idea for the console, and after 3c **all five tabs
are live**: Insights · Calendar · Queue · Messages · Settings, the app's own set in the app's own
order.

Settings is a **hub with two groups**, which is where the whole of the app's eleven-item drawer
went: `SETUP_DESTINATIONS` (Salon details, Opening hours, Services, Staff) and
`BACK_OFFICE_DESTINATIONS` (Client book, Product orders, Products, Offers, Loyalty, Payroll, Tax
estimate, Plan & billing). Two groups rather than one list of twelve because they answer different
questions: setup is what you finish once, the back office is what you come back to. Every row
carries the live state of what it leads to — *"1 new order"*, *"4 products · 1 sold out"*,
*"Growth · 3 requests pending"* — and a locked row states the tier instead of a count, and is not
fetched at all.

**The phone bar carries four of the five.** `phoneOwnerTabs()` drops Settings, which moves to a
gear beside the bell in the header: five fixed items at 390px leaves each 78px, which is where
"Calendar" starts truncating. The desktop header keeps all five.

`alsoMatches` keeps a tab lit on every sub-route, and note which parent each one belongs to —
Payroll and Tax light **Insights**, not Settings, because reading a report is the same job as
reading the trends; they are only listed under Settings because that is where the list of them
lives.

Adding a walk-in is deliberately not a destination in either client: it is something you do *to*
a day, and it is reached from the calendar.

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
- Errors are mapped by `errcode`, not message text — see `lib/api/booking-errors.ts`. The table
  mirrors `bookingFailureMessage` in `../tho/app/lib/customer/booking_guards.dart`; keep them in
  step, because a code that is only in one of them renders as a generic fallback in the other.

### Five server rules the client has to agree with

The 2026-08-07 batch changed *rules*, not just schema, so ported pure logic could offer what the
server refuses. All five were out of step here and all five are re-synced, each with tests. **The
five function bodies were read off the live database first** (`pg_get_functiondef`) — the local
`../tho` checkout drifts in both directions, and wiring a client to a rule that is not deployed
is the mirror image of the bug being fixed.

- **P0015 — the cancellation window closes self-service.** `businesses.cancellation_window_hours`
  was enforced *nowhere* before `20260807000032`; both clients rendered *"Free cancellation has
  closed for this booking"* and put a **working Cancel button directly beneath it**. Now
  `cancel_booking` *and* `reschedule_booking` refuse — and for reschedule the window is measured
  against the **current** start, the commitment being broken, not the new one. `cancellationWindow`
  in `lib/booking-guards.ts` is the one client reading, shared by `/bookings/[id]` and its
  reschedule route so they cannot disagree, and it **fails open** on a salon that would not load
  because disabling on a failed read would strand somebody who could legitimately cancel. Both
  actions are **disabled, not hidden**: a control that vanishes reads as a bug, and the note above
  it is what turns a dead button into an explanation. Check-in stays available — turning up is
  exactly what somebody inside the window should do.
- **P0016 — a start that has already passed.** `create_booking` and `reschedule_booking` both
  accepted a past start until `20260807000035`; only `compute_availability` ever filtered. A salon
  member is **exempt**, because back-filling this morning's walk-in at lunchtime is ordinary shop
  work. `blockForSlot` checks it **first**, as the server does: told "you already have a booking
  that day", somebody cancels it and then finds the slot was never available.
- **Touching working-hours stretches are one stretch.** `is_bookable_window` needs a booking to
  fit inside **one** row, so `09:00–18:00` + `18:00–19:00` is not a 9-to-7 day — and the owner's
  own "+" button used to create exactly that. `bookableStretches` in `lib/hours.ts` ports the
  SQL's gaps-and-islands merge, and the **running maximum** is the part that matters: comparing
  with the previous row's end gets the two-segment case right and a nested one wrong. A strict gap
  survives, which is the whole lunch mechanism.
- **A day can close at midnight.** `24:00:00` is a valid Postgres `time` and `hmsFromMinutes(1440)`
  writes it, but `<input type="time">` cannot hold it. The editor used to clamp the *display* to
  23:59 and write that back — one minute, and it is the minute that stops a 22:30–24:00 booking
  fitting. The end field carries midnight as `00:00` (`endInputValue` / `endMinutesFromInput`) with
  a visible note, because a convention nobody states is a trap.
- **Reminders are Growth+ and the server says so now.** `set_booking_reminders` raises P0001 when
  *enabling* at a salon whose plan does not send reminders; muting is allowed at every plan,
  because only the promise is gated, never the withdrawal of one. `canRemind`
  (`lib/types/booking.ts`) hides the switch — and a **null** plan offers it, because null means
  "the query did not embed one", not "Basic". `hasFeature` maps null to `basic` and would hide a
  working control.

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

Web Push stays deferred **by decision** — the in-app inbox is the channel this app offers —
and that decision is now the only thing keeping it out, because the mechanism upstream is
done: the app carries `firebase_messaging`, registers tokens through `register_device`, and
`pushPlatformFor` already returns `'web'` for a browser, which `devices.platform` accepts. So
a web token would be accepted with **no change in `../tho`**; delivery needs a Firebase web
config and an `FCM_SERVICE_ACCOUNT` secret that exist for **no** platform yet. If it lands,
register through the **`register_device` RPC**, never a direct `devices` insert — it deletes
another profile's claim on the same token, which the client cannot do and which is what stops
a resold handset receiving the previous owner's appointments. The strings to change are in
`QueuePositionCard` and the join form's projection note.

### Reminders are real now, and the toggle is ported

`20260803000003_booking_reminder_mute` added `bookings.reminders_muted` and
`set_booking_reminders`. Until then the app's "Remind me" switch wrote
`reminder_<bookingId>` to `SharedPreferences` and **nothing read it back**, which is why this
repo declined to port it. That rationale is gone: the column is server-owned, and every
reminder branch of `handle_booking_status_event` routes through
`private.enqueue_booking_reminders`, which returns early on it — so the mute cannot be
bypassed and it survives a reschedule, the regression the migration exists for.

Three things to get right, all measured against the live RPC:

- **The polarity is inverted.** The RPC takes `p_enabled`; the column stores
  `reminders_muted = not p_enabled`. Passing the column straight through compiles, runs, and
  means the opposite.
- **`42501` covers two cases** — a stranger's booking *and* a walk-in, whose
  `customer_profile_id` is null so there is nobody to ask. So the toggle is **absent** on a
  walk-in rather than present and doomed; same rule Check in already follows.
- **It is Growth+.** `enqueue_booking_reminders` returns early below growth, so on a Basic
  salon the switch would save a genuine preference against something that never fires. Shown as
  nothing rather than a locked control: a customer cannot upgrade someone else's salon.
  `BOOKING_SELECT` carries `businesses(plan)` for this.

`P0002` means *"no such booking"* here and *"a product is no longer available"* for
`place_order` — which is exactly why `queue-errors.ts` maps by (RPC, code). `booking-errors.ts`
is booking-scoped so it is unambiguous, but do not merge the two tables.

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

**Not every gate is real, and the code says which.** Three of the six locked surfaces are gated in
SQL too — `client_book`, `payroll_report` and `tax_estimate` each raise `P0001`. The other three
are **client-side only**: `analytics_dashboard` and `analytics_peak_heatmap` never look at
`businesses.plan` at all (measured: a `basic` salon gets the complete payload), and
`loyalty_programs_write_owner` checks ownership and stops while
`loyalty_programs_select_public` publishes any active program regardless of tier. Never describe
the Insights or Loyalty paywall as enforced. Reported upstream; not worked around.

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

## Owner setup — services, staff, hours, the salon

### The two hours tables do different jobs

`private.is_bookable_window` reads `businesses.timezone`, then **`staff_working_hours`** and
`staff_time_off` — and never `business_hours`. So:

- **A stylist's hours gate bookings.** `compute_availability` and `create_booking` both refuse
  anything that does not fit inside one interval row. Measured: adding a 12:00–13:00 break to a
  stylist made the customer's slot list jump from 11:30 straight to 13:00.
- **A salon's opening hours gate nothing.** They drive the salon page's hours line, the owner
  calendar's closed days and `% booked`, and `availabilityScoreFromHours` in the ranking.
  Measured the other way too: opening Norzin on a Sunday changed the calendar and changed
  nothing about what could be booked.

`/business/hours` says so on the page, and links to a stylist. Both editors share
`components/owner/hours-editor.tsx` over `lib/hours.ts` (ported with all 32 cases of
`working_hours_model_test.dart`). **A break is the gap between two segments**, never a row.

**`business_hours` has no RPC**, unlike staff hours, so `setBusinessHours` is two ordered
writes: upsert on `(business_id, day_of_week, open_time)`, then delete what is gone. The order
is the safety — a half-failed save leaves the salon *too open*, which is visible, rather than
with no hours at all, which every customer surface renders as closed all week. The upsert needs
the conflicting row to be selectable, and `business_hours_select` admits a member, so it is.
Verified in place: all six of Norzin's original row ids survived a save.

### Always `set_staff_services`

`service_staff_insert` checks `is_business_owner(services.business_id)` and **never that the
staff member belongs to the same salon**, so a direct insert can map your service to another
salon's stylist. Proved live. The RPC derives the business from the staff row and filters
services to it — both sides checked. Never write that table directly.

### Creating a salon cannot use `INSERT … RETURNING`

The live `businesses_select` requires `status = 'approved'` on its public branch, and
`private.is_business_member` is `STABLE`, so its subquery cannot see the row the same statement
is inserting. `INSERT … RETURNING` therefore fails with *"new row violates row-level security
policy"* — a message that reads like the INSERT check when the INSERT check passed. So
`createBusiness` inserts with no RETURNING and reads the row back in a second statement.

Two things follow, both worth reporting upstream. **`Api.createBusiness` does
`.insert(…).select().single()`, so the Flutter app cannot create a salon at all** — consistent
with there being none in the database. And **no migration in `../tho` adds `status = 'approved'`
to that policy**: it exists only on the live database, applied out of band, so a rebuild from
`supabase/migrations` would both publish unreviewed salons and make this problem vanish.

### The Basic stylist cap is client-side only

`maxActiveStylists` is a `Feature`-derived gate in both clients and `staff_insert` has no count
check — so the seed itself is over it: **all nine Basic salons have two active stylists.** The
roster names the cap rather than saying "upgrade", and the paywall stops a *new* stylist rather
than undoing an existing one.

### Exactly one salon is on Pro, and this section used to say none was

**Norzin Salon & Spa is `pro`.** It was `growth` for most of this repo's life, and this heading
read *"No salon is on Pro"* — which is why five surfaces were described here as having no live
example. They have one now: `set_staff_pay`, `payroll_report`, `tax_estimate`, `record_payment`
and the hairstyle picker all raised `P0001` for every account that existed, and on Norzin they
do not.

Two consequences worth acting on:

- **The staff editor's pay block renders its editable branch on Norzin.** That is where
  `20260807000003_pay_and_private_columns` bites: `STAFF_PUBLIC_SELECT` no longer returns the pay
  columns, so the form opened at 0 and **Save wrote 0 back over a real salary**. It reads through
  `payroll_report` for exactly this reason — see `app/business/staff/[id]/page.tsx`.
- **Check a plan gate on Norzin *and* on a Basic salon.** One salon on the unlocked side of every
  Pro gate means the locked branch is still the majority path, and a check that only ever sees
  one side proves nothing about the gate.

`payments` is nonetheless **still 0 rows**, so `record_payment` remains the one Pro surface with
no live data — and it has no writer here. `PARITY.md` §5 has the standing decision.

### Owner photo paths differ from the app's, deliberately

`media_auth_insert` requires the caller's uid as the first path segment, so the app's
`business/<id>/cover.jpg`, `service/<businessId>/<ts>.jpg` and `staff/<staffId>.jpg` are all
refused for anyone but the service role. `uploadOwnerImage` writes `<uid>/<label>-<ts>.jpg`,
which means a salon's photos live under its **owner's** folder — a real consequence, and the
layout the policy allows. Reordering is not offered anywhere: both photo tables have a `sort`
column with no UPDATE policy.

## The owner back office — insights, clients, orders, offers, loyalty, money

### Charts, with no charting library

Six visualisations and 3c adds no dependency. Each is built from the primitive that suits it:
`trend-chart.tsx` is an inline SVG path (Catmull-Rom → cubic at the app's own `curveSmoothness`
0.3, a coral→transparent gradient fill, a ringed dot on the **latest** bucket only), the gauge and
donut are `stroke-dasharray` arcs, the heatmap and waffle are CSS grids, the leaderboard and
breakdown table are flex rows with a share bar behind them. All server components, so every figure
is in the first paint.

The tooltip is a `<title>` inside each hover target — no listener, no state, and a screen reader
reads the values as a list, which `fl_chart`'s gesture tooltip cannot offer at all.

Two palette rules carry over from `chart_theme.dart` and are load-bearing:

- **A bad outcome never wears the brand coral.** Completed is `success-text`, no-shows
  `error-text`, cancelled `border-strong`. Coral is the one accent, for the trend line, the gauge
  arc, share bars and the hot end of the heatmap.
- **A zero heat cell stays canvas white, not the cold end of the ramp.** On a single-hue ramp "no
  bookings ever" and "one booking" would be two barely-different pinks, and a salon closed on
  Sunday would look faintly busy.

### Do not mix a period's figures with the month's

The goal card is always about the **calendar month** — `goal.monthToDateRevenue` and
`monthly_goal` both are, whatever the period pills say — but `kpis.avgTicket` is scoped to the
*selected* period. Dividing a monthly shortfall by a weekly average ticket is how the app arrives
at *"258 more bookings closes the gap"*, measured on Norzin's weekly view. So the ticket
restatement is offered **only** at monthly granularity; every other period states the shortfall
plainly.

### `offerHiddenReason` compares Thimphu days, not UTC ones

`offers_public_read` filters on `(now() at time zone 'Asia/Thimphu')::date`, so anything deciding
whether an offer has lapsed has to as well. Comparing UTC calendar days makes the owner's page and
the customer's disagree for the six hours of every Thimphu day that fall on the previous UTC one —
measured: an offer that had ended still read **"Live"** at 04:20 Thimphu while customers had
already stopped seeing it. Use `thimphuToday(now)`; there is a test pinning the boundary.

### The owner's notifications are addressed to a person, not a salon

`notifications.recipient_profile_id` is the only routing there is, and
`private.enqueue_order_notification` sends the salon's copies to `business_owner_profile(...)`.
So the owner's feed spans **every** salon they run, switching salons changes nothing, and a linked
stylist receives none of it. The page says so.

**And the payload holds `start_ts` and nothing else** — often not even that
(`booking_cancelled` and `order_placed` arrive as `{}`). No `private.enqueue_*` function writes a
customer name. An earlier draft of `ownerNotificationText` read `payload.customer_name` so a row
could say *"New booking — Pema, Fri 11:30"*, which is **the same mistake this repo criticises the
app for** at `notifications_screen.dart` (it renders `payload['message']`, a key the server has
never written). Say only what the row can support.

### Orders are forward-only, so there is no Undo

`set_order_status` allows `new → ready`, `ready → collected`, and `declined` from either. Every
case is one-directional or terminal, so `canOwnerTransition(target, previous)` is never true for a
reverse move and an Undo button could only ever fail. A decline **requires a reason**, and the
customer reads it in their `order_declined` notification.

Restoring an order during verification needs direct SQL: nothing in the schema can move a status
backwards.

### A walk-in has no client page

`client_book` returns a null `customer_profile_id` for anyone the salon knows only from the
counter, grouped by `walkin:<name>:<phone>`. There is nothing to open — `client_history` takes a
profile id and `client_notes.customer_profile_id` is `not null` — so those rows are rendered as
plain rows rather than links. The app pushes a detail screen and then hides both of its sections.

**"Lapsed" is the salon's own rebooking window** (`businesses.rebooking_days`), never a constant.
Verified by moving Norzin's from 42 to 10 to 3 and watching the same two clients cross the line
and back.

### `plan_change_requests` can never be withdrawn

INSERT and SELECT policies, and nothing else — so the table-wide UPDATE and DELETE grants are
dead. **Not with an error, either:** measured, an owner's `update … set status='cancelled'`
succeeds having affected **0 rows**, because with no policy for the command the rows are not
visible to it. A "withdraw" button would report success and change nothing, which is why none is
offered and why the writer de-duplicates *before* inserting. Norzin already carries two pending
`pro` requests and a pending `growth` request for the plan it is already on, all left by the old
app flow.

`status` is in the insert grant and `pcr_insert`'s WITH CHECK does not constrain it, so an owner
*can* file a request already marked `done` and hide it from the operator's queue. Never write that
column; the default is `pending`.

### Offers are writable by staff, not just the owner

`offers_member_write` is `ALL using private.is_business_member` — every other owner-configured
table uses `is_business_owner`. Measured: Norzin's linked stylist can insert, edit **and
hard-delete** offers, while the same account is refused on `products` and `loyalty_rewards` with
`42501`. Since `offers_public_read` puts them on the salon page and in the customer feed, a
stylist can publish a discount in the salon's name. Reported upstream; the console only ever acts
as the owner.

## The customer shop — products, cart, orders, loyalty

### The cart is persistent, so it must re-price

The app's cart lives for minutes in memory and reconciles with the catalogue only *after*
`place_order` refuses. This one is in `localStorage`, so it can be days old — and `place_order`
computes `total_nu` from `products.price_nu` **server-side**, so a stale subtotal would promise a
number the order does not charge. `/cart` therefore reads the salon's live shelf and runs
`repriceCart` before it paints, then says what moved: *"Matte Hair Wax is sold out — removed from
your cart"*, *"Argan Hair Oil is now Nu 500, was Nu 450"*. Silently changing a total would be worse
than either. Proved on live data at all three timings: a sell-out and a price change caught on open,
and a sell-out that lands *after* the re-price caught by `P0002` on the press — which re-prices
rather than showing a bare error.

`repriceCart` returning `{cart, dropped, repriced}` rather than just a cart is what makes those
sentences possible. A function that quietly fixed the cart would be the same bug with better
manners.

### The idempotency token belongs to the cart, not the button

`place_order` de-duplicates on `(business, customer, client_token)`, so **one token per cart, held
across every retry**, is what makes a double-press or a timeout-then-retry safe. It lives in
`localStorage` beside the cart, not in a ref, because a reload of `/cart` must not mint a new one —
a ref would, and the customer would pay twice for one basket. `clear()` retires it, which is why it
is only called after a confirmed success. Measured: two presses on a held token → **one** row;
re-adding after success (which mints the next token) → a genuine second order.

Same rule, same reason, in `LoyaltyCard`: one token per reward for the life of the mount. **This is
the call the Flutter app gets wrong** — `Api.requestRedemption` passes `clientToken ?? _uuid.v4()`
and its only caller passes nothing, so every attempt mints a fresh token and a retry after an
ambiguous failure creates a *second* pending redemption holding the points twice. Replaying the
held token against the live RPC returns the same row and adds none.

### `fetchMyOrders` filters — the third instance of the OR-policy leak

`orders_select_owner` admits `is_business_owner(business_id)`, so an unfiltered `select orders` hands
an owner their salon's orders under **"My orders"**. Measured on the live database as **3 rows vs
0** for the same account, and that is exactly what `Api.myOrders()` does today. `/orders/[id]`
refuses a member the same way `/messages/[id]` does. Check the policy before trusting a `fetchMy…`
name; this is the third time.

### Three server-side gates, none of them the client's business

All measured through the MCP, because no UI can reach the first two:

- **The plan.** `products_select_public` requires `growth`/`pro`, so a Basic salon's products are
  invisible and `fetchProducts` needs no plan filter. `place_order` against one raises *"this salon
  is not taking product orders"*.
- **Stock.** `Beard Grooming Kit` is `in_stock = false`, so it is absent from the browse and the
  Shop tab; ordering it by id raises `P0002` *"a product is no longer available"*.
- **A real account.** `place_order` and `request_redemption` both require
  `private.is_real_user()` — which reads `is_anonymous` straight off the JWT — and raise `P0010`
  *"create an account to order"* / *"…to redeem rewards"*. A guest still browses and still fills the
  cart, and because the cart is local it is **still there** after the sign-up round trip.

**The wall is at Place order and Redeem, never at Add to cart.** Asking for an account before
showing why one is worth having is the one thing this app deliberately protects against.

### `in_stock` is a boolean, so there is no "2 left"

And there is no payment: cash on collection is the whole model, `payments` is Pro-gated with 0 rows,
and nothing in the shop takes a card. Neither `reviews` nor `favourites` has a product column, so
products have neither. `Api.products` loads everything and there are 4 live, so there is no
pagination — a limit with no live case would be untested code.

### Orders and rewards are one flat list each

No segments, matching the app: a customer's own history is small where the owner's inbox needed
New / Ready / Done. And `my_loyalty_summary` lists a salon only when the balance is **non-zero** or
a redemption is pending, so a spent-out customer sees the empty state rather than a row of zeroes —
which means *"no points yet"* also means *"no points left"*, and `/rewards` says so.

The redemption counter on the owner's side is `fetchPendingRedemptions` — a **queue, not a history**.
It lists what is waiting to be honoured and nothing else, which is right for somebody working
through it at the till, and it means a confirmed or cancelled claim vanishes rather than being
filed. Do not "fix" it into a log.

**The Settings hub does not count waiting claims.** `loyaltyLine` states the programme and its
reward count where the orders row states *"1 new order"* — measured, and left alone, because
`private.enqueue_order_notification` files a `loyalty_redemption_requested` to the **owner** for
every claim, and the bell is the path that actually reaches them.

### One owner payload does carry something

`order_placed` and `order_cancelled` arrive as `{}`, as the inbox section says. But
`loyalty_redemption_requested` carries **`reward` and `code`** — only observable once 2f made it
possible to create a redemption at all, since `loyalty_redemptions` had 0 rows platform-wide. So the
owner's bell quotes the code the customer is holding up rather than pointing at the page that would
show it. Still the same rule: say what the row can support, and nothing else.

## Safety, consent and moderation

The 2026-08-07 batch added this whole layer and it is the least guessable part of the schema.
`lib/api/moderation.ts`, `lib/api/account.ts` and `lib/api/staff-invites.ts` are the five-, one-
and five-function wrappers; what follows is what measurement taught, not what the migrations say.

- **A block makes the thread 404 for BOTH sides.** `private.blocked_with` is symmetric, and
  `private.conversation_blocked` is a conjunct in `conversations_select` **and**
  `messages_select` — so blocking does not hide a thread, it stops it existing for either party.
  That is why `ThreadSafetyMenu` navigates to `/messages` after a block rather than refreshing:
  staying put would render a page whose own read now fails.
- **`report_content` is idempotent per (reporter, target)** and refuses guests with `42501`.
  Five target types, nine reasons. Pressing Report twice does not file two reports, so the sheet
  does not need to guard against it.
- **The report control is visible to signed-out visitors and the guest refusal only lands on
  Send.** That is upstream's behaviour and it is left in place, but it is unverified — the anon
  grant is missing (see below), so no signed-out path can be exercised at all.
- **Terms are a precondition for user-generated content, not a signup step.** Without
  `accept_terms` a customer's first review and first message fail with a bare `P0004`. The gate is
  called at the **write site** (`booking-actions.tsx`, `chat-thread.tsx`), which is the only place
  that knows a post is about to happen, and the typed content is held while the sheet is open so
  agreeing does not cost somebody what they had already written.
- **A staff invite is a handshake, and `link_staff_member` is retired.** It let an owner convert
  a stranger's account into their stylist with no consent — `ee413c6` removed it upstream and
  `lib/api/owner-setup.ts` no longer calls it. The accept surface is a **component on Discover**
  (`staff-invite-prompt.tsx`), not a `/staff/invite` route: a pending invite belongs where the
  person already is, and an invited customer has no reason to know a `/staff` URL exists.
- **`/profile/blocked` is a route, not a section of `/profile`.** The block sheet promises
  "Blocked accounts in your profile", and that promise has to land somewhere reachable —
  including when the list is empty, which is the normal state (0 `user_blocks` platform-wide).
  The list **re-reads after every unblock**, because the server is the authority on who is
  blocked.

### The client/server boundary is load-bearing, and the build will not catch it

Adding `"use client"` to a module makes its **non-component exports** arrive at a server
component as client *references* rather than functions — so the server render throws at runtime,
`npm run build` passes, and the only symptom is Next's error page.

This has happened once, and expensively: `owner-booking-card.tsx` became a client component when
it grew inline actions, and the `customerName` helper it exported broke **four** server surfaces
(both booking-detail routes, `booking-detail.tsx`, `today-snapshot.tsx`). `customerName` now lives
in `lib/types/booking.ts`. Two rules follow:

- **Pure helpers go in `lib/`, never beside a component that might become a client one.**
- **Function props cannot cross server → client; index-aligned serializable data can.**
  `PhotoStrip` needed a per-photo report target and takes `(ReportRef | null)[]` for exactly this
  reason, as `queue-board.tsx` takes `clientProfileIds: string[]` rather than a predicate.

### `payments` is owner-only, so read it through the RPC

`payments_select_owner` is the **only** policy on the table, so a direct read works for the salon
and returns `[]` for the person who paid — silently, if the destructure drops `error`. That was
live: a customer could not see a deposit on their own receipt. `fetchBookingPayments` goes through
`booking_payments`, which authorises the salon **or** the payer. Ignore the RPC's `total_paid`
column; it counts a refund as positive.

And **`payments_kind_check` allows `deposit | balance | full | refund`** — not `'payment'`, which
an earlier doc comment named and the tests asserted with. Nothing caught it because the table has
no rows. The union in `lib/types/booking.ts` is now the constraint, and `paymentLine` is the one
formatter both the customer receipt and the owner ledger use.

### Offset paging is unstable across inserts

`fetchNotifications` pages with `.range(offset, offset + limit - 1)`, so a row inserted while
somebody reads can shift the window and repeat an id. `NotificationList` **de-duplicates by id on
append** rather than trusting the offset. The flat `INBOX_LIMIT = 100` it replaced made the 101st
notification unreachable for good — the exact bug upstream fixed in `notifications_screen.dart`.

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

## Signing out

**`app/auth/sign-out/route.ts` — a form POST to a Route Handler, not a client call.** It was a
client `auth.signOut()` in a button rendered by exactly one file, `/profile`, and the owner
console has no `/profile` and never linked to one — so **an owner had no reachable way to sign
out at all**. Three surfaces POST to it now: `/profile`, both collapse panels, and the foot of
`/business/settings` — that last one because the owner's panel stopped existing above 1024 and
would otherwise have re-opened this hole on desktop. Two further defects came out of the same
read:

- **No `catch`.** A failed `signOut()` left `busy` true for ever, so the button sat disabled
  with a spinner. "I can't log out" had two independent causes.
- **`tho_active_business` was never cleared by anything.** It is `httpOnly` with a one-year
  `maxAge` and `path: "/"`, so browser JavaScript *architecturally cannot* clear it — only a
  route handler can send it back expired. On a shared till machine a previous user's salon id
  kept being transmitted on every request. Not a data leak (`resolveActiveBusinessId` filters
  against what the caller owns, and RLS refuses the rows regardless), but exactly the residue a
  sign-out is expected to remove.

Its attributes now live in `ACTIVE_BUSINESS_COOKIE_OPTIONS` beside the name, because a clear
has to repeat the write's own path and protocol or the browser will not match it. Verified by
measurement: switch to the second salon, sign out, sign back in, and the console reopens on the
**first** — which only happens if the cookie is gone.

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

## The nav collapses; there is no bottom bar

**Both bottom tab bars are gone.** A thumb-reachable strip glued to the bottom of the
viewport is a phone-app idiom, and on a desktop browser it was the clearest single tell that
this app was a port. What replaced them:

- `components/ui/app-header.tsx` — one sticky 64px header, used by both shells.
- `components/ui/collapse-nav.tsx` — the overlay, modelled on the marketing site's circle
  reveal with its **six** accessibility gaps closed (it has no `aria-expanded`, no
  `aria-controls`, no `role="dialog"`, no Escape, no focus trap and no focus restore — its own
  sibling file says so in a comment).
- `components/ui/use-dialog-overlay.ts` — scroll lock, focus in, Escape, Tab trap, focus
  restore, **extracted from `Sheet`** so the nav could not fall behind it. `Sheet` calls the
  same hook; there are 27 `<Sheet>` call sites and the extraction is a verbatim move, so the
  risk is uniform rather than per-caller.

**Customer:** `<744` wordmark · bell · menu (all nine destinations in two groups) · sign-out.
`744–1127` the five `TABS` come inline. `≥1128` `SECONDARY` joins as icon buttons and the
menu disappears. `SECONDARY` still appears as rows on `/profile`, so the nav and Profile
cannot disagree about what exists.

**Owner: one row, collapsing at 1024** — `--breakpoint-console`, the one breakpoint not in
DESIGN.md. Above it all five destinations are inline and the hamburger is **not rendered**;
below it the destinations leave the header entirely and the hamburger takes their place, on
the right, opening the same five as panel rows. `phoneOwnerTabs()` and the phone-only settings
gear are **deleted** — their justification was that five fixed items at 390px leaves each
78px.

The tier exists because the console collapses on a different axis from the customer shell:
five labelled tabs plus a nine-salon switcher plus a bell do not fit at 744, so the width that
suits the customer's five left this header cramped between 744 and 1024. `AppHeader` therefore
takes `navFrom` rather than hard-coding `tablet:`, and `CollapseNavPanel` takes `closeAbove`
so it dismisses itself at whichever width its own hamburger disappears at — 1128 for the
customer, 1024 here. **If those two ever disagree the failure is an open menu covering a nav
that is already visible, with nothing on screen to close it.**

This replaced a second header row — a 44px horizontally-scrollable strip below 744, on the
reasoning that an owner works one-handed at a till and a tap plus an overlay is the wrong toll
for the five things they touch all day. That reasoning still holds; the strip only ever
covered *below 744*, which is not where the problem was. If the toll turns out to matter,
bring the strip back at 1024 rather than at 744.

**The owner's menu no longer holds only the account**, and the consequence is load-bearing:
above 1024 there is no panel, so `/business/settings` carries its own sign-out. Without it a
desktop owner is back to having no reachable way out of the console — the exact defect the
panel was added to fix. Two surfaces, one route handler.

Two things collapsing the customer pair fixed for free: `CustomerTopNav` and `CustomerTabBar`
**each** called `useInboxCounts`, so every customer page ran two independent 30-second polls
of the same two reads — now one. And `secondaryHasUnread`, which made the Profile tab wear a
dot as a *proxy* for anything unread beneath it, is replaced by `hiddenUnread`: the bell is on
screen at every width now, so the menu's dot means only the thing the header cannot show.

### Two tokens, because the literal was in eight files

`--header-height: 64px` and `--cta-clearance: 96px`, in a plain `:root` block **outside
`@theme`** — Tailwind prunes theme variables nothing references, and these are consumed only
from arbitrary values: an `h-` utility whose value is `calc(100svh - var(--header-height))`.
The scanner sees that candidate perfectly well (see the comment hazard above) and emits the
rule; what it does not do is treat a `var()` *inside* an arbitrary value as a **use** of the
theme token, so declaring these in `@theme` got them pruned out of `:root` while the rules
referencing them survived. Verified against the compiled sheet, not assumed.

Removing the bar touched **13** sites. Two of them are the interesting ones, and a grep for
`62px` misses both: `chat-thread.tsx`'s composer and `walk-in-form.tsx`'s footer are
`position: sticky; bottom: 0` *inside* `main`, and they cleared the bottom edge only because
`main` reserved 62px of padding for the bar. Remove the padding and they land on the iOS home
indicator. **A sticky element's clearance can be an accident of an ancestor's padding.**

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

**Counted 2026-08-10, and several of these moved during Phase 5.** The database is shared and
has other people on it, so re-count rather than trusting a figure here that a decision depends
on. Check assumptions against it before trusting a column:

- **17 businesses, 14 approved.** Plans across all 17: **basic 13 · growth 3 · pro 1**; across
  the approved 14: basic 10 · growth 3 · pro 1. Earlier notes said 13 salons and no Pro.
- **`businesses.city` contradicts `address_text` on 12 of the 14 approved salons**
  ("Norzin Lam, Thimphu" filed under Paro). `addressText` is the field owners
  actually maintain; the mapper deliberately omits `city`.
- 24 of 34 services have no `gender`; 5 approved salons have no cover; 1 has a gallery;
  0 have offers; 0 are `home_based`/`mobile`, so the coverage-line branch has no
  live example and is covered by unit tests instead.
- Two rows named `Test 01`/`Test 2` are live and approved, so they appear in the
  catalogue. That's a data cleanup in the admin console, not something to filter out
  here.
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
- **`payments` and `offers` are still 0 rows; `review_photos` now has 1.** So the receipt's
  payments block and the offers section have no live example and are covered by unit tests, while
  the review photo strip has one real row (created 2026-08-05 by another client — see *The
  database has other people on it* below). Payments rows created during verification were removed
  with the rest of that run's state; do not assume one is there.
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

## Verify

```bash
npm run dev
npm run build     # also typechecks
npm run lint
npm run test      # ported pure logic
```

A clean build, lint and test run is the bar — currently **559 tests across 28 files** and **70
route entries** in the build tree. Count routes with the tree itself
(`npm run build | sed -n '/^Route (app)/,/(Dynamic)/p'`) rather than by eye: a loose grep over
that output has produced 66, 69 and 70 for the same build.

**A green gate cannot catch a broken route, so sweep them.** Adding `"use client"` to a module
makes its non-component exports arrive at a server component as client *references*, so the page
throws at render while build, lint, tsc and every test stay clean — the only symptom is Next's
error page. The sweep is two passes per role over a route list **derived from
`find app/ -name page.tsx`**, never from memory: `fetch` each route from inside a signed-in page
and read `res.status`, then navigate and read the `<h1>`. Both halves are needed — a 200 that
renders the 404 boundary is not a working page, and `notFound()` is the right answer on some
routes, so the heading is what separates "refused on purpose" from "broke".

Two things that sweep will tell you, and one it told us:

- **A null `h1` is usually `EmptyState`, not a failure.** Its title is a `<p>`, so `/q/[id]`,
  `/queue/[entryId]` and any empty list legitimately have no `h1`. Reading an `h1` and concluding
  "the page is broken" is a mistake this repo has already made once.
- **`/sign-in` and `/sign-up` return an opaque redirect** for a signed-in user. Expected.
- It found `/business/queue` as the **only** route of 61 with no `h1` at all. Fixed in
  `queue-board.tsx`, in both the board and locked branches.

**Do not background `npm run dev` with a redirect to a path you have not checked.** A dev server
whose stdout write fails serves correctly for a while and then 404s **every route but `/`**,
which reads exactly like a routing regression. Fixed by restarting it; diagnosed by noticing
that `/` alone still answered.

Note `overrides.typescript-eslint` in `package.json` pins 8.65.0: upstream
published a version depending on `@typescript-eslint/utils@8.66.0`, which does not exist. Remove
the pin once that is consistent again.

### And check the numbers against SQL, not against themselves

`analytics_dashboard` is 11,700 characters of window functions and timezone arithmetic. A chart
that agrees with itself proves nothing, so every figure on `/business/insights` was recomputed
from `bookings` / `booking_items` through the MCP and compared: revenue, booking count, average
ticket, the per-service and per-staff splits, the three outcome counts and the goal figure. Same
for `private.pit_2026` — `estimateIncomeTax` in `lib/analytics.ts` is a second implementation of
one tax table specifically so the two can be diffed, and its test values were read straight out of
the SQL function.

**Two lessons from 3c's own harness**, both the kind that hide their own failure:

- **Poll the thing you are asserting, never the page.** A "wait for status Ready" that tested all
  of `main` matched the *"Mark ready"* **button** and returned true on the first poll, so three
  later steps acted on a stale page and reported the app broken when it was correct throughout.
  This is the second slice in a row to make that mistake — read the status pill, the specific
  element, the exact node.
- **Make a write idempotent before re-running it.** A fixed upload filename made the second run
  return `409 Duplicate`, which reads identically to the policy refusal the check exists to
  detect.

**And four more from 2f's, all of the same family — a check that cannot fail proves nothing:**

- **A check must be able to fail.** `second.at !== placed.at` passed while `second.at` was `/cart`,
  i.e. it reported success on a press that placed no order at all. `code` was `""` and
  `text.includes("")` is always true. Assert the *shape* you expect (`/^\/orders\/[0-9a-f-]{36}$/`),
  not merely difference from something else.
- **Clear the cookie jar before every sign-in, not just when switching role.** `signIn` reuses an
  existing session, so a previous pass's owner cookies silently made a whole customer half run as
  the owner — and the page then correctly showed 0 points and no Redeem, which reads exactly like
  the feature being broken.
- **A staged pass consumes its own preconditions.** Re-running a stage that had already claimed the
  only affordable reward asserted against a balance its earlier run had spent. Read the state back
  before re-running a stage, or make the stage establish what it needs.
- **Assert against the app's own vocabulary, not a plausible guess.** `sort=price_desc` and
  `sort=price_asc` are not values `PRODUCT_SORTS` knows, so both fell back to `featured` — and one
  of the two checks passed anyway, by coincidence of the default order. The values are
  `priceHighLow` / `priceLowHigh`. Same class of mistake as matching *"Cancel order"* when the
  button says *"Cancel the order"*.

**Backticks inside a `Runtime.evaluate` template literal close it early.** Third slice running. A
comment like `` // links carrying `aria-current` `` inside the evaluated string is a
`SyntaxError: missing ) after argument list` pointing at a line that looks fine.
