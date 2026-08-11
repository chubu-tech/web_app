"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ServiceFormSheet } from "@/components/owner/service-form-sheet";
import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/ui/cover-image";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { setServiceActive } from "@/lib/api/owner-setup";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_GENDERS, type ServiceItem } from "@/lib/types/salon";
import { formatDuration, formatNu } from "@/lib/utils";

/**
 * The salon's menu, and the two ways to add to it.
 *
 * **The active switch writes immediately; everything else waits for Save.** Same split as
 * the app, and the same reason as the customer profile's avatar: a switch is already a
 * deliberate, complete act, whereas a half-typed price is not.
 *
 * **"Performed by nobody" is a warning this screen invented.** `compute_availability` and
 * `create_booking` both require a `service_staff` row, so a service with no stylist mapped is
 * on the menu and unbookable — the state two of Norzin's five services are in right now, and
 * the reason 3a's walk-in form could offer a service that yielded no times. The fix is on the
 * stylist, so the line points there.
 */
export function ServiceList({
  businessId,
  services,
  staffCountByService,
}: {
  businessId: string;
  services: ServiceItem[];
  staffCountByService: Record<string, number>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ServiceItem | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggle(service: ServiceItem) {
    setBusyId(service.id);
    try {
      await setServiceActive(createClient(), service.id, !service.isActive);
      toast.success(service.isActive ? `${service.name} switched off.` : `${service.name} is live.`);
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("toggleService", caught));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[1128px] tablet:px-lg">
      <SectionHeader title="Services" as="h1" />
      <p className="text-body-sm text-muted mb-base">
        What you offer. Duration sets how long a booking takes and feeds the walk-in wait
        estimate.
      </p>

      <div className="gap-sm mb-lg flex flex-wrap">
        <Button onClick={() => setEditing("new")}>
          <Icons.add style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
          Custom service
        </Button>
        <Link
          href="/business/services/catalogue"
          className="border-hairline text-title text-ink hover:bg-surface-soft gap-xs inline-flex min-h-12 items-center rounded-sm border px-4 font-medium"
        >
          <Icons.sparkle style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
          Browse common services
        </Link>
      </div>

      {services.length === 0 ? (
        <EmptyState
          icon={Icons.haircut}
          title="No services yet"
          message="Switch on a common service, or add your own."
        />
      ) : (
        <ul className="gap-md grid tablet:grid-cols-2">
          {services.map((s) => {
            const mapped = staffCountByService[s.id] ?? 0;
            return (
              <li
                key={s.id}
                className="border-hairline-soft p-sm gap-md flex items-center rounded-md border"
              >
                <span className="size-13 shrink-0 overflow-hidden rounded-sm">
                  <CoverImage label={s.name} imageUrl={s.imageUrl} sizes="52px" className="size-full" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="gap-sm flex items-center">
                    <span className="text-title text-ink truncate font-medium">{s.name}</span>
                    {s.gender ? (
                      <span className="bg-surface-strong text-caption-sm text-muted shrink-0 rounded-full px-2 py-0.5">
                        {genderLabel(s.gender)}
                      </span>
                    ) : null}
                    {!s.isActive ? <StatusPill status="inactive" /> : null}
                  </span>
                  <span className="text-body-sm text-muted block">
                    {formatDuration(s.durationMinutes)} · {formatNu(s.price)}
                    {s.category ? ` · ${s.category}` : ""}
                  </span>
                  {s.isActive && mapped === 0 ? (
                    <span className="text-caption-sm text-rausch-cta block">
                      Nobody performs this yet — add it to a stylist so it can be booked.
                    </span>
                  ) : null}
                </span>

                <Button
                  variant="quiet"
                  onClick={() => setEditing(s)}
                  aria-label={`Edit ${s.name}`}
                  className="px-sm shrink-0"
                >
                  <Icons.edit style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
                </Button>
                {/* A real checkbox rather than a styled div: the switch is the one control on
                    this row that changes the database, and it has to be reachable by keyboard
                    and announced as a state. */}
                <label className="gap-xs flex shrink-0 cursor-pointer items-center">
                  <span className="sr-only">{s.isActive ? "Switch off" : "Switch on"} {s.name}</span>
                  <input
                    type="checkbox"
                    checked={s.isActive}
                    disabled={busyId === s.id}
                    onChange={() => void toggle(s)}
                    className="accent-rausch-cta size-5"
                  />
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {/* Mounted only while open, and keyed by what is being edited, so the sheet's fields
          initialise from the row instead of being synchronised into it by an effect. */}
      {editing !== null ? (
        <ServiceFormSheet
          key={editing === "new" ? "new" : editing.id}
          businessId={businessId}
          service={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function genderLabel(gender: string): string {
  return SERVICE_GENDERS.find((g) => g.value === gender)?.label ?? gender;
}
