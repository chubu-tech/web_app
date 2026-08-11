# Tho — the web app

The Bhutan Salons product in a browser. Customers find a salon, book a chair or
join the walk-in queue; owners run the salon; staff see their day. Same database
as the Flutter app.

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4.

> **Phase 2f — Phase 2 is complete, and both roles are done.** The **customer** app covers
> discover, book, reschedule, cancel, review, join a walk-in line, map, stylist profiles, inbox,
> messages, profile editing and now **the shop**: a cross-salon products browse, a salon's Shop
> tab, a cart that survives a closed tab, cash-on-collection orders with tracking and cancel, and
> loyalty — points, rewards, and a redemption code to show at the counter. The **owner** console
> covers everything the phone app's owner side does:
> the daily job (today's book, the booking lifecycle, the live walk-in board, the counter
> walk-in), the whole of setup (services and the catalogue, staff, stylist hours, **the salon's
> own opening hours** — which neither client had ever been able to edit — the profile with a
> draggable map pin, creating a salon), and the back office: insights, the client book, product
> orders, the storefront, offers, loyalty and its redemption counter, the salon's messages and
> notifications, payroll, the tax estimate, and plan & billing.
>
> Six things here are ahead of the app: **five analytics cards** it has parked, **the upgrade
> request** it removed for App Store rule 3.1.1, **an owner notification feed** it has no
> equivalent of, **locked states** four of its screens draw as network errors, a **cart that
> outlives the tab** and re-prices itself against the shelf, and a **redemption code that updates
> itself** instead of asking you to press Refresh at the till.
>
> Next: **Phase 4 — staff**, the last role.

## Related repos

| Repo | What's in it |
| --- | --- |
| `chubu-tech/tho` (`../tho`) | The Flutter app and **every** migration. Source of truth for product behaviour, design tokens and copy. |
| `chubu-tech/admin_dashboard` (`../admin`) | The internal operator console. Separate app; `admin` users belong there, not here. |
| `../landing_page` | The public marketing site that links here. |

This repo owns no schema. Never write SQL in it.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev      # http://localhost:3000
npm run build    # production build (also typechecks)
npm run lint
npm run test     # ported pure logic
```

`.env.local` needs two variables, both in `.env.example`:

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | The `bsalons` project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key — safe in a browser. RLS is the gate. |

**There is no service-role key and there must never be one.** This app acts only
as its signed-in user; every write goes through a `SECURITY DEFINER` RPC that
authorises the caller itself.

## How it fits together

```
app/
  (customer)/   the customer shell — 24 routes. Discover (salons and products),
                salon, book, queue, map, stylist, bookings, messages,
                notifications, saved, profile, and the shop: cart, orders +
                detail, rewards + the redemption code.
  business/     the owner console — 26 routes. The day: calendar, queue, booking
                detail, walk-in. Setup: the settings hub, salon profile, opening
                hours, services, the catalogue, staff, staff detail, create-salon.
                The back office: insights, clients + detail, orders + detail,
                products, offers, loyalty + redemptions, messages + thread,
                notifications, payroll, tax, plans.
                (staff/ arrives with Phase 4)
lib/
  supabase/     server.ts (cookie-bound) · client.ts (browser)
  auth.ts       the three account states, guest upgrade, friendly errors
  session.ts    server-side "who is asking" — role from profiles.role
  owner/        the console's gate + which salon is active (cookie-backed)
  nav.ts        which destination a path belongs to, shared by both shells
  time.ts       Asia/Thimphu, UTC+6, no DST
  calendar-logic.ts   ported from tho, with ported tests
  booking-guards.ts   ported from tho, with ported tests
  hours.ts            ported from tho, with ported tests — both hours editors
  analytics.ts        ported from tho, with ported tests — the dashboard's
                      derivations, the client book's rules, the order state
                      machine and the 2026 Bhutan PIT bands
  cart.ts             ported from tho, with ported tests — pure functions over
                      an immutable cart, plus the re-price a stored one needs
  product-filter.ts   ported from tho, with ported tests — sort and price range
  use-cart.ts   the cart in localStorage, via useSyncExternalStore
  plans.ts      the three tiers and their prices — the only place pricing lives
  types/        TypeScript mirrors of tho's models.dart
proxy.ts        session refresh only — this site is public
app/globals.css design tokens, ported from tho's tokens.dart
```

## Four things worth knowing before you change anything

**Browsing works with no account.** People arrive from a search result or a QR
code. A guest Supabase session is created *lazily*, at the first action that
needs an identity — never on page load and never in the proxy, because
`signInAnonymously()` creates a real user row and a crawler sweep would fill the
table with junk.

**Time is one fixed zone.** `Asia/Thimphu`, UTC+6, no DST — mirroring what the
Flutter app hardcodes and what the RPCs compare against. Don't add a timezone
library.

**The ported logic has ported tests.** `lib/*.test.ts` reproduce the cases in
`../tho/app/test/` exactly. If a rule changes on either platform, both suites
should change together.

**Time is one fixed zone, and that includes calendar days.** Anything deciding whether a date has
passed compares *Thimphu* days, because that is what the RLS policies do
(`(now() at time zone 'Asia/Thimphu')::date`). Comparing UTC days makes the owner's view and the
customer's disagree for six hours out of every twenty-four — which is exactly the bug the offers
list shipped with for an afternoon.

Agent-facing conventions, including the design-token rules, are in
[`AGENTS.md`](AGENTS.md).
