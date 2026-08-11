/**
 * WhatsApp click-to-chat, ported from `tho/app/lib/data/whatsapp.dart`.
 *
 * Deliberately not the WhatsApp Business Cloud API: that needs a verified
 * business number, a Meta app, a permanent token and pre-approved message
 * templates, none of which exist for this project. `wa.me` needs none of them
 * and works from the phone the salon already uses — which, for a one-chair salon
 * in Thimphu, is the whole product.
 */

/**
 * Strips a phone number down to the digits `wa.me` wants: country code plus
 * number, no `+`, spaces, dashes or parentheses.
 *
 * Bhutan's country code is 975 and local mobiles are 8 digits starting 17 or 77.
 * A number typed without its country code is the common case in a Bhutan-first
 * app, so it is prefixed rather than rejected.
 *
 * Returns null when there is nothing usable, so callers **hide the action**
 * rather than launching a link that lands on an error page.
 */
export function whatsappDigits(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 0) return null;

  // 00975… → 975…
  if (digits.startsWith("00")) digits = digits.slice(2);

  // A bare 8-digit Bhutanese mobile: add the country code.
  if (digits.length === 8 && (digits.startsWith("17") || digits.startsWith("77"))) {
    digits = `975${digits}`;
  }

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
