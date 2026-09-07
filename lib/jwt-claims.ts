/**
 * Reading the `is_anonymous` claim out of an access token.
 *
 * A port of `jwtIsAnonymous` in `../tho/app/lib/data/api.dart:76-95`, and it exists because
 * the client and the server were answering *"is this a guest?"* from two different places.
 *
 * `supabase.auth.getUser()` returns the **user record**. `private.is_real_user()` reads the
 * **claim in the JWT**. Those are normally the same answer, and after `auth.updateUser()`
 * they are not: gotrue does not re-issue the access token, it copies the new user into the
 * existing session and keeps the old JWT. So a guest who has just registered looks real to
 * the client while every RPC still sees `is_anonymous: true` and refuses with `P0010` — the
 * defect upstream fixed in `e71dfa0`, where the customer met *"Create an account to book"*
 * **after** creating one, as often as they retried.
 *
 * Reading the same claim the server reads is what stops the two disagreeing.
 *
 * **This does not verify the signature and must never be used to decide access.** It reads a
 * token this client was handed, to decide what to *show*; the server re-derives everything
 * that matters from the token it validates itself.
 */

/**
 * The `is_anonymous` claim, or `null` when the token cannot be read at all.
 *
 * - Absent claim → `false`, matching the server's own `coalesce(…, false)`.
 * - Unparseable or missing token → `null`, so a caller can fall back to the user record
 *   rather than treating "I could not tell" as "not a guest".
 */
export function jwtIsAnonymous(accessToken: string | null | undefined): boolean | null {
  if (!accessToken) return null;

  const parts = accessToken.split(".");
  if (parts.length !== 3) return null;

  const payload = decodeBase64Url(parts[1]!);
  if (payload == null) return null;

  let claims: unknown;
  try {
    claims = JSON.parse(payload);
  } catch {
    return null;
  }
  // `Array.isArray` is not redundant: an array is an `object`, so a payload of `[1]`
  // would otherwise pass this guard and then read `is_anonymous` as absent — i.e. report
  // a real account for a token it could not actually parse.
  if (typeof claims !== "object" || claims === null || Array.isArray(claims)) return null;

  const claim = (claims as { is_anonymous?: unknown }).is_anonymous;
  // A present-but-not-boolean claim is a token shape we do not understand; say so rather
  // than coercing it, so the caller falls back instead of guessing.
  if (claim === undefined) return false;
  return typeof claim === "boolean" ? claim : null;
}

/** base64url → utf-8, without assuming `Buffer` (this runs in the browser too). */
function decodeBase64Url(segment: string): string | null {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  const full = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  try {
    // `atob` gives latin-1; the claim set is ASCII JSON, but decode properly anyway so a
    // non-ASCII claim elsewhere in the payload cannot corrupt the parse.
    const binary = atob(full);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}
