"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { ReportSheet } from "@/components/ui/report-sheet";
import { Sheet } from "@/components/ui/sheet";
import { blockUser } from "@/lib/api/moderation";
import { blockErrorMessage } from "@/lib/api/moderation-errors";
import { createClient } from "@/lib/supabase/client";

/**
 * Report or block the salon you are talking to — a port of the thread's overflow menu in
 * `chat_thread_screen.dart:212-246` and of `block_sheet.dart`.
 *
 * ## Why it is here and not in a settings screen
 *
 * `chat_thread_screen.dart:212` states it plainly: reporting and blocking have to be
 * reachable **from the conversation itself**. Chat is the only place two accounts can reach
 * each other directly on this platform, so it is the only place a block has anything to do —
 * and somebody who wants a person to stop messaging them should not have to go and find a
 * list of accounts to do it from.
 *
 * ## A sheet, not a popup menu
 *
 * The Flutter original is a `PopupMenuButton`. A popup on the web needs its own outside-click
 * handling, Escape, focus trap and focus restore — the five things `Sheet` already has and
 * that `collapse-nav.tsx` documents the marketing site getting wrong. So the menu is a sheet
 * with two rows, and there is one modal implementation in this app rather than two.
 *
 * ## Blocking navigates away, because the thread stops existing
 *
 * `private.conversation_blocked` is a conjunct in `conversations_select` **and** in
 * `messages_select`, and the block is symmetric — so the moment it lands, this page's own
 * read returns nothing and the poll starts coming back empty. Staying here would be a
 * transcript that silently emptied and a composer that fails on send. The Dart pops the
 * route for exactly this reason (`chat_thread_screen.dart:198-201`); this pushes
 * `/messages`, where the thread is now correctly absent from the list.
 */
export function ThreadSafetyMenu({
  counterpartyId,
  counterpartyName,
}: {
  /**
   * The salon owner's profile id. **The caller renders nothing when this is null** — a
   * pending salon's embed is empty, and a menu whose every item needs a person is not worth
   * opening without one. Individual messages stay reportable either way.
   */
  counterpartyId: string;
  /** What to call them: the salon's name, which is who the customer thinks they are talking to. */
  counterpartyName: string;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function doBlock() {
    setBusy(true);
    try {
      await blockUser(createClient(), counterpartyId);
      toast.success(`${counterpartyName} is blocked.`);
      setBlockOpen(false);
      // See the note above: this thread is no longer readable, so there is nothing to
      // stay for. `refresh` as well as `push`, or the list still shows the cached row.
      router.push("/messages");
      router.refresh();
    } catch (caught) {
      toast.error(blockErrorMessage(caught, counterpartyName));
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="Report or block this salon"
        className="border-hairline text-muted hover:text-ink hover:bg-surface-soft focus-visible:outline-ink flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors duration-[var(--duration-fast)] focus-visible:outline-2"
      >
        <Icons.more style={{ width: IconSize.sm, height: IconSize.sm }} aria-hidden />
      </button>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Safety">
        <ul className="p-base gap-sm flex flex-col">
          <li>
            <MenuRow
              icon={Icons.error}
              label={`Report ${counterpartyName}`}
              hint="Tell our moderators about this account. They aren't told who reported them."
              onClick={() => {
                setMenuOpen(false);
                setReportOpen(true);
              }}
            />
          </li>
          <li>
            <MenuRow
              icon={Icons.locked}
              label={`Block ${counterpartyName}`}
              hint="Their messages stop reaching you, and yours stop reaching them."
              onClick={() => {
                setMenuOpen(false);
                setBlockOpen(true);
              }}
            />
          </li>
        </ul>
      </Sheet>

      <ReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        target="user"
        targetId={counterpartyId}
        label={counterpartyName}
        // The block checkbox inside the report sheet, so somebody who is reporting because
        // of what was sent to them does not have to come back and find a second control.
        // `block_sheet.dart:17-20` makes the same argument the other way round.
        blockableUserId={counterpartyId}
        onBlocked={() => {
          router.push("/messages");
          router.refresh();
        }}
      />

      <Sheet
        open={blockOpen}
        onClose={busy ? () => {} : () => setBlockOpen(false)}
        title={`Block ${counterpartyName}?`}
      >
        <div className="p-base gap-md flex flex-col">
          {/*
            **Both directions, before the press.** Ported verbatim in substance from
            `block_sheet.dart:121-131`, which explains why: "you will not see their messages"
            is half the truth, and the half it leaves out — that your own replies stop
            arriving too — is the half that surprises people. `private.blocked_with` matches
            a block in either direction, so this is a statement about the SQL, not a warning
            written to be safe.
          */}
          <p className="text-body-md text-body">
            Their messages stop reaching you, and yours stop reaching them. Your
            conversation disappears from both sides — nothing is deleted, and it comes back
            if you undo this.
          </p>
          <p className="text-body-sm text-muted">
            They are not told that you blocked them. You can undo it any time from Blocked
            accounts in your profile.
          </p>

          {/* `error-text`, not rausch: this is destructive, and white on rausch fails AA —
              the same call `block_sheet.dart:141-143` makes and for the same reason. */}
          <Button
            fullWidth
            busy={busy}
            onClick={() => void doBlock()}
            className="bg-error-text hover:bg-error-text-hover disabled:bg-error-text"
          >
            Block
          </Button>
          <Button
            variant="outlined"
            fullWidth
            disabled={busy}
            onClick={() => setBlockOpen(false)}
          >
            Cancel
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function MenuRow({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: typeof Icons.error;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-hairline-soft p-base gap-md hover:bg-surface-soft focus-visible:outline-ink flex w-full items-start rounded-md border text-left focus-visible:outline-2"
    >
      <Icon
        className="text-error-text mt-0.5 shrink-0"
        style={{ width: IconSize.sm, height: IconSize.sm }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="text-title text-ink block font-medium">{label}</span>
        <span className="text-body-sm text-muted mt-xxs block">{hint}</span>
      </span>
    </button>
  );
}

