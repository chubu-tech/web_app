# web_app — Tho

One Next.js 16 application serving both halves of Tho: the public marketing site
at `/`, and the product — customers, salon owners and stylists — on its own
routes. They were two applications until 2026-08-11; this is the merge.

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 ·
Supabase.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
npm run build      # also typechecks
npm run lint
npm run test       # 653 tests, ported pure logic
```

## The routes

| Route | What it is |
| --- | --- |
| `/` | The marketing homepage. Static, revalidated hourly, salon index prerendered at build. |
| `/waitlist` · `/privacy` | The other two marketing pages. `/privacy` is the canonical policy — the app-store listings point at it, and `/legal/privacy` 308s here. |
| `/discover` | The customer home: find a salon. **This was `/` before the merge.** |
| `/salons` `/salon/[id]` `/stylist/[id]` `/map` | Browse, one salon, one stylist, the map. |
| `/bookings` `/cart` `/orders` `/rewards` `/saved` `/messages` `/notifications` `/profile` | The signed-in customer. |
| `/q/[id]` | Join a walk-in queue. **The printed QR codes point here** — `QueueDeepLink.businessIdFrom` in `../tho` parses this exact shape, so the path is fixed. |
| `/business/*` | The owner console — calendar, queue, insights, the back office. |
| `/staff/*` | A stylist's day. |
| `/sign-in` `/sign-up` `/auth/*` | Auth. |

## How the two halves are kept apart

The marketing code is namespaced; the product's is not. That is deliberate and
it is about churn: the product is 358 files against marketing's 64, so
`@/components/ui/*` and `@/lib/*` keep meaning what they have always meant, and
the marketing side moved.

```
app/
  (marketing)/     /  ·  /waitlist  ·  /privacy      + WaitlistProvider
  (customer)/      /discover and the 24 customer routes
  business/  staff/  auth/  account/
  layout.tsx       the ONE root layout: html, body, Inter, skip link, Toaster
  globals.css      product tokens, and it imports:
  marketing-tokens.css
components/
  marketing/       the 32 marketing components (its own ui/button.tsx lives here)
  customer/ owner/ staff/ ui/ auth/
lib/
  marketing/       content.ts salons.ts search.ts waitlist.ts heading.ts utils.ts
  …                everything else
```

Two files exist twice on purpose, because they are genuinely different things:
`components/marketing/ui/button.tsx` is the editorial button and
`components/ui/button.tsx` is the product one; `lib/marketing/utils.ts` has a
dependency-free `cn` while `lib/utils.ts` wraps `twMerge`. Neither pair should be
reconciled — see the note in `lib/utils.ts` for why the product one cannot simply
be used everywhere.

### The stylesheets

`app/globals.css` is the product system, ported from `../tho/app/lib/ui/tokens.dart`.
It imports `app/marketing-tokens.css`, which is the editorial layer.

The two agreed on **33 of the 43 tokens they both declared**, so those were
dropped from the marketing file during the merge rather than duplicated. What
genuinely conflicted was the display scale — a marketing headline clamp and a
19px product section title are different *sizes*, not one value in two flavours —
so the marketing three are `--text-editorial-{xl,lg,md}` now. `--color-star` was
the one same-role collision and the product value won.

The rule for adding a token is in `AGENTS.md`: override a shared name only when
both systems mean the same *role* and differ only in *value*.

## Deployment

Vercel, with the repository root as the root directory — there is no monorepo and
no workspace. `netlify.toml` is also present and pins Node 22 plus the Associated
Domains content type; `next.config.ts` carries the same header rule for platforms
that serve `public/` through Next.

Environment variables are in `.env.example`. One Supabase pair serves both halves.

## Where the product's rules are written down

`AGENTS.md` is the long-form record — the account model, the queue's two routes,
plan gating, the OR-policy trap that has bitten seven times, the `payments` sign
convention, session timeout, and what live data actually looks like. Read it
before changing behaviour. `PARITY.md` is the audit against the Flutter app.

`../tho` is upstream for product behaviour, tokens and copy. Mirror it; never the
reverse.
