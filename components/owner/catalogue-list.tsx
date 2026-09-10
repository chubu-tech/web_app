"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/ui/chip";
import { CoverImage } from "@/components/ui/cover-image";
import { Field } from "@/components/ui/field";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { enableCatalogService, setServiceActive } from "@/lib/api/owner-setup";
import { createClient } from "@/lib/supabase/client";
import { SERVICE_GENDERS, type CatalogService } from "@/lib/types/salon";
import { formatDuration, formatNu } from "@/lib/utils";

/**
 * Browse the catalogue — a port of `service_catalog_screen.dart`.
 *
 * **The catalogue is 51 entries now, not 20** (`20260818000001`, 33 of them under Women), and
 * that changed what this screen has to be. A flat grid of 20 is a thing you scan; a flat grid
 * of 33 is a thing you scroll past. So it is a list you shop in: **search**, and **grouped by
 * category with a count of what is already on the menu**, so an owner can see at a glance that
 * they have four of the seven colour services and none of the treatments.
 *
 * **The gender chips are the only facet, and there is no fourth chip.** Both
 * `service_catalog.gender` and `hairstyles.gender` are `check (gender in
 * ('male','female','unisex'))`, and no children's services are seeded — the Dart records
 * (THO-42) that a "Child" chip would only ever open onto an empty list. While a search is
 * running each chip carries its own match count, which is what stops "no results" in Women
 * from hiding the three matches sitting under Men.
 *
 * **The whole row is the control.** A `<label>` wraps the plate, the text and the checkbox, so
 * tapping anywhere toggles and there is still exactly one focusable, announceable control —
 * which is what lets the row say **"Tap to add"** and mean it.
 *
 * **Switching off needs the salon's own service id**, which this screen does not hold: the
 * page passes `catalogId → isActive`, not the row. So off is a two-step — look the row up by
 * `catalog_id`, then deactivate it — done inside the click rather than by widening the page's
 * props, because the alternative is shipping the salon's whole service list to the browser to
 * support one button.
 *
 * No virtualisation, deliberately. Upstream builds these rows lazily because a Flutter
 * `Column` of 51 subtrees is built whether or not it is on screen; a browser has never had
 * that problem, and 51 `<li>`s is not a list worth windowing.
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
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  /**
   * The switch's own answer, ahead of the server's.
   *
   * The state on screen comes from a server prop, so without this a switch sat unchanged
   * until `router.refresh()` came back — on the one screen where an owner flips several in
   * a row. Entries are cleared on **failure** only: on success the refresh will agree, and
   * clearing early flickers back to the stale prop before the new one lands.
   */
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const isOn = (id: string) => pending[id] ?? enabled[id] === true;

  const needle = query.trim().toLowerCase();
  const matches = (c: CatalogService) =>
    needle === "" ||
    c.name.toLowerCase().includes(needle) ||
    c.category.toLowerCase().includes(needle);

  /** Per-chip match counts, so an empty group never looks like an empty catalogue. */
  const countByGender = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of catalogue) if (matches(c)) out[c.gender] = (out[c.gender] ?? 0) + 1;
    return out;
    // `matches` closes over `needle`, which is the only thing that moves it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue, needle]);

  /**
   * Category → its entries, in the catalogue's own order.
   *
   * A `Map` rather than an object so the first-seen order is the render order: the seed
   * lists a gender's services in the order a salon would think of them, and sorting the
   * groups alphabetically would put "Treatments" above "Cut".
   */
  const groups = useMemo(() => {
    const out = new Map<string, CatalogService[]>();
    for (const c of catalogue) {
      if (c.gender !== gender || !matches(c)) continue;
      const list = out.get(c.category);
      if (list) list.push(c);
      else out.set(c.category, [c]);
    }
    return [...out];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogue, gender, needle]);

  const shownCount = groups.reduce((n, [, list]) => n + list.length, 0);

  async function toggle(entry: CatalogService, on: boolean) {
    setBusyId(entry.id);
    setPending((p) => ({ ...p, [entry.id]: on }));
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
      setPending((p) => {
        const next = { ...p };
        delete next[entry.id];
        return next;
      });
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

      <div className="mb-base">
        <Field
          label="Search"
          value={query}
          onChange={setQuery}
          type="search"
          placeholder="e.g. colour, beard, facial"
        />
      </div>

      <div
        className="gap-sm mb-lg flex flex-wrap"
        role="group"
        aria-label="Who the services are for"
      >
        {SERVICE_GENDERS.map((g) => (
          <Chip
            key={g.value}
            label={
              needle === "" ? g.label : `${g.label} (${countByGender[g.value] ?? 0})`
            }
            selected={gender === g.value}
            onClick={() => setGender(g.value)}
          />
        ))}
      </div>

      {shownCount === 0 ? (
        <p className="text-body-sm text-muted py-xl text-center">
          {needle === ""
            ? "Nothing in this group yet."
            : `Nothing here matches “${query.trim()}”.`}
        </p>
      ) : (
        <div className="gap-xl flex flex-col">
          {groups.map(([category, entries]) => {
            const added = entries.filter((c) => isOn(c.id)).length;
            return (
              <section key={category}>
                <div className="gap-sm mb-sm flex items-baseline">
                  <h2 className="text-title text-ink font-semibold">{category}</h2>
                  {/* What is already on the menu, per group — the number an owner is
                      actually looking for when they open this page. */}
                  <p className="text-caption text-muted">
                    {added} of {entries.length} on your menu
                  </p>
                </div>
                <ul className="gap-md grid tablet:grid-cols-2">
                  {entries.map((c) => {
                    const on = isOn(c.id);
                    return (
                      <li key={c.id}>
                        <label className="border-hairline-soft p-sm gap-md flex cursor-pointer items-center rounded-md border">
                          <span className="size-14 shrink-0 overflow-hidden rounded-sm">
                            <CoverImage
                              label={c.name}
                              imageUrl={c.defaultImageUrl}
                              sizes="56px"
                              className="size-full"
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="text-title text-ink block truncate font-medium">
                              {c.name}
                            </span>
                            <span className="text-body-sm text-muted block">
                              {formatDuration(c.defaultDurationMinutes)} ·{" "}
                              {formatNu(c.defaultPrice)}
                            </span>
                            {/* The state in words, because a lone checkbox does not say
                                what switching it on will do to the price shown above it. */}
                            <span className="text-caption-sm text-muted-soft block truncate">
                              {on ? "On your menu — edit the price in Services" : "Tap to add"}
                            </span>
                          </span>
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={busyId === c.id}
                            onChange={(e) => void toggle(c, e.target.checked)}
                            aria-label={
                              on ? `Remove ${c.name} from your menu` : `Add ${c.name} to your menu`
                            }
                            className="accent-rausch-cta size-5 shrink-0"
                          />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
