import { SkeletonRows } from "@/components/ui/skeleton";

/**
 * The staff shell's streaming fallback.
 *
 * Rows, like the console's: a stylist's three routes are their own bookings, their schedule and
 * one booking's detail, and all three are lists.
 *
 * Its own file rather than something inherited, for the same reason `app/staff/error.tsx` is:
 * `staff` is a real segment with its own layout, so the fallback belongs beside it and renders
 * with the nav already up.
 */
export default function StaffLoading() {
  return (
    <div className="px-base py-lg mx-auto w-full max-w-[900px] tablet:px-lg">
      <SkeletonRows count={5} />
    </div>
  );
}
