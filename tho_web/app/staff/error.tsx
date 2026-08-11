"use client";

import { ErrorState } from "@/components/ui/error-state";

/**
 * The staff shell's error boundary.
 *
 * Its own file rather than something inherited, for the same reason `lib/staff/context.ts` is a
 * deliberate sibling of `lib/owner/context.ts` rather than a parameterisation: `staff` is a real
 * path segment with its own layout, so without this a failed read in `/staff` or
 * `/staff/bookings/[id]` would fall all the way to `global-error.tsx` and take the nav with it.
 *
 * A stylist's three routes are their whole view of the product, so the copy points at the other
 * two rather than only offering a retry.
 */
export default function StaffError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <ErrorState
      title="This didn't load"
      message="Trying again usually fixes it. Your day and your schedule are separate pages, so one of them failing does not affect the other."
      retry={unstable_retry}
      digest={error.digest}
    />
  );
}
