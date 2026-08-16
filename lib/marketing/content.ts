/**
 * Landing page content — copy and imagery in one place.
 *
 * IMAGERY: every photo is a placeholder sourced from Unsplash. Replace the
 * `u()` URLs with real salon photography (drop files in `public/photos/` and
 * swap to `/photos/<name>.jpg`) before launch — the layout is photography-led,
 * so the shots do most of the design work.
 *
 * COPY RULES:
 * - Plain words only. No "dashboard", "analytics", "CRM", "admin" — a salon
 *   owner in Thimphu should never need to decode a term.
 * - One idea per block. The product's purpose is stated once, in `hero.purpose`.
 * - Say who pays. Customers never pay; only salons subscribe. That has to be
 *   unmissable, not buried in the FAQ.
 *
 * PRICES AND PLAN FEATURES: the source of truth is
 * `app/lib/business/plans/plans_config.dart` in the tho repo — that is what an
 * owner actually sees in the app. Mirror it here; never the other way round.
 * (The prices are flagged as placeholders there too, so re-check before print.)
 */

const UNSPLASH = "https://images.unsplash.com";

/** Build a sized, cropped Unsplash URL. */
function u(id: string, w = 1200, h?: number) {
  const crop = h ? `&h=${h}&fit=crop&crop=entropy` : "&fit=max";
  return `${UNSPLASH}/${id}?auto=format&q=80&w=${w}${crop}`;
}

export const brand = {
  /**
   * The platform, the company and the site. **Renamed from "Bhutan Salons" to
   * "THO"** — every surface reads this constant, so the header, the footer, the
   * page title, the OG image, the JSON-LD and the privacy policy all moved
   * together. Only `waitlist.back` had it hardcoded, and that is fixed too.
   *
   * `domain` deliberately did NOT change: bhutansalons.com is the domain that is
   * actually registered and serving. (`supportEmail` was in that sentence too, and has
   * since changed for its own reason — see the note on it below.)
   */
  name: "THO",
  /**
   * What you install. Still cased "Tho" because that is literally the Android
   * label, the iOS display name and the store listing — the platform is now the
   * same word, so this is a casing distinction rather than a naming one. Use it
   * where the page points at the download; `name` everywhere else.
   */
  appName: "Tho",
  tagline: "Book the chair. Skip the wait.",
  domain: "bhutansalons.com",
  /**
   * Where the product lives — **the same origin as this page, since the merge.**
   *
   * This used to be `NEXT_PUBLIC_APP_URL`, an absolute URL to `tho_web` on another origin,
   * with a `http://localhost:3000` fallback. That is now actively wrong twice over: the
   * product is these same routes, and an unset variable in production would have pointed a
   * visitor at their own machine. The env var is gone and the paths below are relative.
   *
   * Nothing reads these today — the header's "Sign in" was their only consumer and is parked
   * until the site is deployed. They are kept because that restore is a documented
   * intention, and the point of writing them down is that whoever performs it links to
   * `/sign-in` rather than reintroducing a cross-origin link to ourselves.
   */
  appPaths: {
    signIn: "/sign-in",
    discover: "/discover",
  },
  /**
   * The operator console in `../admin`, a third origin. Same mechanism and same
   * caveats as `appUrl` above — inlined at build, so a change needs a rebuild.
   *
   * `/login` is grounded: it is a real route in that repo and its proxy sends every
   * unauthenticated request there. **The port is not.** All three apps run a bare
   * `next dev`, so they fight over 3000 and whichever starts third happens to land
   * on 3002 — a plausible default, not a configured one. Set `NEXT_PUBLIC_ADMIN_URL`
   * locally rather than relying on the start order.
   */
  adminUrl: (process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3002").replace(/\/+$/, ""),
  /**
   * The mailbox on the footer and in the Organization JSON-LD. **Two readers, one
   * constant** — the structured data a crawler files under this Organization has to name
   * the same address a human reads at the bottom of the page, or the two disagree about
   * how to reach the same company.
   *
   * It was `hello@bhutansalons.com`, which **did not exist**, and then briefly a personal
   * address, on the reasoning that a real mailbox beats a branded one nobody opens. This
   * is that role address arriving: branded *and* read.
   *
   * **`legal.contactEmail` is deliberately still the old one and is not this.** It is the
   * address on a legal obligation — account deletion within `legal.deletionDays` — so it
   * moves when somebody decides it moves, not as a side effect of retitling the support
   * inbox. The two being one constant apart is exactly what makes that a decision rather
   * than a search-and-replace.
   */
  supportEmail: "thobhutansalons@gmail.com",
  /**
   * **A real number now**, replacing the `+975 17 00 00 00` placeholder. Two things read
   * it, so it had to be a form both accept: the footer's phone row (`tel:`) and the
   * WhatsApp icon in the same footer, which strips to digits for `wa.me/97517716523`.
   *
   * Kept in the international form the placeholder used, so those two derivations stay
   * correct — WhatsApp will not resolve a bare local number. The digits are 17716523; the
   * spacing is display only.
   */
  whatsapp: "+975 17 71 65 23",
  /** Dzongkha greeting, romanised so it renders on every device. */
  greeting: "Kuzuzangpo la",
  cities: ["Thimphu", "Paro", "Phuentsholing"],
  /**
   * Store listings. TODO: paste the real URLs once the apps are published —
   * until then the badges fall back to the on-page download section.
   */
  stores: { ios: "", android: "" },
  /**
   * Social profiles, for the footer's Follow us row.
   *
   * **WhatsApp is the only real one, and it is now genuinely real** — derived from
   * `whatsapp` above, which used to be the placeholder +975 17 00 00 00 this note told
   * you to check before launch. It has been checked; it is a live number.
   *
   * The other three have no account yet: paste the profile URLs here and the icons
   * point at them with no other edit. Until then they fall back to the site root,
   * which is a harmless destination rather than a 404.
   */
  social: {
    facebook: "",
    instagram: "",
    tiktok: "",
  },
} as const;

/**
 * Root-relative (`/#id`, not `#id`) so the same header works on `/privacy` and
 * `/q/<id>`, where a bare hash would only rewrite the URL and scroll nowhere.
 * On the home page it still resolves to a plain anchor scroll.
 */
export const nav = [
  { label: "Find a salon", href: "/#find" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Live queue", href: "/#queue" },
  // A real route since `/for-salons` shipped — an anchor cannot rank, and this is the
  // entry point for every owner-side query.
  { label: "For salons", href: "/for-salons" },
  { label: "Pricing", href: "/#pricing" },
] as const;

/**
 * The link into the product — **parked, and currently rendered nowhere.**
 *
 * The reason it was parked has changed completely, and the note is worth updating rather
 * than deleting. It used to point at `brand.appUrl`, an absolute URL to a `tho_web` that
 * was not deployed, so on every real visit the button led to `http://localhost:3000` —
 * *the visitor's own machine*. That was worse than a 404.
 *
 * **That hazard is gone: the product is these same routes now.** `/sign-in` is a real
 * route in this application, same origin, no environment variable involved and nothing to
 * misconfigure. What keeps the button parked is a product decision rather than a technical
 * one — the site is not launched, and the download calls to action all open the waitlist.
 *
 * The restore is now one step, not two: re-add the three render sites, all of which read
 * from here — the bar's pill and the sheet's footer in `components/marketing/site-header.tsx`,
 * and the quick-links row in `components/marketing/site-footer.tsx`. Each carries a comment
 * naming this constant.
 *
 * Two things still hold. One label serves both audiences, because `/sign-in` picks the
 * landing route from the account's role (owner → `/business`, customer → `/discover`). And
 * there is deliberately no `?next=`: `safeNext` reduces the parameter to a same-origin path,
 * and the marketing homepage is not somewhere to send somebody who just signed in.
 *
 * It is also deliberately not a row in `nav` above: that array feeds the underline-animation
 * links and the 2rem sheet list, so a sign-in row would land in the wrong visual group.
 */
export const signIn = {
  label: "Sign in",
  href: brand.appPaths.signIn,
} as const;

/**
 * The search band. Plain words on purpose — a salon owner or a customer in
 * Thimphu should not have to decode "filters" or "facets".
 *
 * Note what the wording does NOT claim: choosing a day and a time narrows to
 * salons that are *open* then. Picking an actual slot happens in the app, since
 * there is no public availability lookup.
 */
export const search = {
  eyebrow: "Find a salon",
  /* No `_accent_` markers: this heading reads in one voice. The serif italic is
     still the house style for an emphasised word elsewhere — see `pricing.title`. */
  title: "What do you need, and when?",
  body: "Every salon here is live on Tho. Pick what you want then book or join the queue.",
  treatment: {
    label: "What you want done",
    placeholder: "Anything",
    anyLabel: "Anything",
    heading: "Popular with these salons",
  },
  place: {
    label: "Where",
    placeholder: "Anywhere",
    anyLabel: "Anywhere",
    nearMe: "Use my location",
    locating: "Finding you…",
    denied: "We couldn't get your location — pick a town instead.",
    unsupported: "This browser can't share a location — pick a town instead.",
  },
  when: {
    label: "When",
    placeholder: "Any day",
    anyLabel: "Any day",
    today: "Today",
    tomorrow: "Tomorrow",
    timeLabel: "Time of day",
    anyTime: "Any time",
    note: "Shows salons open then. You'll pick an exact time in the app.",
  },
  submit: "Search",
  clear: "Clear",
  counts: {
    salons: "Salons",
    treatments: "Treatments",
    professionals: "Stylists",
  },
} as const;

/** Copy for the salon grid — recommendations, nearby, and search results. */
export const results = {
  /** A shortlist, and the wording has to say so — see `recommended()`. */
  recommendedTitle: "Recommended",
  recommendedBody:
    "Our pick of the highest-rated salons customers have actually reviewed.",
  nearbyTitle: "Near you",
  nearbyBody: "The closest salons to where you are now.",
  nearbyPrompt: "Share your location and we'll show the salons closest to you.",
  nearbyAction: "Show salons near me",
  nearbyNone:
    "None of the salons near you have put themselves on the map yet.",
  resultsTitle: "Salons",
  partialHeading: "Might also suit",
  partialBody:
    "These haven't filled in everything yet, so we couldn't check them against all of your choices.",
  emptyTitle: "Nothing matched everything",
  emptyBody: "Try widening one of your choices.",
  featured: "Featured",
  noRating: "New",
  cta: "Book in the app",
  offline:
    "The salon list isn't available right now. Everything else on this page still works.",
} as const;

export const hero = {
  eyebrow: brand.cities.join(" · "),
  titleLines: [["Book", "your", "chair."], ["Skip", "the", "wait."]],
  accents: ["wait."],
  /** The product's purpose, in one sentence. Addressed to the customer. */
  purpose:
    "Book ahead or scan the QR code to join the queue and avoid waiting in line.",
  ownerCta: { label: "I run a salon", href: "#for-salons" },
  image: u("photo-1585747860715-2ba37e788b70", 1800, 1200),
  imageAlt: "Warmly lit Bhutanese salon interior with mirrors and styling chairs",
  liveCard: {
    label: "You're in the queue",
    salon: "Norling Hair Studio",
    position: 3,
    waitMinutes: 18,
  },
} as const;

export const services = [
  "Haircut",
  "Beard trim",
  "Colour",
  "Blow-dry",
  "Bridal",
  "Manicure",
  "Head massage",
  "Shave",
] as const;

/** The two ways a customer gets into a chair — the heart of the product. */
export const twoWays = {
  eyebrow: "How it works",
  title: "Two ways into the chair",
  body: "Plan ahead or walk in. Either way you know exactly when it's your turn.",
  options: [
    {
      tag: "Book ahead",
      title: "Pick a time that fits your day",
      body: "Choose the salon, the stylist and the slot. Confirmed on the spot, with a reminder before your schedule.",
      points: ["Prices shown up front", "Reschedule in two taps"],
      image: u("photo-1521590832167-7bcbfaa6381f", 900, 1100),
      alt: "Bright salon floor with styling chairs and mirrors",
    },
    {
      tag: "Walk in & scan",
      title: "Join the queue with one scan",
      body: "Scan the QR at the door and take your place in the virtual queue — then wait wherever you like.",
      /*
        "Pinged two turns ahead" was the second point and it was **not true**. No
        notification is delivered on any platform: every `queue_your_turn` row in the
        outbox is `failed` with "no deliverable channel", `devices` has no rows, and Web
        Push is deferred by decision. The same claim was in `faq` and is corrected there in
        the same change — they had to move together, since a page that contradicts its own
        FAQ is worse than either version on its own.

        What replaced it is what the queue page actually does, and it is the thing the
        product is genuinely better at than a paper list: the position updates itself.
      */
      points: ["No app needed to join", "Your place updates live"],
      image: u("photo-1556742049-0cfed4f6a45d", 900, 1100),
      alt: "Customer checking in at a salon counter with their phone",
    },
  ],
} as const;

export const queueSection = {
  eyebrow: "Virtual queue",
  title: "Watch the line move, live",
  body: "Your position and wait time update as each chair frees up. Run your errands and walk back when you're two away.",
  qrCaption: "Scan at the door",
  qrSub: "You're in line in 3 seconds",
  queue: [
    { name: "Sonam D.", service: "Beard trim" },
    { name: "Karma W.", service: "Haircut + wash" },
    { name: "You", service: "Haircut" },
    { name: "Tashi P.", service: "Colour touch-up" },
    { name: "Pema L.", service: "Kids cut" },
  ],
} as const;

export const forSalons = {
  eyebrow: "For salon owners",
  title: "Run the whole shop from one screen",
  body: "Today's bookings, the walk-in line, your stylists, your price list and how the week is going — all in one place you open on a laptop or a phone.",
  features: [
    {
      title: "Today's bookings",
      body: "See every chair by the hour. Move a booking and the customer is told for you.",
    },
    {
      title: "The walk-in line",
      body: "See who scanned in, change the order, or close the line when the shop is full.",
    },
    {
      title: "Stylists & prices",
      body: "Set who works when, what you offer, and what each service costs.",
    },
    {
      title: "How the week went",
      body: "Bookings, customers who came back, and your busiest hours — in plain numbers.",
    },
  ],
} as const;

/**
 * The proof band, between the owner section and the price list.
 *
 * ## Why this is figures and not quotes
 *
 * The slot it fills is the one a landing page normally gives to testimonials, and
 * this page deliberately has none. `MARKETING-ARCHITECTURE.md` records why, under
 * "Before this goes live": *"Social proof was removed on purpose: the earlier
 * testimonials and stat figures were invented. Add them back only with real,
 * consented quotes and measured numbers."* Writing a salon owner's words for them
 * is not a design decision, and a redesign is not a licence to reopen it.
 *
 * So the band answers the same question — *is anyone actually using this?* — with
 * the only material that needs nobody's consent: **counts of what is already live**,
 * read from the same build-time salon index the search band runs on. Every figure is
 * derived at render from `SalonIndex`; there is no number typed into this file, and
 * there is nothing here that can drift from what the search band shows a few
 * hundred pixels above it.
 *
 * The band renders **nothing at all** when the index is empty — a build that could
 * not reach the database would otherwise print four zeroes under a heading that says
 * "live right now".
 *
 * When there are real, consented quotes, they belong beside this — not instead of
 * it.
 */
export const proof = {
  eyebrow: "Live right now",
  title: "Already open for business",
  body: "Counted from the salons on Tho today, refreshed every hour.",
  stats: {
    salons: "Salons listed",
    treatments: "Treatments to book",
    professionals: "Stylists and barbers",
    towns: "Towns covered",
  },
} as const;

/**
 * **Prices are mirrored from `../tho/app/lib/business/plans/plans_config.dart`, never
 * set here.** That file is what a salon owner actually sees inside the app, and it is
 * explicit: the final launch prices set 2026-08-03 are **Nu 399 / 699 / 1,499** a month,
 * and **there is no free tier** — Basic is the entry price, not a giveaway, so no copy
 * anywhere may describe any *salon* plan as free. `../tho_web/lib/plans.ts` carries the
 * same three figures.
 *
 * This block had drifted from both of them on two counts: Basic read *"Free"*, and
 * Growth read *"Nu 799"* — a price no version of the product has ever charged. Since the
 * whole page's claim is "customers never pay, only salons do", a wrong salon price is
 * the one number here that has to be right.
 *
 * **What is still free is the customer**, and that is a different claim carried by
 * different copy: the `customer` panel below (Nu 0, forever), the first FAQ answer and
 * the download band. None of those changed and none of them should — see the "Say who
 * pays" rule in `AGENTS.md`. (`hero.freeNote` was a fourth carrier of it and is gone —
 * the hero badge was removed, so the hero itself no longer says who pays.)
 *
 * ## The feature lists mirror the entitlements gate, not a wish list
 *
 * Every bullet below is a capability that exists and is gated at the tier it is listed
 * under. The tier split is `../tho/app/lib/data/entitlements.dart` (ported verbatim as
 * `lib/entitlements.ts`), which is the only thing that decides what a plan unlocks;
 * `plans_config.dart` is the app's own rendering of the same three cards. Anything a
 * salon cannot actually do at the tier it is sold under does not belong here — a price
 * list is the one place on this page where a wrong claim is a refund conversation, and
 * the plan is flipped by an operator out-of-band, so there is no refund path.
 *
 * **Two bullets were removed as unimplemented**, both from Pro, and both were flagged by
 * the app's own pre-launch audit (`../tho/docs/launch/2026-08-06-prelaunch-audit-findings.md`):
 *
 * - *"Shown higher in search"* — finding **A3-04**, filed as a truthfulness problem
 *   rather than a feature gap. `Feature.priorityPlacement` is read by **no code in either
 *   client**: `recommendations.dart`'s `_score` has no plan term and there is no ranking
 *   code in `supabase/` at all, so a Pro salon ranks identically to a Basic one. Put the
 *   bullet back only when the recommender actually scores the plan.
 * - *"Deposits & no-show cover"* — the deposit half is real (`record_payment`, Pro-gated,
 *   with kinds `deposit | balance | full | refund`) and is now stated as what it is. The
 *   **no-show cover half is not built**: `businesses.late_fee_amount` exists with a
 *   default of 0, is not in the owner-updatable column grant, and is referenced by no
 *   function in the schema. Nothing charges anybody for a no-show.
 *
 * **Three implemented capabilities were added**, each verified against its gate rather
 * than inferred from a plan card: offers (`offers/offers_screen.dart` carries no plan
 * check at all, so it is a Basic feature), rebooking nudges
 * (`enqueue_rebooking_nudges` filters `plan in ('growth','pro')`) and style selection at
 * booking (`set_booking_hairstyle` is Pro-gated in SQL and `time_step.dart` passes
 * `offerStyles: entitlements.has(Feature.stylePicker)`). The last one is a Pro perk the
 * app's own card omits.
 *
 * Two things are deliberately NOT claimed, and both are traps:
 *
 * - **The salon's opening hours.** The Flutter app only ever *reads* `business_hours`
 *   (`Api.businessHours` is a select; there is no writer), so an owner cannot edit them
 *   in the app. `tho_web` has an editor. What both clients can edit is a **stylist's**
 *   working hours, which is also the table that actually gates bookings — hence "who
 *   works when" rather than "your opening hours".
 * - **The five hidden analytics cards.** New vs returning, Top services, Staff
 *   leaderboard, Completion & no-shows and Peak hours are commented out of
 *   `insights_tab.dart` at the owner's request (THO-55) — working features, not dead
 *   code, and `tho_web` draws all nine. Growth's bullet therefore names only what the app
 *   renders today: the KPI figures, the revenue trend and the monthly goal.
 */
export const pricing = {
  eyebrow: "Who pays what",
  title: "Customers never pay. Only salons do.",
  body: "Booking a chair and joining a queue cost you no booking fee.",
  note: "Paid salon plans are billed monthly in Ngultrum. Pay by bank transfer or mBoB — we switch your plan on within a day.",
  /** The free-for-customers panel that sits beside the salon plans. */
  customer: {
    label: "If you're booking a haircut",
    price: "Nu 0",
    period: "forever",
    /*
      "and getting reminders" was removed from the end of this sentence. Reminders are a
      **Growth** feature — `enqueue_booking_reminders` returns early below that tier — and
      13 of the 16 live salons are Basic, so for most customers no reminder is ever sent.
      The app's own audit files that as A4-01: the per-booking "Remind me" toggle is shown
      at every salon and only enqueues at some. Listing it among the things that are free
      for customers made a salon's plan read as a customer entitlement.

      What is left is unconditional at every tier: search, booking and the queue. The same
      claim is still made in `faq[0]` and in `twoWays.options[0].points` — fix those
      together with this one, or not at all, so the page does not contradict itself.
    */
    body: "Everything a customer needs is free — searching salons, booking a time and joining the walk-in queue.",
    points: ["No booking fee", "No card needed", "No charge at the door"],
    cta: { label: "Get the app", href: "#download" },
  },
  salonHeading: "If you run a salon",
  tiers: [
    {
      name: "Basic",
      price: "Nu 399",
      period: "/mo",
      tagline: "Get found and take bookings.",
      /*
        Nothing here is gated: `Entitlements` unlocks the empty set at Basic, so every
        line is a capability an ungated salon has today. Four were missing from this card
        and are real — the service list and prices, a stylist's working hours, the message
        thread with a customer, and offers, which carry no plan check anywhere.

        "1 stylist" is enforced by the `staff_members_basic_cap` trigger
        (`20260807000004`), not just by the Dart cap — it raises P0001 on an insert that
        lands active or an update that flips inactive → active.
      */
      features: [
        "Listed in the app, found by customers nearby",
        "Online bookings, confirmed on the spot",
        "Today's bookings, hour by hour",
        "Today's numbers at a glance",
        "Your services, prices and who works when",
        "Your profile, photos and reviews",
        "Message customers and post offers",
        "1 stylist",
      ],
      cta: "Start with Basic",
      featured: false,
    },
    {
      name: "Growth",
      price: "Nu 699",
      period: "/mo",
      tagline: "For a full team and a full book.",
      /*
        The eight `_growthAdds` entitlements, plus rebooking nudges — which is a ninth
        Growth capability with no `Feature` of its own, gated directly in SQL
        (`enqueue_rebooking_nudges` filters `plan in ('growth','pro')`).

        Seven of the eight are enforced server-side. `weekView` is the exception and
        structurally so: it reads the owner's own bookings through RLS, so there is no RPC
        to gate — a trivially bypassable perk, not a disclosure.

        "your busiest hours" is gone from the last line: the peak-hours heatmap is one of
        the five cards commented out of the app's Insights tab (THO-55). The three figures
        named instead are what the app actually draws at Growth.
      */
      features: [
        "Everything in Basic",
        "As many stylists as you like",
        "The walk-in queue, joined by QR at your door",
        "Week view",
        "Reminders sent for you",
        "Your customer list and visit history",
        "Nudges that bring back customers who drift",
        "Sell products in the app",
        "Rewards for regulars",
        "How the week went — bookings, takings, monthly goal",
      ],
      cta: "Choose Growth",
      featured: true,
    },
    {
      name: "Pro",
      price: "Nu 1,499",
      period: "/mo",
      tagline: "For busy shops with a big team.",
      /*
        The three `_proAdds` entitlements that are real, split by what an owner actually
        does with them. Every one raises P0001 below Pro in SQL, quoted from the
        migrations: 'payroll requires Pro' (`set_staff_pay`, `payroll_report`), 'tax report
        requires Pro' (`tax_estimate`), 'payments require Pro' (`record_payment`).

        The customer's phone and WhatsApp sit under `Feature.deposits` rather than a
        contact feature of their own — an odd bundling, but it is the live gate
        (`client_detail_screen.dart:98`, `business_booking_detail_screen.dart:158`).

        Style selection is `Feature.stylePicker`, added here because it is a real Pro perk
        that the app's own card forgets to sell: `set_booking_hairstyle` is Pro-gated and
        the customer's booking flow only offers the picker when the salon has it.

        "Shown higher in search" was here and is not a feature — see the note on A3-04
        above. Do not restore it without a plan term in the recommender.
      */
      features: [
        "Everything in Growth",
        "Staff pay, commissions and payroll",
        "A Bhutan income-tax estimate",
        "Deposits and payments recorded on a booking",
        "Call or WhatsApp a customer from their booking",
        "Customers pick the exact style they want",
      ],
      cta: "Choose Pro",
      featured: false,
    },
  ],
} as const;

/**
 * The questions, and the answers a search engine or an assistant will quote.
 *
 * This list grew from four to twelve, and the shape of every entry changed. Both are
 * deliberate and neither is padding.
 *
 * ## An answer is extracted without its page, so it has to stand up alone
 *
 * These strings are lifted into `FAQPage` markup by `app/(marketing)/page.tsx` and, from
 * there, into an answer box or an assistant's reply with nothing around them. So each one
 * is written to the rules that survive that trip:
 *
 * - **The first sentence answers the question.** A paragraph that builds to its point gets
 *   truncated before the point.
 * - **No pronoun subjects.** *"It's free"* is useless once extracted; *"Booking a salon on
 *   THO is free"* is quotable. Every answer names THO or the salon rather than leaning on
 *   the question for its subject.
 * - **The place is named in the sentence, not inferred.** An engine answering *"how do I
 *   book a salon in Bhutan"* cannot infer the country from a page it did not retrieve.
 * - **Numbers, not adjectives.** "Nu 399 a month" is citable; "affordable" is not.
 *
 * ## Two answers were removed because they were not true
 *
 * This is the important part and it is not a style change.
 *
 * - ***"What if I miss my turn?"* claimed *"You get a message two turns ahead, and again
 *   when you're next."*** Nothing sends that message on any platform. `AGENTS.md` is
 *   explicit: every `queue_your_turn` row in the outbox is `failed` with "no deliverable
 *   channel", `devices` has no rows, and Web Push is deferred by decision — so the promise
 *   is kept by nothing. The replacement says what the product actually does, which is that
 *   the page updates itself. The same false claim lives in `twoWays.options[1].points` as
 *   *"Pinged two turns ahead"* and is corrected there in the same change, because a page
 *   that contradicts its own FAQ is worse than either version alone.
 * - ***"Create an owner account"*** described a flow that does not exist. Sign-up is
 *   customer-only by design — an owner is onboarded by an operator who creates the account
 *   and the salon together, and `businesses.status` defaults to `pending` review, so a
 *   self-served owner would land on a console with no salon in it. The answer now
 *   describes the real path.
 *
 * The rule both corrections come from is this repo's own: **say only what the row can
 * support.** It was written about notification copy and it binds harder here, because an
 * FAQ answer is a claim attributed to us and repeated by machines that will not check it.
 */
export const faq = [
  {
    q: "Does it cost anything to book a haircut?",
    /*
      Reminders dropped from the list, for the reason spelled out on `pricing.customer`:
      they are a Growth feature, so at a Basic salon — 13 of the 16 live ones — none is
      ever sent, and naming them here made a salon's plan read as a customer entitlement.
      This answer and that panel carried the same sentence, so they had to change together
      or the page would answer its own pricing section.

      The "who pays" answer itself is untouched, and still lands in all four places
      `AGENTS.md` requires: the hero chip, this answer, the pricing lead panel and the
      download band.
    */
    a: "No — never. Searching salons, booking a time and joining the walk-in queue are all free for customers on THO. There is no booking fee and nothing extra to pay at the salon. Salons are the ones who pay, from Nu 399 a month.",
  },
  {
    q: "What is THO?",
    a: "THO is a salon and barber booking service for Bhutan. You can find a salon near you, see its services and prices, book an appointment for a specific time, or join a salon's walk-in queue from your phone and watch your place in line. THO is free for customers; salons pay a monthly subscription to be listed and to run their bookings.",
  },
  {
    q: "How do I book a salon appointment in Bhutan?",
    a: "Open THO at bhutansalons.com, search for a salon or barber near you, and open its page to see its services and prices. Choose the services you want, pick a stylist or leave it to the salon, then choose a date and time from what is actually free. The booking is confirmed straight away and you can reschedule or cancel it from your bookings.",
  },
  {
    q: "How do I find salons in Bhutan?",
    a: "Browse every salon and barber on THO at bhutansalons.com. You can search by name or area, filter by service, price, rating and distance, sort by nearest or best rated, or open the map to see which salons are close to you. Most listed salons are in Thimphu, with more in Paro and Phuentsholing.",
  },
  {
    q: "How can I join a salon queue without waiting?",
    a: "Scan the QR code at the salon's door, or open the salon's page on THO and join from there. THO puts you in the salon's live walk-in line and shows your position and the rough wait, so you can go and do something else instead of sitting in the shop. The page updates itself as each chair frees up — there is nothing to refresh.",
  },
  {
    q: "Do I need the app to join a queue?",
    a: "No — scanning the salon's QR code puts you in line straight away in your phone's browser. Nothing needs to be installed to search salons, book an appointment or join a walk-in queue on THO.",
  },
  {
    q: "What if I miss my turn?",
    /*
      Rewritten. The old answer promised a message two turns ahead and again when you are
      next; nothing on any platform sends it — see this block's own header. What follows is
      what the product genuinely does: a self-updating page, and a salon that can pass a
      place on. Both are observable in `queue_active_line` and `set_queue_status`.
    */
    a: "Keep the queue page open and it updates itself, so you can see when you are getting close and walk back. If you are not there when your turn comes, the salon can hold your place or pass it to the next person, and you will see that on the page. THO does not send you a text or a push notification about your turn.",
  },
  {
    q: "Is there a salon booking app in Bhutan?",
    /*
      Answered for the launch state the user confirmed on 2026-08-16: the web product is
      live and complete, the store listings are not. `brand.stores` is still empty, so this
      must not tell anyone to look for Tho on either store — a promise neither store can
      currently keep, and the reason `download.body` is written the way it is.
    */
    a: "Yes. THO works in any web browser at bhutansalons.com — you can search salons, book an appointment and join a walk-in queue without installing anything. Mobile apps for iOS and Android are in development; join the waitlist and we will email you the day they land.",
  },
  {
    q: "Which salons in Thimphu can I book on THO?",
    a: "Most of the salons and barbers on THO are in Thimphu, on and around Norzin Lam, Chang Lam, Doebum Lam and the Clock Tower. Each has its own page with its services, prices, team, opening hours and reviews, and you can see them all together at bhutansalons.com/salons/thimphu.",
  },
  {
    q: "I run a salon. How do I get started?",
    /*
      Rewritten: sign-up is customer-only. `AGENTS.md` — "an owner is onboarded by an
      operator who creates the account *and* the salon together, and `businesses.status`
      defaults to `pending` review. A self-served owner would land on a console with no
      salon in it." The old answer sent owners to a form that cannot serve them.
    */
    a: "Get in touch and we will set your salon up with you — email thobhutansalons@gmail.com or message +975 17 71 65 23 on WhatsApp. We create your salon, then you add your services, prices and stylists and print the QR code for your door. Plans start at Nu 399 a month and most shops are taking bookings the same afternoon.",
  },
  {
    q: "How do salons manage their appointments and queues on THO?",
    a: "A salon on THO gets a console it opens on a laptop or a phone. It shows the day's bookings hour by hour, the live walk-in line with a button to call the next customer, and the salon's services, prices, stylists and working hours. Salons on Growth and Pro also get a client book, product orders, loyalty rewards and reporting on bookings, takings and busy hours.",
  },
  {
    q: "What does THO cost for a salon?",
    a: "Salon plans on THO are Nu 399, Nu 699 or Nu 1,499 a month, billed in Ngultrum. Basic gets you listed and takes online bookings with one stylist. Growth adds unlimited stylists, the walk-in queue, automatic reminders, a client book, products, loyalty and reporting. Pro adds payroll, a Bhutan income-tax estimate and deposits recorded against a booking. There is no free salon tier, and customers never pay anything.",
  },
] as const;

export const download = {
  eyebrow: "Coming soon",
  title: "The chair is ready when you are",
  /**
   * Written for the pre-launch state. The app is not on either store yet, so
   * this may not tell anyone to "look for Tho on the App Store" — that is a
   * promise the stores cannot currently keep. When `brand.stores` is filled in,
   * revert this to the download wording and the badges become real links again
   * on their own (see `StoreBadges`).
   */
  body: "Tho is nearly here. Join the waitlist and we'll email you the moment it's on the App Store and Google Play — free to download, free to book.",
  image: u("photo-1503951914875-452162b0f3f1", 1800, 1000),
  alt: "Barber giving a client a close shave",
} as const;

/**
 * The waitlist — what the download call to action does until the app ships.
 *
 * Every string a visitor can see while joining lives here, including the error
 * messages, because a form is mostly copy. The three outcomes are deliberately
 * distinct: **joined** is new, **already** is a repeat address, and an error is
 * neither. Collapsing "already" into "joined" would be a small lie told to
 * somebody who is trying to check whether their first attempt worked.
 */
export const waitlist = {
  /** The label every download CTA carries while the stores are empty. */
  cta: "Join the waitlist",
  eyebrow: "Coming soon",
  title: "Our mobile app is _coming soon_",
  body: "Enter your email address to join the waitlist. We'll notify you as soon as the app is available on the App Store and Google Play.",
  emailLabel: "Email address",
  emailPlaceholder: "you@example.com",
  submit: "Join the waitlist",
  submitting: "Joining…",
  /** Nothing on this page asks for more than an address, and it should say so. */
  reassurance: "One email when we launch. Nothing else, and no charge — ever.",
  success: {
    joined: {
      title: "You're on the list",
      body: "We'll email you the moment Tho is on the App Store and Google Play.",
    },
    already: {
      title: "You're already on the list",
      body: "That address is signed up. We'll be in touch the day we launch.",
    },
  },
  errors: {
    empty: "Enter your email address.",
    invalid: "That does not look like an email address.",
    /** The catch-all. Says what to do, not what broke. */
    failed: "We couldn't save that just now. Please try again in a moment.",
    offline: "You appear to be offline. Check your connection and try again.",
  },
  qr: {
    caption: "Scan to join",
    sub: "Point your camera here",
  },
  /** The standalone page a scanned QR lands on. */
  page: {
    title: "Join the waitlist",
    description:
      "Tho is nearly here. Leave your email and we'll tell you the day it lands on the App Store and Google Play.",
    /** The one place the old name was hardcoded rather than read from `brand`. */
    back: "Back to THO",
  },
} as const;

export const footer = {
  /** The company blurb beside the mark. Says what the product does, for a reader
   *  who scrolled past everything above and is deciding whether to come back. */
  blurb:
    "Discover, book, and manage salon appointments with ease. Connecting customers with trusted beauty and wellness professionals across Bhutan.",

  /**
   * One list, not two. It used to be a Product column and a Salons column of three
   * links each; the footer now carries Contact, Follow us and the signup beside it,
   * and four columns of three read as a wall. Sign in and the console join the end
   * because that is what somebody scrolls to the bottom looking for.
   *
   * Root-relative for the same reason as `nav` — these render on every route.
   */
  quickLinks: {
    title: "Quick links",
    /*
      **Three of these are real pages now, and that is the point of the change.**

      Every link in this footer was an on-page hash — `/#how-it-works`, `/#queue`,
      `/#pricing` — so the footer of every marketing page linked only back to the page it
      was on. Combined with the salon cards linking to `#download`, the result was that
      **the homepage passed no authority to anything**, and `app/sitemap.ts` was the only
      route a crawler had into the product at all.

      `/salons`, `/salons/thimphu` and `/for-salons` are indexable pages that this site
      should link to from every one of its own pages: the country list, the page for the
      town where most of the inventory is, and the owner-side landing page that the
      `/#for-salons` anchor could never rank as.

      The anchors that remain are the ones with no page behind them, which is correct —
      "How it works" and "Live queue" are sections of the homepage and are not documents.
    */
    links: [
      { label: "Find a salon", href: "/salons" },
      { label: "Salons in Thimphu", href: "/salons/thimphu" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Live queue", href: "/#queue" },
      { label: "For salon owners", href: "/for-salons" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Questions", href: "/#faq" },
    ],
  },

  contact: {
    title: "Contact",
    /** Labels, so a screen reader does not read two bare strings in a row. */
    emailLabel: "Email",
    phoneLabel: "Phone",
  },

  social: {
    title: "Follow us",
    /** `href` is resolved in the component: WhatsApp from `brand.whatsapp`, the
     *  rest from `brand.social`, falling back to "/" while they are unset. */
    networks: [
      { key: "whatsapp", label: "WhatsApp" },
      { key: "tiktok", label: "TikTok" },
      { key: "facebook", label: "Facebook" },
      { key: "instagram", label: "Instagram" },
    ],
  },

  /** The footer's own signup. Shorter than the modal's copy, because the reader
   *  is skimming a footer rather than having pressed a download button. */
  newsletter: {
    title: "Stay updated",
    body: "Be the first to know when our mobile app launches.",
  },

  /** Must match `brand.cities` — one coverage claim, stated the same way twice. */
  cities: ["Thimphu", "Paro", "Phuentsholing"],

  /**
   * The Legal section — a titled column in the footer's link grid, where it used to be
   * one row of the bottom bar.
   *
   * **It could only become a section because all four routes now exist and all four are
   * public.** Terms and Cookie sat here with empty hrefs when `/privacy` was the only one
   * built; `/help`, `/legal/terms` and `/legal/content-policy` have since shipped.
   *
   * **All four now live under `app/(marketing)/(documents)/` and render the public site's
   * own header and footer.** Three of them used to sit under `app/(customer)/`, so a link
   * in this footer handed a signed-out reader the *product's* nav — Bookings, Messages,
   * Saved — wrapped around a policy. They were only ever reachable because
   * `requireLiveAccount()` turns away a deleted or suspended account and nothing else; a
   * visitor with no session passed straight through, which made a real defect look like a
   * working link. The group calls no auth helper at all now, so nothing about a session can
   * put a wall in front of a policy — and a footer is exactly where somebody goes looking
   * for one.
   *
   * **A blank `href` is still dropped by the filter in `site-footer.tsx`.** That stays: it
   * is what makes adding a fifth policy a one-line paste. Cookie Policy is gone rather
   * than kept blank — there is no route for it, and an entry that renders nowhere is a
   * worse record of that than no entry.
   *
   * Help is not a legal document, and is grouped here on purpose: it is the other thing a
   * reader scrolls to the bottom for, and it is a page of links into the product rather
   * than a support address (see the note on `app/(marketing)/(documents)/help/page.tsx`).
   */
  legal: {
    title: "Legal",
    links: [
      { label: "Help", href: "/help" },
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Content policy", href: "/legal/content-policy" },
    ],
  },
  rights: "All rights reserved.",
} as const;

/**
 * Who operates the service, for the privacy policy's benefit.
 *
 * Both app stores read `/privacy`, and every value here is a commitment made to
 * a regulator and to users — not marketing copy. Change them only deliberately.
 *
 * `contactEmail` is deliberately different from `brand.supportEmail`, because
 * account-deletion requests legally land here and so this has to be a mailbox somebody
 * actually reads. The two briefly agreed, while `brand.supportEmail` was this same
 * address; the support inbox has since moved to `thobhutansalons@gmail.com` and **this
 * has not followed**, which is the case the two constants exist for. Moving it is a
 * decision about a published commitment — `/privacy` names it twice and promises a reply
 * within `deletionDays` — so make it deliberately, not because the footer changed.
 */
export const legal = {
  operator: "Chojay Wangchuk",
  jurisdiction: "Bhutan",
  contactEmail: "chemsbhai@gmail.com",
  /** Update whenever the policy text below changes materially. */
  lastUpdated: "4 August 2026",
  /** Days to honour a deletion request. A promise — keep it achievable. */
  deletionDays: 30,
} as const;

/**
 * The privacy policy, as data.
 *
 * Prose lives here rather than in the page component for the same reason the
 * rest of the copy does: one place to edit. Each list item is split into a
 * bolded `lead` and its `body` so the page needs no markdown renderer.
 *
 * Every claim here must stay true of the shipped app. The specifics — location
 * never leaving the device, QR frames never being uploaded, instruction photos
 * behind signed links — are real properties of the build, and a policy that
 * overstates them is worse than one that says less.
 */
export const privacy = {
  title: "Privacy Policy",
  description: `How ${brand.appName} collects, uses and stores your information.`,
  sections: [
    {
      title: "Overview",
      body: `${brand.appName} ("the app") helps customers discover and book salons and barbers, and helps salon owners manage bookings, staff and services. This policy explains what we collect, why, and the choices you have.`,
    },
    {
      title: "Information we collect",
      items: [
        {
          lead: "Account information",
          body: "your email address, name and, optionally, a phone number you give at sign-up or add to your profile.",
        },
        {
          lead: "Content you create",
          body: "bookings, reviews, messages to salons, and photos you upload (profile picture, salon gallery, service images, review photos, and instruction photos attached to a booking).",
        },
        {
          lead: "Approximate location",
          body: "with your permission, your device's location is used on your device to show salons near you and sort them by distance. We do not store your location on our servers.",
        },
        {
          lead: "Camera",
          body: "used only to scan a salon's walk-in-queue QR code. The image is decoded on your device and is never uploaded or stored.",
        },
        {
          lead: "Notification token",
          body: "if you allow notifications, your device's push token is stored so we can send booking reminders and queue updates. It is tied to your account and removed when another account signs in on that device.",
        },
        {
          lead: "Service activity",
          body: "the bookings, orders, queue entries and loyalty points needed to operate the service.",
        },
      ],
      footnote:
        "We do not knowingly collect data from children, sell your data, or use third-party advertising SDKs.",
    },
    {
      title: "How we use it",
      items: [
        { body: "To create and secure your account and sign you in." },
        {
          body: "To provide the service: discovery, booking, rescheduling and cancellation, walk-in queues, messaging, reviews, loyalty, product orders, and — for salon staff — calendar, client and business management.",
        },
        { body: "To show salons near you (location stays on your device)." },
        {
          body: "To notify you about your bookings, your place in a queue, and rewards.",
        },
      ],
    },
    {
      title: "How it is stored and shared",
      items: [
        {
          body: "Data is stored with our backend provider, Supabase, and transmitted over encrypted connections (HTTPS).",
        },
        {
          body: "Access is enforced by row-level security in the database: you see your own data; a salon's owner and staff see the data for that salon's bookings, orders and queue.",
        },
        {
          body: "Salon and stylist gallery photos are public — they are marketing material shown to anyone browsing the app.",
        },
        {
          body: "Instruction photos you attach to a booking are held in a private store and are readable only through short-lived signed links, by you and the salon you booked.",
        },
        {
          body: "A salon you book with, join the queue at, or order from can see your name, profile photo and contact details, and the history of your visits with that salon.",
        },
        {
          body: "We share data only as needed to operate the service or where the law requires it. We do not sell personal data.",
        },
      ],
    },
    {
      title: "Your rights and choices",
      items: [
        { lead: "Access and update", body: "edit your profile in the app." },
        {
          lead: "Location",
          body: "deny or withdraw the permission in your device settings at any time; the map falls back to a default city view.",
        },
        {
          lead: "Notifications",
          body: "turn them off in the app's Settings or in your device settings.",
        },
        {
          lead: "Account and data deletion",
          body: `email ${legal.contactEmail} and we will delete your account and personal data within ${legal.deletionDays} days. Records a salon must keep for its own accounts — for example that a booking took place and what it cost — are kept in a form that no longer identifies you.`,
        },
      ],
    },
    {
      title: "Data retention",
      body: "We keep your data while your account is active and for as long as needed to provide the service or meet a legal obligation, then delete or anonymise it.",
    },
    {
      title: "Changes",
      body: 'We may update this policy. Material changes will be posted here with a new "Last updated" date.',
    },
  ],
} as const;

/**
 * Where a walk-in-queue QR code lands for someone who does not have the app.
 *
 * Anyone who does have it never sees this page: once the two files in
 * `public/.well-known/` are live and verified, the OS hands
 * `https://<domain>/q/<id>` straight to the app. So this leads with "get the
 * app" and keeps "open in Tho" as the fallback for before verification has
 * propagated.
 *
 * Deliberately no automatic redirect to the custom scheme — on a phone without
 * the app that raises a browser error dialog, which is a worse first impression
 * than a page that explains itself.
 */
export const queueLanding = {
  title: "Join the walk-in queue",
  /** Used when the salon is known; `{salon}` is replaced with its name. */
  titleWithSalon: "Join the queue at {salon}",
  lede: `Open this shop's line in the ${brand.appName} app.`,
  reassurance: `In the app you'll see the shop's live wait and your projected place in line — "You'd be #3 · ~35 min" — before you commit to joining.`,
  getApp: `Get ${brand.appName}`,
  openApp: `Open in ${brand.appName}`,
  /**
   * Shown when the path segment is not a well-formed shop code — a truncated or
   * mistyped link. (It can never be *absent*: `/q` without a code is a 404.)
   */
  badId: `That link doesn't carry a valid shop code. Scan the shop's QR again, or open ${brand.appName} and scan from inside the app.`,
} as const;
