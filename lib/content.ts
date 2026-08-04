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
  eyebrow: "Get the app",
  title: "The chair is ready when you are",
  body: "Look for Tho on the App Store and Google Play. Free to download, free to book — for iPhone and Android. Customers never pay a fee.",
  image: u("photo-1503951914875-452162b0f3f1", 1800, 1000),
  alt: "Barber giving a client a close shave",
} as const;

export const footer = {
  /** Root-relative for the same reason as `nav` — these render on every route. */
  columns: [
    {
      title: "Product",
      links: [
        { label: "How it works", href: "/#how-it-works" },
        { label: "Live queue", href: "/#queue" },
        { label: "Pricing", href: "/#pricing" },
      ],
    },
    {
      title: "Salons",
      links: [
        { label: "For salon owners", href: "/#for-salons" },
        { label: "List your shop", href: "/#salon-plans" },
        { label: "Questions", href: "/#faq" },
      ],
    },
  ],
  /** Must match `brand.cities` — one coverage claim, stated the same way twice. */
  cities: ["Thimphu", "Paro", "Phuentsholing"],
  /** Sits in the bottom bar, not a column: it is a legal link, not navigation. */
  legalLinks: [{ label: "Privacy", href: "/privacy" }],
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
