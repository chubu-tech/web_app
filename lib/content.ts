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
  name: "Bhutan Salons",
  /** What you install. The platform is Bhutan Salons; the app ships as "Tho"
   *  on both stores and on the phone home screen. Use this wherever the page
   *  points at the download, not as a replacement for `name`. */
  appName: "Tho",
  tagline: "Book the chair. Skip the wait.",
  domain: "bhutansalons.com",
  /**
   * Where the product lives — the web app in `../tho_web`, a different origin
   * from this site. Set `NEXT_PUBLIC_APP_URL` per environment; the fallback is a
   * local `next dev`, which is where this is usually read.
   *
   * `||`, not `??`: a declared-but-blank `NEXT_PUBLIC_APP_URL=` is a common CI
   * accident, and `??` would let it through as "", making the href the
   * same-origin `/sign-in` — a 404 on *this* site, with a green build.
   *
   * Must stay a direct `process.env.X` access. Next inlines only that form; a
   * destructure or a `getEnv()` indirection becomes `undefined` in the browser
   * bundle. Being inlined also means the value is frozen at `next build` — a
   * change needs a rebuild, not a redeploy of the same bundle.
   */
  appUrl: (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, ""),
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
} as const;

export const nav = [
  { label: "Find a salon", href: "#find" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Live queue", href: "#queue" },
  { label: "For salons", href: "#for-salons" },
  { label: "Pricing", href: "#pricing" },
] as const;

/**
 * The one link off this site and into the product (`../tho_web`). The header
 * renders it twice — the quiet pill in the bar and the sheet's footer — and both
 * read from here, so the label and the destination cannot drift apart.
 *
 * Deliberately not a row in `nav` above: that array feeds the underline-animation
 * links and the 2rem sheet list, so a sign-in row would land in the wrong visual
 * group and lose its own treatment.
 *
 * It replaced "Salon sign in", which pointed at `#salon-plans` and signed nobody
 * in — there was nothing to sign in to when it was written. One label serves both
 * audiences because tho_web's `/sign-in` does: it picks the landing route from the
 * account's role (owner → `/business`, customer → `/`).
 *
 * No `?next=` on purpose. tho_web's `safeNext` reduces the parameter to a
 * same-origin path and drops absolute URLs, so one pointing back at this site
 * could not work.
 */
export const signIn = {
  label: "Sign in",
  href: `${brand.appUrl}/sign-in`,
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
  title: "What do you need, _and when_?",
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

export const pricing = {
  eyebrow: "Who pays what",
  title: "Customers never pay. Only salons do.",
  body: "Booking a chair and joining a queue cost you nothing — no booking fee, no charge at the door. Salons start free, and pay only if they want more.",
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
      price: "Free",
      period: "",
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
      price: "Nu 799",
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
    a: "No — never. Searching, booking, joining the walk-in queue and getting reminders are all free for customers. There is no booking fee and nothing extra to pay at the salon. Salons start on a free plan too; only the ones who want more pay, from Nu 799 a month.",
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
    back: "Back to Bhutan Salons",
  },
} as const;

export const footer = {
  columns: [
    {
      title: "Product",
      links: [
        { label: "How it works", href: "#how-it-works" },
        { label: "Live queue", href: "#queue" },
        { label: "Pricing", href: "#pricing" },
      ],
    },
    {
      title: "Salons",
      links: [
        { label: "For salon owners", href: "#for-salons" },
        { label: "List your shop", href: "#salon-plans" },
        { label: "Questions", href: "#faq" },
      ],
    },
  ],
  /** Must match `brand.cities` — one coverage claim, stated the same way twice. */
  cities: ["Thimphu", "Paro", "Phuentsholing"],
} as const;
