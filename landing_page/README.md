# Bhutan Salons — landing page

The public marketing site. One route, statically served — no API routes, no
auth, no runtime network calls. The platform is **Bhutan Salons**; the app you
download is **Tho**.

- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript
- Tailwind CSS v4 (tokens in `app/globals.css`, no `tailwind.config`)
- `motion` (Framer Motion 12) for animation, `lucide-react` for icons
- Statically prerendered — the landing page ships as static HTML
- Real salons, read from Supabase **at build time** and inlined (see below)

## Related repos

This used to live inside the product repo as `tho/web/`. It is now standalone.

| Repo | What's in it |
|---|---|
| [`chubu-tech/tho`](https://github.com/chubu-tech/tho) | The Flutter app + Supabase backend. **Source of truth for anything factual on this page** — plan prices and features come from `app/lib/business/plans/plans_config.dart`. |
| [`chubu-tech/admin_dashboard`](https://github.com/chubu-tech/admin_dashboard) | The internal operator console (`../admin`). It is not, and will not be, routes in this app. |

## Run

```bash
cd landing_page
npm install
cp .env.example .env.local
npm run dev      # http://localhost:3000
npm run build    # production build (also typechecks)
npm run lint
```

## The salon data

The "Find a salon" band (`components/find-salon.tsx`) lists **real salons**.

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | The `tho` project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key — safe to expose; RLS is the gate |

`lib/salons.ts` reads them **once at build time**, and `app/page.tsx` sets
`revalidate = 3600`, so `/` stays prerendered static HTML (confirm with
`npm run build` — the route must print `○ (Static)`) and no request happens on
load. Everything read is anon-readable by policy; there is no service-role key
here and there must never be one.

Without the env vars the build still succeeds — the band renders a short
"not available" note instead. Filtering lives in `lib/search.ts` and runs
entirely in the browser over the inlined data.

Two behaviours worth knowing before changing them:

- **Blank fields never exclude a salon.** Missing hours or services put a salon
  under "Might also suit" rather than hiding it.
- **"When" filters on opening hours, not free slots** — there is no public
  availability lookup, so the copy must not imply one.

## The link into the app — currently none

**There is no longer any link off this site.** The "Sign in" button is removed until
`../tho_web` is deployed, from all three places it appeared: the header bar's pill, the
mobile sheet's footer and the footer's quick-links row. Every link on the site is now
same-origin.

The reason is not tidiness. `brand.appUrl` falls back to `http://localhost:3000` when
`NEXT_PUBLIC_APP_URL` is unset, and it is inlined at `next build` — so a production build
made without that variable shipped a primary CTA pointing at **the visitor's own
machine**. Not a 404 on a known host: a connection-refused screen, or on a phone whatever
else answers on that port.

`signIn` in `lib/content.ts` is kept, unreferenced, with the restore written on it. To
put the button back:

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Origin of the web app. Defaults to `http://localhost:3000` |

1. Set `NEXT_PUBLIC_APP_URL` **and rebuild** — being `NEXT_PUBLIC_`, it is frozen into
   the bundle at `next build`, so a redeploy of the same bundle keeps the old value.
   Locally both apps run `next dev` on 3000, so whichever starts second gets 3001; if
   that is tho_web, put `NEXT_PUBLIC_APP_URL=http://localhost:3001` in `.env.local`.
2. Re-add the three render sites. Each carries a comment naming `signIn` and the layout
   notes that were learned the hard way — read them before rewriting the markup.

Two facts that still hold whenever it returns: one label serves both audiences, because
tho_web's `/sign-in` picks the landing route from the account's role (owner →
`/business`, customer → `/`); and no `?next=` is sent, because tho_web's `safeNext` drops
absolute URLs, so a parameter pointing back at this site could not work.

## Page architecture

Seven blocks, in the order a first-time visitor needs them:

| # | Block | Job |
|---|---|---|
| 1 | `hero.tsx` | What this is, in one sentence — plus the App Store / Google Play buttons and a live-queue card showing the product working |
| 2 | `service-marquee.tsx` | What you can book (texture band) |
| 3 | `two-ways.tsx` | The two ways to use it: book ahead, or walk in and scan |
| 4 | `queue-live.tsx` | The virtual queue, actually moving |
| 5 | `for-salons.tsx` | The owner side — one pinned dashboard, four features |
| 6 | `pricing.tsx` → `faq.tsx` | What it costs, then the objections |
| 7 | `download-band.tsx` | The download, again |

```
app/
  layout.tsx            fonts, metadata, skip-link
  page.tsx              composition + JSON-LD graph
  globals.css           design tokens, keyframes, utilities
  icon.svg              favicon (scissors mark)
  opengraph-image.tsx   1200×630 share card, generated at build
  sitemap.ts / robots.ts
components/
  site-header.tsx       floating pill nav, scroll progress, mobile sheet
  hero.tsx / service-marquee.tsx / two-ways.tsx / queue-live.tsx
  for-salons.tsx / pricing.tsx / faq.tsx / download-band.tsx / site-footer.tsx
  ui/
    bhutan.tsx          TextileRule, MotifDiamond, MountainRule
    store-badges.tsx    App Store + Google Play buttons
    reveal.tsx text-reveal.tsx parallax-image.tsx marquee.tsx
    button.tsx section.tsx
lib/
  content.ts        ALL copy + image URLs (single place to edit)
  heading.ts        `_accent_` / `|` heading parser (server-safe)
  utils.ts          cn()
```

## Bhutanese design cues

Deliberately restrained — three motifs, used as ornament only, all `aria-hidden`:

- **Dzong-window arch** (`arch` utility) frames the two pictorial cards in
  `two-ways.tsx` — the strongest architectural cue on the page.
- **Kira-weave rule** (`TextileRule`) — the uneven stripe band from Bhutanese
  textiles. Opens the hero and the footer.
- **Woven diamond** (`MotifDiamond`) separates the services ticker, and a
  **Himalayan skyline** (`MountainRule`) closes the download band.

Plus a Dzongkha greeting — *Kuzuzangpo la* — in saffron serif above the
headline, and saffron/maroon/jade accent tokens taken from dzong trim and
monastic cloth. Rausch stays the only action colour.

## SEO

- One `<h1>`; every band is a `<section aria-labelledby>` pointing at its `<h2>`
- Full metadata in `layout.tsx`: canonical, keywords, Open Graph, Twitter,
  `max-image-preview:large`
- `app/sitemap.ts` and `app/robots.ts` (add a row to the sitemap per new route)
- Build-time OG image at `app/opengraph-image.tsx`
- One JSON-LD `@graph` in `page.tsx` linking Organization → WebSite →
  SoftwareApplication (with the plan offers) → FAQPage
- Statically prerendered, `next/image` everywhere with `sizes`, alt text on
  every photo, skip-to-content link

## Design system

Colour tokens mirror `DESIGN.md` and `app/lib/ui/tokens.dart` **in the tho
repo** so the site and the Flutter app read as one brand: rausch `#FF385C` used only for primary
CTAs and active states, ink `#222222` (never pure black), the single
`shadow-card` tier.

**Type is deliberately different.** Three faces, each with one job:

| Token | Face | Used for |
|---|---|---|
| `font-sans` | DM Sans | everything — geometric, open, low contrast |
| `font-display` | Inter Black (900) | the hero `<h1>` only |
| `font-serif` | Instrument Serif italic | the accent word in a heading |

The Flutter app stays on Inter (tho's `DESIGN.md` names it as the substitute for
Cereal); this page is the cleaner-typed surface, not a mirror of the app's type
stack. **This divergence is intentional — don't "fix" it to match the app.**

The landing page also adds a **marketing-only** editorial layer the in-app system
deliberately does not use: a warm cream canvas (`--color-canvas`), an oversized
display scale (`text-display-*`), and Instrument Serif italic for the accent word
in a heading. In-app screens should keep DESIGN.md's quieter display sizes.

## Writing rules

1. **No technical words.** Never "dashboard", "admin", "analytics", "CRM",
   "roster", "storefront". Say "one screen", "your customer list", "how the week
   went". A salon owner in Thimphu should not have to decode anything.
2. **Say who pays, early and often.** The most likely misreading of this page is
   "do I pay to book?". The answer (no — only salons subscribe) appears in the
   hero chip, the pricing section's lead panel, the FAQ and the download band.
   Don't remove any of those.

Write headings with the accent syntax: `"Free to get listed. _Pay when you grow._"`
— underscores become serif italic, `|` forces a line break.

## Animation

Everything runs on one curve (`cubic-bezier(0.16, 1, 0.3, 1)`) so the whole
scroll feels like one motion language:

| Where | Motion |
|---|---|
| Hero load | image un-zooms 1.2 → 1; headline rises word-by-word from behind a clip mask; kira rule wipes in; purpose line, free-for-customers chip, store badges and queue card stagger in |
| Hero live card | the queue position and wait time **tick down** (`#7 → #3`, `40 → 18 min`) — the clearest demo of what the app does |
| Hero scroll | photo drifts down + scales, copy lifts and fades |
| Nav | condenses into a floating blurred pill past 28px; brand-coloured read-progress line; each link's label slides out the top while a copy rises to replace it |
| Buttons | magnetic — the pill leans toward the cursor and springs back; the arrow lifts diagonally |
| Services ticker | velocity-linked: it drifts on its own, speeds up as you scroll down, reverses as you scroll up, and skews slightly with the shove |
| Sections | `Reveal` / `RevealGroup` — opacity + short travel, staggered, fires once |
| Large photos | `ParallaxImage` — spring-damped drift as the slab crosses the viewport |
| Arch cards | `Curtain` lifts to reveal the photo, `Tilt` leans it toward the cursor, image scales under the fixed arch mask on hover |
| Queue band | `Spotlight` — a warm saffron light follows the cursor behind the content |
| Queue board | a 5-deep window slides along a ring every 2.6s; "You" climbs to the chair; the "two away" notification fires at position #2. Pauses when off-screen |
| Salon screen | panels advance on a 5s timer with a dwell bar per row; tapping a row takes over. A light sheen sweeps the card |
| Week numbers | `CountUp` on the three figures |
| Pricing | breathing halo behind the free-for-customers panel; a brand gradient rim rotates around the recommended plan (`rim-card`, driven by an `@property` angle); cards lift on hover |
| Marquees | the motif divider drifts on CSS alone |
| FAQ | height-animated accordion, one open at a time |

### Why the salon section is on a timer, not on scroll

It used to pin the mock and pick the active feature from scroll position. That
only worked on a wide screen: on a phone the mock had scrolled away by the time
you reached the feature it was illustrating. Now a plain 5s timer drives the
active index (tap to take over), and the mock is `sticky` inside a **block-flow**
wrapper that only becomes a grid at `lg` — in a single-column *grid* the mock's
row is exactly its own height, so it would have no room to stick. The
`useInView` sensor is on the mock, not the whole block: the block is taller than
a phone screen, so its intersection ratio is unstable and the timer would die
the moment it dipped below the threshold.

`prefers-reduced-motion` is honoured: `useReducedMotion` drops travel/loops and
`globals.css` collapses all durations.

## Before this goes live

1. **Add the store URLs.** `brand.stores` in `content.ts` is empty, so both
   badges currently fall back to the on-page `#download` section. Paste the real
   App Store / Play listing URLs once the apps are published.
2. **Replace the placeholder photography.** Every image is an Unsplash URL built
   in `lib/content.ts`. Put real salon photos in `public/photos/`, point
   `content.ts` at them, then delete `images.remotePatterns` from
   `next.config.ts`.
3. **Re-check the plan prices.** The tiers here mirror
   `app/lib/business/plans/plans_config.dart` in the tho repo, which flags its
   own prices as placeholders. The launch plan
   (`docs/launch/2026-07-27-production-launch-and-marketing-plan.md` §pricing)
   proposes Nu 899 / Nu 1,999 instead. Whatever the business settles on, the app
   is the source of truth and this page follows it.
4. Fill in the real support email, WhatsApp number and domain in `brand`
   (`content.ts`) — the domain drives `metadataBase`, the canonical URL, the
   sitemap and every JSON-LD `@id`. The WhatsApp number is still the same
   `+975 17 00 00 00` placeholder the app carries.
5. **Swap the `assetlinks.json` fingerprint** — see "Deep links" below. This is
   the one item on this list that fails *silently*. `/privacy`, `/q/<id>` and
   both `.well-known` files now exist; `/terms` still does not.
6. Social proof was removed on purpose: the earlier testimonials and stat
   figures were invented. Add them back only with real, consented quotes and
   measured numbers.

## Deep links

A shop's printed queue QR code encodes `bhutansalons://q/<id>` (the custom
scheme — see `queue_links.dart` in the tho repo). `/q/<id>` is the web landing
page for a phone that does *not* have Tho, and the two files in
`public/.well-known/` are what let a phone that *does* have it skip this page
and open the app directly.

**`assetlinks.json` currently carries the wrong fingerprint, on purpose.** The
SHA-256 in it is the *upload* key from `~/.keystores/tho-upload.jks`. But new
apps ship as App Bundles, so Google re-signs every install with its own **app
signing key** — a different certificate. Android verifies the App Link against
the certificate the installed APK was signed with, which is Google's, not ours.

So after the first Play upload:

1. Play Console → your app → **Test and release → Setup → App signing**.
2. Copy the **app signing key certificate**'s SHA-256 fingerprint.
3. Put it in `sha256_cert_fingerprints`. Keep the upload-key fingerprint in the
   array too — the array holds several, and it is what locally-built debug/
   sideloaded APKs are signed with, so both cases then verify.

Until that swap, `/q/<id>` links open in a browser rather than the app, with no
error anywhere. Verify with:

```bash
curl -s https://bhutansalons.com/.well-known/assetlinks.json
# Content-Type must be application/json for BOTH files:
curl -sI https://bhutansalons.com/.well-known/apple-app-site-association
```

`apple-app-site-association` still has a literal `TEAMID` placeholder — replace
it with the real Apple Developer Team ID before any iOS build. It has no
extension, so `next.config.ts` sets its `Content-Type` explicitly; iOS rejects
it otherwise.
