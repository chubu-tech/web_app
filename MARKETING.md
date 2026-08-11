# The marketing site — rules and rationale

> Was `landing_page/AGENTS.md` until the two applications merged on 2026-08-11. Every rule
below still applies to `app/(marketing)/`, `components/marketing/` and `lib/marketing/`.
Paths in the text predate the merge: `components/x` is now `components/marketing/x`,
`lib/content.ts` is `lib/marketing/content.ts`, and `../tho_web` is this same application.
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Bhutan Salons — landing page

The public marketing site for a Bhutan-first salon & barber booking marketplace.
Two routes (`/` and `/waitlist`), both **statically served** — no API routes and
no auth. Next.js 16 (App Router), React 19, Tailwind 4, `motion`.

## The one runtime network call

"No runtime network calls" was true until the waitlist, and the exception is
bounded on purpose: **nothing happens until somebody presses Join.** No fetch on
load, on scroll or on navigation.

The app is not on either store yet, so a button reading "Download on the App
Store" cannot keep its promise. Every download call to action therefore opens a
waitlist modal — the header CTA, both store badges, the pricing panel and the
closing band — and the download band also carries a **real, scannable QR** that
resolves to `/waitlist`, because a camera cannot open a modal.

Four things about it are decisions, not implementation detail:

- **It goes straight to Supabase from the browser**, not through a Route
  Handler. A handler would mean a server, and the page would stop being a static
  file. `lib/waitlist.ts` is the only place that talks to the network.
- **The publishable key can join the list and cannot read it.** `app_waitlist`
  has RLS on with no policies and no table grants, so the one reachable thing is
  `join_app_waitlist()` — a definer function returning `joined` or `already`.
  A visitor cannot enumerate the list they just joined.
- **"Already on the list" is a success, not an error.** Someone checking whether
  their first attempt worked deserves an answer.
- **The badges become real links again on their own.** Paste the store URLs into
  `brand.stores` and `StoreBadges` switches back to anchors with no other edit.
  That is the switch — not a flag anybody has to remember. `download.body` and
  `download.eyebrow` in `lib/content.ts` are the copy to revert at the same time.

The **decorative** QR in `queue-live.tsx` (`QrTile`) is a different thing and was
left alone: it illustrates scanning at a salon door to join a queue, which is a
real product feature that has nothing to do with downloading the app. Do not
repoint it at the waitlist.

Signups land in the `bsalons` project and are read by the operator console at
`../admin/app/(console)/waitlist`, which is also where the launch announcement
is sent from. Schema:
`tho/supabase/migrations/20260805000002_app_waitlist.sql`.

**One data dependency.** The "Find a salon" band lists real salons. `lib/salons.ts`
reads them from the `tho` Supabase project **at build time** with the publishable
key and `export const revalidate = 3600` in `app/page.tsx`, so the page stays
prerendered static HTML and the browser makes no request. Everything it reads is
anon-readable by RLS (approved+active businesses, their services, categories,
opening hours, ratings), so there is nothing to authorise and no service key.

If the fetch fails or the env vars are missing, `getSalonIndex()` returns an
empty index and the band renders a short "not available" note. A marketing site
must never fail to build because a database blinked.

Two things that fall out of using real data:

- **Fields are often blank.** Some salons have no cover photo, no opening hours,
  no services and no map pin. `lib/search.ts` therefore never *excludes* a salon
  for missing data — unjudgeable salons surface under "Might also suit". A blank
  field is the salon's gap, not a reason to hide them.
- **Placeholders leak.** The operator console can approve anything, and salons
  named "Test 2" / "Test 01" are live right now. `PLACEHOLDER_NAME` in
  `lib/salons.ts` drops them. Suspending them in the console is the real fix.

The "when" filter matches salons that are **open** at that time, from
`business_hours`. It cannot know whether a chair is free — `compute_availability`
is `authenticated`-only — so no copy anywhere may imply it does.

Naming: the platform, company and site are **THO** — renamed from "Bhutan Salons",
and every surface reads `brand.name`, so the rename was one constant plus the one
string that had it hardcoded (`waitlist.page.back`). The **domain stays
`bhutansalons.com`**, because that is what is registered and serving; so does
`supportEmail`. `brand.appName` is still cased "Tho" because that is literally the
Android label and the store listing — after the rename it is a casing distinction,
not a naming one, so do not "fix" one to match the other.

`brand.appName` in `lib/content.ts` holds it; use it only where the page points at
the download, and `brand.name` everywhere else.

## The product is not in this repo

Everything factual on this page is owned by **`github.com/chubu-tech/tho`**
(Flutter app + Supabase backend):

- **Plan prices and features** → `app/lib/business/plans/plans_config.dart`.
  That file is what an owner actually sees in the app. Mirror it here; never the
  reverse. It flags its own prices as placeholders.
- **What has actually shipped** → `docs/launch/`, `docs/deployment/`,
  `docs/design-analysis-and-roadmap.md`.
- **Brand tokens** → `DESIGN.md` and `app/lib/ui/tokens.dart`.

The operator console is a third repo (`chubu-tech/admin_dashboard`, `../admin`).
It is not part of this app.

## Rules

- **All copy lives in `lib/content.ts`.** One place to edit. Components read
  from it; don't inline strings that make a claim. That includes the waitlist's
  error messages — a form is mostly copy.
- **Plain words only.** No "dashboard", "admin", "analytics", "CRM", "roster",
  "storefront". Say "one screen", "your customer list", "how the week went". A
  salon owner in Thimphu should not have to decode anything.
- **Say who pays. "Customers never pay" — and no salon plan is free.** This rule used
  to end "and Basic is free", which was wrong on the page and wrong here: upstream's
  `plans_config.dart` states the final launch prices (**Nu 399 / 699 / 1,499** a month,
  set 2026-08-03) and says in as many words that **there is no free tier** — Basic is the
  entry price, not a giveaway. The page had also drifted to **Nu 799** for Growth, a price
  the product has never charged. Never describe a *salon* plan as free.
  The customer half is the part that is free, and it is a separate claim carried by
  separate copy: the hero chip, the Nu 0 customer panel beside the plans, the first FAQ
  answer and the download band. Don't remove any of those four.
- **Don't invent proof.** Testimonials and stat figures were deliberately
  removed once because they were made up. Numbers go back only when they are
  real and measured.
- **The editorial design layer is intentional** — but it is the *canvas and the scale*,
  not the typeface. The cream ground, the slab radii and the oversized display clamps are
  a marketing-only layer the in-app system does not use. Divergence by design, not drift;
  do not "resync" it to the Flutter tokens.
- **One typeface: Inter.** It replaced three — DM Sans for body, Inter Black 900 for the
  hero, Instrument Serif italic for accent words. `--font-serif` and `--font-display` are
  gone, so a stray `font-serif` class now resolves to Tailwind's default Georgia stack
  rather than to nothing: if you see a serif on this site, that is the bug. The same face
  carries `../tho_web` and the Flutter app, so the seam between marketing and product is a
  URL change and nothing else.
- **There is a type scale now; use it.** Ten steps in `@theme`, each carrying its own
  line-height and tracking: the display clamps, then `heading`, `subheading`, `body-lg`,
  `body-md`, `ui`, `body-sm`, `caption`, `caption-sm`. There used to be **none** — 143
  elements carried a bracketed pixel size across 18 distinct values, none of them with a
  line-height. Reach for a step; do not invent a size. The handful of arbitrary sizes left
  are display *figures* (prices, the queue stat, the marquee) where `leading-none` on a
  numeral is the point.
- Headings use the accent syntax: `_word_` is an accent, `|` forces a line break
  (`lib/heading.ts`). The accent is a **weight drop** against the heading — 400 against
  600/700 — applied in `components/ui/text-reveal.tsx`. It was serif italic; one family
  means emphasis comes from weight.
- Add a token to `app/globals.css` rather than hardcoding a hex in a component.

## Verify

```bash
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

No test framework is installed; a clean `build` and `lint` is the bar. `README.md`
carries the page architecture, the animation map and the pre-launch checklist.
