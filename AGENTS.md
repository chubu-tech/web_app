<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Bhutan Salons — landing page

The public marketing site for a Bhutan-first salon & barber booking marketplace.
One route (`/`), **fully static** — no database, no API routes, no auth, no
Supabase client. Next.js 16 (App Router), React 19, Tailwind 4, `motion`.

Naming: the platform, company and site are **Bhutan Salons**. The app you
download is **Tho** — that is the Android label, the iOS display name and the
store listing. `brand.appName` in `lib/content.ts` holds it; use it only where
the page points at the download.

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
  from it; don't inline strings that make a claim.
- **Plain words only.** No "dashboard", "admin", "analytics", "CRM", "roster",
  "storefront". Say "one screen", "your customer list", "how the week went". A
  salon owner in Thimphu should not have to decode anything.
- **Say who pays.** Customers never pay; only salons subscribe, and Basic is
  free. That appears in the hero chip, the pricing lead panel, the FAQ and the
  download band — don't remove any of them.
- **Don't invent proof.** Testimonials and stat figures were deliberately
  removed once because they were made up. Numbers go back only when they are
  real and measured.
- **The editorial design layer is intentional.** The cream canvas, DM Sans /
  Bricolage Grotesque / Instrument Serif, and the oversized display scale are a
  marketing-only layer that the in-app system deliberately does not use
  (`app/globals.css:3-9`). This is divergence by design, not drift — do not
  "resync" it to the Flutter tokens.
- Headings use the accent syntax: `_word_` becomes serif italic, `|` forces a
  line break (`lib/heading.ts`).
- Add a token to `app/globals.css` rather than hardcoding a hex in a component.

## Verify

```bash
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

No test framework is installed; a clean `build` and `lint` is the bar. `README.md`
carries the page architecture, the animation map and the pre-launch checklist.
