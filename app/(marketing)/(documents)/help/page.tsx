import type { Metadata } from "next";
import Link from "next/link";
import { Icons, IconSize } from "@/components/ui/icons";
import { CUSTOMER_HOME } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Help",
  description: "How booking, the walk-in queue, orders and rewards work on Tho.",
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
 */
export default function HelpPage() {
  return (
    <div className="px-base py-xl tablet:px-lg mx-auto w-full max-w-[680px]">
      <h1 className="text-display-xl text-ink font-semibold">Help</h1>
      <p className="text-body-md text-body mt-base">
        The things people ask most. Each one ends where you can go and do it.
      </p>

      <div className="gap-lg mt-xl flex flex-col">
        {TOPICS.map((topic) => (
          <section
            key={topic.q}
            className="border-hairline-soft bg-paper p-lg rounded-lg border"
          >
            <h2 className="text-title text-ink font-semibold">{topic.q}</h2>
            <p className="text-body-sm text-body mt-xs">{topic.a}</p>
            {topic.href ? (
              <Link
                href={topic.href}
                className="text-title text-rausch-cta gap-xs mt-sm inline-flex items-center font-medium"
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
    </div>
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
