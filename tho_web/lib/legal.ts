/**
 * The legal and policy copy, ported from `tho/app/lib/moderation/`.
 *
 * ## It lives in one module, not in the pages
 *
 * Because two of its consumers are not pages: the terms gate has to link to *the exact
 * text* it is asking somebody to accept, and `TERMS_VERSION` in `lib/api/moderation.ts`
 * has to identify that same text. Two copies of a legal document is how they drift apart,
 * which is the reason the Dart keeps `kTermsOfServiceText` next to the gate rather than
 * inside a screen.
 *
 * ## The content rules are not decoration
 *
 * Google Play requires an app hosting user content to *"define objectionable content and
 * behaviors … and prohibit them in the app's terms of use or user policies"*.
 * `CONTENT_RULES` defines them; `TERMS_OF_SERVICE` prohibits them. Changing either
 * materially means bumping `TERMS_VERSION` — `profiles.terms_version` records what was
 * agreed to precisely so a future revision can re-prompt without a migration.
 *
 * **This is MVP text and says so**, matching upstream. The content rules are not
 * placeholder; they apply now.
 */

export const TERMS_OF_SERVICE: { heading: string | null; body: string }[] = [
  {
    heading: null,
    body:
      "By using Tho you agree to book in good faith and to honour the cancellation window " +
      "each salon sets. Payments are cash-first: they are recorded in the app, not " +
      "processed by it, and any money changes hands between you and the salon.",
  },
  {
    heading: "What you post",
    body:
      "Reviews, photos and messages you post are yours, and you are responsible for them. " +
      "Post only what you have the right to post, and only about visits that really " +
      "happened.\n\n" +
      "You may not post anything our content policy prohibits — spam and scams, " +
      "harassment, hate speech, sexual or violent content, false claims, other people's " +
      "private information, or impersonation. Content that breaks those rules is removed, " +
      "and accounts that keep breaking them are suspended.\n\n" +
      "Anyone can report content to us, and anyone can block another user. Reports are " +
      "read by a person.",
  },
  {
    heading: "Your account",
    body:
      "You need an account to book, to post and to message a salon. Keep your sign-in to " +
      "yourself. You can delete your account at any time from your profile; the salon " +
      "keeps its own record of bookings and reviews, anonymised, because that is its " +
      "business record.",
  },
  {
    heading: null,
    body:
      "This is the MVP text and will be replaced by the final Terms before general " +
      "release. The content rules above are not placeholder — they apply now.",
  },
];

export const CONTENT_POLICY_INTRO =
  "Tho carries reviews, photos and messages written by the people who use it. These are " +
  "the things that may not be posted. They apply to everyone: customers, stylists and " +
  "salon owners alike.";

export const CONTENT_RULES: { title: string; body: string }[] = [
  {
    title: "Spam and scams",
    body:
      "Repeated or unsolicited promotion, fake reviews, links to other services, or any " +
      "attempt to take payment outside a salon's own booking. Reviews must come from a " +
      "real visit.",
  },
  {
    title: "Harassment and bullying",
    body:
      "Insults, intimidation, unwanted repeated contact, or singling out a stylist or " +
      "customer for abuse. Disagreeing with a salon is fine; going after the people who " +
      "work there is not.",
  },
  {
    title: "Hate speech",
    body:
      "Attacks on anyone because of ethnicity, national origin, religion, caste, " +
      "disability, sex, gender identity or sexual orientation.",
  },
  {
    title: "Sexual and explicit content",
    body:
      "Nudity, sexual content, or anything soliciting sexual services. Photos must show " +
      "hair, grooming or the salon itself.",
  },
  {
    title: "Violence and threats",
    body: "Threatening harm, encouraging violence, or graphic images of injury.",
  },
  {
    title: "False or misleading claims",
    body:
      "Reviews of a visit that never happened, prices or services a salon does not offer, " +
      "or health claims that could mislead someone.",
  },
  {
    title: "Other people's private information",
    body:
      "Phone numbers, addresses, ID or payment details belonging to anyone other than " +
      "yourself — including a photo that shows another customer's face without their " +
      "agreement.",
  },
  {
    title: "Impersonation",
    body: "Posing as another person, a salon you do not work for, or Tho itself.",
  },
  {
    title: "Anything else that does harm",
    body:
      "Illegal activity, and anything that puts someone at risk. If it does not fit a " +
      "category above, report it anyway and tell us why.",
  },
];

export const WHAT_HAPPENS_WHEN_YOU_REPORT =
  "Every report is read by a person. Content that breaks these rules is removed, and " +
  "accounts that keep breaking them are suspended. You can also block someone: their " +
  "messages stop reaching you and yours stop reaching them. Reporting is anonymous — the " +
  "person you report is not told who reported them.";

/**
 * The privacy summary.
 *
 * **The web has no upstream original for this**: the Flutter app opens a hosted URL for
 * its privacy policy rather than carrying text. Rather than invent a legal document, this
 * states only what the code in this repo can be shown to do — what is stored, what the
 * salon can see, what leaves the platform (nothing), and how to remove it — and says
 * plainly that the full policy is the hosted one. Do not extend it with claims the
 * schema does not support.
 */
export const PRIVACY_SUMMARY: { heading: string; body: string }[] = [
  {
    heading: "What we store",
    body:
      "Your name, email, and — if you add one — your phone number and photo. Your " +
      "bookings, orders, reviews, saved salons, followed stylists, messages to salons, " +
      "and your place in a walk-in queue.",
  },
  {
    heading: "What the salon can see",
    body:
      "A salon sees your name, your phone number if you have added one, and the bookings, " +
      "orders and queue places you have with that salon. It cannot see your bookings with " +
      "any other salon, and it cannot browse the customer list of the platform.",
  },
  {
    heading: "What leaves Tho",
    body:
      "Nothing is sold, and there is no advertising network here. Reference photos you " +
      "attach to a booking are stored privately and are readable only by you and the " +
      "salon you booked with.",
  },
  {
    heading: "Removing it",
    body:
      "Delete your account from your profile. Your sign-in and personal details go, and " +
      "the email becomes free again. Past bookings and reviews stay with the salon as its " +
      "business record, with your name removed.",
  },
];
