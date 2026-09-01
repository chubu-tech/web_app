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
