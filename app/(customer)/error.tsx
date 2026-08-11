"use client";

import { ErrorState } from "@/components/ui/error-state";

/**
 * The customer surface's error boundary — **the thing whose absence made an outage look like
 * an empty account.**
 *
 * Before this there was no `error.tsx` anywhere in the app, and the consequence was not that
 * failures crashed: it was that seven list routes *avoided* crashing by catching every read
 * into `[]` and then branching on length. So a Supabase outage rendered *"No upcoming
 * appointments — book a salon and it will show up here"* to somebody with four bookings. With a
 * boundary to fall into, those catches could be removed and a failed read can say so.
 *
 * ## A route group **is** an error boundary, unlike `not-found`
 *
 * Worth stating because this repo has been caught by the opposite. `app/(customer)/not-found.tsx`
 * never rendered once: `not-found` resolves by **URL path**, and `(customer)` contributes no path
 * segment, so the lookup walked straight past it. `error.tsx` is different — it is part of the
 * rendered component tree, wrapping the segment's `page`, `loading` and nested layouts, and
 * layouts resolve *through* route groups. So this one does apply to all 25 customer routes.
 *
 * ## What it does not catch
 *
 * `error.tsx` does **not** wrap the `layout.tsx` in its own segment. `app/(customer)/layout.tsx`
 * calls `requireLiveAccount()` and reads the queue, so a failure there bubbles past this to
 * `global-error.tsx`. That is the correct split — the shell is gone at that point, and drawing
 * a friendly card inside chrome that failed to render would be a lie about how much of the page
 * works.
 */
export default function CustomerError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorState
      message="That didn't load. It may be a connection problem — trying again often fixes it. Everything else on the site still works."
      retry={unstable_retry}
      digest={error.digest}
    />
  );
}
