# The marketing site — page architecture, animation map, launch checklist

> Was `landing_page/README.md`. Kept because the animation map and the pre-launch checklist
exist nowhere else. Same path caveat as `MARKETING.md`.

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

Nine blocks, in the order a first-time visitor needs them:

| # | Block | Job |
|---|---|---|
| 1 | `hero.tsx` | What this is, in one sentence — copy on the left, photography on the right, with a white live-queue card floating on it |
| 2 | `service-marquee.tsx` | What you can book (category strip) |
| 3 | `find-salon.tsx` | Real salons, searchable — the pill search bar and the card grid it narrows |
| 4 | `two-ways.tsx` | The two ways to use it: book ahead, or walk in and scan |
| 5 | `queue-live.tsx` | The virtual queue, actually moving |
| 6 | `for-salons.tsx` | The owner side — one sticky screen, four features |
| 7 | `proof.tsx` | Four counts of what is already live, derived from the same index block 3 searches |
| 8 | `pricing.tsx` → `faq.tsx` | What it costs, then the objections |
| 9 | `download-band.tsx` | The download, again |

**There are no testimonials, and `proof.tsx` is not a substitute for them.** Social
proof was removed on purpose (see "Before this goes live" below) because the quotes and
figures the page carried were invented. The proof band answers the same question with
counts computed at render from `SalonIndex`, so nothing in it can be a claim nobody
made. It returns `null` on an empty index rather than printing four zeroes. Real,
consented quotes belong beside it, not instead of it.

```
app/
  layout.tsx            fonts, metadata, skip-link          (repo root — shared)
  globals.css           product tokens                      (repo root — shared)
  marketing-tokens.css  the public pages' type scale, chrome height, utilities
  (marketing)/
    layout.tsx          WaitlistProvider only — no data-shell wrapper
    page.tsx            composition + JSON-LD graph
    privacy/ waitlist/
components/marketing/
  site-header.tsx       80px top nav, centred links, mobile sheet
  hero.tsx / service-marquee.tsx / find-salon.tsx / search-bar.tsx
  search-panel.tsx / salon-card.tsx / two-ways.tsx / queue-live.tsx
  for-salons.tsx / proof.tsx / pricing.tsx / faq.tsx
  download-band.tsx / site-footer.tsx
  ui/
    bhutan.tsx          TextileRule, MotifDiamond, MountainRule
    store-badges.tsx    App Store + Google Play buttons
    reveal.tsx text-reveal.tsx parallax-image.tsx marquee.tsx
    count-up.tsx qr-code.tsx social-icons.tsx
    button.tsx section.tsx
lib/marketing/
  content.ts        ALL copy + image URLs (single place to edit)
  heading.ts        `_accent_` / `|` heading parser (server-safe)
  salons.ts         the build-time salon index
  search.ts         browser-side filtering
  utils.ts          cn()
```

## Bhutanese design cues

Deliberately restrained — ornament only, all `aria-hidden`:

- **Kira-weave rule** (`TextileRule`) — the uneven stripe band from Bhutanese
  textiles. Opens the hero and the footer, and it is **the only place on the site
  where saffron, maroon and jade still appear.** Confining them to a woven band is
  what lets every other surface hold to one accent without the brand losing its
  voice.
- **Woven diamond** (`MotifDiamond`) sits inside each chip on the category strip and
  drives the divider between Pricing and the FAQ, tinted `rausch/35` rather than
  saffron.
- **Himalayan skyline** (`MountainRule`) closes the download band and the waitlist
  page.
- A Dzongkha greeting — *Kuzuzangpo la* — in rausch above the headline.

**The dzong-window arch is gone.** It framed the two pictorial cards in
`two-ways.tsx` and was the strongest architectural cue on the page. It went with the
redesign because the reference has exactly one card shape — a rounded rectangle — and
once the salon grid, the plan cards and the live board all read as that shape, two
arches in the middle of the page read as a section from another site. Restoring it is
one `@utility` in `marketing-tokens.css` plus one class; nothing else depended on it.
The reasoning is written out at the top of `two-ways.tsx`.

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

**`../tho/DESIGN.md` is the reference the public pages are built to**, and that is a
change: they used to carry an *editorial* layer of their own — a cream canvas, a 5rem
display clamp at weight 900, a dzong arch, a rotating gradient rim, a breathing halo,
a cursor spotlight, a light sheen. What replaced it is the system DESIGN.md describes,
with THO's palette rather than the reference's.

Six rules, and each one is load-bearing rather than a preference:

1. **One accent, spent sparingly.** Rausch `#FF385C` for accents, active states,
   dots, rules and icon tints; `--color-rausch-cta` `#E00B41` **whenever white text
   sits on it**, because white on `#FF385C` measures 3.53:1 and fails WCAG AA while
   the deeper step measures 4.89:1. Every other surface is white and ink. Saffron,
   maroon and jade survive only inside the kira rule.
2. **Three surfaces.** `canvas` `#ffffff`, `surface-soft` `#f7f7f7`, `surface-strong`
   `#f2f2f2`, separated by `hairline` `#dddddd` / `hairline-soft` `#ebebeb`. Bands
   alternate white → soft → white. **The one dark moment on the page is the closing
   call to action, and it is a photograph rather than a fill.**
3. **The radii are the product's.** `--radius-sm` 8px, `--radius-md` 14px,
   `--radius-lg` 20px, `--radius-xl` 32px in `globals.css` *are* the reference's
   `rounded.{sm,md,lg,xl}` to the pixel, so `marketing-tokens.css` declares none.
   Cards are `rounded-md`, photo slabs `rounded-lg`, every control a pill.
   `--radius-slab` (2rem) belongs to the customer shell and is no longer used out
   here.
4. **One shadow tier.** `shadow-card`, and nothing else — the reference applies that
   same definition to hover-floated cards, to the search bar at rest and to every
   dropdown. `shadow-lift` stays declared in `globals.css` for the customer shell and
   is unused on the public pages.
5. **Two button heights, ever.** 48px and 56px, label 15px/500 and 16px/500. Store
   badges and the "show salons near me" control match the 48px pill so a row of
   controls reads as one set of objects.
6. **Display type stays modest.** Weight 600, never 700+, with the hero clamped
   38→54px where it used to reach 80px at weight 900. This is the reference's central
   claim: the layout leans on photography and whitespace for hierarchy, so the type
   does not have to.

**One face: Inter**, loaded variable in the shared `app/layout.tsx` and reaching the
public pages, the customer shell and the owner console alike. The three-face stack
this section used to describe — DM Sans for body, Inter Black 900 for the hero,
Instrument Serif italic for the accent word — is gone with the loaders; emphasis in a
heading is now weight contrast (`components/marketing/ui/text-reveal.tsx`).

The type scale lives in `app/marketing-tokens.css` and is marketing-only: every token
in that file was checked to have no consumer outside `components/marketing/` and
`app/(marketing)/`. Do not add a token there that a product route would pick up — the
file is imported by `globals.css`, so it reaches every route.

### Where the public pages still diverge from `../tho/DESIGN.md`

Four places, all deliberate:

- **The filled-button colour.** The reference fills its primary button with `#ff385c`;
  THO's own system forbids that under white text on contrast grounds. Accessibility
  wins over fidelity.
- **The star.** The reference renders ratings in ink ("yellow stars feel cheap in
  travel context"); THO's `--color-star` gold is the app's single rating colour on
  every surface, and a rating that changes colour between the website and the app
  reads as a different thing.
- **Button radius.** The reference's `button-primary` is 8px. Pills throughout, per
  the brief, and the reference has pill CTAs of its own (`button-pill-rausch`,
  `search-bar-pill`, `search-orb`).
- **The display scale is clamped.** The reference states fixed pixel sizes because it
  documents a phone-and-desktop app; this is one page read at 360px and at 1440px, so
  every display step is a `clamp()`.

## Writing rules

1. **No technical words.** Never "dashboard", "admin", "analytics", "CRM",
   "roster", "storefront". Say "one screen", "your customer list", "how the week
   went". A salon owner in Thimphu should not have to decode anything.
2. **Say who pays, early and often.** The most likely misreading of this page is
   "do I pay to book?". The answer (no — only salons subscribe) appears in the
   hero chip, the pricing section's lead panel, the FAQ and the download band.
   Don't remove any of those.

Write headings with the accent syntax: `"Free to get listed. _Pay when you grow._"`
— underscored words drop to weight 400 and take the accent colour, `|` forces a line
break. (They used to become Instrument Serif italic; the face is gone, the syntax is
not.)

## Animation

Everything runs on one curve (`cubic-bezier(0.16, 1, 0.3, 1)`) so the whole
scroll feels like one motion language. **What survives is motion that shows the
product working or marks a change of state; ambient decoration is gone.**

| Where | Motion |
|---|---|
| Hero load | image un-zooms 1.08 → 1; headline rises word-by-word from behind a clip mask; kira rule wipes in; lede, free-for-customers chip, store badges and queue card stagger in |
| Hero live card | the queue position and wait time **tick down** (`#7 → #3`, `40 → 18 min`) — the clearest demo of what the app does |
| Nav | a bottom hairline fades in past 8px of scroll. Nothing reflows |
| Nav links | a 2px ink rule grows from the left on hover |
| Mobile sheet | fade + 12px slide, 240ms; Escape closes it, focus goes to the close button and returns to the hamburger |
| Category strip | velocity-linked: it drifts on its own, speeds up as you scroll down, reverses as you scroll up, and skews slightly with the shove |
| Sections | `Reveal` / `RevealGroup` — opacity + short travel, staggered, fires once |
| Closing photo | `ParallaxImage` — spring-damped drift as the slab crosses the viewport |
| Card photos | scale to 1.04 under a fixed rounded mask on hover |
| Queue board | a 5-deep window slides along a ring every 2.6s; "You" climbs to the chair; the "two away" notification fires at position #2. Pauses when off-screen |
| Salon screen | panels advance on a 5s timer with a dwell bar per row; tapping a row takes over |
| Numbers | `CountUp` on the hero card and the week figures |
| Pricing | plan cards take the one shadow tier on hover |
| Motif divider | drifts on CSS alone |
| FAQ | height-animated accordion, one open at a time |

**Seven effects were removed and their CSS deleted with them**, so nothing is left
declared for a call site that no longer exists: the header's shape-changing pill and
its read-progress line, `Button`'s magnetic spring, `Curtain`, `Tilt`, `Spotlight`,
the `rim-card` conic gradient and its `@property` angle, the pricing panel's breathing
`glow`, and the salon screen's `sheen`. `curtain.tsx`, `tilt.tsx` and `spotlight.tsx`
are deleted files.

`prefers-reduced-motion` is honoured: `useReducedMotion` drops travel and loops, and
`marketing-tokens.css` collapses all durations and iteration counts.

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

### Responsive behaviour

The reference's rule for every grid: **reduce columns, never reflow rows.**

| Grid | <640 | 640–1023 | 1024–1279 | ≥1280 |
|---|---|---|---|---|
| Salon cards | 1 | 2 | 3 | 4 |
| Two-ways | 1 | 1 | 2 | 2 |
| Plan cards | 1 | 1 | 3 | 3 |
| Proof figures | 2 | 4 | 4 | 4 |
| Footer | 1 | 2 | 3 | 5 (3·2·2·3·2 of twelve) |
| Hero | stacked | stacked | 6 + 6 | 6 + 6 |
| Nav | hamburger sheet | hamburger sheet | inline, centred | inline, centred |

Three things that only show up under measurement, and each cost a fix:

- **The hero photo has three shapes, not one.** 4:5 on a phone, because the live card
  is pinned to the foot of it and covered three-quarters of a 4:3 box; 16:10 from
  `sm`, where the card shrinks to a fixed 19rem in the corner; and no ratio at all
  from `lg`, where the column is stretched to the copy's height so the two columns
  share one top and one bottom edge. `items-center` there left ~150px of blank canvas
  above and below the copy at 1280.
- **The footer's twelve-track grid waits until `xl`.** At 1024 a twelve-track grid
  with 32px gutters gives each track 49px, so a two-track column is 130px — narrower
  than "Join the waitlist" and 20px short of the support address. Both broke
  mid-word. It falls back to three equal columns between 1024 and 1280.
- **Section rhythm is 56/64/80px, and it arrives doubled.** Two adjacent bands put
  their padding back to back, so the old 96/112/128 meant 192px of empty canvas
  between sections at desktop — more than a phone screen, and most visible under
  "Near you", which ends in a button and renders no grid until somebody shares a
  location.

Checked with a scripted sweep at 360 / 390 / 744 / 834 / 1024 / 1280 / 1440 that
scrolls the whole page (so every `whileInView` reveal has fired), lifts the root
layout's `overflow-x-hidden` — which *masks* sideways scroll rather than preventing
it — and asserts `documentElement.scrollWidth <= clientWidth` plus no element outside
the viewport that is not inside an `overflow: hidden` ancestor. Zero offenders at
every width.

`prefers-reduced-motion` is honoured: `useReducedMotion` drops travel/loops and
`marketing-tokens.css` collapses all durations.

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
