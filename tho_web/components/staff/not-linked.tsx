import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";

/**
 * What a staff account sees before an owner has linked it — a port of `_NotLinked`
 * (`staff/staff_home.dart:80`).
 *
 * **This is the normal first state, not an error**, and it is now reachable for a second
 * reason worth knowing.
 *
 * It used to describe `link_staff_member`, where the owner typed an email and the role
 * arrived *before* the link — this screen was the gap between the two. That RPC is gone
 * (see `lib/api/staff-invites.ts`): the owner invites and the person accepts, so the role
 * and the link now land together in `accept_staff_invite`.
 *
 * So this state means one of two things: an invitation is waiting and has not been
 * accepted yet — in which case it is on Discover, not here — or the account was made
 * staff some other way and no chair has been attached to it. The copy covers both without
 * claiming which, because from inside `/staff` they are indistinguishable.
 *
 * The app offers a "Check again" button against a `setState` reload. Here the equivalent is
 * a plain link to the same route: this is a server component, so re-requesting `/staff` is
 * the refetch, and it needs no client boundary to do it. Same outcome, one fewer bundle.
 */
export function NotLinked() {
  return (
    <div className="px-base py-xxl tablet:px-lg mx-auto w-full max-w-[560px]">
      <EmptyState
        icon={Icons.people}
        title="Not linked yet"
        message="Your salon needs to invite you to a chair. If they already have, the invitation is waiting on your home page — accept it there and your bookings and schedule show up here."
        action={
          <a
            href="/staff"
            className="border-hairline text-title text-ink hover:bg-surface-soft inline-flex min-h-12 items-center rounded-sm border px-4 font-medium"
          >
            Check again
          </a>
        }
      />
    </div>
  );
}
