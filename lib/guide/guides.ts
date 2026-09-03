/**
 * The two walkthroughs, as words against frames.
 *
 * ## The one rule
 *
 * **Every sentence here describes the frame it is attached to, and nothing else.** The
 * brief is explicit about it twice — *"do not invent functionality"*, and *"the narration
 * should never describe something different from what is happening on screen"* — and it is
 * the only rule in this file that cannot be traded away for pacing. A line that describes
 * the next screen, or a feature the capture does not show, is a lie the voice-over then
 * delivers confidently, which is worse than saying nothing.
 *
 * Every frame named below was opened and read before its line was written. Where a capture
 * would not support a claim, the claim was dropped rather than softened.
 *
 * ## What is deliberately absent
 *
 * Nine captured frames are **not** used here. None of the omissions is an oversight:
 *
 * - `customer/21-book-stylist` is the *services* step captured a second time — 48.8 dB PSNR
 *   against `20-book-services`, i.e. the same picture. The stylist step was never reached,
 *   so this guide never claims to show one: chapter 4 steps from services to time, and says
 *   "your stylist" only where `22-book-time`'s own subtitle puts a stylist on screen.
 * - `customer/29-booking-detail` is the bookings *list*, not a booking.
 * - `owner/49-client-book-locked`, `owner/53-payroll-locked` and `owner/54-tax-estimate-locked`
 *   all read *"Couldn't load — Retry"*: network failures the walk happened to record where a
 *   paywall was expected. Narrating a dropped connection as a plan boundary would misdescribe
 *   the app and the pricing at the same time.
 * - `customer/17-salon-reviews` and `customer/16-specialist-profile` lead with a seeded review
 *   reading "dsadsa", and no framing crops it out.
 * - `owner/70-offers` shows an expired offer called "powder's offer"; `51-offers-basic` teaches
 *   the same feature better, because its empty state explains what an offer is *for*.
 * - `auth/04-guest-discover` caught the salon cards before their images loaded.
 *
 * ## Frames whose measured ring points at the wrong control
 *
 * `ring: false` appears three times. The capture harness rings whichever widget the walk
 * pointed it at, and on those three that widget is not what the step is about —
 * `auth/01-onboarding` measures the **Skip** pill, and a walkthrough that opens on a circled
 * "Skip" teaches the opposite of what it means to. See the flag's own note in `timeline.ts`.
 *
 * ## Ordering
 *
 * Steps are listed, never sorted. Two owner captures share a number — `51-insights` and
 * `51-offers-basic` — because the console was walked twice, so a filename sort would
 * interleave two different salons.
 */

import { VOICE_SECONDS } from "./durations";
import { TIMING, type Guide, type GuideAudience } from "./timeline";

/**
 * The customer walkthrough.
 *
 * Seven chapters, following the brief's §10 shape but adjusted to the app as built: there is
 * no separate "what Tho does" section, because the onboarding screen *is* that statement in
 * the product's own words, and repeating it in different words would be the guide talking
 * over the app.
 */
const CUSTOMER: Guide = {
  audience: "customer",
  title: "How Tho works",
  chapters: [
    {
      title: "Welcome to Tho",
      steps: [
        {
          // The measured rect is the Skip pill — the one instruction this chapter must not
          // give. See `ring` in `timeline.ts`.
          frame: "auth/01-onboarding",
          ring: false,
          title: "What Tho is for",
          body: "Barbers and salons near you, and what they offer.",
          narration:
            "This is Tho. It helps you find barbers and salons near you in Thimphu, see what each one offers, and book a time — all from your phone.",
        },
      ],
    },
    {
      title: "Getting started",
      steps: [
        {
          frame: "auth/02-sign-in",
          title: "Sign in, or just look",
          body: "An account is only needed to book, queue or message.",
          narration:
            "Sign in with your email and password. If you would rather look around first, choose Browse without an account — you only need one when you want to book, join a queue, or message a salon.",
        },
        {
          frame: "auth/03-create-account",
          // The ring sits on the Business tile. A finger landing there would be telling a
          // customer to sign up as a salon, so the ripple comes off and the line explains
          // the choice rather than pressing one side of it.
          tap: false,
          title: "Customer or business",
          body: "Two kinds of account, chosen here.",
          narration:
            "Creating an account takes a name, an email and a password. Choose Customer if you are booking appointments, or Business if you run a salon yourself.",
        },
        {
          frame: "auth/05-guest-wall",
          title: "Nothing you saved is lost",
          body: "Finishing sign-up keeps what you saved while browsing.",
          narration:
            "If you try to message or book while browsing, Tho asks you to finish signing up — and everything you saved while looking around comes with you.",
        },
      ],
    },
    {
      title: "Finding a salon",
      steps: [
        {
          frame: "customer/06-discover",
          title: "Your home screen",
          body: "Salons you have booked, offers, and services by type.",
          narration:
            "Discover is your home screen. It opens with the salons you have booked before, whatever offers are running, and services grouped by type — hair, barber, spa, nails and makeup.",
        },
        {
          frame: "customer/07-discover-search",
          title: "Search by name",
          body: "Type a name to go straight to a salon.",
          narration:
            "Tap the search icon and start typing to go straight to a salon you already know.",
        },
        {
          frame: "customer/08-filters",
          title: "Narrow it down",
          body: "Who they serve, the service, rating, distance and price.",
          narration:
            "The filter narrows the list by who the salon serves, the kind of service, its rating, how far away it is, and what you want to spend. Apply to see the results.",
        },
        {
          frame: "customer/23-map",
          title: "See who is nearby",
          body: "The same salons, placed where they actually are.",
          narration:
            "The Map tab puts those same salons where they actually are, so you can choose one by how close it is rather than by name.",
        },
        {
          frame: "customer/13-salon-detail",
          title: "The salon page",
          body: "Message, call, directions — and today's walk-in status.",
          narration:
            "A salon's page carries its rating and today's opening hours, buttons to message, call or get directions, whether you can walk in right now, and its photos. Book Appointment starts a booking.",
        },
      ],
    },
    {
      title: "Booking an appointment",
      steps: [
        {
          frame: "customer/14-salon-services",
          title: "What they do, and what it costs",
          body: "Every service with its length and its price.",
          narration:
            "The Services tab lists everything this salon does, each with how long it takes and what it costs — a beard trim at twenty minutes and a hundred and fifty ngultrum, a haircut and style at thirty minutes and three hundred and fifty.",
        },
        {
          frame: "customer/15-salon-specialists",
          title: "Who works there",
          body: "The stylists you can book, and the loyalty card.",
          narration:
            "Specialists shows who works there and who you can book with. Below it sits the salon's loyalty card, and how close you are to a free visit.",
        },
        {
          frame: "customer/20-book-services",
          title: "Step one — services",
          body: "Add as many as you want. One visit, one stylist.",
          narration:
            "Booking runs in three steps. First choose your services. You can add more than one, as long as a single stylist can do them all in the same visit.",
        },
        {
          frame: "customer/22-book-time",
          title: "Step three — a time",
          body: "Open slots on the day you pick.",
          narration:
            "With your services and your stylist settled, pick a day and an open time. The button carries the time and the price, so you know exactly what you are agreeing to.",
        },
        {
          frame: "customer/22b-book-confirm",
          title: "Say what you want",
          body: "A style, a note or a photo — all optional.",
          narration:
            "Before you confirm you can add a style, a note, or a reference photo, so your stylist knows what you are after. Cancelling is free up to twelve hours before.",
        },
        {
          frame: "customer/22c-booking-confirmed",
          title: "Booked",
          body: "The date, the service, the stylist and the salon.",
          narration:
            "And that is it. Your appointment is confirmed, with the date, the service, your stylist and the salon all on one card.",
        },
      ],
    },
    {
      title: "Walking in",
      steps: [
        {
          // The measured rect is the sheet's own title, clipped by the top edge of the frame.
          frame: "customer/13a-join-queue",
          ring: false,
          title: "Join the line from your phone",
          body: "Pick a barber and a service, and hold your place.",
          narration:
            "If a salon takes walk-ins, you can join its queue from here. Choose a barber and a service, and Tho tells you where you stand. It notifies you when you are next, so you do not have to wait at the shop.",
        },
      ],
    },
    {
      title: "Bookings and messages",
      steps: [
        {
          frame: "customer/26-bookings-upcoming",
          title: "Everything you have booked",
          body: "Upcoming, completed and cancelled.",
          narration:
            "My bookings keeps your appointments in three tabs. Each upcoming card carries its reference and its price, a switch for reminders, and buttons to cancel or open the receipt.",
        },
        {
          frame: "customer/27-bookings-completed",
          title: "After the visit",
          body: "Leave a review, or reopen the receipt.",
          narration:
            "Once a visit is done it moves to Completed, where you can leave the salon a review or pull the receipt up again.",
        },
        {
          frame: "customer/24-chats",
          title: "Talk to the salon",
          body: "One conversation per salon.",
          narration: "Chats keeps one conversation with each salon you have contacted.",
        },
        {
          frame: "customer/25-chat-thread",
          title: "Ask before you go",
          body: "Quick replies for the usual questions.",
          narration:
            "Ask whether they are open, or whether there is a slot today — there are quick replies ready for the questions people ask most.",
        },
        {
          frame: "customer/36-notifications",
          title: "What changed",
          body: "Bookings, offers, points and orders in one list.",
          narration:
            "Notifications gathers your confirmations and cancellations, the offers running, the points you earn, and word that an order is ready to collect.",
        },
      ],
    },
    {
      title: "Shop, rewards and your account",
      steps: [
        {
          frame: "customer/18-salon-shop",
          title: "Buy what they use",
          body: "Products the salon keeps in stock.",
          narration:
            "Salons can sell products too. The Shop tab lists what this one keeps in stock, and Add puts it into an order.",
        },
        {
          // The measured rect is the orders shortcut, not the Products tab this step is
          // about, so the ring comes off rather than pointing somewhere else.
          frame: "customer/09-discover-products",
          ring: false,
          title: "Browse every product",
          body: "Across all salons, by category.",
          narration:
            "Switching Discover over to Products browses everything on sale across salons, by category, with what is new and what is selling this week.",
        },
        {
          frame: "customer/12-product-detail",
          title: "One product",
          body: "The price, what it is for, and who sells it.",
          narration:
            "A product page gives you the price, what it is for, and which salon you would be buying it from.",
        },
        {
          frame: "customer/11-my-orders",
          title: "Your orders",
          body: "New, ready, collected or declined.",
          narration:
            "My orders follows each one through, and you pay cash at the salon when you collect it.",
        },
        {
          frame: "customer/32-my-rewards",
          title: "Points you have earned",
          body: "Your balance at each salon.",
          narration: "My rewards keeps the points you have collected, salon by salon.",
        },
        {
          frame: "customer/35-saved-salons",
          title: "Saved salons",
          body: "Everywhere you tapped the heart.",
          narration:
            "Saved salons is everywhere you tapped the heart, ready for the next time you want to book.",
        },
        {
          frame: "customer/30-drawer",
          title: "The menu",
          body: "Profile, saved salons, orders, rewards and settings.",
          narration:
            "The menu gathers the rest — your profile, your saved salons, your orders, your rewards and your settings.",
        },
        {
          frame: "customer/31-profile",
          title: "Your details",
          body: "Your name, your photo, and where everything lives.",
          narration:
            "Your profile holds your name and your photo, and links out to your messages, your saved salons, your rewards, your packs and your orders.",
        },
        {
          frame: "customer/33-settings",
          // Informational: this ring names the way out of the product, not a button the
          // guide is inviting anyone to press.
          tap: false,
          title: "Settings",
          body: "Reminders, time zone, privacy — and leaving.",
          narration:
            "Settings covers your appointment reminders and the privacy policy. And if you ever want to go, Delete account removes your sign-in and your personal details for good.",
        },
      ],
    },
  ],
};

/**
 * The owner walkthrough.
 *
 * The console was captured twice — once on a Basic salon, once on a Pro one — so these
 * frames fall into two sets that are **not interchangeable**: the Basic walk is a different,
 * empty salon (Paro Glow Beauty Lounge) while the Pro walk is a working one (Norzin Salon &
 * Spa). Cutting between them mid-tour would look like the owner's own data disappearing
 * from one screen to the next.
 *
 * So the Pro capture carries the whole tour, and the Basic frames are held back for the
 * closing chapter — where the difference between the plans *is* the subject, and the
 * narration says "on the Basic plan" out loud rather than leaving the change of salon to be
 * noticed.
 */
const OWNER: Guide = {
  audience: "owner",
  title: "How the salon console works",
  chapters: [
    {
      title: "Your salon console",
      steps: [
        {
          frame: "owner/51-insights",
          title: "The day in front of you",
          body: "Who is next, how many are booked, what is expected.",
          narration:
            "Insights opens the console on today. It tells you who is next through the door and when, how many appointments you are holding, what they are expected to bring in, and how full the day is.",
        },
        {
          frame: "owner/61-drawer",
          title: "Everything else",
          body: "Services, staff, clients, orders, offers and billing.",
          narration:
            "The menu reaches the rest of the console — your services and your staff, the client book, product orders, offers and loyalty, payroll and tax, and your plan.",
        },
      ],
    },
    {
      title: "Your calendar",
      steps: [
        {
          frame: "owner/52-calendar-day",
          title: "The day view",
          body: "Each booking, with its actions on it.",
          narration:
            "The calendar's day view lists every appointment with its customer, service and stylist — and on each one, the buttons to complete it, mark a no-show, or cancel.",
        },
        {
          frame: "owner/53-calendar-week",
          title: "The week view",
          body: "Seven days, and where the work sits.",
          narration:
            "The week view counts the bookings on each day, so you can see where the work is landing before it arrives.",
        },
        {
          frame: "owner/54-calendar-list",
          title: "The list view",
          body: "Upcoming, completed and cancelled together.",
          narration:
            "The list view drops the grid and shows the same bookings as upcoming, completed and cancelled.",
        },
        {
          frame: "owner/55-booking-detail",
          // The ring is the status pill — something to read, not something to press.
          tap: false,
          title: "One booking",
          body: "Services, total, loyalty points and payment.",
          narration:
            "Opening a booking gives you the services and the total, the loyalty points it earns, and somewhere to record the payment once it is taken at the salon.",
        },
      ],
    },
    {
      title: "The walk-in queue",
      steps: [
        {
          frame: "owner/56-queue-board",
          title: "Who is waiting",
          body: "The line, the wait, and who is free.",
          narration:
            "The queue board shows how many people are waiting, roughly how long that is, and which of your barbers are free. Call next moves the line along.",
        },
        {
          frame: "owner/57-queue-qr",
          title: "Let people join themselves",
          body: "A code for the counter, or a link to send.",
          narration:
            "Show QR gives you a code customers scan to put themselves in the line. Print it for the counter, or copy the link and send it to your staff group.",
        },
        {
          frame: "owner/66-walk-in",
          title: "Add someone yourself",
          body: "A name, the services, a stylist and a time.",
          narration:
            "And when somebody simply walks in, you can add them yourself — their name and number if you want them, the services, a stylist and a time.",
        },
      ],
    },
    {
      title: "Services, products and staff",
      steps: [
        {
          frame: "owner/62-services",
          title: "What you offer",
          body: "Price, length, who it is for, and on or off.",
          narration:
            "Your services carry a price, a length, and who they are for. The switch on each one takes it off the menu without deleting it, and you can start from a common service or write your own.",
        },
        {
          frame: "owner/63-products",
          title: "What you sell",
          body: "In stock, or sold out.",
          narration:
            "Products work the same way. Anything out of stock shows as sold out, and customers cannot order it.",
        },
        {
          frame: "owner/64-staff",
          title: "Your team",
          body: "Everyone customers can book.",
          narration: "Staff lists everyone customers can book with.",
        },
        {
          frame: "owner/65-staff-edit",
          title: "One stylist",
          body: "Their account, their pay, their services.",
          narration:
            "Each one has their own record — whether they are active and bookable, whether their account is linked so they can sign in, what they are paid, and which services they perform.",
        },
        {
          frame: "owner/60-packs",
          title: "Prepaid packs",
          body: "Bundle visits a customer buys up front.",
          narration:
            "Packs bundle visits a customer buys in advance. They are paid for at the salon, so you confirm each one once the money is in hand.",
        },
      ],
    },
    {
      title: "Clients and orders",
      steps: [
        {
          frame: "owner/67-client-book",
          title: "Your client book",
          body: "Regulars, lapsed, and who is booked in.",
          narration:
            "The client book counts your regulars, who has lapsed, and who is booked in — and sorts them by their spend, their visits, or their name.",
        },
        {
          frame: "owner/68-client-detail",
          title: "One client",
          body: "Visits, spend, a private note and their history.",
          narration:
            "Opening a client shows how often they come and what they have spent, a private note only you can see, and every appointment they have had.",
        },
        {
          frame: "owner/69-orders",
          title: "Product orders",
          body: "New, ready and done.",
          narration:
            "Product orders arrive as new, move to ready when they are waiting at the counter, and close as done.",
        },
        {
          frame: "owner/58-messages",
          title: "Customer messages",
          body: "Every conversation in one place.",
          narration: "And messages from customers all land in one place.",
        },
      ],
    },
    {
      title: "Growing the salon",
      steps: [
        {
          frame: "owner/51-offers-basic",
          title: "Run an offer",
          body: "It shows on your page and in the customer feed.",
          narration:
            "An offer is a promotion you run yourself — twenty percent off colour, or a festival special. It shows on your salon page and in the customer home feed.",
        },
        {
          frame: "owner/71-loyalty",
          title: "Reward your regulars",
          body: "Points per visit or per spend, and what they buy.",
          narration:
            "The loyalty programme earns customers points on every visit, or on what they spend, and you decide what those points are worth.",
        },
        {
          frame: "owner/72-redemptions",
          title: "Redeem a reward",
          body: "Confirm it with the customer's code.",
          narration:
            "When somebody cashes a reward in, you confirm it here with their code.",
        },
        {
          frame: "owner/73-payroll",
          title: "Pay your stylists",
          body: "Base pay plus commission on completed work.",
          narration:
            "Payroll adds each stylist's base pay to a commission on the bookings they actually completed, month by month.",
        },
        {
          frame: "owner/74-tax-estimate",
          title: "An estimate for the year",
          body: "Turnover, assessable income and your deadline.",
          narration:
            "And the tax report estimates your position for the year on a presumptive basis, with your filing deadline. It is an estimate — confirm it with an accountant before you file.",
        },
      ],
    },
    {
      title: "Settings and your plan",
      steps: [
        {
          frame: "owner/59-salon-settings",
          title: "Your salon's details",
          body: "Name, type, address, map pin and phone.",
          narration:
            "Settings is where your salon describes itself — its name and type, its address and its pin on the map, its phone number and its photos. This is what customers see.",
        },
        {
          frame: "owner/37-insights-basic",
          title: "On the Basic plan",
          body: "Get listed, and take bookings.",
          narration:
            "Tho comes in three plans. Basic gets you listed and taking bookings, with today's numbers and a day calendar.",
        },
        {
          frame: "owner/41-queue-locked",
          title: "What Growth adds",
          body: "The walk-in queue belongs to Growth.",
          narration:
            "Anything beyond that says so plainly rather than hiding. The walk-in line you saw earlier is part of the Growth plan.",
        },
        {
          frame: "owner/39-calendar-week-locked",
          title: "Named, with a price",
          body: "Each locked feature says which plan it belongs to.",
          narration:
            "Every locked feature names the plan it belongs to and what that plan costs, so nothing is a surprise later.",
        },
        {
          frame: "owner/75-plans",
          // The ring is the "most popular" badge — a label, not a control.
          tap: false,
          title: "The three plans",
          body: "Basic, Growth and Pro.",
          narration:
            "Basic gets you listed. Growth adds unlimited stylists, the week view, reminders, full analytics, the client book, the storefront, loyalty and the walk-in queue. And Pro adds commissions and payroll for busier teams.",
        },
      ],
    },
  ],
};

/**
 * Stamp each step with how long its narration really takes.
 *
 * `stepHold` prefers `seconds` over `estimateSpeechSeconds`, and the estimate — 165 words a
 * minute plus a breath per sentence — was deliberately generous, because a frame that
 * outlives its sentence is a pause while one that ends inside it is a mistake. Being
 * generous everywhere added up: it held each film roughly a minute longer than the voice
 * needs, and it could not know how fast the chosen narrator actually reads.
 *
 * `TIMING.tail` is added here because the estimate branch adds it too. It is the beat after
 * the last word, before the cut — without it every step ends on a hard stop.
 *
 * Steps with no clip keep the estimate. That is the honest fallback for a line added since
 * the last `voice-guide.py` run: the film still builds, it is just paced by a guess again.
 */
function voiced(guide: Guide): Guide {
  return {
    ...guide,
    chapters: guide.chapters.map((chapter) => ({
      ...chapter,
      steps: chapter.steps.map((step) => {
        const measured = VOICE_SECONDS[step.frame];
        return measured === undefined ? step : { ...step, seconds: measured + TIMING.tail };
      }),
    })),
  };
}

export const GUIDES: Record<GuideAudience, Guide> = {
  customer: voiced(CUSTOMER),
  owner: voiced(OWNER),
};
