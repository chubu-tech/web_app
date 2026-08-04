"use client";

import { useState } from "react";
import { CoverImage } from "@/components/ui/cover-image";
import { Icons, IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import type { Business } from "@/lib/types/salon";
import { cn } from "@/lib/utils";

/**
 * Which salon the console is showing, and how to change it — a port of
 * `business_home.dart`'s `_SalonTitle` and `_showSalonPicker`.
 *
 * **Plain text with one salon, a button with more.** The app makes the title tappable
 * only when `allBusinesses.length > 1`, and that restraint is worth keeping: a control
 * that opens a list of one is a control that lies about having a choice. The seeded owner
 * runs **nine**, so both states are live.
 *
 * Each row is a real form `POST` to `/business/active-salon`, not an `onClick`. That is
 * what lets the switch set an `httpOnly` cookie the server layout can read on the very
 * next render — the app can use `SharedPreferences` because its shell re-reads on the
 * client, whereas here the salon has to be known *before* the first row is drawn. It also
 * means switching works with no JavaScript at all.
 *
 * The subtitle is the app's drawer header line, `Owner · <Plan> plan`. It is the only
 * place the console states the plan, and it is why a locked tab elsewhere never has to
 * explain which tier the salon is on.
 */
export function SalonSwitcher({
  active,
  businesses,
}: {
  active: Business | null;
  businesses: Business[];
}) {
  const [open, setOpen] = useState(false);
  const canSwitch = businesses.length > 1;

  // An owner with no salon at all: an operator created the account before the shop. The
  // header still has to say something, and "no salon yet" is the honest thing.
  if (!active) {
    return (
      <div className="min-w-0">
        <p className="text-title text-ink truncate font-medium">No salon yet</p>
        <p className="text-caption-sm text-muted truncate">Owner</p>
      </div>
    );
  }

  const label = (
    <span className="min-w-0 text-left">
      <span className="text-title text-ink block truncate font-medium">{active.name}</span>
      <span className="text-caption-sm text-muted block truncate">
        Owner · {planLabel(active.plan)} plan
      </span>
    </span>
  );

  if (!canSwitch) return <div className="min-w-0 flex-1 tablet:flex-none">{label}</div>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          "gap-xs px-xs -mx-xs flex min-w-0 flex-1 items-center rounded-sm",
          "hover:bg-surface-soft tablet:flex-none tablet:max-w-[320px]",
        )}
      >
        {label}
        <Icons.chevronDown
          className="text-muted shrink-0"
          style={{ width: IconSize.sm, height: IconSize.sm }}
          aria-hidden
        />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Your salons">
        <ul className="divide-hairline-soft divide-y">
          {businesses.map((b) => {
            const current = b.id === active.id;
            return (
              <li key={b.id}>
                <form action="/business/active-salon" method="post">
                  <input type="hidden" name="businessId" value={b.id} />
                  <button
                    type="submit"
                    aria-current={current ? "true" : undefined}
                    className="gap-base py-md hover:bg-surface-soft flex w-full items-center text-left"
                  >
                    <span className="size-11 shrink-0 overflow-hidden rounded-sm">
                      <CoverImage label={b.name} imageUrl={b.coverUrl} sizes="44px" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-title text-ink block truncate font-medium">
                        {b.name}
                      </span>
                      <span className="text-caption-sm text-muted block truncate">
                        {b.addressText ?? planLabel(b.plan)}
                      </span>
                    </span>
                    {current ? (
                      <Icons.success
                        className="text-rausch shrink-0"
                        style={{ width: IconSize.sm, height: IconSize.sm }}
                        aria-label="Currently showing"
                      />
                    ) : null}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}

function planLabel(plan: Business["plan"]): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}
