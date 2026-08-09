import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";

/**
 * What a staff account sees before an owner has linked it — a port of `_NotLinked`
 * (`staff/staff_home.dart:80`).
 *
 * **This is the normal first state, not an error.** `link_staff_member` is the owner's
 * action: they type the stylist's email into the staff editor, which resolves it to a real
 * `auth.users` row and sets `profiles.role = 'staff'`. So the role arrives *before* the link
 * in every flow that produces a staff account, and the gap between the two is exactly this
 * screen.
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
        message="Your manager needs to add your account to a staff profile. Once they do, your bookings and schedule show up here."
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
