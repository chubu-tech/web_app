import { HOTSPOTS } from "./hotspots";

/**
 * The two in-product walkthroughs — Customer and Salon owner.
 *
 * ## Every frame is a real screenshot of this app, in two sizes
 *
 * Not a mockup, not a redraw: `public/guide/**` was captured from `npm run dev` by
 * `scripts/capture-guide-frames.py`, signed in as the seeded customer and as the seeded
 * owner, on the routes named in `route` below. That is the whole point of the feature — a
 * guide drawn by hand starts lying the first time a button moves, whereas these can be
 * re-taken by re-running the capture.
 *
 * Every step carries **two** frames. `wide` is the 1280x800 capture and `phone` is the
 * 390x844 one, and the player picks by viewport. The second set is not a nicety: the guide
 * is mostly read on a phone, and a desktop screenshot shown 358px wide is a picture of a
 * layout that phone will never render, at a size nobody can read. What differs between the
 * two is the app's own responsive behaviour, which is the thing worth showing.
 *
 * Three consequences worth keeping:
 *
 * - **The copy may only claim what the frame shows** — and now, what *both* frames show. A
 *   sentence about the filter rail down the left would be true of one and false of the
 *   other, so the bodies describe what the screen does rather than where it sits. Where
 *   something important is below the captured fold, the body says so ("further down")
 *   rather than describing it as if it were on screen.
 * - **Hotspots are measured, not eyeballed**, and they live in `hotspots.ts`, which
 *   `scripts/measure-guide-hotspots.py` regenerates. That file is geometry; this one is
 *   words. The split is what lets a re-capture move every ring without touching a sentence.
 * - **No `alt` quotes a number the database owns.** The frames are files, so an `alt` that
 *   said "All 44, two unread" was true — until the next capture, where it silently became a
 *   lie because somebody else on the shared database had read a notification. Counts,
 *   balances, totals and chosen dates are described by their *shape*; the numbers that stay
 *   are the ones a person decides (a plan's price, a service's price), where a stale one is
 *   a signal rather than noise.
 *
 * ## The narration is written for the ear
 *
 * `narration` is not `body` read aloud. It drops the parentheticals and the typographic
 * asides that make sense to an eye and trip a voice, and it is what decides how long a frame
 * holds when sound is on — see `lib/guide/narration.ts` for why the voice is the browser's
 * own, and how a recorded one would slot in.
 *
 * ## This module is data, and it lives in `lib/`
 *
 * `components/guide/*` is `"use client"`, and a non-component export from a client module
 * arrives at a server component as a client *reference* — the failure AGENTS.md records
 * costing four server surfaces. So the guides live here, where either side can import them,
 * and the components hold no content.
 */

export type GuideAudience = "customer" | "owner";

/** Which frame set is on screen. The player picks by viewport, at the app's own 744. */
export type GuideVariant = "wide" | "phone";

/**
 * The shape of each capture, as width ÷ height.
 *
 * Numbers rather than CSS strings because they are arithmetic as well as style: `aspect-ratio`
 * takes a number happily, and `panPercent` needs to divide them.
 */
export const FRAME_RATIO: Record<GuideVariant, number> = {
  wide: 1280 / 800,
  phone: 390 / 844,
};

/**
 * The shape of the opening the frame is seen through.
 *
 * On a wide screen the window *is* the frame — nothing is cropped, which is what keeps the
 * measured hotspots landing where they were measured. On a phone it is a 3:4 opening onto a
 * much taller picture: shown whole, a 390x844 frame at 358px wide is 775px tall, which is
 * the entire viewport with nothing left for the words. So the window shows about three
 * fifths of it, at close to life size, and pans to whatever is being highlighted.
 */
export const WINDOW_RATIO: Record<GuideVariant, number> = {
  wide: 1280 / 800,
  phone: 3 / 4,
};

/**
 * A highlight over one frame: a ring, and a label pinned to it.
 *
 * `x/y/w/h` are percentages of the **frame** (0–100), so the ring tracks the picture at
 * every size, and `panPercent` can work out where the window has to sit to include it.
 */
export type GuideHotspot = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Three or four words. It names the thing; the body explains it. */
  label: string;
  place?: "above" | "below";
};

export type GuideFrame = {
  /** Path under `public/guide/`. */
  image: string;
  /** What a screen reader gets instead of the frame. */
  alt: string;
  hotspot?: GuideHotspot;
};

export type GuideStep = {
  /** Stable, and used as the React key. */
  id: string;
  /** The chapter this step belongs to, shown as an eyebrow so 16 steps still orient. */
  chapter: string;
  title: string;
  body: string;
  /**
   * The route the frame was captured on, shown in the player's address bar. Long slugs are
   * elided with an ellipsis — it is a display string, not a link.
   */
  route: string;
  /** What the voice says. Falls back to the title and body; see `narrationFor`. */
  narration?: string;
  /**
   * A recorded clip for this step, if one is ever made. Present means the synthesiser is not
   * used at all — see `components/guide/use-narration.ts`.
   */
  audio?: string;
  /** Seconds this frame holds with narration **off**. Defaults to `DEFAULT_SECONDS`. */
  seconds?: number;
  wide: GuideFrame;
  phone: GuideFrame;
};

export type Guide = {
  audience: GuideAudience;
  /** The player's own title, and the launcher's accessible name. */
  title: string;
  blurb: string;
  steps: GuideStep[];
};

/**
 * How long a frame holds when it is not being narrated.
 *
 * Long enough to read two sentences at a glance and look at the highlight — measured against
 * the longest body below rather than picked round. With sound on this is not consulted: the
 * voice decides, and a frame lasts exactly as long as its sentence.
 */
export const DEFAULT_SECONDS = 9;

/** What the voice says for this step. */
export function narrationFor(step: GuideStep): string {
  return step.narration ?? `${step.title}. ${step.body}`;
}

/**
 * How far down the frame the window sits, as a percentage of the frame's own height.
 *
 * Zero wherever the window is the whole picture. On a phone it centres the window on the
 * highlight — clamped, so it never runs past either end and leaves a strip of nothing — and
 * falls back to the top of the frame for a step that has no highlight, because the top of a
 * screen is where a screen introduces itself.
 */
export function panPercent(variant: GuideVariant, hotspot?: GuideHotspot): number {
  // The share of the frame's height the window can show at once.
  const visible = FRAME_RATIO[variant] / WINDOW_RATIO[variant];
  if (visible >= 1) return 0;

  const visiblePercent = visible * 100;
  if (!hotspot) return 0;

  const centre = hotspot.y + hotspot.h / 2;
  return Math.max(0, Math.min(100 - visiblePercent, centre - visiblePercent / 2));
}

/**
 * A measured box plus the words that go on it.
 *
 * The geometry comes from `hotspots.ts` — regenerated, never edited — and the label is
 * written here. A key with no measurement yields no highlight rather than a ring at the
 * origin: a frame with no ring still teaches, and one with a ring in the wrong place lies.
 */
function spot(
  key: string,
  label: string,
  place: "above" | "below" = "below",
): GuideHotspot | undefined {
  const box = HOTSPOTS[key];
  return box ? { ...box, label, place } : undefined;
}

const CUSTOMER_STEPS: GuideStep[] = [
  {
    id: "discover",
    chapter: "Finding a salon",
    title: "Start on Discover",
    body: "Everything open near you, ranked. Switch between Salons and Products, search by name, or scan a salon's QR code. Distances are measured from wherever you actually are.",
    narration:
      "Everything open near you, ranked. You can switch between salons and products, search by name, or scan the code on a salon's counter. Distances are measured from wherever you actually are.",
    route: "/discover",
    wide: {
      image: "customer/01-discover.webp",
      alt: "The Discover page: a Salons and Products switch with search and QR buttons, filters down the left, a row of service categories, and salon cards under Book again.",
      hotspot: spot("customer/01-discover", "Search, or scan a QR"),
    },
    phone: {
      image: "customer/phone/01-discover.webp",
      alt: "Discover on a phone: the Salons and Products switch with search and QR buttons above a scrollable row of service categories and the salon cards.",
      hotspot: spot("customer/phone/01-discover", "Search, or scan a QR"),
    },
  },
  {
    id: "salon",
    chapter: "Finding a salon",
    title: "Read the salon first",
    body: "Photos, rating, whether it is open right now, and directions. The row of links below the photos jumps to Services, Shop, Team, Reviews and About — they are anchors, so you can link straight to any of them.",
    narration:
      "Photos, the rating, whether it's open right now, and directions. The row of links below the photos jumps straight to services, the shop, the team, reviews, or the about section.",
    route: "/salon/norzin-salon-and-spa-…",
    wide: {
      image: "customer/02-salon.webp",
      alt: "A salon page: name, rating, opening time, cover photos, and a row of section links reading Services, Shop, Team, Reviews, About.",
      hotspot: spot("customer/02-salon", "Jump to any section", "above"),
    },
    phone: {
      image: "customer/phone/02-salon.webp",
      alt: "The same salon page on a phone, with the cover photo above the name and rating and the section links in a scrollable strip.",
      hotspot: spot("customer/phone/02-salon", "Jump to any section"),
    },
  },
  {
    id: "services",
    chapter: "Finding a salon",
    title: "Prices, before you commit",
    body: "Every service with how long it takes and what it costs. Anything the salon has not put a stylist on says “Ask the salon — not bookable online” instead of leading you into a dead end.",
    narration:
      "Every service, with how long it takes and what it costs. If the salon hasn't put a stylist on something yet, it says so, instead of leading you into a dead end.",
    route: "/salon/norzin-salon-and-spa-…#services",
    wide: {
      image: "customer/03-services.webp",
      alt: "The salon's service list with durations and prices and a Book button on each bookable row.",
      hotspot: spot("customer/03-services", "Length and price on every row"),
    },
    phone: {
      image: "customer/phone/03-services.webp",
      alt: "The service list on a phone, one service per row with its duration, price and a Book button.",
      hotspot: spot("customer/phone/03-services", "Length and price on every row"),
    },
  },
  {
    id: "book-services",
    chapter: "Booking",
    title: "Step 1 — what you want",
    body: "Booking is four steps and the breadcrumb goes back to any of them. Add one service or several; the running total keeps up as you go.",
    narration:
      "Booking is four steps, and you can go back to any of them. Add one service or several — the total keeps up as you go.",
    route: "/salon/…/book",
    wide: {
      image: "customer/04-book-service.webp",
      alt: "Step one of the booking wizard, Select services, listing the salon's services with prices and a running total.",
      hotspot: spot("customer/04-book-service", "Four steps, all reversible"),
    },
    phone: {
      image: "customer/phone/04-book-service.webp",
      alt: "Step one on a phone: the four step names across the top, the services listed below, and the total pinned at the bottom.",
      hotspot: spot("customer/phone/04-book-service", "Four steps, all reversible"),
    },
  },
  {
    id: "book-professional",
    chapter: "Booking",
    title: "Step 2 — who does it",
    body: "“Any professional” takes whoever is free first and gives you the most times to choose from. Only stylists who actually perform everything in your basket are offered.",
    narration:
      "Choose anyone, and you'll get whoever is free first, and the most times to pick from. Or choose a stylist by name. Only the people who actually do everything in your basket are offered.",
    route: "/salon/…/book?step=professional",
    wide: {
      image: "customer/05-book-professional.webp",
      alt: "Step two, Select professional: Any professional with maximum availability, then each stylist by name.",
      hotspot: spot("customer/05-book-professional", "Anyone, or by name"),
    },
    phone: {
      image: "customer/phone/05-book-professional.webp",
      alt: "Step two on a phone, listing Any professional first and then each stylist with their role.",
      hotspot: spot("customer/phone/05-book-professional", "Anyone, or by name"),
    },
  },
  {
    id: "book-time",
    chapter: "Booking",
    title: "Step 3 — when",
    body: "Pick the day along the strip, then the time. “2 available” means two stylists are free at that moment. Every time is Bhutan time, wherever you happen to be reading this.",
    narration:
      "Pick the day along the strip, then the time. Two available means two stylists are free at that moment. Every time here is Bhutan time, wherever you happen to be reading this.",
    route: "/salon/…/book?step=time",
    wide: {
      image: "customer/06-book-time.webp",
      alt: "Step three, Select date and time: a scrollable week of dates with one chosen, and the free times grouped under Morning, each marked with how many stylists are available.",
      hotspot: spot("customer/06-book-time", "Day first, then time"),
    },
    phone: {
      image: "customer/phone/06-book-time.webp",
      alt: "Step three on a phone: the week of dates across the top and the free times listed underneath.",
      hotspot: spot("customer/phone/06-book-time", "Day first, then time"),
    },
  },
  {
    id: "book-confirm",
    chapter: "Booking",
    title: "Step 4 — check, then book",
    body: "The summary names the stylist and the total. A note and up to three reference photos are optional and stay private between you and the salon. The line under the total is how long you have to cancel for free.",
    narration:
      "Check it over. A note and up to three reference photos are optional, and they stay private between you and the salon. The line under the total tells you how long you have to cancel for free.",
    route: "/salon/…/book?step=confirm",
    wide: {
      image: "customer/07-book-confirm.webp",
      alt: "Step four, Review and confirm: an optional style picker, a note field and reference photos, beside a summary card naming the salon, the chosen day and time, the service, the stylist, the total, and how long free cancellation lasts.",
      hotspot: spot("customer/07-book-confirm", "Free cancellation window", "above"),
    },
    phone: {
      image: "customer/phone/07-book-confirm.webp",
      alt: "Step four on a phone, with the optional style picker and note above the summary and the booking button pinned at the bottom.",
      hotspot: spot("customer/phone/07-book-confirm", "Free cancellation window", "above"),
    },
    seconds: 11,
  },
  {
    id: "bookings",
    chapter: "Your appointments",
    title: "Everything you've booked",
    body: "Upcoming, completed and cancelled, in three tabs. Each card carries the service, the stylist, the price and a short reference the salon can look up.",
    narration:
      "Upcoming, completed and cancelled, in three tabs. Each card carries the service, the stylist, the price, and a short reference the salon can look up at the counter.",
    route: "/bookings",
    wide: {
      image: "customer/08-bookings.webp",
      alt: "My bookings, with tabs for upcoming, completed and cancelled, and confirmed appointments listed with their date, service, stylist and price.",
      hotspot: spot("customer/08-bookings", "Upcoming · Completed · Cancelled"),
    },
    phone: {
      image: "customer/phone/08-bookings.webp",
      alt: "My bookings on a phone: the three tabs above a stack of appointment cards.",
      hotspot: spot("customer/phone/08-bookings", "Upcoming · Completed · Cancelled"),
    },
  },
  {
    id: "booking-detail",
    chapter: "Your appointments",
    title: "Change it, or check in",
    body: "Call the salon, get directions, read the receipt, and switch reminders on or off. Reschedule, cancel and check-in sit further down the same page — self-service closes once the salon's cancellation window does, and the page says so rather than offering a button that will fail.",
    narration:
      "Call the salon, get directions, read the receipt, and switch reminders on or off. Rescheduling and cancelling are further down the same page, and they close when the salon's cancellation window does.",
    route: "/bookings/…",
    wide: {
      image: "customer/09-booking-detail.webp",
      alt: "One confirmed booking showing its date, time and stylist, Call and Directions buttons, a receipt, and a Remind me switch.",
      hotspot: spot("customer/09-booking-detail", "Reminders, on or off", "above"),
    },
    phone: {
      image: "customer/phone/09-booking-detail.webp",
      alt: "The same booking on a phone, with the salon photo, the details, the receipt and the reminder switch stacked.",
      hotspot: spot("customer/phone/09-booking-detail", "Reminders, on or off", "above"),
    },
    seconds: 11,
  },
  {
    id: "queue",
    chapter: "Walking in",
    title: "No appointment? Take a place in line",
    body: "Scan the code on the counter, or open the salon and join from there. The badge tells you how long the line is before you commit, and the page then updates itself while you wait — a browser gets nothing pushed to it, so watching the page is the promise this makes.",
    narration:
      "No appointment? Take a place in the walk-in line. The badge tells you how long the line is before you commit, and the page updates itself while you wait.",
    route: "/q/…",
    wide: {
      image: "customer/10-queue-join.webp",
      alt: "The join-queue form for a salon showing how long the line is, a choice of barber, and the list of services.",
      hotspot: spot("customer/10-queue-join", "How long the line is"),
    },
    phone: {
      image: "customer/phone/10-queue-join.webp",
      alt: "The join-queue form on a phone, with the salon name, the queue state, and the barber and service choices below it.",
      hotspot: spot("customer/phone/10-queue-join", "How long the line is"),
    },
    seconds: 11,
  },
  {
    id: "map",
    chapter: "Walking in",
    title: "Or find one on the map",
    body: "The same salons as pins, nearest first, with the list beside them. Search and the map follows; tap a pin to see the salon before opening it.",
    narration:
      "The same salons as pins, nearest first, with the list beside them. Search, and the map follows.",
    route: "/map",
    wide: {
      image: "customer/11-map.webp",
      alt: "The map page: salons listed with ratings and distances beside a grey map of Thimphu with salon pins on it.",
      hotspot: spot("customer/11-map", "Search, and the map follows"),
    },
    phone: {
      image: "customer/phone/11-map.webp",
      alt: "The map on a phone, filling the screen with salon pins and a search field above it.",
      hotspot: spot("customer/phone/11-map", "Search, and the map follows"),
    },
  },
  {
    id: "shop",
    chapter: "Shop and rewards",
    title: "Buy what your salon uses",
    body: "Salons sell the products they work with. Add them to a basket that survives a closed tab, then pay in cash when you collect — if a price or the stock changed while the basket sat there, the cart tells you what moved before you order.",
    narration:
      "Salons sell the products they work with. Add them to a basket that survives a closed tab, and pay in cash when you collect.",
    route: "/salon/…#shop",
    wide: {
      image: "customer/12-shop.webp",
      alt: "The salon's Shop section listing products with their price, a short description and an Add button.",
      hotspot: spot("customer/12-shop", "Add to basket"),
    },
    phone: {
      image: "customer/phone/12-shop.webp",
      alt: "The Shop section on a phone, one product per row with its price and an Add button.",
      hotspot: spot("customer/phone/12-shop", "Add to basket"),
    },
    seconds: 11,
  },
  {
    id: "rewards",
    chapter: "Shop and rewards",
    title: "Points, and what they're worth",
    body: "Points build up on completed visits at salons that run a programme. When you have enough, claim the reward and show the code at the counter — the screen changes by itself the moment the till confirms it.",
    narration:
      "Points build up on completed visits, at salons that run a programme. When you have enough, claim the reward and show the code at the counter.",
    route: "/rewards",
    wide: {
      image: "customer/13-rewards.webp",
      alt: "My rewards showing a points balance at a salon and how many more points its next reward needs.",
      hotspot: spot("customer/13-rewards", "Progress to the next reward"),
    },
    phone: {
      image: "customer/phone/13-rewards.webp",
      alt: "My rewards on a phone: the salon, the balance, and the progress to the next reward.",
      hotspot: spot("customer/phone/13-rewards", "Progress to the next reward"),
    },
  },
  {
    id: "messages",
    chapter: "Staying in touch",
    title: "Ask before you book",
    body: "A thread per salon, for the questions a price list cannot answer. An open thread refreshes itself, so a reply arrives without a reload.",
    narration:
      "A thread for each salon, for the questions a price list can't answer. An open thread refreshes itself, so a reply arrives without a reload.",
    route: "/messages",
    wide: {
      image: "customer/14-messages.webp",
      alt: "The Messages list with one thread per salon, each showing the latest message and how long ago it arrived.",
      hotspot: spot("customer/14-messages", "One thread per salon"),
    },
    phone: {
      image: "customer/phone/14-messages.webp",
      alt: "The Messages list on a phone, one salon per row with the latest message under the name.",
      hotspot: spot("customer/phone/14-messages", "One thread per salon"),
    },
  },
  {
    id: "notifications",
    chapter: "Staying in touch",
    title: "Everything that happened",
    body: "Booking changes, reminders, offers, orders and points all land here, newest first, with filters for the ones you care about.",
    narration:
      "Booking changes, reminders, offers, orders and points all land here, newest first, with filters for the ones you care about.",
    route: "/notifications",
    wide: {
      image: "customer/15-notifications.webp",
      alt: "The Notifications page with filter chips for all, unread, bookings and offers, listing points earned, an order ready for pickup and queue alerts.",
      hotspot: spot("customer/15-notifications", "Filter to unread"),
    },
    phone: {
      image: "customer/phone/15-notifications.webp",
      alt: "Notifications on a phone: the filter chips in a scrollable row above the list.",
      hotspot: spot("customer/phone/15-notifications", "Filter to unread"),
    },
  },
  {
    id: "profile",
    chapter: "Staying in touch",
    title: "Your details",
    body: "Name, photo, and the phone number a salon uses to reach you about a booking. Saved salons, orders, rewards and blocked accounts are all one row away.",
    narration:
      "Your name, your photo, and the phone number a salon uses to reach you about a booking. Saved salons, orders, rewards and blocked accounts are all one row away.",
    route: "/profile",
    wide: {
      image: "customer/16-profile.webp",
      alt: "The Profile page with a photo control, name and phone fields, the account email, and rows for bookings, notifications, saved salons, orders, rewards and blocked accounts.",
    },
    phone: {
      image: "customer/phone/16-profile.webp",
      alt: "Profile on a phone, with the photo and fields stacked above the rows for bookings, saved salons, orders and rewards.",
    },
  },
];

const OWNER_STEPS: GuideStep[] = [
  {
    id: "calendar",
    chapter: "Your day",
    title: "The console opens on today",
    body: "Day, Week and List are the three ways to read it. The strip under them is the day's appointments, what is left to come, what it is worth, and how full you are. Run more than one salon and the switcher above changes everything on the page.",
    narration:
      "The console opens on today. Day, week and list are the three ways to read it. The strip underneath is the day's appointments, what's left to come, what it's worth, and how full you are.",
    route: "/business",
    wide: {
      image: "owner/01-calendar.webp",
      alt: "The owner calendar on the Pro plan: Day, Week and List views, a Walk-in button, a fortnight of dates, a strip of the day's totals, and the day's appointments with time, customer, service, stylist and status.",
      hotspot: spot("owner/01-calendar", "Day · Week · List"),
    },
    phone: {
      image: "owner/phone/01-calendar.webp",
      alt: "The owner calendar on a phone: the salon switcher, the date, the three views, the scrollable dates and the day's appointments.",
      hotspot: spot("owner/phone/01-calendar", "Day · Week · List"),
    },
    seconds: 11,
  },
  {
    id: "booking",
    chapter: "Your day",
    title: "One appointment, end to end",
    body: "Who it is, when, the receipt, what is outstanding, and the loyalty points it earned. Confirm, complete and no-show live here while a booking is still live; a finished one shows no buttons rather than buttons that would fail.",
    narration:
      "Everything about one appointment: who, when, the receipt, and the loyalty points it earned. Confirm, complete and no-show live here while a booking is still live.",
    route: "/business/bookings/…",
    wide: {
      image: "owner/02-booking-detail.webp",
      alt: "A booking showing the customer, the time and the stylist, the services and total, what is still outstanding, and the loyalty points it earned.",
      hotspot: spot("owner/02-booking-detail", "Customer and state"),
    },
    phone: {
      image: "owner/phone/02-booking-detail.webp",
      alt: "The same booking on a phone, with the customer, status, services, total and loyalty stacked.",
      hotspot: spot("owner/phone/02-booking-detail", "Customer and state"),
    },
    seconds: 11,
  },
  {
    id: "queue-board",
    chapter: "Walk-ins",
    title: "The live walk-in board",
    body: "It polls every few seconds, so the line is current without anyone refreshing. “Show QR” is the code you print for the counter, and “Call next” takes the front of the line into a named stylist's chair.",
    narration:
      "The live walk-in line, updating by itself. Show QR is the code you print for the counter, and call next takes the front of the line into a named stylist's chair.",
    route: "/business/queue",
    wide: {
      image: "owner/03-queue-board.webp",
      alt: "The walk-in queue board with buttons for Show QR and Add walk-in, and a Call next button for each stylist.",
      hotspot: spot("owner/03-queue-board", "Someone at the counter", "above"),
    },
    phone: {
      image: "owner/phone/03-queue-board.webp",
      alt: "The queue board on a phone, with the line state, Show QR and Add walk-in, and a Call next button per stylist.",
      hotspot: spot("owner/phone/03-queue-board", "Someone at the counter", "above"),
    },
  },
  {
    id: "walk-in",
    chapter: "Walk-ins",
    title: "Book someone standing in front of you",
    body: "A walk-in becomes an ordinary booking: their name and phone so you can call them, the services, a stylist, and a time. Open times only appear once there is a service and a stylist to compute them from.",
    narration:
      "Someone who just walked in becomes an ordinary booking: their name and phone so you can call them, the services, a stylist, and a time.",
    route: "/business/walk-in",
    wide: {
      image: "owner/04-walk-in.webp",
      alt: "The Add walk-in form with optional customer name and phone, a note, the salon's services, a staff picker, and a time section waiting on both.",
      hotspot: spot("owner/04-walk-in", "Name them, so you can call"),
    },
    phone: {
      image: "owner/phone/04-walk-in.webp",
      alt: "The Add walk-in form on a phone, with the name and phone fields above the service list.",
      hotspot: spot("owner/phone/04-walk-in", "Name them, so you can call"),
    },
  },
  {
    id: "insights",
    chapter: "Insights",
    title: "What needs you, then how you're doing",
    body: "Anything waiting is at the top — new product orders here. Below it today's snapshot, then the four headline numbers with how each moved against the last period.",
    narration:
      "Anything waiting for you is at the top — new product orders here. Below that, today's snapshot, then the four headline numbers, and how each has moved.",
    route: "/business/insights",
    wide: {
      image: "owner/05-insights.webp",
      alt: "The Insights page: a banner for new product orders, today's snapshot, and At a glance cards for revenue, bookings, returning customers and no-shows.",
      hotspot: spot("owner/05-insights", "Waiting on you"),
    },
    phone: {
      image: "owner/phone/05-insights.webp",
      alt: "Insights on a phone, with the orders banner at the top and the headline numbers stacked below it.",
      hotspot: spot("owner/phone/05-insights", "Waiting on you"),
    },
  },
  {
    id: "insights-charts",
    chapter: "Insights",
    title: "Trends, and the month's goal",
    body: "Revenue over time at four zoom levels — daily, weekly, monthly, yearly — with bookings, average ticket and utilisation beneath it, and the monthly goal saying how many more bookings would close the gap.",
    narration:
      "Revenue over time at four zoom levels, with bookings, average ticket and utilisation beneath it, and the month's goal saying how many more bookings would close the gap.",
    route: "/business/insights",
    wide: {
      image: "owner/06-insights-charts.webp",
      alt: "The revenue trend chart at monthly zoom with its pace against the goal, cards for bookings, average ticket and utilisation, and a monthly goal dial.",
      hotspot: spot("owner/06-insights-charts", "Four zoom levels"),
    },
    phone: {
      image: "owner/phone/06-insights-charts.webp",
      alt: "The trend chart on a phone, with the four zoom levels above it and the goal dial below.",
      hotspot: spot("owner/phone/06-insights-charts", "Four zoom levels"),
    },
    seconds: 11,
  },
  {
    id: "services",
    chapter: "Setting up",
    title: "Your menu",
    body: "What you offer, how long it takes and what it costs — and duration is load-bearing: it sets how long a booking blocks the chair and feeds the walk-in wait estimate. A service nobody performs yet says so, because it cannot be booked until a stylist has it.",
    narration:
      "What you offer, how long it takes, and what it costs. Duration is the important one: it sets how long a booking blocks the chair, and it feeds the walk-in wait estimate.",
    route: "/business/services",
    wide: {
      image: "owner/07-services.webp",
      alt: "The Services page listing each service with its duration and price, some warning that nobody performs them yet.",
      hotspot: spot("owner/07-services", "Duration drives the diary"),
    },
    phone: {
      image: "owner/phone/07-services.webp",
      alt: "The Services page on a phone, one service per row with its duration, price and warnings.",
      hotspot: spot("owner/phone/07-services", "Duration drives the diary"),
    },
    seconds: 11,
  },
  {
    id: "staff",
    chapter: "Setting up",
    title: "Your team",
    body: "Each stylist needs two things before anyone can book them: the services they perform, and their working hours. The page says so rather than letting you find out from an empty slot list.",
    narration:
      "Each stylist needs two things before anyone can book them — the services they perform, and their working hours.",
    route: "/business/staff",
    wide: {
      image: "owner/08-staff.webp",
      alt: "The Staff page listing each stylist with whether their login is linked, and an Add staff button.",
      hotspot: spot("owner/08-staff", "Services and hours each"),
    },
    phone: {
      image: "owner/phone/08-staff.webp",
      alt: "The Staff page on a phone, one stylist per row.",
      hotspot: spot("owner/phone/08-staff", "Services and hours each"),
    },
  },
  {
    id: "hours",
    chapter: "Setting up",
    title: "Two kinds of hours",
    body: "These are the shop's opening hours: they show on your salon page and drive how full each day looks. A break is the gap between two stretches of a day. What can actually be booked comes from each stylist's own working hours — the page links you there.",
    narration:
      "These are the shop's opening hours. A break is the gap between two stretches of a day. What can actually be booked comes from each stylist's own hours, and the page links you there.",
    route: "/business/hours",
    wide: {
      image: "owner/09-hours.webp",
      alt: "The Opening hours editor, day by day, with start and end times, Add a break, and a note that stylists' own hours decide what can be booked.",
      hotspot: spot("owner/09-hours", "Split a day for lunch"),
    },
    phone: {
      image: "owner/phone/09-hours.webp",
      alt: "The Opening hours editor on a phone, one day per block with its start and end times.",
      hotspot: spot("owner/phone/09-hours", "Split a day for lunch"),
    },
    seconds: 11,
  },
  {
    id: "settings",
    chapter: "Back office",
    title: "Everything else, in two groups",
    body: "What you set up once, and the back office you come back to. Each row carries the live state of what it leads to — how many services, how many stylists, how many orders are waiting.",
    narration:
      "Two groups: what you set up once, and the back office you come back to. Every row shows the live state of whatever it leads to.",
    route: "/business/settings",
    wide: {
      image: "owner/10-settings.webp",
      alt: "The settings hub: Salon details, Opening hours, Services and Staff under Set up your salon, each showing its current state, and a Run the business group below.",
      hotspot: spot("owner/10-settings", "Run the business"),
    },
    phone: {
      image: "owner/phone/10-settings.webp",
      alt: "The settings hub on a phone, the setup rows stacked above the back-office group.",
      hotspot: spot("owner/phone/10-settings", "Run the business"),
    },
  },
  {
    id: "salon-details",
    chapter: "Back office",
    title: "How customers see you",
    body: "Name, type, address, contact, cover photo, the categories you appear under on Discover, and the pin on the map. A WhatsApp number adds a button to your salon page; leave it blank and the button is not there.",
    narration:
      "Name, type, address, contact, photos, the categories you appear under, and the pin on the map. This is what a customer sees.",
    route: "/business/settings/salon",
    wide: {
      image: "owner/11-salon-details.webp",
      alt: "The Salon details form: cover photo, salon name, business type, address, phone, WhatsApp number, category chips, and a draggable map pin.",
      hotspot: spot("owner/11-salon-details", "Your public page"),
    },
    phone: {
      image: "owner/phone/11-salon-details.webp",
      alt: "The Salon details form on a phone, with the cover control above the name, type and address fields.",
      hotspot: spot("owner/phone/11-salon-details", "Your public page"),
    },
  },
  {
    id: "orders",
    chapter: "Back office",
    title: "Product orders",
    body: "Orders only move forward: New, Ready, then collected — or out for delivery and delivered. Declining asks for a reason and the customer reads it, and you cannot decline once the goods have left the shop.",
    narration:
      "Product orders only move forward: new, ready, then collected — or out for delivery, and delivered. Declining asks for a reason, and the customer reads it.",
    route: "/business/orders",
    wide: {
      image: "owner/12-orders.webp",
      alt: "The Orders inbox on the New tab, listing orders by reference with their item count and total.",
      hotspot: spot("owner/12-orders", "New · Ready · Delivering · Done"),
    },
    phone: {
      image: "owner/phone/12-orders.webp",
      alt: "The Orders inbox on a phone, the status tabs above the list of orders.",
      hotspot: spot("owner/phone/12-orders", "New · Ready · Delivering · Done"),
    },
    seconds: 11,
  },
  {
    id: "clients",
    chapter: "Back office",
    title: "Your client book",
    body: "Everyone who has ever booked, what they have spent, how often they come — and who has quietly stopped. “Lapsed” is measured against your own rebooking window, not a number we picked.",
    narration:
      "Everyone who has ever booked, what they've spent, how often they come, and who has quietly stopped. Lapsed is measured against your own rebooking window.",
    route: "/business/clients",
    wide: {
      image: "owner/13-clients.webp",
      alt: "The Client book with counts of clients, regulars and lapsed, and rows showing each client's visits, spend and last visit.",
      hotspot: spot("owner/13-clients", "Regulars, and who drifted"),
    },
    phone: {
      image: "owner/phone/13-clients.webp",
      alt: "The Client book on a phone, with the search field and counts above the client rows.",
      hotspot: spot("owner/phone/13-clients", "Regulars, and who drifted"),
    },
  },
  {
    id: "loyalty",
    chapter: "Back office",
    title: "Loyalty, and the counter",
    body: "Points per visit or per spend, the rewards you offer, and — at the top — the codes waiting to be honoured. That list is a queue for whoever is on the till, not a history: a claim vanishes once it is confirmed.",
    narration:
      "Points per visit or per spend, the rewards you offer, and at the top, the codes waiting to be honoured at the counter.",
    route: "/business/loyalty",
    wide: {
      image: "owner/14-loyalty.webp",
      alt: "The Loyalty page: the redemptions queue at the top, the programme's earning rule, and the rewards on offer with what each costs in points.",
      hotspot: spot("owner/14-loyalty", "Codes to honour"),
    },
    phone: {
      image: "owner/phone/14-loyalty.webp",
      alt: "The Loyalty page on a phone, the redemptions queue above the earning rule and the rewards.",
      hotspot: spot("owner/phone/14-loyalty", "Codes to honour"),
    },
    seconds: 11,
  },
  {
    id: "owner-messages",
    chapter: "Back office",
    title: "The salon's inbox",
    body: "Customers asking about times, prices and anything else. It is one inbox per salon — switch salons in the header to read another one's.",
    narration:
      "Customers asking about times, prices and anything else. It's one inbox per salon — switch salons in the header to read another one's.",
    route: "/business/messages",
    wide: {
      image: "owner/15-messages.webp",
      alt: "The salon's message inbox, listing customer threads with the latest message under each name.",
      hotspot: spot("owner/15-messages", "This salon only"),
    },
    phone: {
      image: "owner/phone/15-messages.webp",
      alt: "The salon's inbox on a phone, one customer thread per row.",
      hotspot: spot("owner/phone/15-messages", "This salon only"),
    },
  },
  {
    id: "plans",
    chapter: "Back office",
    title: "Plan and billing",
    body: "What each tier costs and what it unlocks. Payment is arranged with us directly — no card is taken in the app or on this site — and you can ask to move tier from this page.",
    narration:
      "What each tier costs and what it unlocks. Payment is arranged with us directly — no card is taken here — and you can ask to move tier from this page.",
    route: "/business/plans",
    wide: {
      image: "owner/16-plans.webp",
      alt: "Plan and billing: the tiers side by side with their monthly price and the features each one includes.",
      hotspot: spot("owner/16-plans", "No card is taken"),
    },
    phone: {
      image: "owner/phone/16-plans.webp",
      alt: "Plan and billing on a phone, the tiers stacked with their price and features.",
      hotspot: spot("owner/phone/16-plans", "No card is taken"),
    },
  },
];

export const CUSTOMER_GUIDE: Guide = {
  audience: "customer",
  title: "How Tho works",
  blurb: "Booking, walk-ins, the shop and your rewards — in the real app, one screen at a time.",
  steps: CUSTOMER_STEPS,
};

export const OWNER_GUIDE: Guide = {
  audience: "owner",
  title: "How the salon console works",
  blurb:
    "Your day, the walk-in board, insights and the back office — in the real console, one screen at a time.",
  steps: OWNER_STEPS,
};

export const GUIDES: Record<GuideAudience, Guide> = {
  customer: CUSTOMER_GUIDE,
  owner: OWNER_GUIDE,
};

/** Total run time of a guide, in seconds — what the launcher quotes. */
export function guideRunSeconds(guide: Guide): number {
  return guide.steps.reduce((total, step) => total + (step.seconds ?? DEFAULT_SECONDS), 0);
}

/** "About 3 min" — rounded up, because a guide that runs longer than promised is worse. */
export function guideRunLabel(guide: Guide): string {
  const minutes = Math.ceil(guideRunSeconds(guide) / 60);
  return `About ${minutes} min`;
}
