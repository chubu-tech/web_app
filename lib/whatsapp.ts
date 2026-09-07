/**
 * WhatsApp click-to-chat, ported from `tho/app/lib/data/whatsapp.dart`.
 *
 * Deliberately not the WhatsApp Business Cloud API: that needs a verified
 * business number, a Meta app, a permanent token and pre-approved message
 * templates, none of which exist for this project. `wa.me` needs none of them
 * and works from the phone the salon already uses — which, for a one-chair salon
 * in Thimphu, is the whole product.
 */

import { toE164 } from "./bhutan-phone";

/**
 * Strips a phone number down to the digits `wa.me` wants: country code plus
 * number, no `+`, spaces, dashes or parentheses.
 *
 * Returns null when there is nothing usable, so callers **hide the action**
 * rather than launching a link that lands on an error page.
 *
 * **Bhutanese numbers go through `lib/bhutan-phone.ts`, which is the one authority for what a
 * valid one is.** This used to carry its own copy of that arithmetic — the `00` strip, the
 * bare-8-digit prefixing, the `17`/`77` check — and two normalisers for one product is how
 * the two eventually disagree about an edge case nobody re-tests.
 *
 * What stays here is the part that is genuinely about `wa.me` rather than about Bhutan: a
 * number that is **already international** is passed through on length alone. A salon may
 * legitimately publish a foreign WhatsApp, and this link is the only thing that reads it, so
 * refusing one because it is not Bhutanese would remove a working button.
 */
export function whatsappDigits(raw: string | null | undefined): string | null {
  if (raw == null) return null;

  // The Bhutanese case, which is almost all of them, and the only one with a real rule.
  const e164 = toE164(raw);
  if (e164 != null) return e164.slice(1);

  let digits = raw.replace(/[^0-9]/g, "");
  // `00` is the international access prefix, not part of the number.
  if (digits.startsWith("00")) digits = digits.slice(2);

  // Shorter than any real international number — a landline fragment or a typo.
  if (digits.length < 8) return null;
  // Longer than E.164 allows.
  if (digits.length > 15) return null;
  return digits;
}

/**
 * A `wa.me` link, optionally pre-filling a message. Null when the phone yields
 * no usable digits.
 *
 * The no-message case omits the query entirely rather than emitting a trailing
 * `?` — wa.me is fine either way, but the bare link is what gets shared and
 * pasted.
 */
export function whatsappUrl(
  phone: string | null | undefined,
  message?: string,
): string | null {
  const digits = whatsappDigits(phone);
  if (digits == null) return null;
  const text = message?.trim();
  return text
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${digits}`;
}
