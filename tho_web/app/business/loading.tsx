import { SkeletonRows } from "@/components/ui/skeleton";

/**
 * The console's streaming fallback.
 *
 * Rows rather than cards, because that is what the console is: the calendar's agenda, the client
 * book, the order inbox, the roster and the settings hub are all lists of rows, and Insights is
 * the only card-shaped page of the twenty-six.
 *
 * It renders **inside** `OwnerLayout` — `business` is a real path segment, so the header, the
 * salon switcher and the five destinations are already on screen and interactive while this is
 * up. That is what makes a fallback worth having here rather than merely polite: an owner can
 * start moving to another tab before this one has finished loading.
 */
export default function BusinessLoading() {
  return (
    <div className="px-base py-lg mx-auto w-full max-w-[1128px] tablet:px-lg">
      <SkeletonRows count={6} />
    </div>
  );
}
