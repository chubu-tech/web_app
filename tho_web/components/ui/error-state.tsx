"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";

/**
 * The fallback every `error.tsx` in this app renders — one voice for a failed page.
 *
 * ## `unstable_retry`, never `reset`
 *
 * Both are handed to an `error.tsx` in Next 16, and they are **not interchangeable**:
 * `reset()` clears the error state and re-renders *without re-fetching*, so it cannot recover
 * from a Server Component error. Every failure this app can produce is one — a Supabase read
 * inside a server page — so `reset()` would clear the boundary, re-render the same failing
 * server output, and land straight back here. A "Try again" button that provably cannot
 * succeed is worse than no button.
 *
 * `unstable_retry()` re-fetches and re-renders the boundary's children, and it does it inside
 * a Transition, so client state *outside* the boundary survives the attempt.
 *
 * The name carries `unstable_` because the API does (Next 16.2). It is the documented prop of
 * the stable `error.tsx` convention, not an opt-in experiment — but if it is renamed, this is
 * the one file to change.
 *
 * ## Why a component rather than four copies
 *
 * Three shells and a root boundary need the same words. The customer surface, the console and
 * the staff shell all render this; only `global-error.tsx` cannot, because it replaces the root
 * layout and ships without global styles — see its own note.
 */
export function ErrorState({
  title = "Something went wrong",
  message = "That didn't load. It may be a connection problem — trying again often fixes it.",
  retry,
  digest,
}: {
  title?: string;
  message?: string;
  /** The `unstable_retry` handed in by the boundary. */
  retry: () => void;
  /**
   * `error.digest` — the hash Next generates so a client-side report can be matched to the
   * server log.
   *
   * Rendered, quietly, and that is a deliberate call: in production the `error.message` from a
   * Server Component is replaced by a generic string precisely so nothing sensitive leaks, so
   * the digest is the **only** thing that connects what somebody saw to what was logged. A
   * salon owner reading it down the phone is worth more than a tidier card.
   */
  digest?: string;
}) {
  return (
    <div className="px-base py-xxl w-full">
      <EmptyState
        icon={Icons.offline}
        title={title}
        message={message}
        action={
          <div className="gap-sm flex flex-col items-center">
            <button
              type="button"
              onClick={retry}
              className="bg-rausch-cta text-on-primary text-title hover:bg-rausch-cta-pressed px-lg inline-flex min-h-12 items-center rounded-full font-medium"
            >
              Try again
            </button>
            {digest ? (
              <span className="text-caption-sm text-muted-soft tabular-nums">
                Reference {digest}
              </span>
            ) : null}
          </div>
        }
      />
    </div>
  );
}
