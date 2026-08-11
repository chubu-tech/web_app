import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";

/**
 * The owner console's 404, for the six `/business` routes that call `notFound()` on a row
 * that isn't theirs or no longer exists.
 *
 * Unlike the customer side, this boundary resolves the way you would expect: `business` is a
 * real URL segment, not a route group, so it is found and it renders **inside**
 * `app/business/layout.tsx` — which means `OwnerHeader` and the salon switcher's row are both
 * still there. So this file is content only; adding a header would double it. That is also
 * what makes the message below honest: the salon it tells the owner to check really is above
 * this page, which it would not be under the root boundary.
 *
 * Without it, an owner hitting a stale link would fall through to the root boundary and get
 * the *customer* shell — cream canvas, a "Find a salon" button — which is a disorienting
 * place to land while working at a till, and offers nothing that helps.
 */
export default function OwnerNotFound() {
  return (
    <div className="px-base py-xxl tablet:px-lg mx-auto w-full max-w-[560px]">
      <EmptyState
        icon={Icons.searchEmpty}
        title="Not found"
        message="This may have been deleted, or it belongs to another salon. Check the salon you're switched to at the top of the page."
        action={
          <Link href="/business">
            <Button>Back to today</Button>
          </Link>
        }
      />
    </div>
  );
}
