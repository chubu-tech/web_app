/**
 * Where to send someone after they sign in.
 *
 * `?next=` is attacker-controlled — it arrives in a URL that can be pasted into a
 * chat, an email or a QR code — so it is treated as untrusted input and reduced to
 * a **same-origin path** or nothing. A sign-in page that forwards to an arbitrary
 * URL is a credential-phishing tool: the victim signs in on the real site, and the
 * site then hands them to a copy of it.
 *
 * The rule is an allow-list, not a block-list: it must start with a single `/`, and
 * that is the whole test. Absolute URLs, protocol-relative `//evil.example`,
 * `javascript:` and backslash variants all fail by not matching, rather than by
 * being enumerated one at a time.
 */

/** Where a customer goes when there is no usable `next`. */
export const DEFAULT_NEXT = "/";

/**
 * Control characters, which can truncate or split a value further downstream.
 *
 * Tested by code point rather than with a regex literal so the source file stays
 * free of the very bytes it is rejecting.
 */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function safeNext(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_NEXT;

  // A browser may hand back a percent-encoded value, so decode once: `%2F%2Fevil`
  // has to be judged as `//evil` rather than slipping past as an opaque string. A
  // malformed sequence throws, and input we cannot parse is not input we follow.
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return DEFAULT_NEXT;
  }

  // **Before** trimming, not after. `%0d%0a/evil` decodes to a value whose CRLF
  // `trim()` would quietly remove, leaving an innocuous-looking `/evil` that passes
  // every check below. Reject anything carrying a control character outright, then
  // trim ordinary surrounding spaces.
  if (hasControlChar(value)) return DEFAULT_NEXT;

  value = value.trim();

  // Must be a path...
  if (!value.startsWith("/")) return DEFAULT_NEXT;
  // ...and a single-slash one. `//host` is protocol-relative, and browsers treat a
  // backslash in that position the same way.
  if (value.startsWith("//") || value.startsWith("/\\")) return DEFAULT_NEXT;

  // Never bounce someone back to the page they just left, or they land in a loop.
  if (value.startsWith("/sign-in") || value.startsWith("/sign-up")) {
    return DEFAULT_NEXT;
  }

  return value;
}
