import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/marketing/content";
import { PLAN_TIERS } from "@/lib/plans";
import { absoluteUrl } from "@/lib/site";
import { breadcrumbSchema, faqSchema, jsonLdScript } from "@/lib/seo";

/**
 * The owner-side landing page — `/for-salons`.
 *
 * ## Why a route, when `/#for-salons` already exists
 *
 * The homepage's owner band is a *section* of a page whose subject is booking a haircut.
 * An anchor cannot rank: it has no title, no description, no canonical and no URL of its
 * own, so the whole owner-side keyword cluster — "salon management software",
 * "salon queue management", "salon staff management", "salon booking system" — had nothing
 * on this domain to match against except a page about being a customer.
 *
 * The two audiences also want opposite things. A customer wants the shop nearest them; a
 * salon owner wants to know what the software does, what it costs and how to get it. One
 * page cannot lead with both, and the homepage rightly leads with the customer.
 *
 * ## Every capability named here is gated at the tier it is listed under
 *
 * The bullets are `PLAN_TIERS` from `lib/plans.ts` — the same source `/business/plans` and
 * the in-console paywall read, which is why they cannot quote different features or
 * different prices at the same owner.
 *
 * **Two of that file's Pro bullets used to be excluded from the prose here while the tier
 * list underneath printed them anyway, and that is the defect this note now records.** The
 * page's prose was careful and its rendered `<ul>` was not — so the two claims the site had
 * decided not to make were being published on it regardless, on the one owner-side page
 * built to rank.
 *
 * Both are fixed at the source, in `lib/plans.ts`, which is the only way to fix them once:
 *
 * - *"Priority placement" / "Shown higher in search"* — **deleted.** `Feature.priorityPlacement`
 *   was read by no code in either client; there is no plan term in `lib/recommendations.ts`
 *   and no ranking code in `supabase/`, so a Pro salon ranks exactly like a Basic one.
 *   Upstream removed the flag in `fb9791c` (audit A3-04); this repo carried it four days
 *   longer.
 * - *"No-show cover"* — **relabelled** to "Deposits & payments on a booking".
 *   `businesses.late_fee_amount` defaults to 0, is not in the owner-updatable column grant,
 *   and is referenced by no function in the schema. Nothing charges anybody for a no-show.
 *   The deposit half is real (`record_payment`, Pro-gated) and is all the label now claims.
 *
 * A price list is the one place on this site where a wrong claim becomes a refund
 * conversation, and the plan is flipped by an operator out of band, so there is no refund
 * path. **The lesson is structural: prose that omits a claim does not suppress it if a list
 * on the same page renders the claim from data.** Fix the data.
 *
 * ## It lives in `(documents)`
 *
 * That group supplies the public site's header and footer and calls no auth helper, so a
 * signed-out salon owner reading this gets the marketing chrome rather than the product's
 * customer nav — the same reason the four policy pages moved there.
 */

const HOW_IT_WORKS = [
  {
    title: "Customers find your salon and book a real time",
    body: "Your salon gets its own page on THO with your services, your prices, your team, your opening hours and your reviews. Customers in Bhutan search by area, service, price and rating, and book against your stylists' actual working hours — so a booking that lands is a booking you can keep.",
  },
  {
    title: "Walk-ins join a live queue instead of filling your shop",
    body: "Print the QR code THO makes for your door. A walk-in scans it, takes a place in your line and waits wherever they like while their phone shows their position. Behind the counter you see who is waiting, call the next customer, and add somebody who walked in without a phone.",
  },
  {
    title: "You run the day from one screen",
    body: "The console opens on a laptop or a phone at the counter. It shows the day hour by hour, the live queue, and everything you set up once — services and prices, who works when, your photos and your salon's details.",
  },
  {
    title: "You see how the shop is doing",
    body: "Bookings, takings, average ticket, how full your chairs are, which services sell, which stylist is busiest, and the hours you are actually busy. On Growth and Pro, with a monthly goal to measure against.",
  },
  /*
    Added 2026-08-18, and it is the only new *section* this sync added to the site.

    The upstream shop rework (slices 1–4) and prepaid packs gave an owner four genuinely new
    levers — sell, deliver, discount, sell ahead — and none of them had a sentence anywhere on
    this domain. This page is the right and only home for them: it is prose, so it does not
    fight an index-aligned icon array the way the homepage's four-panel band does, and its
    audience is somebody deciding what to pay for.

    Every clause is gated where it is claimed. Products, delivery, discount codes and recorded
    order payments are Growth+ (`products_select_public`'s plan check, `upsert_promo_code`,
    `record_order_payment`). Prepaid packs are Pro (`create_service_pack` re-derives the plan
    server-side). The pack sentence names the counter, because money never moves in-app.
  */
  {
    title: "You can sell more than time",
    body: "On Growth you can sell products from your salon page for collection or delivery, with your own discount codes, and record the cash when you take it. On Pro you can also sell ahead — a pack of ten cuts, paid at your counter, that the customer spends one visit at a time. THO does not take card payments or hold anyone's money: it records what was agreed and what is still owed.",
  },
] as const;

const FAQ = [
  {
    q: "What is THO for salon owners?",
    a: "THO is salon booking and management software for Bhutan. It lists your salon so customers can find and book it, runs your appointments and your walk-in queue, and keeps your services, prices, staff and opening hours in one place. Plans are Nu 399, Nu 699 or Nu 1,499 a month.",
  },
  {
    q: "How do salons manage appointments and queues on THO?",
    a: "A salon on THO gets a console showing today's bookings hour by hour and the live walk-in line side by side. You confirm, complete, reschedule or cancel a booking and the customer is told for you; you call the next person in the queue with one press; and you can add a walk-in who arrived without a phone. The customer's queue page updates itself, so nobody has to keep asking how long is left.",
  },
  {
    q: "How much does salon booking software cost in Bhutan?",
    a: "THO costs Nu 399 a month for Basic, Nu 699 for Growth or Nu 1,499 for Pro, billed monthly in Ngultrum. There is no free tier and no commission on bookings — customers pay you directly in the shop, and THO takes nothing from the transaction.",
  },
  {
    q: "Do my customers pay to book?",
    a: "No. Booking a chair and joining a walk-in queue are free for customers on THO, with no booking fee and no card required. Customers pay you in the shop, exactly as they do now. Only salons pay a subscription.",
  },
  {
    q: "How do I get my salon listed on THO?",
    a: "Get in touch and we will set your salon up with you — email thobhutansalons@gmail.com or message +975 17 71 65 23 on WhatsApp. We create the salon, then you add your services, prices and stylists and print your door QR code. Most shops are taking bookings the same afternoon.",
  },
  {
    q: "Can I manage more than one salon?",
    a: "Yes. If you run several salons, you switch between them in the console and each keeps its own services, staff, hours, bookings and plan.",
  },
  {
    q: "Does THO handle staff and payroll?",
    a: "THO holds your team, what each stylist does, and the hours each of them works — which is what customer bookings are checked against. On Pro it also records each stylist's commission and base pay and produces a monthly payroll figure, plus a Bhutan presumptive income-tax estimate from your turnover.",
  },
  {
    q: "Can I take payments through THO?",
    /*
      Extended for `record_order_payment` (Growth+, shop slice 3) — the order-side twin of
      `record_payment`. The "no card payments" sentence is the load-bearing one and stays
      first: it is the answer to the question actually being asked, and it is also why the
      pack and loyalty handshakes are shaped the way they are.
    */
    a: "No. Money changes hands between you and the customer in the shop. THO records what was booked or ordered and what it costs; on Growth you can record what a product order was paid, and on Pro a deposit or a payment against a booking, so the balance is on the receipt. THO does not process card payments and never holds your money.",
  },
  {
    q: "Can I sell packages, like ten haircuts up front?",
    /*
      New. `Feature.servicePacks`, Pro, and every clause is a rule in the seven pack RPCs:
      the request → confirm handshake (`request_pack_purchase` / `confirm_pack_purchase`), the
      snapshot at confirm time, credits derived rather than counted, expiry enforced at
      redemption, and one credit per booking. The no-refunds sentence is the one the app's own
      request sheet carries verbatim, and it belongs in the answer a salon owner reads before
      they start taking money for something.

      **The example's numbers are upstream's own** — "twelve credits, valid for Haircut or
      Beard trim, Nu 4,000, expires 12 months after purchase" is the pack the design spec
      describes, and twelve months is the edit sheet's default validity. Nothing here is a
      figure this site made up, which matters in an answer an engine may quote as a price.
    */
    a: "Yes, on Pro. You set up a pack — say twelve haircuts for Nu 4,000, valid twelve months — and a customer requests it in the app. You collect the money at your counter and confirm the request, and their credits go live. They spend one credit per visit, and the booking shows both of you what is left. Editing a pack later never changes what somebody already bought. THO does not hold the money or issue refunds: a pack is an agreement you honour in your shop.",
  },
] as const;

export const metadata: Metadata = {
  title: "Salon Management & Booking Software in Bhutan",
  description:
    "THO is salon booking and management software for Bhutan. Take online appointments, run a live walk-in queue by QR code, and manage staff, services, prices and clients from one screen. From Nu 399 a month.",
  alternates: { canonical: "/for-salons" },
  openGraph: {
    type: "website",
    url: "/for-salons",
    title: "Salon Management & Booking Software in Bhutan",
    description:
      "Take online bookings, run a live walk-in queue, and manage staff, services and clients from one screen. From Nu 399 a month.",
  },
};

export default function ForSalonsPage() {
  const trail = [
    { name: "Home", path: "/" },
    { name: "For salons", path: "/for-salons" },
  ];

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqSchema(FAQ, "/for-salons")) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema(trail)) }}
      />
      {/*
        `SoftwareApplication` again, but scoped to the owner side and priced.

        The homepage's node describes the free customer app; this one describes what a
        salon buys, so the two are separate `@id`s rather than one node trying to be both.
        `offers` is an array of the three real tiers with `BTN` and a monthly billing
        increment — the shape that lets an engine answer "how much is salon software in
        Bhutan" with a number rather than a link.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "@id": `${absoluteUrl("/for-salons")}#software`,
            name: `${brand.name} for salons`,
            applicationCategory: "BusinessApplication",
            applicationSubCategory:
              "Salon appointment booking, walk-in queue and salon management",
            operatingSystem: "Web, iOS, Android",
            url: absoluteUrl("/for-salons"),
            areaServed: { "@type": "Country", name: "Bhutan" },
            offers: PLAN_TIERS.map((tier) => ({
              "@type": "Offer",
              name: tier.name,
              description: tier.tagline,
              price: tier.priceLabel.replace(/[^\d]/g, ""),
              priceCurrency: "BTN",
              availability: "https://schema.org/InStock",
              priceSpecification: {
                "@type": "UnitPriceSpecification",
                price: tier.priceLabel.replace(/[^\d]/g, ""),
                priceCurrency: "BTN",
                billingIncrement: 1,
                unitText: "MONTH",
              },
            })),
          }),
        }}
      />

      <header>
        <nav aria-label="Breadcrumb" className="mb-sm">
          <ol className="text-caption text-muted gap-xxs flex items-center font-medium">
            <li>
              <Link href="/" className="hover:text-ink">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-ink">
              For salons
            </li>
          </ol>
        </nav>

        <h1 className="text-editorial-xl text-ink font-semibold tracking-tight">
          Salon booking and management software for Bhutan
        </h1>
        {/*
          The lead paragraph is the passage most likely to be extracted whole, so it
          answers "what is this" in its first sentence, names the country, and states the
          price — rather than opening with a promise and arriving at the facts later.
        */}
        <p className="text-body-lg text-body mt-base max-w-[46rem]">
          THO lets salons and barbershops in Bhutan take online bookings, run a live
          walk-in queue, and manage services, prices, stylists and customers from one
          screen. Customers book free; salons pay from Nu 399 a month. There is no
          commission on a booking — your customers pay you in the shop, as they do now.
        </p>
      </header>

      <section className="mt-xl" aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-editorial-md text-ink font-semibold">
          How THO works for a salon
        </h2>
        {HOW_IT_WORKS.map((item) => (
          <div key={item.title} className="mt-base">
            <h3 className="text-subheading text-ink font-semibold">{item.title}</h3>
            <p className="text-body-md text-body mt-xxs max-w-[46rem]">{item.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-xl" aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="text-editorial-md text-ink font-semibold">
          What THO costs a salon
        </h2>
        <p className="text-body-md text-body mt-xs max-w-[46rem]">
          Billed monthly in Ngultrum. Pay by bank transfer or mBoB — we switch your plan on
          within a day. There is no free tier.
        </p>

        {PLAN_TIERS.map((tier) => (
          <div key={tier.plan} className="border-hairline-soft mt-base border-t pt-base">
            <h3 className="text-subheading text-ink font-semibold">
              {tier.name} — {tier.priceLabel}
            </h3>
            <p className="text-body-sm text-muted mt-xxs">{tier.tagline}</p>
            <ul className="text-body-md text-body mt-xs list-disc pl-5">
              {tier.features
                // A "soon" line is a declaration, not a capability, and this page is read
                // by somebody deciding what to pay for.
                .filter((feature) => !feature.soon)
                .map((feature) => (
                  <li key={feature.label}>{feature.label}</li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="mt-xl" aria-labelledby="owner-faq-heading">
        <h2 id="owner-faq-heading" className="text-editorial-md text-ink font-semibold">
          Questions salon owners ask
        </h2>
        <dl className="mt-base max-w-[46rem]">
          {FAQ.map((item) => (
            <div key={item.q} className="border-hairline-soft py-base border-b first:border-t">
              <dt>
                <h3 className="text-subheading text-ink font-semibold">{item.q}</h3>
              </dt>
              <dd className="text-body-md text-body mt-xs">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-xl" aria-labelledby="start-heading">
        <h2 id="start-heading" className="text-editorial-md text-ink font-semibold">
          Get your salon on THO
        </h2>
        <p className="text-body-md text-body mt-xs max-w-[46rem]">
          {/*
            Sign-up is customer-only — an owner is onboarded by an operator who creates the
            account and the salon together, because `businesses.status` defaults to pending
            review and a self-served owner would land on an empty console. So this points at
            a mailbox and a WhatsApp number rather than at `/sign-up`, which cannot serve them.
          */}
          Email{" "}
          <a href={`mailto:${brand.supportEmail}`} className="text-rausch-cta font-medium">
            {brand.supportEmail}
          </a>{" "}
          or message{" "}
          <a
            href={`https://wa.me/${brand.whatsapp.replace(/[^\d]/g, "")}`}
            className="text-rausch-cta font-medium"
            rel="noopener noreferrer"
          >
            {brand.whatsapp}
          </a>{" "}
          on WhatsApp and we will set your salon up with you. If you already run a salon on
          THO, <Link href="/sign-in" className="text-rausch-cta font-medium">sign in</Link>{" "}
          to your console.
        </p>
        <p className="text-body-md text-body mt-base max-w-[46rem]">
          Curious what your customers will see? Browse the{" "}
          <Link href="/salons" className="text-rausch-cta font-medium">
            salons already on THO
          </Link>{" "}
          or the ones in{" "}
          <Link href="/salons/thimphu" className="text-rausch-cta font-medium">
            Thimphu
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
