import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";

/**
 * What the console shows an owner who owns no salon.
 *
 * Reachable, and not a defensive nicety: an operator can create the owner account in the
 * admin console before the shop exists, and `profiles.role = 'owner'` with zero rows in
 * `businesses` is exactly that state. The app answers it with a create-salon form
 * (`business_home.dart`'s `_CreateBusiness`), and since 3b so does this — `/business/new`.
 *
 * The copy says what happens next, including the part an owner would otherwise discover by
 * waiting: a salon they create starts `pending`, so it stays invisible to customers until an
 * operator reviews it. `businesses`' INSERT grant deliberately cannot name `status`.
 */
export function NoSalonYet() {
  return (
    <div className="px-base py-lg mx-auto w-full max-w-[1128px] tablet:px-lg">
      <EmptyState
        icon={Icons.salon}
        title="No salon on this account yet"
        message="Add your salon and you'll run your day from here — the appointment book, the walk-in line and your team. It stays private until we've reviewed it."
        action={
          <Link
            href="/business/new"
            className="bg-rausch-cta text-on-primary text-title hover:bg-rausch-cta-pressed inline-flex min-h-12 items-center rounded-sm px-4 font-medium"
          >
            Add your salon
          </Link>
        }
      />
    </div>
  );
}
