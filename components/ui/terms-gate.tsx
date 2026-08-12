"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { acceptTerms } from "@/lib/api/moderation";
import { acceptTermsErrorMessage } from "@/lib/api/moderation-errors";
import { createClient } from "@/lib/supabase/client";

/**
 * "Before you post" — the one-time terms acceptance, a port of `moderation/terms_gate.dart`.
 *
 * ## Why it has to exist rather than being a link in the footer
 *
 * `20260807000012` made accepted terms a **precondition** for user-generated content.
 * Without this, a customer's first review and first message fail with a bare `P0004`
 * from the RPC — a refusal with no explanation and nothing to press. The gate turns that
 * into the one question it actually is.
 *
 * ## It asks once, and the server is what remembers
 *
 * `accept_terms` coalesces, so the first acceptance is the one on record and calling it
 * again never moves the timestamp. That means this component needs no local "already
 * agreed" cache and a double-press is harmless — the truth lives in
 * `profiles.terms_accepted_at`, which the caller reads server-side and passes in.
 *
 * ## Usage
 *
 * Render it *before* the action, not after the failure:
 *
 * ```
 * if (needsTerms) { setGateOpen(true); return; }
 * await postTheThing();
 * ```
 *
 * `onAccepted` continues whatever was interrupted, so agreeing does not cost the person
 * the thing they had already typed.
 */
export function TermsGate({
  open,
  onClose,
  onAccepted,
  /** What they were trying to do — "post this review", "send this message". */
  action,
}: {
  open: boolean;
  onClose: () => void;
  onAccepted: () => void;
  action: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function agree() {
    setBusy(true);
    setError(null);
    try {
      await acceptTerms(createClient());
      onAccepted();
      onClose();
    } catch (caught) {
      setError(acceptTermsErrorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose} title="Before you post">
      <div className="p-base">
        <p className="text-body-md text-body">
          To {action}, please agree to our terms and our rules about what can be posted.
          We ask once.
        </p>

        <ul className="gap-sm mt-base flex flex-col">
          <li>
            <Link
              href="/legal/terms"
              className="text-title text-rausch-cta font-medium underline"
            >
              Terms of Service
            </Link>
          </li>
          <li>
            <Link
              href="/legal/content-policy"
              className="text-title text-rausch-cta font-medium underline"
            >
              What can&apos;t be posted
            </Link>
          </li>
        </ul>

        <p className="text-body-sm text-muted mt-base">
          In short: no spam, no abuse, nothing that isn&apos;t yours to post, and nothing
          about someone else&apos;s private life. Reports go to our moderators.
        </p>

        {error ? (
          <p role="alert" className="text-body-sm text-error-text mt-md">
            {error}
          </p>
        ) : null}

        <div className="gap-sm mt-lg flex flex-col">
          <Button fullWidth busy={busy} onClick={() => void agree()}>
            I agree
          </Button>
          <Button variant="quiet" fullWidth disabled={busy} onClick={onClose}>
            Not now
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
