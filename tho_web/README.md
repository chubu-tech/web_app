# Tho — the web app

The Bhutan Salons product in a browser. Customers find a salon, book a chair or
join the walk-in queue; owners run the salon; staff see their day. Same database
as the Flutter app.

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4.

> **Phase 1 of 4.** Foundations only: design tokens, the Supabase layer, the
> account model and the ported pure logic. `app/page.tsx` is a proof page that
> reads live salons — not the real Discover screen. Next: the customer app, then
> owner, then staff.

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
app/            routes. Phase 2+ adds (customer)/, business/, staff/ shells.
lib/
  supabase/     server.ts (cookie-bound) · client.ts (browser)
  auth.ts       the three account states, guest upgrade, friendly errors
  session.ts    server-side "who is asking" — role from profiles.role
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
