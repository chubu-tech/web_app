"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import type { Coords } from "@/lib/discover-logic";
import { MAX_PLAUSIBLE_KM, THIMPHU_CENTER, resolveLocation } from "@/lib/geo";

/**
 * Where the salon is on the map — `lat`/`lng`, and the only place either is set.
 *
 * **Why a map rather than the app's one button.** `business_settings_tab.dart` offers "Use my
 * location" and nothing else, which is sound on a phone standing in the shop and useless on a
 * laptop in another town — and a browser is often the second. Dragging a pin is new design
 * work rather than a port, which `AGENTS.md` already expects for desktop.
 *
 * **What being unpinned costs**, stated rather than implied: `/map` only plots located salons,
 * and every distance line on Discover and the salon page needs coordinates. A salon with none
 * is invisible on the map and sorts last on anything distance-aware.
 *
 * **The 150 km plausibility guard is the same one `lib/geo.ts` applies to a customer's fix.**
 * A desktop browser geolocating from an IP address can land in another country, and silently
 * pinning a Thimphu salon to Singapore is worse than refusing. `plausibleFix` would quietly
 * substitute the Thimphu centre; here the owner is told instead, because a pin they did not
 * choose is a wrong address rather than a slightly-off ranking.
 */
const PinMap = dynamic(() => import("./pin-map").then((m) => m.PinMap), {
  ssr: false,
  loading: () => <div className="bg-surface-soft h-full w-full" aria-hidden />,
});

export function PinPicker({
  name,
  coverUrl,
  lat,
  lng,
  onChange,
}: {
  name: string;
  coverUrl: string | null;
  lat: number | null;
  lng: number | null;
  onChange: (next: { lat: number | null; lng: number | null }) => void;
}) {
  const [locating, setLocating] = useState(false);
  // Bumped whenever the coordinates change from outside the map, so `PanTo` follows exactly
  // those moves and not a drag.
  const [panKey, setPanKey] = useState(0);

  const pinned = lat != null && lng != null;
  const coords: Coords = pinned ? { lat, lng } : THIMPHU_CENTER;

  // Named `locateMe` rather than `useMyLocation`: a `use`-prefixed function inside a component
  // reads as a hook to the linter, and to anyone else.
  async function locateMe() {
    setLocating(true);
    try {
      const fix = await resolveLocation();
      if (fix.source === "fallback") {
        // `resolveLocation` never rejects: a denied prompt, no sensor, a timeout and a fix
        // more than 150 km from Thimphu all come back as the Thimphu centre. For a salon's
        // address that is not good enough to store silently.
        toast.error(
          `Couldn't get a location within ${MAX_PLAUSIBLE_KM} km of Thimphu. Drag the pin instead.`,
        );
        return;
      }
      onChange(fix.coords);
      setPanKey((k) => k + 1);
      toast.success("Pin moved to where you are.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <div>
      <div className="border-hairline-soft h-64 overflow-hidden rounded-md border">
        <PinMap
          name={name || "Your salon"}
          coverUrl={coverUrl}
          coords={coords}
          panKey={panKey}
          onMove={(next) => onChange(next)}
        />
      </div>

      <div className="gap-sm mt-sm flex flex-wrap items-center">
        <p className="text-body-sm text-muted min-w-0 flex-1">
          {pinned ? (
            <>
              <span className="text-ink font-medium">Pinned</span> at {lat.toFixed(5)},{" "}
              {lng.toFixed(5)} — drag it or tap the map to move it.
            </>
          ) : (
            <>
              <span className="text-ink font-medium">Not on the map yet.</span> Tap the map or
              drag the pin to place your salon — otherwise customers can&apos;t find you there
              or see how far away you are.
            </>
          )}
        </p>
        <Button variant="quiet" busy={locating} onClick={() => void locateMe()}>
          <Icons.nearMe style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
          Use my location
        </Button>
        {pinned ? (
          <Button variant="quiet" onClick={() => onChange({ lat: null, lng: null })}>
            Remove pin
          </Button>
        ) : null}
      </div>
    </div>
  );
}
