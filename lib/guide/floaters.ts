/**
 * Which of the app's components drift around the device, and in which chapter.
 *
 * ## The reference's trick, and what it costs to copy honestly
 *
 * The Spaceti film does not only photograph screens: it takes the interface apart and lets
 * the pieces float at different depths around the device. That reads as confidence — the
 * product is made of parts, here are the parts — and it is the thing screenshots alone
 * cannot fake.
 *
 * Copying it needed a re-capture, because a component cropped out of a screenshot arrives
 * welded to a white rectangle and to whatever sat beside it. `../tho/app/test/
 * guide_components_test.dart` renders each widget alone on a transparent ground through
 * `flutter test`, so every piece here is the real widget, drawn by the app's own code with
 * the app's own theme — not a picture of one, and not a redraw.
 *
 * ## Where they are allowed to appear
 *
 * Only on `statement` and `cluster`. Those are the two shots whose job is to say what a
 * chapter is *about*; the split layouts are where somebody is being shown which button to
 * press, and a booking card drifting past while they are trying to find it is decoration
 * charged to the viewer's attention.
 *
 * ## The rule: a piece must be *on* the screen behind it
 *
 * The first version of this file chose by chapter *subject* — the pieces beside a chapter
 * were pieces the chapter was broadly about. That is not a strong enough test, and the
 * opening shot proved it: a salon card, a rating and a Book button floated beside the
 * onboarding screen, which shows none of the three. It read as interface that had fallen
 * off the phone, and the reviewer's reaction was exactly that.
 *
 * The working version is narrower. A floating piece has to appear on the very screen it is
 * drifting beside, so the eye can find where it came from — two queue badges beside the
 * queue screen that shows both badges, order chips beside the orders list, the selected
 * 09:00 chip beside the time grid it was selected in. Then the shot reads as one interface
 * coming apart rather than as unrelated widgets arranged around a phone.
 *
 * Applying it emptied three chapters, and that is the rule working rather than failing:
 * those shots now carry themselves.
 *
 * Three per shot at most. Four starts to read as a collage and competes with the device,
 * which is still the thing being explained.
 *
 * ## Only three lists here are ever drawn
 *
 * Floaters render on `statement` and `cluster` only, so a chapter `layouts.ts` gives a split
 * to never shows its list. Those are marked below and are left as candidates for if a
 * chapter's layout changes — they have not been audited against the rule above, and would
 * need to be before they could be trusted on screen.
 */

import type { GuideAudience } from "./timeline";

/**
 * Component names, matching keys in the generated `components.ts`.
 *
 * Indexed by chapter. An empty list is legitimate — it means that chapter's shot carries
 * itself — and is why this is a list per chapter rather than a lookup that has to have an
 * answer for everything.
 */
export const CHAPTER_FLOATERS: Record<GuideAudience, readonly (readonly string[])[]> = {
  customer: [
    /*
      Welcome — nothing, and this one was learned the hard way.

      It used to carry a salon card, a rating and a Book button, chosen as "the three things
      the app is for". But the screen behind them is *onboarding*: a photograph and a
      sentence, with no card, no rating and no button anywhere on it. Pieces that appear
      nowhere on the screen they float beside do not read as an interface taken apart — they
      read as interface that fell off, and the effect collapses into decoration.

      Compare chapter 5, where the two queue badges float beside the queue screen that shows
      exactly those badges: same technique, and it reads immediately, because the eye can
      find where each piece came from.
    */
    [],
    // Getting started — a sign-in form, and nothing else. (Split layout; never rendered.)
    [],
    // Finding a salon. (Split layout; never rendered.)
    ["salon-card", "rating", "section-header"],
    /*
      Booking an appointment. Rendered on `22c-booking-confirmed` only, which `layouts.ts`
      promotes to a statement. That screen holds the time grid with 09:00 selected behind
      the confirmation sheet, and a coral primary button on the sheet itself — so both of
      these are on it. The stylist tile was dropped: it belongs to `20-book-services`
      earlier in the chapter and is nowhere on this screen.
    */
    ["slot-selected", "button-book"],
    // Walking in — the join-queue screen shows both badges and the specialists' monograms.
    ["queue-wait", "queue-free", "avatar"],
    // Bookings and messages — the list is booking cards carrying exactly these two pills.
    ["booking-card", "pill-confirmed", "pill-completed"],
    // Shop, rewards and your account. (Split layout; never rendered.)
    ["loyalty-ring", "order-ready", "avatar"],
  ],
  owner: [
    /*
      Your salon console — nothing. The insights screen is a dashboard of revenue tiles, a
      "next up" summary and a trends chart. It carries no booking card, no status pill and
      no monogram, so the three that used to float here were all borrowed from elsewhere in
      the console.
    */
    [],
    // Your calendar. (Split layout; never rendered.)
    ["booking-card", "pill-confirmed", "pill-cancelled"],
    /*
      The walk-in queue. Rendered on `57-queue-qr`, promoted to a statement. Its banner reads
      "3 waiting · ~40 min wait" and its Next-up rows carry monograms, so those two are on
      screen. `queue-free` is not: that salon has a queue, which is the whole point of the
      shot.
    */
    ["queue-wait", "avatar"],
    // Services, products and staff. (Split layout; never rendered.)
    ["stylist-tile", "section-header", "button-book"],
    // Clients and orders — the orders screen is a list of exactly these three chips.
    ["order-new", "order-ready", "order-collected"],
    // Growing the salon. (Split layout; never rendered.)
    ["loyalty-ring", "rating", "salon-card"],
    /*
      Settings and your plan — nothing. The settings screen is a cover image and a form; its
      only match was the "Salon details" section header, and one lone piece drifting in the
      corner reads as something left behind rather than as a composition.
    */
    [],
  ],
};

/** The pieces that drift beside a chapter, or none. */
export function floatersFor(
  audience: GuideAudience,
  chapterIndex: number,
): readonly string[] {
  return CHAPTER_FLOATERS[audience][chapterIndex] ?? [];
}
