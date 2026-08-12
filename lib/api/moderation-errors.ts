import { errorCode } from "./booking-errors";

/**
 * Turning a moderation or consent rejection into a sentence.
 *
 * A fifth error module, and it exists for two reasons rather than one.
 *
 * **It is where these belong.** `report-sheet.tsx`, `thread-safety-menu.tsx` and
 * `terms-gate.tsx` each grew their own copy of the same seven-line "pull `code` off an
 * unknown" narrowing, next to the component that used it — the layout `owner-errors.ts`,
 * `queue-errors.ts` and `shop-errors.ts` had already rejected. All three are client
 * components, so this is also the rule in *The client/server boundary is load-bearing*:
 * a pure helper beside a component that might become a client one is the shape that broke
 * four server surfaces when `customerName` lived in `owner-booking-card.tsx`.
 *
 * **The tables stay apart.** Same rule `queue-errors.ts` records: these are keyed by
 * *(action, code)*, never by code alone. `42501` is the guest refusal on all three
 * surfaces but the sentence differs, and `P0002` is *"that review has already been
 * removed"* for a report and *"that account no longer exists"* for a block. One shared
 * table would have to pick one meaning and be wrong on the other surface — which is
 * exactly what `booking-errors.ts` warns about for its own `P0002`.
 *
 * Codes as raised in `../tho/supabase/migrations/20260807000010_moderation.sql` and
 * `20260807000012_terms_acceptance.sql`.
 */

export const MODERATION_ERROR = {
  /**
   * A guest tried to commit — `private.is_real_user()` refused.
   *
   * Note this is **not** the `42501` of `booking-errors.ts`, where it means "that booking
   * isn't yours". Same SQLSTATE, different fact, different module.
   */
  guestRefused: "42501",
  /** The target row has already gone — a deleted review, or a closed account. */
  missing: "P0002",
  /**
   * An unknown enum value, or reporting yourself. Deliberately unmapped: this UI prevents
   * both, so it reads as a bug rather than as something the person can act on.
   */
  invalid: "22023",
} as const;

const REPORT_MESSAGES: Record<string, string | undefined> = {
  [MODERATION_ERROR.guestRefused]: "Create an account to report content.",
  [MODERATION_ERROR.missing]: "That's already been removed.",
};

/**
 * `P0002` is not worth alarming anyone about: the thing they wanted gone is gone.
 */
export function reportErrorMessage(error: unknown): string {
  return (
    REPORT_MESSAGES[errorCode(error) ?? ""] ??
    "Couldn't send that report. Please try again."
  );
}

const BLOCK_MESSAGES: Record<string, string | undefined> = {
  // Unreachable from a thread — messaging already requires a real account — but it is the
  // RPC's own refusal, so it is stated rather than guessed at.
  [MODERATION_ERROR.guestRefused]: "Create an account to block someone.",
  [MODERATION_ERROR.missing]: "That account no longer exists.",
};

/** The fallback names the person, so it is built rather than looked up. */
export function blockErrorMessage(error: unknown, name: string): string {
  return (
    BLOCK_MESSAGES[errorCode(error) ?? ""] ??
    `Couldn't block ${name}. Check your connection and try again.`
  );
}

const TERMS_MESSAGES: Record<string, string | undefined> = {
  // The guest wall is the right surface for this and is already in front of both callers,
  // so reaching it here means something upstream let a guest through.
  [MODERATION_ERROR.guestRefused]: "Create an account first, then you can post.",
};

export function acceptTermsErrorMessage(error: unknown): string {
  return TERMS_MESSAGES[errorCode(error) ?? ""] ?? "Couldn't save that. Please try again.";
}
