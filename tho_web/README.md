# Tho — the web app

The Bhutan Salons product in a browser. Customers find a salon, book a chair or
join the walk-in queue; owners run the salon; staff see their day. Same database
as the Flutter app.

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4.

> **Phase 3a.** The **customer** app is complete — discover, book, reschedule, cancel,
> review, join a walk-in line, map, stylist profiles, inbox, messages, profile editing.
> The **owner** console now covers the daily job: today's book, the booking lifecycle,
> the live walk-in board and booking someone in at the counter.
>
> Next: **3b** owner setup (services, staff, hours, salon profile) · **3c** the owner
> back office (insights, client book, orders, loyalty, plan) · **2f** the customer shop ·
> then **staff**.

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
  (customer)/   the customer shell — 19 routes
  business/     the owner console — calendar, queue, booking detail, walk-in
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
  types/        TypeScript mirrors of tho's models.dart
proxy.ts        session refresh only — this site is public
app/globals.css design tokens, ported from tho's tokens.dart
```

## Three things worth knowing before you change anything

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

Agent-facing conventions, including the design-token rules, are in
[`AGENTS.md`](AGENTS.md).
