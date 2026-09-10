import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client. Publishable (anon) key — safe to ship: RLS is the gate and
 * every write goes through an RPC that authorises the caller server-side.
 *
 * Reads work with no session at all, which is what lets a visitor browse salons
 * before signing in. See `lib/auth.ts` for why a guest session is created lazily
 * rather than on arrival.
 *
 * ## There is no retry layer here, and that is a decision
 *
 * The app wraps its Supabase calls in one — a few attempts, jittered backoff, reads only —
 * because a Bhutanese mobile link drops connections routinely and **every** read in the app
 * is that hop: a phone in Thimphu talking to Supabase directly.
 *
 * Most of this product's reads are not that hop. They happen in server components through
 * `lib/supabase/server.ts`, on a Vercel node talking to Supabase over a datacentre link. The
 * connection that actually drops is the browser's to Vercel, and what it carries is an RSC
 * payload, not a Postgres query. A retry layer in this file would harden the reliable hop and
 * leave the unreliable one untouched.
 *
 * What does cross the mobile link from here is, first, **every write in the app** — writes are
 * client components calling RPCs — and the app's own rule is that a retry layer must never
 * touch those. `record_payment`'s contract says a retried call records a *second* payment, and
 * `create_booking` and `place_order` carry idempotency keys precisely so that retrying stays
 * the caller's decision. So the layer would be forbidden from acting on most of what it saw.
 *
 * And second, two kinds of read, both already answered:
 *
 * - **Polls** — the queue line, a message thread, the unread badge. A poll is its own retry:
 *   `usePollTick` fires again within seconds, and every caller distinguishes *the last read
 *   failed* from *there is nothing*. A dropped poll heals itself; a retried one arrives twice.
 * - **One-shot reads**, of which the slot picker is the sharpest. It already resolves a failure
 *   into an explicit failed state with something to press — which is what the app's second
 *   restriction argues for in the first place: a timeout has already spent its budget, and
 *   another spinner is worse than the Retry button it replaced.
 *
 * If that ever stops being true, the three restrictions to copy exactly are: **reads only**
 * (this layer sees bytes, not intent), **timeouts are not retried**, and **backoff is
 * jittered**, because a screen fires several reads at once and a fixed delay brings them all
 * back on the same millisecond.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
