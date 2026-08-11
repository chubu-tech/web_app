"use client";

import { ErrorState } from "@/components/ui/error-state";

/**
 * The console's error boundary.
 *
 * A sibling of `app/business/not-found.tsx` and, unlike the customer group's, it renders inside
 * `OwnerLayout` for the ordinary reason: `business` is a real path segment, so the layout above
 * it stays mounted. The owner keeps the header, the salon switcher and the five destinations —
 * which matters more here than on the customer side, because an owner who cannot load Insights
 * can still work the day from the Calendar tab.
 *
 * Worded for somebody at a till mid-shift rather than for a visitor: it says which part failed
 * and that the rest of the console is unaffected, because the useful next move is usually
 * another tab rather than a retry.
 */
export default function BusinessError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorState
      title="This didn't load"
      message="Trying again usually fixes it. Your other tabs are unaffected, and nothing you have saved is lost."
      retry={unstable_retry}
      digest={error.digest}
    />
  );
}
