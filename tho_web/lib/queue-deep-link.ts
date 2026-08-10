/**
 * The walk-in queue link shape, ported from
 * `tho/app/lib/business/queue/queue_links.dart` and the `ScanLatch` in
 * `customer/queue/scan_screen.dart`.
 *
 * **This is the one string both clients and a printed poster have to agree on.** A QR already
 * stuck to a counter cannot be re-issued, so the parser accepts both shapes upstream emits:
 *
 * - `bhutansalons://q/<id>` — the custom scheme, which is what `kQueueLinkFor` emits today
 * - `https://<host>/q/<id>` — the universal-link shape, which is what **this** app serves and
 *   what `components/owner/queue-qr-sheet.tsx` encodes
 *
 * So a code printed from the Flutter app scans here, and a code printed from the console scans
 * in the app. That is the whole reason `/q/<id>`'s path cannot be renamed.
 *
 * ## One divergence, and it is the platform's
 *
 * Dart's `Uri` parses `bhutansalons://q/<id>` with `q` as the **host**, which is why the Dart
 * has a branch for it. `URL` does the same thing, so the branch ports directly — but `URL`
 * **throws** on input it cannot parse where `Uri.tryParse` returns null, so the try/catch here
 * is doing the job of `tryParse` rather than hiding an error.
 *
 * `not-a-url` is the case worth knowing: Dart parses it as a *relative* URI with one path
 * segment and returns null from the `q` lookup; `URL` throws. Both answer null, by different
 * routes, and the ported test pins it.
 */

/** The scheme the Flutter app's printed codes use. */
export const QUEUE_LINK_SCHEME = "bhutansalons";

/** What the app's `kQueueLinkFor` emits, for parity in tests and in generated codes. */
export function queueLinkFor(businessId: string): string {
  return `${QUEUE_LINK_SCHEME}://q/${businessId}`;
}

/**
 * The business id out of a queue deep link, or null for anything else.
 *
 * Null covers junk input, a link with no `q` segment, and a `q` with nothing after it — all of
 * which mean "keep looking" to a scanner rather than "fail".
 */
export function businessIdFromQueueLink(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // `URL` throws where Dart's `Uri.tryParse` returns null. Same answer either way.
    return null;
  }

  const segments = url.pathname.split("/").filter((s) => s.length > 0);

  if (url.protocol === `${QUEUE_LINK_SCHEME}:`) {
    // `bhutansalons://q/<id>` — `q` lands in the host, leaving the id as the only segment.
    if (url.hostname === "q" && segments.length > 0) return decodeURIComponent(segments[0]!);
    // The host-less form, `bhutansalons:q/<id>`.
    const i = segments.indexOf("q");
    if (i >= 0 && i + 1 < segments.length) return decodeURIComponent(segments[i + 1]!);
    return null;
  }

  // `https://<host>/q/<id>`, or any other scheme: the id follows `q`.
  const i = segments.indexOf("q");
  if (i >= 0 && i + 1 < segments.length) return decodeURIComponent(segments[i + 1]!);
  return null;
}

/**
 * A one-shot gate over a scanner's raw payloads.
 *
 * A decoder reports the same code many times a second while it stays in frame, so acting on
 * every read would push the same route several times. This yields a business id the **first**
 * time it sees a recognised queue link and null for ever after.
 *
 * **A code it does not recognise never latches**, which is what lets the camera keep hunting
 * after somebody points it at an unrelated QR — a wifi code, a menu, a payment code. Ported
 * verbatim in behaviour from `ScanLatch`, and its four Dart test cases come with it.
 */
export class ScanLatch {
  private fired = false;

  businessIdFor(raw: string | null | undefined): string | null {
    if (this.fired || raw == null || raw.length === 0) return null;
    const id = businessIdFromQueueLink(raw);
    if (id == null) return null;
    this.fired = true;
    return id;
  }
}
