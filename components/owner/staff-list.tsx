"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PaywallSheet } from "@/components/owner/paywall-sheet";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { maxActiveStylists } from "@/lib/entitlements";
import { isLinked, type Business, type StaffMember } from "@/lib/types/salon";

/**
 * The team, and adding to it.
 *
 * **Basic caps active stylists at one, and the cap is live on eight of the nine seeded
 * salons — all of which already have two.** So the seed itself is over the cap, because
 * **nothing enforces it server-side**: `maxActiveStylists` is a client-side gate in both
 * clients, and `staff_insert` has no count check. Two consequences worth being straight
 * about: the paywall here stops a *new* stylist rather than undoing an existing one, and the
 * copy names the cap instead of saying "upgrade".
 *
 * **Add is its own page now**, not the one-field sheet it was. A stylist with a name and
 * nothing else can do nothing, and *which services they perform* is the half of that which
 * belongs in the same gesture as creating them — see `staff-add-form.tsx`. The button still
 * checks the cap before navigating, so nothing is created and then refused.
 *
 * **The subtitle on each row is this list's own contribution**, and it is what lets the add
 * flow return here rather than pushing on into the editor: "no hours yet, so not bookable"
 * names the one thing still standing between a new chair and a booking. The app's team list
 * says nothing of the kind.
 */
export function StaffList({
  business,
  staff,
  staffWithHours,
}: {
  business: Business;
  staff: StaffMember[];
  staffWithHours: string[];
}) {
  const router = useRouter();
  const [paywall, setPaywall] = useState(false);

  const withHours = new Set(staffWithHours);
  const activeCount = staff.filter((s) => s.isActive).length;
  const cap = maxActiveStylists(business.plan);
  const atCap = cap != null && activeCount >= cap;

  /**
   * The cap is checked before the form opens, so nothing is created and then rejected.
   *
   * A button rather than a `ButtonLink`, precisely so this check can happen. `/business/staff/new`
   * makes it again for a direct visit — the two are not redundant: this one avoids a pointless
   * navigation, that one covers a bookmark.
   */
  function startAdd() {
    if (atCap) {
      setPaywall(true);
      return;
    }
    router.push("/business/staff/new");
  }

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[1128px] tablet:px-lg">
      <SectionHeader title="Staff" as="h1" />
      <p className="text-body-sm text-muted mb-base">
        The people who perform services. Each one needs services and working hours before they
        can be booked.
      </p>

      <div className="mb-lg">
        <Button onClick={startAdd}>
          <Icons.personAdd style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
          Add staff
        </Button>
        {atCap ? (
          <p className="text-caption-sm text-muted mt-xs">
            Basic covers one active stylist. You have {activeCount}.
          </p>
        ) : null}
      </div>

      {staff.length === 0 ? (
        <EmptyState
          icon={Icons.people}
          title="No staff yet"
          message="Add the people who perform services so customers can book with them."
        />
      ) : (
        <ul className="gap-md grid tablet:grid-cols-2">
          {staff.map((s) => (
            <li key={s.id}>
              <Link
                href={`/business/staff/${s.id}`}
                className="border-hairline-soft p-md gap-base hover:bg-surface-soft flex items-center rounded-md border"
              >
                <Avatar name={s.displayName} photoUrl={s.photoUrl} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="gap-sm flex items-center">
                    <span className="text-title text-ink truncate font-medium">
                      {s.displayName}
                    </span>
                    {!s.isActive ? <StatusPill status="inactive" /> : null}
                  </span>
                  <span className="text-caption-sm text-muted block">
                    {[
                      isLinked(s) ? "Login linked" : "No login",
                      withHours.has(s.id) ? null : "no hours yet, so not bookable",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <Icons.chevronRight
                  className="text-muted-soft shrink-0"
                  style={{ width: IconSize.sm, height: IconSize.sm }}
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <PaywallSheet
        open={paywall}
        onClose={() => setPaywall(false)}
        feature="unlimitedStylists"
      />
    </div>
  );
}
