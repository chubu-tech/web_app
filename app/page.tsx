import { DownloadBand } from "@/components/download-band";
import { Faq } from "@/components/faq";
import { ForSalons } from "@/components/for-salons";
import { Hero } from "@/components/hero";
import { Pricing } from "@/components/pricing";
import { QueueLive } from "@/components/queue-live";
import { ServiceMarquee } from "@/components/service-marquee";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TwoWays } from "@/components/two-ways";
import { MotifDivider } from "@/components/ui/bhutan";
import { brand, faq, hero, pricing } from "@/lib/content";

const SITE = `https://${brand.domain}`;

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
      url: SITE,
      slogan: brand.tagline,
      email: brand.supportEmail,
      areaServed: { "@type": "Country", name: "Bhutan" },
      address: { "@type": "PostalAddress", addressCountry: "BT" },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      url: SITE,
      name: brand.name,
      description: hero.purpose,
      inLanguage: "en",
      publisher: { "@id": `${SITE}/#organization` },
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
        // A free tier carries no digits ("Free"), and an empty price string is
        // invalid structured data — emit an explicit zero.
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

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {/* 1. What this is + get the app. */}
        <Hero />
        <ServiceMarquee />
        {/* 2. The two ways to use it. */}
        <TwoWays />
        {/* 3. The queue, working. */}
        <QueueLive />
        {/* 4. The owner side. */}
        <ForSalons />
        {/* 5. Who pays what, 6. questions, 7. download. */}
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
