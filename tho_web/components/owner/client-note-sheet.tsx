"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icons, IconSize } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import { setClientNote } from "@/lib/api/owner-back-office";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { createClient } from "@/lib/supabase/client";

/**
 * The salon's private note about a client — a port of
 * `tho/app/lib/business/clients/client_note_sheet.dart`.
 *
 * **"Private" means private from the customer, not from staff.** `client_notes_rw_owner` is
 * `ALL using is_business_owner`, so the owner writes it and nobody outside the salon can read
 * it — but `client_book` (which reports `has_note`) admits any business *member*. The copy says
 * "only your team can see this" rather than "only you", because that is what is true.
 *
 * One text area and a Save. No autosave: a note is a considered thing, and a half-typed
 * sentence saved on blur is worse than no note.
 */
export function ClientNoteSheet({
  businessId,
  customerProfileId,
  initialNote,
  clientName,
}: {
  businessId: string;
  customerProfileId: string;
  initialNote: string;
  clientName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(initialNote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await setClientNote(createClient(), businessId, customerProfileId, note.trim());
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(ownerErrorMessage("saveClientNote", e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        <Icons.note style={{ width: IconSize.xxs, height: IconSize.xxs }} aria-hidden />
        {initialNote ? "Edit note" : "Add note"}
      </Button>

      {/*
        Keyed on `open`, so the text area is re-created from `initialNote` each time the sheet
        opens rather than keeping whatever was abandoned last time. Mount-and-key instead of a
        `setState` in an effect — the pattern 3b settled on for `service-form-sheet`.
      */}
      <Sheet
        key={open ? "open" : "closed"}
        open={open}
        onClose={() => setOpen(false)}
        title={`Note about ${clientName}`}
        footer={
          <Button fullWidth busy={busy} onClick={save}>
            Save note
          </Button>
        }
      >
        <div className="gap-sm flex flex-col">
          <label className="text-caption text-muted" htmlFor="client-note">
            Only your team can see this — never the customer.
          </label>
          <textarea
            id="client-note"
            rows={5}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Allergic to ammonia. Prefers Sonam. Always late."
            className="border-hairline text-body-md text-ink placeholder:text-muted-soft focus:border-ink p-md rounded-sm border outline-none"
          />
          {error ? <p className="text-body-sm text-error-text">{error}</p> : null}
        </div>
      </Sheet>
    </>
  );
}
