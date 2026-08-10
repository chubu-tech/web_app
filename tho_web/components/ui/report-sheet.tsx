"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SelectTile } from "@/components/ui/select-tile";
import { Sheet } from "@/components/ui/sheet";
import {
  blockUser,
  reportContent,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  type ReportReason,
  type ReportTarget,
} from "@/lib/api/moderation";
import { createClient } from "@/lib/supabase/client";

/**
 * One report form for all five targets — a port of `moderation/report_sheet.dart`.
 *
 * ## One sheet, not five
 *
 * `report_content` takes a target *type* and an id, so a review, a review photo, a
 * gallery photo, a message and a person differ only in two arguments. Five components
 * would be five places for the reason list to drift, and the reasons are a Postgres enum
 * — a list that must not drift.
 *
 * ## Blocking rides along, because that is the pair people actually want
 *
 * `block_sheet.dart` offers "block, and optionally report" as one action. Reporting a
 * person you are talking to without also being able to stop them talking to you is half a
 * feature, so the `user` target grows a checkbox rather than a second sheet. It is a
 * separate RPC and a separate failure: the report can succeed while the block fails, and
 * the toast says which, rather than claiming both.
 *
 * ## What it does not do
 *
 * No optimistic hiding of the reported content. A report is a request to a moderator, not
 * a decision — the row stays until `admin_resolve_report` says otherwise, and pretending
 * otherwise would tell somebody their report was upheld the instant they filed it.
 */
export function ReportSheet({
  open,
  onClose,
  target,
  targetId,
  /** The thing being reported, for the heading: "this review", "this message". */
  label,
  /** Only meaningful for `target="user"`; enables the block checkbox. */
  blockableUserId,
  onBlocked,
}: {
  open: boolean;
  onClose: () => void;
  target: ReportTarget;
  targetId: string;
  label: string;
  blockableUserId?: string | null;
  onBlocked?: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!reason) return;
    setBusy(true);
    const supabase = createClient();
    try {
      await reportContent(supabase, { target, targetId, reason, note });

      if (alsoBlock && blockableUserId) {
        try {
          await blockUser(supabase, blockableUserId);
          toast.success("Reported and blocked. Thanks — we'll take a look.");
          onBlocked?.();
        } catch {
          // The report landed. Saying "reported and blocked" here would be a lie about
          // the half that failed, and the block is retryable on its own.
          toast.success("Reported. We couldn't block them — try again from the menu.");
        }
      } else {
        toast.success("Reported. Thanks — we'll take a look.");
      }
      onClose();
    } catch (caught) {
      toast.error(reportErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose} title={`Report ${label}`}>
      <div className="p-base">
        <p className="text-body-sm text-muted mb-base">
          Reports go to our moderators, not to the salon. Tell us what&apos;s wrong and
          we&apos;ll look at it.
        </p>

        <fieldset>
          <legend className="text-title text-ink mb-sm font-medium">
            What&apos;s the problem?
          </legend>
          <ul className="gap-sm flex flex-col">
            {REPORT_REASONS.map((r) => (
              <li key={r}>
                <SelectTile
                  name="report-reason"
                  value={r}
                  checked={reason === r}
                  onSelect={(v) => setReason(v as ReportReason)}
                  title={REPORT_REASON_LABELS[r]}
                />
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="mt-lg">
          <label htmlFor="report-note" className="text-title text-ink mb-sm block font-medium">
            Anything else? (optional)
          </label>
          <textarea
            id="report-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            // The RPC refuses over 1000 with `22023`; stopping here means the limit is a
            // property of the field rather than an error after the fact.
            maxLength={1000}
            className="border-hairline bg-paper text-body-md text-ink placeholder:text-muted-soft p-md focus:border-ink w-full rounded-md border focus:border-2 focus:outline-none"
          />
        </div>

        {blockableUserId ? (
          <label className="gap-sm mt-base flex items-start">
            <input
              type="checkbox"
              checked={alsoBlock}
              onChange={(e) => setAlsoBlock(e.target.checked)}
              className="mt-1 size-5 shrink-0"
            />
            <span className="text-body-sm text-body">
              Also block them — they won&apos;t be able to message you, and you
              won&apos;t see them.
            </span>
          </label>
        ) : null}

        <div className="mt-lg">
          <Button fullWidth busy={busy} disabled={reason == null} onClick={() => void submit()}>
            Send report
          </Button>
        </div>

        {/*
          **A link to the policy, not the policy.** `report_sheet.dart:18-21` gives the
          reason and it is not a space saving: the prohibited categories have to be both
          defined *and* reachable, and a reason list on its own is neither — while a wall of
          policy text inside a report form is how people learn to scroll past it.

          It opens in a new tab so a half-written report survives reading the rules. Same
          reason the note field is not cleared when the sheet closes.
        */}
        <p className="text-body-sm text-muted mt-md text-center">
          <Link
            href="/legal/content-policy"
            target="_blank"
            rel="noopener"
            className="text-rausch-cta font-medium underline"
          >
            What isn&apos;t allowed on Tho
          </Link>
        </p>
      </div>
    </Sheet>
  );
}

/**
 * By `errcode`, never message text — the rule the rest of this repo follows.
 *
 * `42501` is a guest: reporting needs a real account. `P0002` means the thing has already
 * gone, which is not a failure worth alarming anyone about. `22023` covers an unknown
 * value or reporting yourself, both of which this UI prevents — so it reads as a bug
 * rather than as something the person can fix.
 */
function reportErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (code === "42501") return "Create an account to report content.";
  if (code === "P0002") return "That's already been removed.";
  return "Couldn't send that report. Please try again.";
}
