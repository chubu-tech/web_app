import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { brand } from "@/lib/marketing/content";
import { shareCard } from "@/lib/seo";
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
 * Google Search Console's HTML-tag verification, and **deliberately not `NEXT_PUBLIC_`.**
 *
 * This layout is a server component and `metadata` resolves on the server, so the token
 * reaches the document `<head>` — the only place Google reads it — without ever entering a
 * client bundle. `NEXT_PUBLIC_` would inline the same string into browser chunks for no
 * gain. It is not a secret; it is simply not the browser's business.
 *
 * **Absent means absent.** The whole `verification` key is spread conditionally rather than
 * handed an `undefined` value. Next's resolver happens to drop falsy keys — `resolveVerification`
 * guards each one with `if (value)` — so the looser form works today, but that is an
 * implementation detail, and a declared-but-blank `GOOGLE_SITE_VERIFICATION=` is the same CI
 * accident `lib/site.ts` documents guarding against with `||` rather than `??`.
 *
 * **Set it before the build, not after.** Not being `NEXT_PUBLIC_` does not make it a
 * runtime value here: the public pages are statically prerendered, so this `<head>` is
 * generated at `next build` and the token is baked into the HTML then. Measured, not
 * assumed — setting it only in the running server's environment left the tag absent, and a
 * fresh build with it set emitted it. So it carries the same caveat `lib/site.ts` documents
 * for `NEXT_PUBLIC_SITE_URL`: re-deploying existing build output does nothing.
 *
 * Verifying by **DNS TXT** instead needs no value here at all, and gives a Search Console
 * *Domain* property covering apex and `www` together — which is the property type that can
 * actually watch a `www`→apex consolidation. This is the escape hatch, not the expected path.
 */
const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION;

/**
 * GA4, or nothing at all.
 *
 * `NEXT_PUBLIC_` **is** right here, unlike the verification token above: the measurement id
 * travels in the `gtag.js` URL, so the browser needs it and there is nothing to withhold.
 * Unset — which is every local run, and every preview unless you opt in — renders no
 * component, so no script, no cookie, and no request to Google.
 *
 * **Client-side navigations are not counted by this code.** GA4's own Enhanced measurement
 * ("page changes based on browser history events", on by default in a new web data stream)
 * is what records them. Turn that off and only the first page of each visit is recorded.
 *
 * Inlined at `next build` like every other `NEXT_PUBLIC_` value, so setting it needs a
 * rebuild rather than a redeploy of the same output.
 *
 * ## Adding a custom event is a privacy-policy change, not a code change
 *
 * The app reports into **this same GA4 property**, and it deliberately sends nothing but
 * Firebase's automatic `screen_view`. Its own note says why: on both store forms every custom
 * event is a **new declared data collection**, to be added deliberately and disclosed in the
 * same change. That constraint reaches the website through the property, not through the code.
 *
 * So: `gtag('event', …)` anywhere in this repo needs a matching edit to `/privacy` in the same
 * change — and `/privacy` is the URL both app-store listings point at, so it is the document
 * the reviewers read. Page views are already covered by what is disclosed; a click, a search
 * term or a booking funnel is not.
 */
const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * `fb:app_id`, and the honest framing: **this is optional, and the Sharing Debugger is
 * wrong to call it required.**
 *
 * The debugger emits "The following required properties are missing: fb:app_id" on a page
 * whose preview it has just rendered perfectly — which is the proof it is not required. The
 * property tied a domain to a Meta app for Facebook Domain Insights, and Meta shut that
 * product down on 30 June 2021. It is load-bearing today only for Facebook Login, the Share
 * dialog's app attribution, and Messenger extensions, none of which this site uses. Stripe,
 * Vercel and Airbnb all ship no `fb:app_id` and all unfurl correctly.
 *
 * It is wired here so that silencing the warning is one environment variable rather than a
 * code change — not because anything is broken without it. Getting a value means creating a
 * Meta app at developers.facebook.com, which is only worth doing if a Facebook presence is
 * wanted for its own sake; `brand.social.facebook` is still an empty string.
 *
 * Build-time, like the two above, because these pages are prerendered.
 */
const facebookAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;

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
  /*
    iOS "Add to Home Screen", which reads almost none of the manifest.

    Safari has no install prompt and no API to request one — `beforeinstallprompt` is
    Chromium-only, so on iOS this is always a person tapping Share → Add to Home Screen by
    hand. What these three tags control is what they get when they do.

    - **`title`.** Without it iOS labels the icon with the document `<title>`, which here is
      "THO — Salon & Barber Booking in Bhutan" and reaches the home screen as "THO — Sal…".
      `brand.name` is the label the app icon already uses on both stores.
    - **`capable`.** Launches standalone, without Safari's chrome. The manifest has asked for
      `display: "standalone"` all along and iOS 15.4+ honours it, so this agrees with an
      existing decision rather than making a new one — it is what older iOS reads, and it
      costs nothing to state twice.
    - **`statusBarStyle: "default"`.** Dark text on a light bar, matching
      `viewport.themeColor` and a design with no dark mode. Not `black-translucent`, which
      does not tint anything — it removes the bar's background entirely and runs the page
      under the clock, which would put the header behind it.

    The icon itself is `app/apple-icon.tsx` via the file convention; iOS takes
    `apple-touch-icon` over anything in the manifest, which is why that route stays
    full-bleed rather than circle-cropped like the favicon.
  */
  appleWebApp: {
    capable: true,
    title: brand.name,
    statusBarStyle: "default",
  },
  /*
    Through `shareCard` rather than written out, and the reason is not brevity.

    This block used to declare `openGraph` without `images` and let
    `app/opengraph-image.tsx`'s file convention supply them. That works — for the routes
    that inherit this metadata untouched. It silently stops working for any route that
    exports an `openGraph` of its own, because Next's merge is shallow and replaces the
    whole object: nine pages, including this site's homepage, were serving no `og:image`
    at all as a result. Declaring the image explicitly here, through the same helper those
    nine now call, means the inherited card and the overridden card are built by one
    function and there is no second code path to keep in step.
  */
  ...shareCard({ title, description, url: "/" }),
  ...(googleSiteVerification
    ? { verification: { google: googleSiteVerification } }
    : {}),
  ...(facebookAppId ? { facebook: { appId: facebookAppId } } : {}),
};

export const viewport: Viewport = {
  // Every shell's canvas, since the port moved them all onto `tokens.dart`'s white. The
  // three nested layouts still declare their own — see `app/(marketing)/layout.tsx` — but
  // they now declare the same value rather than correcting this one.
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
        {/*
          Inside `<body>`, last — not as a sibling of `<body>`, which is what the Next guide's
          own example shows. The component renders through `next/script` at the default
          `afterInteractive` strategy, which Next injects itself, so the mount point has no
          bearing on behaviour; a non-`<body>` element directly under `<html>` would lean on
          React 19 hoisting for no benefit.
        */}
        {gaMeasurementId ? <GoogleAnalytics gaId={gaMeasurementId} /> : null}
      </body>
    </html>
  );
}
