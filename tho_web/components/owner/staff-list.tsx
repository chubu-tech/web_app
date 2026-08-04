"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PaywallSheet } from "@/components/owner/paywall-sheet";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { createStaff } from "@/lib/api/owner-setup";
import { maxActiveStylists } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/client";
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
 * **Add creates and then opens the editor**, which is the app's flow and the right one: a
 * stylist with a name and nothing else can do nothing — no services, no hours, so not
 * bookable — and the editor is where that gets fixed.
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
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [paywall, setPaywall] = useState(false);

  const withHours = new Set(staffWithHours);
  const activeCount = staff.filter((s) => s.isActive).length;
  const cap = maxActiveStylists(business.plan);
  const atCap = cap != null && activeCount >= cap;

  function startAdd() {
    // The cap is checked before the form opens, so nothing is created and then rejected.
    if (atCap) {
      setPaywall(true);
      return;
    }
    setName("");
    setAdding(true);
  }

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const created = await createStaff(createClient(), business.id, trimmed);
      setAdding(false);
      router.push(`/business/staff/${created.id}`);
    } catch (caught) {
      toast.error(ownerErrorMessage("createStaff", caught));
    } finally {
      setBusy(false);
    }
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

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="Add staff member"
        footer={
          <Button fullWidth busy={busy} disabled={!name.trim()} onClick={() => void add()}>
            Add
          </Button>
        }
      >
        <Field
          label="Name"
          value={name}
          onChange={setName}
          placeholder="e.g. Sonam Dorji"
          autoFocus
          hint="You'll set their services and hours next."
        />
      </Sheet>

      <PaywallSheet
        open={paywall}
        onClose={() => setPaywall(false)}
        feature="unlimitedStylists"
      />
    </div>
  );
}
