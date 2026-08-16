import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { brand } from "@/lib/marketing/content";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

/**
 * **One face, every route.** Inter carries the whole product — the 25 customer routes and
 * the 26 owner-console routes alike.
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
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="bg-canvas text-ink flex min-h-full flex-col overflow-x-hidden">
        {/*
          From the marketing site's root layout, kept because it is the only skip link in the
          merged app and it now serves every route rather than three. `overflow-x-hidden`
          came with it: the marketing pages run full-bleed bands and off-canvas animations
          that would otherwise let the document scroll sideways by a pixel or two.
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
