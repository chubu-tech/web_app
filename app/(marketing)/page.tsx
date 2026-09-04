import type { Metadata } from "next";
import { DownloadBand } from "@/components/marketing/download-band";
import { Faq } from "@/components/marketing/faq";
import { FindSalon } from "@/components/marketing/find-salon";
import { ForSalons } from "@/components/marketing/for-salons";
import { Hero } from "@/components/marketing/hero";
import { Pricing } from "@/components/marketing/pricing";
import { Proof } from "@/components/marketing/proof";
import { QueueLive } from "@/components/marketing/queue-live";
import { ServiceMarquee } from "@/components/marketing/service-marquee";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { TwoWays } from "@/components/marketing/two-ways";
import { MotifDivider } from "@/components/marketing/ui/bhutan";
import { brand, faq, hero, pricing } from "@/lib/marketing/content";
import { getSalonIndex } from "@/lib/marketing/salons";
import { sameAsBlock, shareCard } from "@/lib/seo";
import { absoluteUrl, SITE_URL } from "@/lib/site";

/**
 * **`SITE_URL`, not `https://${brand.domain}`.**
 *
 * This was the literal domain, which meant the JSON-LD graph named a different origin
 * from the one `metadataBase` resolves canonicals against — so on any deploy that is not
 * production (a Netlify preview, a local build) the page's canonical said one thing and
 * its `@id` graph said another, and an engine reconciling the two has to pick. Reading
 * the same constant the canonical reads makes them agree by construction.
 *
 * The values are identical in production. The point is that they are now identical
 * *everywhere*, and that a change of origin is one edit rather than two.
 */
const SITE = SITE_URL;

/**
 * Rebuild the salon list hourly.
 *
 * The salons are read at build time and inlined, so the page keeps being served
 * as static HTML with no request on load. An hour is short enough that a newly
 * approved salon appears without a deploy, and long enough that the database is
 * hit once an hour rather than once a visit.
 *
 * Note this is the pre-Cache-Components model, which is correct here because
 * `cacheComponents` is not enabled in `next.config.ts`.
 */
export const revalidate = 3600;

/**
 * **The homepage had no `metadata` export at all**, which cost it the two things that
 * matter most on the single highest-authority URL on the domain.
 *
 * It inherited the root layout's title and description, which is defensible — they were
 * written for this page. What it did *not* inherit is a canonical, because the root
 * layout declares none, and Next does not synthesise one. So `/` had no
 * `rel="canonical"`, and every way of reaching it — a trailing slash, a `?utm_source=`
 * from a WhatsApp campaign, a `?fbclid=` — was a separate URL competing with the others
 * for the same content, with nothing telling a crawler which was the real one. On a site
 * whose traffic will arrive mostly through shared links carrying tracking parameters,
 * that is the most valuable single line in this file.
 *
 * The title is more specific than the root layout's default: this page's job is the query
 * *"salon booking Bhutan"* and its variants, so it names the service, the two things it
 * does and the country, in that order, inside the ~60 characters a result actually shows.
 */
export const metadata: Metadata = {
  /*
    `absolute`, so the root layout's `%s · THO` template does not run.

    Without it this rendered as *"THO — Salon & Barber Booking in Bhutan · THO"* — the
    brand twice in one title, spending characters a result actually shows on a word it has
    already said. Every other page keeps the template, because on a salon or a place page
    the suffix is the only thing naming the product.
  */
  title: { absolute: `${brand.name} — Salon & Barber Booking in Bhutan` },
  description:
    "Book a salon or barber appointment anywhere in Bhutan, or join a shop’s walk-in queue from your phone and watch your place in line. Free for customers — no booking fee, no card needed.",
  /*
    `keywords`, and an honest note about it: **Google has ignored `<meta name="keywords">`
    since 2009**, and Bing's guidance has described it as a signal for spotting spam rather
    than for ranking. No AI retrieval crawler reads it either — GPTBot, ClaudeBot,
    PerplexityBot and OAI-SearchBot all read rendered text, which is what `/llms.txt` and the
    JSON-LD graph are for.

    It is here because it was asked for and it is inert, not because it earns anything. Every
    term below appears in this page's own title, description or body copy, so the tag cannot
    drift into claiming something the page does not say — which is the only real cost a dead
    tag carries. The pages that genuinely target *"salons in Thimphu"* are the place pages
    under `/salons/<town>`; they are not given one, because it would be equally ignored there.
  */
  keywords: [
    "salon booking Bhutan",
    "barber Bhutan",
    "book a salon appointment",
    "walk-in queue",
    "salon prices Bhutan",
  ],
  alternates: { canonical: "/" },
  /*
    **This page is the one that was worst off.** It declared its own `openGraph` and
    therefore lost the root layout's — so the single highest-authority URL on the domain
    unfurled on WhatsApp, Facebook and LinkedIn with no image, no `og:site_name` and no
    `og:locale`, and told X the generic root-layout title instead of this one. Verified
    against production before the fix: `og:image` was absent from `/` and present on
    `/privacy`, which overrides nothing. See `shareCard`.
  */
  ...shareCard({
    url: "/",
    title: `${brand.name} — Salon & Barber Booking in Bhutan`,
    description:
      "Find salons and barbers across Bhutan, book a time or join the walk-in queue, and see prices before you go. Free for customers.",
  }),
};

/**
 * Structured data. Kept in one graph so crawlers resolve the relationships
 * between the organisation, the apps and the page's Q&A.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: brand.name,
      /*
        **This product answers to three names and nothing said so.**

        It is "THO" on the page, "Tho" on the app stores, and "Bhutan Salons" in the
        database, the repo and — decisively — the domain that actually serves it. To a
        retrieval engine those are three unrelated strings, so a query using one of them
        could not surface a page written in another: somebody searching "Bhutan Salons
        booking" would not reach a site that calls itself THO throughout.

        `alternateName` is what merges them into one entity. It costs one line and it is
        the difference between three weak name signals and one strong one.
      */
      alternateName: [brand.appName, "Bhutan Salons"],
      url: SITE,
      slogan: brand.tagline,
      email: brand.supportEmail,
      telephone: brand.whatsapp,
      areaServed: { "@type": "Country", name: "Bhutan" },
      address: { "@type": "PostalAddress", addressCountry: "BT" },
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: brand.supportEmail,
        telephone: brand.whatsapp,
        areaServed: "BT",
        availableLanguage: ["en", "dz"],
      },
      /*
        `sameAs` — the profiles that corroborate this entity, built rather than written out.

        This comment used to say the field was deliberately absent because `brand.social`
        is three empty strings. Half of that is still true; the other half was never
        checked. **`brand.appListing.url` is a real, live profile of this organisation** —
        the App Store listing on the Bhutan storefront, v1.1.0, and the URL answers 200 —
        and a third-party page that names the entity is exactly what `sameAs` is for.

        `sameAsBlock` keeps the original rule rather than discarding it: an empty string is
        invalid structured data, and an array filtered to nothing is a claim of "no
        corroborating profiles", so the key is omitted entirely when nothing is real. Which
        means pasting a Facebook or Instagram URL into `brand.social` adds it here with no
        edit to this file, and the empty members cost nothing today.

        `Object.values` rather than three named reads, so a fourth network flows in on its
        own; the invariant that every member is a profile URL is what that constant's own
        doc comment states. A `wa.me` deep link is still not a profile and still does not
        belong in it.
      */
      ...sameAsBlock([...Object.values(brand.social), brand.appListing.url]),
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      url: SITE,
      name: brand.name,
      alternateName: [brand.appName, "Bhutan Salons"],
      description: hero.purpose,
      inLanguage: "en-BT",
      publisher: { "@id": `${SITE}/#organization` },
      /*
        **This node is honest only because `?q=` became a real URL in the same change.**

        A `SearchAction` is a claim that a caller can substitute a term into this template
        and get results back. Until now Discover's search box was `useState` with nothing
        written to the URL, so the endpoint named here would have returned the unfiltered
        list for every query — a lie about an interface, which is worse than having no
        node, because an engine can act on it.

        `/discover?q=` now narrows server-side, so the template returns what it promises
        with no JavaScript and no session. See `app/(customer)/discover/page.tsx`.
      */
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${absoluteUrl("/discover")}?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      // The app itself: free, for customers. It ships on both stores as
      // "Tho" — the platform is Bhutan Salons, the download is Tho.
      "@type": "SoftwareApplication",
      "@id": `${SITE}/#app`,
      name: brand.appName,
      alternateName: brand.name,
      description: hero.purpose,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Salon appointment booking and queue management",
      operatingSystem: "iOS, Android, Web",
      url: SITE,
      publisher: { "@id": `${SITE}/#organization` },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "BTN",
        description: "Free for customers — no booking fee, ever.",
      },
    },
    {
      // The subscription: only salons pay, so the tiers hang off their own node
      // rather than looking like a charge to the person booking.
      "@type": "Product",
      "@id": `${SITE}/#salon-plans`,
      name: `${brand.name} for salon owners`,
      description: pricing.body,
      brand: { "@id": `${SITE}/#organization` },
      offers: pricing.tiers.map((tier) => {
        // Strips "Nu " and the thousands comma: "Nu 1,499" → "1499". Every salon tier
        // now carries digits — Basic is Nu 399, not "Free" — so the `|| "0"` fallback
        // is unreachable and stays only because an empty `price` is invalid structured
        // data, which is a worse failure than a wrong-looking zero. Do NOT read it as
        // evidence that a free tier exists; `plans_config.dart` upstream says there is
        // none.
        const amount = tier.price.replace(/[^\d]/g, "") || "0";
        return {
          "@type": "Offer",
          name: tier.name,
          description: tier.tagline,
          price: amount,
          priceCurrency: "BTN",
          availability: "https://schema.org/InStock",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: amount,
            priceCurrency: "BTN",
            billingIncrement: 1,
            unitText: "MONTH",
          },
        };
      }),
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE}/#faq`,
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ],
};

export default async function Home() {
  const salonIndex = await getSalonIndex();

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {/* 1. What this is + get the app. */}
        <Hero />
        <ServiceMarquee />
        {/* 2. Real salons, searchable — the proof the marketplace exists. */}
        <FindSalon index={salonIndex} />
        {/* 3. The two ways to use it. */}
        <TwoWays />
        {/* 4. The queue, working. */}
        <QueueLive />
        {/* 5. The owner side. */}
        <ForSalons />
        {/* 6. Proof that any of this is real, immediately before the price list.
            Four counts derived from the same prerendered index the search band
            filters — deliberately NOT testimonials, which this site removed on
            purpose because the ones it had were invented. See `proof` in
            `lib/marketing/content.ts`. Renders nothing when the index is empty. */}
        <Proof index={salonIndex} />
        {/* 7. Who pays what, 8. questions, 9. download.

            There is no supporter band here any more. It stood between the proof
            figures and the price list, and a partner's mark on its own `bg-paper`
            card — given a ninth of the page's vertical rhythm — read as the loudest
            thing on a page that is meant to be selling chairs. The credit is owed;
            that much prominence was not. It is now a byline under the hero's store
            badges (`SupporterCredit`, same artwork and same animation at a fifth of
            the size) and a line in the footer mast (`DabtongCredit`, which is a
            server component and therefore the one that survives scripting being
            off). Do not restore the band without moving one of those. */}
        <Pricing />
        <MotifDivider />
        <Faq />
        <DownloadBand />
      </main>
      <SiteFooter />

      <script
        type="application/ld+json"
        // Static, developer-authored JSON — no user input reaches this.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
