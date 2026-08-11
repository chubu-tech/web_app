"use client";

import { useState } from "react";
import { Icons, IconSize } from "@/components/ui/icons";
import { ReportSheet } from "@/components/ui/report-sheet";
import type { ReportRef } from "@/lib/api/moderation";
import { cn } from "@/lib/utils";

/**
 * The one control that opens a report, so a **server** component can offer one.
 *
 * `ReportSheet` needs state, which means a client component, which means a review tile
 * rendered on the server cannot hold it. This is the client leaf that can: it owns the
 * open/closed state for exactly one target and nothing else, so a page keeps its server
 * rendering and gains a report button per review, per photo, per message.
 *
 * ## Findable, not loud
 *
 * `business_detail_screen.dart:747-758` states the rule this follows: reviews are the most
 * public content in the product, so this is the affordance a moderation review looks for
 * first — and it must be findable *without competing with the review it sits on*. So it is
 * an icon, muted, with the label only in `aria-label` and the tooltip.
 *
 * **It is always in the DOM and always visible**, which is where this diverges from the
 * app: the Dart hides the per-message control behind a long press. A long press has no
 * honest web equivalent — hover reveals are invisible on a touchscreen, which is most of
 * chat — so the control is simply present and quiet.
 */
export function ReportButton({
  target,
  targetId,
  label,
  variant = "quiet",
  className,
}: ReportRef & {
  /**
   * `quiet` sits on the page. `overlay` sits on a photograph, where a muted grey has no
   * reliable contrast — it takes a scrim and white instead, the same treatment the
   * gallery's own "See all photos" pill uses.
   */
  variant?: "quiet" | "overlay";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Report ${label}`}
        title={`Report ${label}`}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--duration-fast)]",
          variant === "quiet"
            ? "text-muted-soft hover:text-error-text hover:bg-surface-soft focus-visible:outline-ink focus-visible:outline-2"
            : "bg-canvas/85 text-ink hover:bg-canvas hover:text-error-text focus-visible:outline-ink shadow-card focus-visible:outline-2",
          className,
        )}
      >
        <Icons.error style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
      </button>

      <ReportSheet
        open={open}
        onClose={() => setOpen(false)}
        target={target}
        targetId={targetId}
        label={label}
      />
    </>
  );
}
