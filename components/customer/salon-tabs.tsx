"use client";

import { useEffect, useId, useState } from "react";
import { DetailTabBar } from "@/components/ui/detail-bits";

/**
 * The salon page's tab strip and panel.
 *
 * **Keyed by label, never by index.** Shop only exists when the salon has in-stock
 * products, so a positional index selects the wrong body whenever it is absent —
 * spelled out at `business_detail_screen.dart:529-536`, which is also where the
 * deep-link rule comes from: match `'Shop'`, never a hardcoded number.
 *
 * The active tab is mirrored into `?tab=` with `replaceState` rather than a router
 * push. That makes the tab linkable — paste the URL and land on Reviews — without
 * re-running the server component and re-fetching the whole salon on every tab
 * click. A push would be correct and wasteful; this is correct and cheap.
 */
export function SalonTabs({
  tabs,
  initial,
}: {
  tabs: { label: string; content: React.ReactNode }[];
  /** From `?tab=`. Ignored when it names a tab this salon doesn't have. */
  initial?: string;
}) {
  const labels = tabs.map((t) => t.label);
  const first = labels[0] ?? "";
  const [active, setActive] = useState(
    initial && labels.includes(initial) ? initial : first,
  );
  const panelId = useId();

  useEffect(() => {
    const url = new URL(window.location.href);
    if (active === first) url.searchParams.delete("tab");
    else url.searchParams.set("tab", active);
    window.history.replaceState(null, "", url);
  }, [active, first]);

  const current = tabs.find((t) => t.label === active) ?? tabs[0];
  if (!current) return null;

  return (
    <div>
      <DetailTabBar
        labels={labels}
        active={current.label}
        onChange={setActive}
        panelId={panelId}
      />
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`tab-${current.label}`}
        tabIndex={0}
        className="pt-base"
      >
        {current.content}
      </div>
    </div>
  );
}
