import type { Metadata } from "next";
import Link from "next/link";
import { Icons, IconSize } from "@/components/ui/icons";
import { CUSTOMER_HOME } from "@/lib/auth";
import { breadcrumbSchema, faqSchema, jsonLdScript } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Help — Booking, Queues, Payment & Rewards",
  description:
    "How to change or cancel a booking, join a salon's walk-in queue, pay, earn and spend loyalty points, report something, and delete your account on THO.",
  alternates: { canonical: "/help" },
  openGraph: {
    type: "website",
    url: "/help",
    title: "Help — Booking, Queues, Payment & Rewards on THO",
    description:
      "How booking changes, the walk-in queue, payment, loyalty points and account deletion work on THO.",
  },
};

/**
 * Help — and it answers with **links into the product**, not with a support address.
 *
 * The app's Help entry opens a hosted page. There is no support inbox in this codebase and
 * no ticketing anywhere in the schema, so a page promising "contact support" would be
 * promising something nothing here delivers — the same class of dishonesty as the queue
 * card that once said "we'll notify you" while every outbox row failed.
 *
 * So each answer ends where the thing actually is. Every fact below is one this repo
 * enforces: the cancellation window is the salon's own `cancellation_window_hours`, the
 * queue is `queue_active_line`, cash on collection is the whole payment model, and points
 * are awarded by `handle_booking_status_event` on completion.
 *
 * ## It is a public document now, and that changes who reads it
 *
 * This is the first of the footer's four Legal links, and it used to render inside the
 * customer app — a page of "here is where that is in the product" wrapped in the product's
 * own nav, which is the one audience that did not need it. It renders in the public shell
 * now (see `(documents)/layout.tsx`), so somebody deciding whether to sign up can read what
 * the thing does first. The six answers are unchanged, links included: they still point
 * into the app, which is where those things are, and a signed-out reader meets the sign-in
 * wall at the destination rather than at the explanation.
 *
 * The rows are the divided list the landing page's FAQ band uses, not the accordion. These
 * are six short answers somebody arrives at from a footer with a question already in mind —
 * an accordion would hide five of them behind a press, and a document that cannot fail to
 * render is worth more here than a gesture.
 */
export default function HelpPage() {
  const trail = [
    { name: "Home", path: "/" },
    { name: "Help", path: "/help" },
  ];

  return (
    <article className="scroll-mt-[calc(var(--site-header-height)+1.5rem)]">
      {/*
        **Six real questions with real answers, and they carried no markup at all.**

        This is the most rigorously fact-checked prose in the repo — its own doc comment
        says every fact below is one this repo enforces — and it is exactly the shape an
        answer engine wants: a question as a heading, a self-contained answer under it,
        nothing hedged. It was invisible as such, because nothing told a crawler these
        were question-and-answer pairs rather than eight paragraphs.

        `faqSchema` is fed the **same array the page renders**, so the marked-up answer and
        the visible answer cannot drift apart — which Google's structured-data policy
        requires, and which is also the only way this stays true when the copy changes.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            faqSchema(
              TOPICS.map(({ q, a }) => ({ q, a })),
              "/help",
            ),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema(trail)) }}
      />

      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="text-muted flex items-center gap-1.5 text-caption font-medium">
          <li>
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-ink">
            Help
          </li>
        </ol>
      </nav>

      <h1 className="text-editorial-lg font-semibold">
        Help — booking, queues, payment and rewards
      </h1>

      <p className="text-body mt-6 text-body-lg leading-relaxed">
        The things people ask most. Each one ends where you can go and do it.
      </p>

      <div className="bg-hairline-soft mt-10 h-px" />

      <div className="flex flex-col">
        {TOPICS.map((topic) => (
          <section
            key={topic.q}
            className="border-hairline-soft border-b py-7 last:border-b-0"
          >
            <h2 className="text-ink text-subheading font-semibold">{topic.q}</h2>
            <p className="text-body mt-2 text-body-lg leading-relaxed">{topic.a}</p>
            {topic.href ? (
              <Link
                href={topic.href}
                className="text-rausch-cta hover:text-ink mt-4 inline-flex items-center gap-1.5 text-ui font-medium transition-colors"
              >
                {topic.cta}
                <Icons.forward
                  style={{ width: IconSize.xxs, height: IconSize.xxs }}
                  aria-hidden
                />
              </Link>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}

const TOPICS: { q: string; a: string; href?: string; cta?: string }[] = [
  {
    q: "How do I change or cancel a booking?",
    a: "Open the booking and use Reschedule or Cancel. Each salon sets its own free-cancellation window, and the booking shows you the deadline for that salon rather than a general rule.",
    href: "/bookings",
    cta: "My bookings",
  },
  {
    q: "What is a walk-in queue?",
    a: "Some salons take walk-ins as a live line you can join from your phone. You get a place and a rough wait, and the page updates itself while you wait — there is nothing to refresh and nothing to keep checking.",
    href: CUSTOMER_HOME,
    cta: "Find a salon",
  },
  {
    q: "How do I pay?",
    a: "In the shop, at the salon. Tho records what you booked or ordered and what it costs; the money changes hands between you and the salon. There is no card payment here.",
  },
  {
    q: "How do points work?",
    a: "Salons that run a loyalty programme award points when a booking is completed — not when it is made. When you have enough for a reward you claim it here and show the code at the till.",
    href: "/rewards",
    cta: "My rewards",
  },
  {
    q: "Something here is wrong or abusive",
    a: "Report it. Reports go to our moderators rather than to the salon, they are read by a person, and the person you report is not told who reported them. You can also block someone so their messages stop reaching you.",
    href: "/legal/content-policy",
    cta: "What can't be posted",
  },
  {
    q: "How do I delete my account?",
    a: "From your profile, at the bottom. It removes your sign-in and your personal details permanently and frees the email for reuse. Past bookings and reviews stay with the salon as its business record, with your name removed.",
    href: "/profile",
    cta: "My profile",
  },
];
