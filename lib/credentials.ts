/**
 * What counts as a usable email address and password.
 *
 * A port of `../tho/app/lib/data/credentials.dart`. Kept out of the form so the rules can be
 * tested directly, and so there is **one** answer rather than one per form — before this,
 * `auth-form.tsx` and `guest-wall.tsx` each asked only whether the fields were non-empty, so
 * `a`, `a@` and a one-character password all reached the server, which answered with
 * something like *"Unable to validate email address: invalid format"* — a message about the
 * request, not about what the person should type.
 */

/**
 * Supabase's own minimum is 6. **This is deliberately stricter for NEW passwords**: six
 * characters is a weekend's work to brute-force, and this product holds people's phone
 * numbers and their booking history.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Practical rather than RFC-complete: a local part, an `@`, and a domain with at least one
 * dot and a two-or-more character last label.
 *
 * The full RFC 5322 grammar allows quoted strings, comments and addresses with no dot at all
 * (`postmaster@localhost`). Matching it would accept things no customer of a Bhutanese salon
 * has ever owned, while still not proving the address exists — only the confirmation email
 * does that, and that is what actually gates sign-up.
 */
const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

/** Why `raw` is not a usable email address, or `null` if it is. */
export function emailError(raw: string): string | null {
  const email = raw.trim();
  if (email.length === 0) return "Enter your email.";
  // Caught before the pattern so the message can name the actual problem — a pasted address
  // with a stray space reads as merely "invalid" otherwise.
  if (email.includes(" ")) return "An email address can't contain spaces.";
  if (!email.includes("@")) return "An email address needs an @.";
  if (!EMAIL_PATTERN.test(email)) return "That doesn't look like an email address.";
  return null;
}

/**
 * Why `raw` is not a strong enough **new** password, or `null` if it is.
 *
 * **Only for sign-up. {@link signInPasswordError} is what a sign-in uses**, and the split is
 * not cosmetic: somebody who set a six-character password before this rule existed still has
 * to be able to get into their account, and telling them their correct password is "too
 * short" would be a lie about why they cannot.
 */
export function newPasswordError(raw: string): string | null {
  if (raw.length === 0) return "Choose a password.";
  if (raw.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  // A length rule alone is satisfied by `aaaaaaaa`. One letter and one digit is the cheapest
  // rule that rules that out without pushing people into `Password1!` variants they will not
  // remember.
  if (!/[A-Za-z]/.test(raw)) return "Include at least one letter.";
  if (!/[0-9]/.test(raw)) return "Include at least one number.";
  return null;
}

/**
 * Why `raw` cannot be a sign-**in** attempt, or `null` if it can.
 * Deliberately only emptiness — see {@link newPasswordError}.
 */
export function signInPasswordError(raw: string): string | null {
  return raw.length === 0 ? "Enter your password." : null;
}

/** Why `raw` is not a usable name, or `null` if it is. */
export function nameError(raw: string): string | null {
  return raw.trim().length === 0 ? "Enter your name." : null;
}
