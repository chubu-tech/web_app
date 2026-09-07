import { headers } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/marketing/content";
import { APP_CARD_IMAGE, shareCard } from "@/lib/seo";
import { storePlatformFromUserAgent } from "@/lib/store-target";

/**
 * `/app` — the link to share when you mean "get the app", on either platform.
 *
 * ## Why this route exists
 *
 * Because neither store link can be made to preview well, and this can.
 *
 * Sharing a store URL on WhatsApp unfurls the **store's** Open Graph tags, and the store
 * is the only party who can change them. Measured, not assumed — this is what each
 * currently serves:
 *
 * - Apple: `og:title` *"Tho.bt App - App Store"*, `og:description` *"Download Tho.bt by
 *   Chojay Wangchuk on the App Store. See screenshots, ratings and reviews, user tips and
 *   more games like Tho.bt."*, `og:image` a URL ending `.../Placeholder.mill/1200x630wa.jpg`.
 * - Google: `og:title` *"Tho - Que & Appointment App - Apps on Google Play"*, `og:image` a
 *   `play-lh.googleusercontent.com` thumbnail.
 *
 * So one card calls a salon marketplace a game and illustrates it with Apple's literal
 * placeholder asset, and the other reproduces the listing's own misspelling of "Queue".
 * No amount of metadata in this repo changes either. What fixes them is App Store Connect
 * and Play Console — worth doing, and not something this codebase can do.
 *
 * What this codebase *can* do is own the link. `/app` is a page on our domain, so it
 * carries our title, our description and our card, and it forwards to the right listing.
 * Share this instead of a store URL and the preview is ours.
 *
 * ## The platform branch
 *
 * `storePlatformFromUserAgent` reads the request's UA and this page then has three
 * shapes: forward to Apple, forward to Google, or forward nobody and show both badges.
 * That last branch is what desktop **and every crawler** gets — see that module's note on
 * why bot detection runs before platform detection, and why serving a redirect only to
 * Googlebot's mobile agent would be cloaking.
 *
 * Reading a header opts this route out of static rendering, which is a real cost and the
 * right one: a page whose whole job is to branch on the client cannot be one file for
 * everybody. The `metadata` export below does **not** read the header, so the card is
 * identical whoever asks — a preview that varied by device would be a different bug.
 *
 * ## It is unlinked, on purpose
 *
 * Nothing in the header, the footer or the hero points here, and it is not in the
 * sitemap. `brand.stores` is still empty, so every download call to action on the site
 * still opens the waitlist and still says "Coming soon to App Store" — which is now **out
 * of date**, since iOS has been live on the Bhutan storefront since 2026-08-24 and
 * Android is live on Play. Reconciling that is a copy decision with nine components
 * attached (see `brand.stores`), and it is not this route's business. This route is a
 * share target: it works for anybody given the URL and changes nothing for anybody who is
 * not.
 *
 * If that copy decision is ever made, the honest edit is to point the badges at
 * `brand.appListing` — or at this page — and delete this paragraph.
 *
 * ## How the forward works, and why it is not `redirect()`
 *
 * `redirect()` from `next/navigation` would send a 307 to **everybody**, crawlers
 * included — so WhatsApp would follow it to the store and unfurl the store's placeholder
 * card, which is the exact thing this page exists to avoid. A page has to be *served* for
 * its Open Graph tags to be read.
 *
 * So the forward is a zero-delay `<meta http-equiv="refresh">`, which:
 *
 * - unfurlers ignore — they read the head and stop, which is what we want;
 * - browsers honour immediately, with no JavaScript, so it works in a WhatsApp in-app
 *   webview with scripting restricted;
 * - leaves a real, visible, tappable link behind for the case where it does not fire.
 *
 * React 19 hoists `<meta>` out of the body into the head, so it can be declared inline
 * here. It is not expressible through the `metadata` export, which has no field for it.
 *
 * ## `noindex`
 *
 * A thin forwarding page has nothing to rank and would compete with `/` if it tried.
 * `follow` stays on so the outbound links are still a signal.
 *
 * **It must not go in `robots.txt`'s disallow list**, which is a different mechanism with
 * a different audience: `facebookexternalhit` obeys `robots.txt` and would then refuse to
 * fetch this page at all, killing the Facebook and Messenger preview. It does not obey a
 * `noindex` meta, which is a search-engine directive. That asymmetry is the whole reason
 * this is done here and not in `lib/site.ts`.
 */

const title = `Get ${brand.appName} — Book a Salon or Barber in Bhutan`;
const description =
  "Book a chair at salons and barbershops across Bhutan, or join a shop's walk-in queue from your phone and watch your place in line. Free to download, free to book.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/app" },
  robots: { index: false, follow: true },
  // Its own card, not the site card — see `APP_SHARE_CARD` for why the two differ.
  ...shareCard({ title, description, url: "/app", images: [APP_CARD_IMAGE] }),
};

export default async function AppLinkPage() {
  const platform = storePlatformFromUserAgent((await headers()).get("user-agent"));
  const { ios, android } = brand.appListing;

  // `null` on the branch that forwards nobody, which is desktop and every crawler.
  const forwardTo =
    platform === "ios" ? ios.url : platform === "android" ? android.url : null;

  const heading =
    platform === "ios"
      ? "Opening the App Store…"
      : platform === "android"
        ? "Opening Google Play…"
        : `Get ${brand.appName}`;

  return (
    <>
      {/*
        Zero delay: treated as an immediate redirect rather than a timed one, which is
        what keeps it out of WCAG 2.2.1's "timing adjustable" requirement.
      */}
      {forwardTo ? <meta httpEquiv="refresh" content={`0; url=${forwardTo}`} /> : null}

      <main
        id="main"
        className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-20 text-center"
      >
        <p className="text-muted text-caption-sm font-semibold tracking-[0.14em] uppercase">
          {brand.greeting}
        </p>

        <h1 className="text-display-md font-display text-ink mt-4 font-semibold">
          {heading}
        </h1>

        <p className="text-body text-body-lg mt-4 max-w-[28rem]">
          {forwardTo
            ? `${brand.appName} is free to download. If nothing happens, use the link below.`
            : `${brand.appName} is free on iPhone and Android. Pick your phone below, or open this link on the phone itself.`}
        </p>

        {/*
          `StoreBadges`' pill, restyled inline rather than imported — and the reason is
          behaviour, not bundle size. That component reads `brand.stores`, finds it empty,
          and therefore renders *buttons* that open the waitlist modal. On this page that
          is precisely backwards: the app it would invite you to wait for is the one this
          page is about to open. So these are plain anchors at the `brand.appListing`
          addresses, which are what actually exist.

          Both are rendered on every branch, and the matched platform's is simply first —
          an Android user who arrived on a link someone shared from an iPhone still needs
          a way to Play, and a mis-sniffed UA should cost a tap rather than a dead end.
        */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <StoreLink
            href={platform === "android" ? android.url : ios.url}
            primary
            label={
              platform === "android"
                ? `Get ${brand.appName} on Google Play`
                : `Get ${brand.appName} on the App Store`
            }
          />
          <StoreLink
            href={platform === "android" ? ios.url : android.url}
            label={platform === "android" ? "Or the App Store" : "Or Google Play"}
          />
        </div>

        <Link
          href="/"
          className="text-muted hover:text-ink text-body-sm mt-6 underline decoration-hairline decoration-2 underline-offset-4 transition-colors"
        >
          Or visit {brand.name} on the web
        </Link>
      </main>
    </>
  );
}

/** One store anchor. `primary` is the platform we think the visitor is holding. */
function StoreLink({
  href,
  label,
  primary,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <a
      href={href}
      className={
        primary
          ? "bg-ink hover:bg-obsidian focus-visible:ring-rausch text-title inline-flex h-12 items-center rounded-full px-6 font-semibold text-white transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
          : "border-hairline text-ink hover:border-border-strong focus-visible:ring-rausch text-title inline-flex h-12 items-center rounded-full border px-6 font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
      }
    >
      {label}
    </a>
  );
}
