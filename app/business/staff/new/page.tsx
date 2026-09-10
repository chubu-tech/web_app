import type { Metadata } from "next";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { StaffAddForm } from "@/components/owner/staff-add-form";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { fetchServices, fetchStaff } from "@/lib/api/salon";
import { maxActiveStylists } from "@/lib/entitlements";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Add staff" };

/**
 * Adding a stylist — a port of `staff_add_screen.dart`.
 *
 * **Its own route, not the sheet it replaced.** The sheet held one Name box, which is what the
 * app's old `AlertDialog` held and what §3.7 exists to undo: the services picker belongs on the
 * screen where the person is created. A page is also what the rest of this console is, so Add
 * gets a back button, a reloadable URL and room for a menu of any length.
 *
 * **The services read is caught into `null`, not into `[]`.** A salon with no services and a
 * salon whose services would not load need different sentences, and only one of them is
 * something the owner can act on. Neither blocks the create.
 *
 * **The cap is checked here as well as on the button that leads here.** `/business/staff/new` is
 * a URL: it can be bookmarked, reloaded, or reached with the back button after the last chair
 * was activated in another tab. `enforce_basic_stylist_cap` fires on *an insert that lands
 * active*, so on a Basic salon at its limit the create would raise `P0001` — better to say so
 * before the form than after the name.
 */
export default async function OwnerStaffNewPage() {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const supabase = await createClient();
  const [roster, services] = await Promise.all([
    fetchStaff(supabase, active.id, { activeOnly: false }),
    // Switched-off services included, so this list and the editor's agree about what the
    // salon's menu is. A tick against one is still a real mapping; it starts mattering the day
    // the service is switched back on.
    fetchServices(supabase, active.id, { activeOnly: false }).catch(() => null),
  ]);

  const activeCount = roster.filter((s) => s.isActive).length;
  const cap = maxActiveStylists(active.plan);

  if (cap != null && activeCount >= cap) {
    return (
      <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
        <EmptyState
          icon={Icons.locked}
          title="You're at your plan's stylist limit"
          message={`${active.plan === "basic" ? "The Basic plan" : "Your plan"} covers ${
            cap === 1 ? "one active stylist" : `${cap} active stylists`
          }, and you have ${activeCount}. Stand one down on the Staff page, or move up a plan.`}
          action={
            <div className="gap-sm flex flex-wrap justify-center">
              <ButtonLink href="/business/plans">See plans</ButtonLink>
              <ButtonLink href="/business/staff" variant="outlined">
                Back to staff
              </ButtonLink>
            </div>
          }
        />
      </div>
    );
  }

  return <StaffAddForm businessId={active.id} services={services} />;
}
