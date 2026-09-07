/**
 * Bhutanese phone numbers: one place that knows what a valid one looks like.
 *
 * A port of `../tho/app/lib/data/bhutan_phone.dart`. Every phone field in this product is a
 * Bhutan number, so none of them ask for a country code: the person types the 8 local digits
 * they would read off a shopfront — `17 12 34 56` — and `+975` is a fixed label on the field
 * rather than something to type, get wrong, or type twice.
 *
 * **Storage is always E.164 ({@link toE164}), display is always local ({@link toLocal}).**
 * E.164 is what `wa.me`, `tel:` links and any future SMS gateway want; the local form is what
 * people in Thimphu recognise. Both conversions live here so a field, a validator and a saved
 * row can never disagree — before this, four fields stored `phone.trim()` raw and
 * `lib/whatsapp.ts` kept its own normalisation.
 */

/** Bhutan's country calling code, without the `+`. */
export const BHUTAN_CALLING_CODE = "975";

/** Local mobile numbers are 8 digits. */
export const BHUTAN_LOCAL_DIGITS = 8;

/**
 * The two mobile prefixes in use: 17 (B-Mobile) and 77 (TashiCell).
 *
 * Landlines are 7 digits behind an area code and can receive neither SMS nor WhatsApp —
 * which is what every phone field in this product is ultimately for — so they are rejected
 * rather than quietly stored as something unreachable.
 */
export const BHUTAN_MOBILE_PREFIXES = ["17", "77"] as const;

const digitsOf = (raw: string): string => raw.replace(/[^0-9]/g, "");

/**
 * The local 8-digit form of `raw`, with any country code stripped.
 *
 * Accepts what people actually paste: `+975 17 12 34 56`, `0097517123456`, `975-17123456`,
 * `17123456`. Returns the digits it could recover, which may be fewer than 8 while somebody
 * is still typing — {@link bhutanPhoneError} decides whether that is acceptable, not this.
 */
export function toLocal(raw: string): string {
  let d = digitsOf(raw);
  // `0097517123456` → `97517123456`. The international access prefix, dialled from a landline
  // abroad.
  if (d.startsWith("00")) d = d.slice(2);
  /*
    A country code only counts as one when what follows it is the right length for a local
    number. Without that length check, a local number beginning `975` would lose its first
    three digits — and `77` is a live prefix, so `97577123` is a shape a person can type.
  */
  if (
    d.startsWith(BHUTAN_CALLING_CODE) &&
    d.length === BHUTAN_CALLING_CODE.length + BHUTAN_LOCAL_DIGITS
  ) {
    d = d.slice(BHUTAN_CALLING_CODE.length);
  }
  return d;
}

/**
 * `raw` as `+97517123456`, or `null` when it is not a valid Bhutanese mobile.
 *
 * **Null rather than a best guess.** A caller storing this wants a number that can actually
 * be dialled, and half a phone number is worse than none — stored, it renders a WhatsApp
 * button that lands on nothing.
 */
export function toE164(raw: string): string | null {
  const local = toLocal(raw);
  if (bhutanPhoneError(local, { required: true }) != null) return null;
  return `+${BHUTAN_CALLING_CODE}${local}`;
}

/**
 * `17 12 34 56` — the local number in the grouping people read it in.
 *
 * Returns the recoverable digits unformatted when there are not 8 of them, so a partial entry
 * is never re-grouped into something that looks complete.
 */
export function formatLocal(raw: string): string {
  const d = toLocal(raw);
  if (d.length !== BHUTAN_LOCAL_DIGITS) return d;
  return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 6)} ${d.slice(6)}`;
}

/**
 * Why `raw` is not a usable Bhutanese mobile number, or `null` if it is.
 *
 * **`required` decides only what an *empty* field means**: on a salon's own phone that is a
 * missing answer, on a walk-in customer's it is a legitimate "didn't ask". Everything else is
 * judged the same either way — a half-typed number is wrong whether or not the field had to
 * be filled, and that is the case the free-text fields used to let through.
 */
export function bhutanPhoneError(
  raw: string,
  { required = false }: { required?: boolean } = {},
): string | null {
  const d = toLocal(raw);
  if (d.length === 0) return required ? "Enter a phone number." : null;
  if (d.length < BHUTAN_LOCAL_DIGITS) {
    const missing = BHUTAN_LOCAL_DIGITS - d.length;
    return `Too short — ${missing} more digit${missing === 1 ? "" : "s"} to go.`;
  }
  if (d.length > BHUTAN_LOCAL_DIGITS) return "That's more than 8 digits.";
  if (!BHUTAN_MOBILE_PREFIXES.some((p) => d.startsWith(p))) {
    return `Bhutan mobile numbers start with ${BHUTAN_MOBILE_PREFIXES.join(" or ")}.`;
  }
  return null;
}

/** Whether `raw` is a complete, valid Bhutanese mobile number. */
export function isValidBhutanPhone(raw: string): boolean {
  return bhutanPhoneError(raw, { required: true }) == null;
}
