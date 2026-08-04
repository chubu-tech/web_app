"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/ui/chip";
import { CoverImage } from "@/components/ui/cover-image";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { enableCatalogService, setServiceActive } from "@/lib/api/owner-setup";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_GENDERS, type CatalogService } from "@/lib/types/salon";
import { formatDuration, formatNu } from "@/lib/utils";

/**
 * Browse the catalogue, one gender at a time.
 *
 * **The gender chips are the only filter, and there is no fourth chip.** Both
 * `service_catalog.gender` and `hairstyles.gender` are `check (gender in
 * ('male','female','unisex'))`, and no children's services are seeded — the Dart records
 * (THO-42) that a "Child" chip would only ever open onto an empty list.
 *
 * **Switching off needs the salon's own service id**, which this screen does not hold: the
 * page passes `catalogId → isActive`, not the row. So off is a two-step — look the row up by
 * `catalog_id`, then deactivate it — done inside the click rather than by widening the page's
 * props, because the alternative is shipping the salon's whole service list to the browser to
 * support one button.
 */
export function CatalogueList({
  businessId,
  catalogue,
  enabled,
}: {
  businessId: string;
  catalogue: CatalogService[];
  enabled: Record<string, boolean>;
}) {
  const router = useRouter();
  const [gender, setGender] = useState("female");
  const [busyId, setBusyId] = useState<string | null>(null);

  const shown = catalogue.filter((c) => c.gender === gender);

  async function toggle(entry: CatalogService, on: boolean) {
    setBusyId(entry.id);
    try {
      const supabase = createClient();
      if (on) {
        await enableCatalogService(supabase, businessId, entry);
        toast.success(`${entry.name} added to your menu.`);
      } else {
        const { data, error } = await supabase
          .from("services")
          .select("id")
          .eq("business_id", businessId)
          .eq("catalog_id", entry.id)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          await setServiceActive(supabase, (data as { id: string }).id, false);
          toast.success(`${entry.name} switched off.`);
        }
      }
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("enableCatalogService", caught));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[1128px] tablet:px-lg">
      <Link
        href="/business/services"
        className="text-caption text-rausch-cta gap-xs mb-sm inline-flex items-center font-medium"
      >
        <Icons.back style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
        Services
      </Link>
      <SectionHeader title="Common services" as="h1" />
      <p className="text-body-sm text-muted mb-base">
        Switch one on and it joins your menu with these defaults. Change the price or duration
        afterwards on the Services page — your edits stay.
      </p>

      <div className="gap-sm mb-lg flex flex-wrap" role="group" aria-label="Who the services are for">
        {SERVICE_GENDERS.map((g) => (
          <Chip
            key={g.value}
            label={g.label}
            selected={gender === g.value}
            onClick={() => setGender(g.value)}
          />
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-body-sm text-muted py-xl text-center">Nothing in this group yet.</p>
      ) : (
        <ul className="gap-md grid tablet:grid-cols-2">
          {shown.map((c) => {
            const on = enabled[c.id] === true;
            return (
              <li
                key={c.id}
                className="border-hairline-soft p-sm gap-md flex items-center rounded-md border"
              >
                <span className="size-14 shrink-0 overflow-hidden rounded-sm">
                  <CoverImage label={c.name} imageUrl={c.defaultImageUrl} sizes="56px" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-title text-ink block truncate font-medium">{c.name}</span>
                  <span className="text-body-sm text-muted block">
                    {c.category} · {formatDuration(c.defaultDurationMinutes)} ·{" "}
                    {formatNu(c.defaultPrice)}
                  </span>
                </span>
                <label className="shrink-0 cursor-pointer">
                  <span className="sr-only">
                    {on ? `Remove ${c.name} from your menu` : `Add ${c.name} to your menu`}
                  </span>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={busyId === c.id}
                    onChange={(e) => void toggle(c, e.target.checked)}
                    className="accent-rausch-cta size-5"
                  />
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
