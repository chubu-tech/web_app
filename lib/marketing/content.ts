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
   * `domain` and `supportEmail` deliberately did NOT change: bhutansalons.com is
   * the domain that is actually registered and serving.
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
  supportEmail: "hello@bhutansalons.com",
  whatsapp: "+975 17 00 00 00",
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
   * **WhatsApp is the only real one.** It is derived from `whatsapp` above, which
   * is itself a placeholder number (+975 17 00 00 00) — check it before launch.
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
  { label: "For salons", href: "/#for-salons" },
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
  body: "Every salon here is live on Tho. Pick what you want done, where, and roughly when — then book or join the queue in the app.",
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
  /** The product's purpose, in one sentence. Says both halves: customer + salon. */
  purpose:
    "Book your appointment online, or scan the QR at the door to join the live queue — so you stop waiting around. Salons get one simple screen for bookings, staff and services.",
  /** Who pays. Stated in the hero so nobody assumes there is a booking fee. */
  freeNote: "Always free for customers",
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
      body: "Choose the salon, the stylist and the slot. Confirmed on the spot, with a reminder before you go.",
      points: ["Prices shown up front", "Reschedule in two taps"],
      image: u("photo-1521590832167-7bcbfaa6381f", 900, 1100),
      alt: "Bright salon floor with styling chairs and mirrors",
    },
    {
      tag: "Walk in & scan",
      title: "Join the queue with one scan",
      body: "Scan the QR at the door and take your place in the virtual queue — then wait wherever you like.",
      points: ["No app needed to join", "Pinged two turns ahead"],
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
 * different copy: `hero.freeNote`, the `customer` panel below (Nu 0, forever), the first
 * FAQ answer and the download band. None of those changed and none of them should — see
 * the "Say who pays" rule in `AGENTS.md`.
 */
export const pricing = {
  eyebrow: "Who pays what",
  title: "Customers never pay. Only salons do.",
  body: "Booking a chair and joining a queue cost you nothing — no booking fee, no charge at the door. Salons pay a monthly plan, starting at Nu 399.",
  note: "Paid salon plans are billed monthly in Ngultrum. Pay by bank transfer or mBoB — we switch your plan on within a day. Customers are never charged anything.",
  /** The free-for-customers panel that sits beside the salon plans. */
  customer: {
    label: "If you're booking a haircut",
    price: "Nu 0",
    period: "forever",
    body: "Everything a customer needs is free — searching salons, booking a time, joining the walk-in queue and getting reminders.",
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
      features: [
        "Listed in the app",
        "Online bookings",
        "Today's bookings by the hour",
        "Your profile, photos & reviews",
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
      features: [
        "Everything in Basic",
        "As many stylists as you like",
        "Week view",
        "Reminders sent for you",
        "The walk-in queue",
        "Your customer list",
        "Sell products in the app",
        "Rewards for regulars",
        "How your week and your busiest hours went",
      ],
      cta: "Choose Growth",
      featured: true,
    },
    {
      name: "Pro",
      price: "Nu 1,499",
      period: "/mo",
      tagline: "For busy shops with a big team.",
      features: [
        "Everything in Growth",
        "Shown higher in search",
        "Staff pay & commissions",
        "Deposits & no-show cover",
      ],
      cta: "Choose Pro",
      featured: false,
    },
  ],
} as const;

export const faq = [
  {
    q: "Does it cost anything to book a haircut?",
    a: "No — never. Searching, booking, joining the walk-in queue and getting reminders are all free for customers. There is no booking fee and nothing extra to pay at the salon. Salons are the ones who pay, from Nu 399 a month.",
  },
  {
    q: "Do I need the app to join a queue?",
    a: "No — scanning the salon's QR code puts you in line straight away. The app is worth it if you book often, since it keeps your history and sends live updates on your turn.",
  },
  {
    q: "What if I miss my turn?",
    a: "You get a message two turns ahead, and again when you're next. If you're not back, the salon can hold your place briefly or pass it on — and you'll see that happen live.",
  },
  {
    q: "I run a salon. How do I get started?",
    a: "Create an owner account, add your services, prices and stylists, then print the QR code we make for your door. Most shops are taking bookings the same afternoon.",
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
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Live queue", href: "/#queue" },
      { label: "For salon owners", href: "/#for-salons" },
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
   * Sits in the bottom bar, not a column: these are legal links, not navigation.
   *
   * **A blank `href` is not rendered.** Only `/privacy` exists as a route today, so
   * Terms and Cookie would be a pair of 404s in the one place a visitor goes looking
   * for a commitment. Same self-switching mechanism as `brand.stores`: build the
   * page, paste the path, and the link appears with no other edit.
   */
  legalLinks: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "" },
    { label: "Cookie Policy", href: "" },
  ],
  rights: "All rights reserved.",
} as const;

/**
 * Who operates the service, for the privacy policy's benefit.
 *
 * Both app stores read `/privacy`, and every value here is a commitment made to
 * a regulator and to users — not marketing copy. Change them only deliberately.
 *
 * `contactEmail` is deliberately NOT `brand.supportEmail`: account-deletion
 * requests legally land at this address, so it has to be a mailbox that is
 * actually read. `hello@bhutansalons.com` does not exist yet; when it does and
 * someone monitors it, point this there and delete this paragraph.
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
