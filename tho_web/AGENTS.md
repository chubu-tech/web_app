<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tho — the web app

The Bhutan Salons product in a browser: customers book chairs and join walk-in
queues, owners run their salon, staff see their day. Next.js 16 (App Router),
React 19, Tailwind 4, TypeScript.

**Status: Phase 1 (foundations).** Design tokens, the Supabase layer, the account
model and the ported pure logic are in. `app/page.tsx` is a proof page, not the
real Discover screen. Phases: customer → owner → staff.

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

`lib/time.ts`, `lib/calendar-logic.ts` and `lib/booking-guards.ts` are ports of
the Dart originals, and their tests are ports of `../tho/app/test/*_test.dart`
with the same cases and expectations. **Keep them in step**: if either platform
changes a rule, both suites should change together. A silent off-by-one in
Thimphu day bounds would corrupt every calendar view.

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
