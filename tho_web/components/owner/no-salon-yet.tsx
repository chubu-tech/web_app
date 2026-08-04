import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";

/**
 * What the console shows an owner who owns no salon.
 *
 * Reachable, and not a defensive nicety: an operator can create the owner account in the
 * admin console before the shop exists, and `profiles.role = 'owner'` with zero rows in
 * `businesses` is exactly that state. The app answers it with a create-salon form
 * (`business_home.dart`'s `_CreateBusiness`); **that form is 3b**, because it writes six
 * columns of `businesses` and belongs with the rest of the settings surface.
 *
 * So this says what is true and nothing more. It does not offer a form that isn't built,
 * and it does not pretend the console is broken.
 */
export function NoSalonYet() {
  return (
    <div className="px-base py-lg mx-auto w-full max-w-[1128px] tablet:px-lg">
      <EmptyState
        icon={Icons.salon}
        title="No salon on this account yet"
        message="Once your salon is set up you'll run your day from here — the appointment book, the walk-in line and your team. Ask whoever onboarded you to add it."
      />
    </div>
  );
}
