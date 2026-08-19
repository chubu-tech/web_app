import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { brand } from "@/lib/marketing/content";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

/**
 * **One face across the product; a second one only where the site has to have a voice.**
 * Inter carries the whole product — the 25 customer routes and the 26 owner-console
 * routes alike — and Fraunces carries display type on the public marketing pages only.
 * See the `fraunces` loader below for why the split falls exactly there.
 *
 * ## What this replaced, and why it was wrong
 *
 * Three loaders used to sit here: DM Sans, Bricolage Grotesque and Instrument Serif. Two
 * of the three were **never rendered by anything**. `--font-display` and `--font-serif`
 * were declared in `@theme` and no component in the repo referenced either, so Bricolage
 * and Instrument were downloaded-on-demand faces with no demand — dead weight carried
 * because the marketing site had them.
 *
 * Worse, DM Sans applied to the customer shell **only**. `[data-shell="customer"]` set
 * `font-family` directly, so the console inherited Tailwind's system stack and rendered in
 * whatever the visitor's OS happened to supply — Segoe UI on Windows, San Francisco on a
 * Mac, Roboto on Android. Half the product had no typeface of its own and looked different
 * on every machine. Measured before the change: `getComputedStyle(html).fontFamily` was
 * `-apple-system, …, "Segoe UI", …` while `body` under the customer wrapper was DM Sans.
 *
 * ## The mechanism is `--font-sans`, not a `font-family` declaration
 *
 * `globals.css` sets `--font-sans` inside `@theme`. Tailwind's preflight declares
 * `font-family: var(--default-font-family)` on `html, :host`, and `--default-font-family`
 * resolves `--font-sans` at `:root` — the same element `inter.variable` lands on. So one
 * token reaches every route, and the customer shell no longer needs a `font-family`
 * override at all.
 *
 * That resolution order is the whole reason this works and is easy to break: if
 * `inter.variable` is ever moved off `<html>` onto a layout's `<div>`, `--font-sans`
 * computed at `:root` resolves to nothing and the entire app silently falls back to the
 * system stack — the exact bug that was here before, in a new costume.
 *
 * Inter is loaded variable (no `weight`), so 400/500/600/700 all come from one file and
 * the scale in `globals.css` can use any of them at no extra cost.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * **The display face, and it renders on the seven public marketing routes only.**
 *
 * ## Why a second family exists at all
 *
 * Until now this file loaded exactly one, and the whole product — marketing, customer and
 * console — set every headline in Inter at a heavier weight. A single-family page has no
 * display *voice*: hierarchy comes only from size and weight, which is the same lever the
 * body copy already uses, so a 54px headline is a big paragraph rather than a different
 * kind of thing. That reads as untyped, and it is the most-cited signature of a generated
 * layout.
 *
 * ## Why it is Fraunces
 *
 * `marketing-tokens.css` is explicit that display weights stay modest — 500/600, never the
 * 700+ an enterprise system leans on — "because the brand trusts photography and generous
 * whitespace over typographic muscle". A heavier grotesque would have fought that; a serif
 * adds voice without adding weight, which is the one axis this design has already spent.
 * Fraunces is variable, so its 600 comes from the same file as its 400, and it is warm
 * rather than austere — the right register for a salon marketplace and for the Bhutanese
 * identity the kira rule and the woven motif carry elsewhere on the page.
 *
 * ## Why the console does NOT get it
 *
 * The seam this repo cares about is marketing → product, and it is a *colour* seam, closed
 * by `data-shell` on the marketing layout. Typeface is the opposite case: the console is a
 * dense operational tool somebody works at a till, its largest step is a 32px figure, and a
 * display serif on a payroll column is decoration on a spreadsheet. So `--font-display` is
 * referenced only by marketing components, and every product route stays exactly as it was.
 *
 * ## The mechanism, and the trap it shares with Inter
 *
 * `globals.css` maps this to `--font-display` in `@theme`, which is what emits the
 * `font-display` utility. That is an **explicit class on an element**, not an inherited
 * `font-family` — which matters, because a `font-family` set in a shell scope is the exact
 * bug that once left the console on the visitor's OS font (see above). `fraunces.variable`
 * must therefore stay on `<html>` beside `inter.variable`: both resolve at `:root`, and
 * moving either onto a layout's `<div>` breaks it silently.
 *
 * `--font-display` was declared here once before, for Bricolage Grotesque, and deleted
 * because **nothing referenced it**. This time the call sites land in the same change:
 * `hero.tsx`'s `h1`, `SectionHeading`'s `h2`, and the two wordmarks.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  // Fraunces ships four axes. `opsz` is requested explicitly because the face is drawn
  // with optical sizing and the browser will not apply it from a bare variable load;
  // `SOFT` and `WONK` are deliberately left at their defaults — the wonky leg on the
  // `g` is a personality this page does not need, and it is the axis that would make
  // the face read as a costume rather than a voice.
  axes: ["opsz"],
});

/*
  **The brand's own name, from the one constant that holds it.**

  These were the literal string "Tho" in five places here, while `lib/marketing/content.ts`
  declares `brand.name = "THO"` and every marketing surface renders that. So the tab title,
  the share card's `og:site_name` and the title template said "Tho" while the page said
  "THO" — three names for one product on one page, which is precisely the entity confusion
  the `alternateName` work in the homepage graph exists to undo. Reading the constant makes
  them agree, and makes a future rename one edit.

  `brand.appName` is still "Tho" and is still correct where it is used: it is the store
  listing's name, a casing distinction rather than a different product.
*/
const title = `${brand.name} — Book a Salon or Barber in Bhutan`;
const description =
  "Book a salon or barber appointment anywhere in Bhutan, or join a shop's walk-in queue from your phone. Compare services, prices and reviews. Free for customers.";

/**
 * **`metadataBase` is the one that unlocks the rest.** Without it Next resolves every
 * relative `openGraph.images` and `alternates.canonical` against nothing and logs a
 * warning, so a canonical is a bare path — which a crawler reads as no canonical at all —
 * and an `og:image` never resolves. Nothing else here works until it is set, which is why
 * `lib/site.ts` exists and why it is documented as build-time-inlined.
 *
 * `openGraph` and `twitter` are declared here rather than per-page so every route inherits
 * a share card, and the three routes with their own `generateMetadata` override only the
 * fields that differ. Before this, a salon link pasted into WhatsApp — which is how this
 * product is actually shared in Bhutan — unfurled as a bare URL.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: title, template: `%s · ${brand.name}` },
  description,
  applicationName: brand.name,
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: brand.name,
    locale: "en_BT",
    title,
    description,
    url: "/",
  },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  // The owner console's canvas. `app/(customer)/layout.tsx` overrides this with the
  // cream one for the customer routes.
  themeColor: "#ffffff",
  // Light only — DESIGN.md has no dark mode.
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      /*
        `en-BT`, matching `openGraph.locale: "en_BT"` below rather than contradicting it.

        The document declared `en` while its own share metadata declared `en_BT` — a
        disagreement about the same page. `en-BT` is a valid BCP-47 tag (English as
        written in Bhutan) and it is a regional signal for a product that serves exactly
        one country.
      */
      lang="en-BT"
      className={`${inter.variable} ${fraunces.variable} h-full overflow-x-clip antialiased`}
    >
      <body className="bg-canvas text-ink flex min-h-full flex-col overflow-x-clip">
        {/*
          The skip link comes from the marketing site's root layout, kept because it is the
          only one in the merged app and it now serves every route rather than three.

          **`overflow-x-clip`, on `html` AND `body` — it was `hidden`, on `body` alone.**

          Three things were wrong with that. `hidden` makes the element a *scroll container*,
          which silently breaks `position: sticky` on descendants in some engines — and this
          app has sticky rails on `/salon/[id]`, a sticky composer in `chat-thread.tsx` and a
          sticky footer in `walk-in-form.tsx`. `clip` forbids the scroll without creating the
          container, which is the whole reason it exists.

          It was also only on `body`, so `html` could still be the one that scrolled.

          And it was hiding real bugs rather than preventing them. `site-header.tsx` documents
          finding one — a `w-full` element with `sm:mx-4`, i.e. 100% of the viewport plus 32px
          of margin — and says outright that it "only ever hid behind the root layout's
          `overflow-x-hidden`". That one was caught by reading the code. The mask is why
          nobody could know about the others, which is why this changed and why the widths
          were swept afterwards.
        */}
        <a
          href="#main"
          className="bg-ink focus:ring-rausch sr-only rounded-full px-4 py-2 text-white focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-100 focus:ring-2"
        >
          Skip to content
        </a>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
