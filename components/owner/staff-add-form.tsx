"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionCard } from "@/components/ui/section-card";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { createStaff, setStaffServices } from "@/lib/api/owner-setup";
import { createClient } from "@/lib/supabase/client";
import type { ServiceItem } from "@/lib/types/salon";
import { formatDuration, formatNu } from "@/lib/utils";

/**
 * Adding a stylist — a port of `tho/app/lib/business/staff_add_screen.dart`.
 *
 * **Why this exists at all.** Adding someone was a one-field sheet: type a name, get a row,
 * land in the full editor and work out what else was needed. The one thing that decides
 * whether a new stylist can be *booked* — which services they perform — was four sections down
 * that editor, so a chair added in a hurry was a chair customers could not book. The services
 * picker is therefore on the screen where the person is created, and everything that can wait
 * — photo, hours, pay, portfolio, a login account — stays in the editor.
 *
 * **The two writes are reported separately, which upstream's version does not do.** The row has
 * to exist before services can be mapped to it, so this is unavoidably two calls. Upstream wraps
 * both in one `try` and says *"Couldn't add this person"* for either — so a failed service
 * mapping denies a stylist who was in fact created, and the owner's natural next move, tapping
 * Add again, makes a second one. Here a failed create says so and stays put; a failed mapping
 * says the person was added, and goes to their profile, which is where the ticks can be
 * finished. Reported upstream.
 *
 * **A failed services *read* must not block adding the person.** Services can be ticked later;
 * refusing to create a stylist because a second query failed is the worse trade. So the section
 * has four states and only one of them stops anything — see `services === null` below.
 */
export function StaffAddForm({
  businessId,
  services,
}: {
  businessId: string;
  /**
   * The salon's menu, or **null when the read failed** — not `[]`, which means the salon has
   * no services yet. The two need different words and only one of them is the owner's to fix,
   * which is the repo's standing rule about never catching a read into the shape of "no rows".
   */
  services: ServiceItem[] | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [retrying, startRetry] = useTransition();

  const menu = services ?? [];
  const allPicked = menu.length > 0 && selected.length === menu.length;

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Enter their name.");
      return;
    }
    setSaving(true);
    const supabase = createClient();

    let created;
    try {
      created = await createStaff(supabase, businessId, trimmed);
    } catch (caught) {
      // Nothing was written. Stay, so the name that was typed is still there.
      toast.error(ownerErrorMessage("createStaff", caught));
      setSaving(false);
      return;
    }

    // `saving` deliberately stays true from here on: the person exists, and a second tap must
    // not be able to make a second one while the route transition is in flight.
    if (selected.length > 0) {
      try {
        await setStaffServices(supabase, created.id, selected);
      } catch {
        toast.error(
          `${created.displayName} was added, but their services didn't save. Tick them here.`,
        );
        router.push(`/business/staff/${created.id}`);
        router.refresh();
        return;
      }
    }

    /**
     * Back to the team, not on into the editor — upstream's call, and the web can afford it for
     * a reason the app cannot: this list says **"no hours yet, so not bookable"** against every
     * stylist who has none, so returning there shows the owner what is still outstanding instead
     * of dropping them into a long form to find out.
     */
    toast.success(`${created.displayName} added.`);
    router.push("/business/staff");
    router.refresh();
  }

  return (
    /* A real form, so Enter in the name field adds the person — which is what the app's
       `textInputAction: done` does, and what a browser gives away for nothing. */
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
      className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg"
    >
      <Link
        href="/business/staff"
        className="text-caption text-rausch-cta gap-xs mb-sm inline-flex items-center font-medium"
      >
        <Icons.back style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
        Staff
      </Link>

      <div className="gap-base flex flex-col">
        <SectionCard title="Who are they?">
          <Field
            label="Name"
            value={name}
            onChange={(v) => {
              setName(v);
              if (nameError) setNameError(null);
            }}
            error={nameError}
            placeholder="e.g. Sonam Dorji"
            autoFocus
            autoCapitalize="words"
          />
        </SectionCard>

        {services === null ? (
          <SectionCard title="Services they perform">
            <div className="gap-sm flex items-start">
              <Icons.offline
                className="text-muted mt-0.5 shrink-0"
                style={{ width: IconSize.xs, height: IconSize.xs }}
                aria-hidden
              />
              <p className="text-body-sm text-muted min-w-0 flex-1">
                Couldn&apos;t load your services — you can set these later.
              </p>
              {/* A re-render of the page, which is where the read lives. Nothing about the
                  name typed above is lost: the router keeps this component mounted, and the
                  transition is what makes the wait visible. */}
              <Button
                variant="quiet"
                busy={retrying}
                onClick={() => startRetry(() => router.refresh())}
                className="px-sm"
              >
                Retry
              </Button>
            </div>
          </SectionCard>
        ) : menu.length === 0 ? (
          <SectionCard title="Services they perform">
            <p className="text-body-sm text-muted">
              <Link href="/business/services" className="text-rausch-cta font-medium">
                Add services
              </Link>{" "}
              first, then come back and tick the ones they do.
            </p>
          </SectionCard>
        ) : (
          <SectionCard
            title="Services they perform"
            subtitle="Customers can only book them for what is ticked here."
            trailing={
              <Button
                variant="quiet"
                className="px-sm"
                onClick={() => setSelected(allPicked ? [] : menu.map((s) => s.id))}
              >
                {allPicked ? "Clear" : "All"}
              </Button>
            }
          >
            <ul className="divide-hairline-soft divide-y">
              {menu.map((s) => (
                <li key={s.id}>
                  <label className="gap-base py-md flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={selected.includes(s.id)}
                      onChange={(e) =>
                        setSelected((current) =>
                          e.target.checked
                            ? [...current, s.id]
                            : current.filter((id) => id !== s.id),
                        )
                      }
                      className="accent-rausch-cta size-5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-title text-ink block truncate font-medium">
                        {s.name}
                        {!s.isActive ? " (switched off)" : ""}
                      </span>
                      <span className="text-body-sm text-muted block">
                        {formatDuration(s.durationMinutes)} · {formatNu(s.price)}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>

      <div className="mt-lg">
        <Button type="submit" fullWidth busy={saving}>
          Add staff
        </Button>
        <p className="text-caption-sm text-muted mt-sm text-center">
          Photo, working hours and pay are set on their profile once they are added. They
          can&apos;t be booked until their working hours are there.
        </p>
      </div>
    </form>
  );
}
