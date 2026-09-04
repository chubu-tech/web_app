import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/marketing/content";
import { shareCard } from "@/lib/seo";

/**
 * `/app` — the link to share when you mean "get the app".
 *
 * ## Why this route exists
 *
 * Because the App Store link cannot be made to preview well, and this can.
 *
 * Sharing `apps.apple.com/bt/app/tho-bt/id6801982891` on WhatsApp unfurls **Apple's**
 * Open Graph tags, and Apple is the only party who can change them. Measured, not
 * assumed — this is what Apple currently serves for the listing:
 *
 * - `og:title` — *"Tho.bt App - App Store"*
 * - `og:description` — *"Download Tho.bt by Chojay Wangchuk on the App Store. See
 *   screenshots, ratings and reviews, user tips and more games like Tho.bt."*
 * - `og:image` — a URL ending `.../Placeholder.mill/1200x630wa.jpg`
 *
 * So the card calls a salon marketplace a game and illustrates it with Apple's literal
 * placeholder asset, because the listing has no promotional image for Apple to use. No
 * amount of metadata in this repo changes any of that. The only thing that does is
 * uploading proper App Store marketing artwork in App Store Connect — worth doing, and
 * not something this codebase can do.
 *
 * What this codebase *can* do is own the link. `/app` is a page on our domain, so it
 * carries our title, our description and our card, and it forwards to the listing.
 * Share this instead of the Apple URL and the preview is ours.
 *
 * ## It is unlinked, on purpose
 *
 * Nothing in the header, the footer or the hero points here, and it is not in the
 * sitemap. `brand.stores.ios` is still empty, so every download call to action on the
 * site still opens the waitlist and still says "Coming soon to App Store" — which is
 * now **out of date**, since the app has been live on the Bhutan storefront since
 * 2026-08-24. Reconciling that is a copy decision with nine components attached (see
 * `brand.stores`), and it is not this route's business. This route is a share target:
 * it works for anybody given the URL and changes nothing for anybody who is not.
 *
 * If that copy decision is ever made, the honest edit is to point the badges at
 * `brand.appListing.url` — or at this page — and delete this paragraph.
 *
 * ## How the forward works, and why it is not `redirect()`
 *
 * `redirect()` from `next/navigation` would send a 307 to **everybody**, crawlers
 * included — so WhatsApp would follow it to Apple and unfurl Apple's placeholder card,
 * which is the exact thing this page exists to avoid. A page has to be *served* for its
 * Open Graph tags to be read.
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
 * `follow` stays on so the outbound link is still a signal.
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
  ...shareCard({ title, description, url: "/app" }),
};

export default function AppLinkPage() {
  const { url } = brand.appListing;

  return (
    <>
      {/*
        Zero delay: treated as an immediate redirect rather than a timed one, which is
        what keeps it out of WCAG 2.2.1's "timing adjustable" requirement.
      */}
      <meta httpEquiv="refresh" content={`0; url=${url}`} />

      <main
        id="main"
        className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-20 text-center"
      >
        <p className="text-muted text-caption-sm font-semibold tracking-[0.14em] uppercase">
          {brand.greeting}
        </p>

        <h1 className="text-display-md font-display text-ink mt-4 font-semibold">
          Opening the App Store…
        </h1>

        <p className="text-body text-body-lg mt-4 max-w-[28rem]">
          {brand.appName} is on the App Store in Bhutan. If nothing happens, use the
          link below.
        </p>

        {/*
          `StoreBadges`' pill, restyled inline rather than imported — and the reason is
          behaviour, not bundle size. That component reads `brand.stores.ios`, finds it
          empty, and therefore renders a *button* that opens the waitlist modal. On this
          page that is precisely backwards: the app it would invite you to wait for is
          the one this page is about to open. So the link is a plain anchor at
          `brand.appListing.url`, which is the address that actually exists.
        */}
        <a
          href={url}
          className="bg-ink hover:bg-obsidian focus-visible:ring-rausch mt-8 inline-flex h-12 items-center rounded-full px-6 text-title font-semibold text-white transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
        >
          Get {brand.appName} on the App Store
        </a>

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
