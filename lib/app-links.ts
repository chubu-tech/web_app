import { brand } from "./marketing/content";

/**
 * Where the Tho app lives, and how to hand a scanned queue link over to it.
 *
 * ## Why this module exists at all
 *
 * `/q/<id>` is the printed QR's target, and until now it had exactly one answer for
 * everybody who scanned it: the web join form. That form works and is not going
 * anywhere — but it is the *wrong* first offer for somebody who already has the app,
 * and it says nothing at all to somebody who would rather have it.
 *
 * ## The OS already does most of this, and that is the part worth understanding
 *
 * **Both platforms hand `https://bhutansalons.com/q/<id>` straight to the app when it is
 * installed**, without this module and without the browser ever painting a pixel:
 *
 * - Android App Links — `public/.well-known/assetlinks.json`, package `bt.tho.app`,
 *   matched by the `autoVerify` intent filter in the app's `AndroidManifest.xml`.
 * - iOS Universal Links — `public/.well-known/apple-app-site-association`, app id
 *   `9BPV5PP9BU.bt.tho.app`, scoped to `/q/*`.
 *
 * So the naive reading — "add a button that opens the app" — describes something the
 * operating system is already doing better than a button can. What this module is for is
 * the **cases where that hand-off does not fire**, and they are common enough to matter:
 *
 * - **An in-app browser.** A link opened inside WhatsApp, Instagram, Messenger or Facebook
 *   renders in an embedded webview that does not honour App Links or Universal Links. A
 *   queue link forwarded to a friend on WhatsApp — which is exactly how these get shared
 *   here — lands in the webview every time.
 * - **A link typed, pasted, or followed from another page in the same browser.** iOS
 *   deliberately suppresses Universal Links for same-domain navigations, so a customer who
 *   taps through from the salon page never gets the hand-off.
 * - **Verification not yet cached.** Android caches the App Links verdict at install time;
 *   an install that predates a fix keeps reporting the old answer until it is reinstalled.
 *
 * In all three the customer is standing in the shop looking at a web page, and the app on
 * their phone is one tap away with nothing on screen offering it.
 *
 * ## The custom scheme is the fallback, not the primary
 *
 * `bhutansalons://q/<id>` (`queueLinkFor` in `lib/queue-deep-link.ts`) fires regardless of
 * any hosted file, which is precisely why the Flutter app still prints it — see
 * `kQueueLinkFor`'s own note upstream. Its weakness is the mirror image of the https form's:
 * it does **nothing** when the app is absent, and a browser asked to follow an unhandled
 * scheme either ignores it or shows an error the customer cannot act on.
 *
 * So the two are used for what each is good at, and neither is used alone:
 *
 * - the **printed QR keeps encoding the https form**, so the OS hand-off works and somebody
 *   without the app still gets a real page;
 * - the **"Open in the app" control uses the custom scheme**, because by the time it is on
 *   screen the https hand-off has already demonstrably not fired.
 *
 * **Do not "simplify" this to one link.** Each covers the other's failure, and AGENTS.md's
 * "one poster, both clients" rule depends on the printed half staying https.
 *
 * ## Both store listings are live, and one repo doc says otherwise
 *
 * Verified by request, not assumed — both answer 200 and both are the real listing:
 *
 * | Store | URL | Listing |
 * | --- | --- | --- |
 * | Apple | `apps.apple.com/bt/app/id6801982891` | Tho.bt, Bhutan storefront, v1.1.0 |
 * | Google | `play.google.com/store/apps/details?id=bt.tho.app` | Tho — Que & Appointment App |
 *
 * `chubu-tech/docs/deployment/STORE_DEPLOYMENT_CHECKLIST.md:456` still has *"Promote to
 * Closed/Open testing, then Production"* unticked. **That line is stale**; Play is in
 * production. It is upstream's document, so it is noted here rather than edited here.
 */

/**
 * The origin every **printed** code must carry, whatever host served the page that drew it.
 *
 * **This is not a preference, it is what the deep link requires.** The app's own
 * `AndroidManifest.xml` pins its App Links filter to
 * `android:host="bhutansalons.com"` with `pathPrefix="/q/"`, and the Apple file is served
 * from that same domain. A code encoding any other host — a preview deployment, a laptop on
 * `localhost:3000` — therefore **cannot** hand off to Tho at all. It would open a browser at
 * best, and at worst point at a machine that is not on the internet.
 *
 * An earlier version built this from the request's `host` header, reasoning that a QR
 * generated from a preview should point at that preview. That is right for a link you click
 * and wrong for one you laminate: the artefact outlives the deployment that produced it, and
 * the only address guaranteed to still answer in two years is the real one.
 *
 * So `NEXT_PUBLIC_SITE_URL` is deliberately **not** consulted either. It is inlined at build
 * time and a misconfigured build would bake `localhost:3000` onto paper — a failure with no
 * way back once the poster is on a wall.
 */
export const DEEP_LINK_ORIGIN = "https://bhutansalons.com";

/** The permanent public address of one salon — the single link a salon has for its life. */
export function salonScanUrl(businessId: string): string {
  return `${DEEP_LINK_ORIGIN}/q/${businessId}`;
}

/** The phone platforms that have a Tho build. Anything else gets the web join. */
export type MobilePlatform = "ios" | "android";

/**
 * The two store listings, and the Android package — all re-exported from `brand.appListing`
 * rather than restated here.
 *
 * **`brand.appListing` is the single source and this file defers to it.** An earlier version
 * of this module pasted its own copies, which is the duplication AGENTS.md's "keep them in
 * step" rule exists to prevent: the `/bt/` storefront segment is load-bearing (the
 * storefront-less form is a measured 404 for this app, since it is published to Bhutan only),
 * and two places holding that fact is one place for it to rot.
 *
 * `ANDROID_PACKAGE` is also what `public/.well-known/assetlinks.json` and the app's
 * `AndroidManifest.xml` name, so if it is ever wrong the App Links hand-off described above
 * stops working silently while every link still resolves.
 */
export const APP_STORE_URL = brand.appListing.ios.url;
export const PLAY_STORE_URL = brand.appListing.android.url;
export const ANDROID_PACKAGE = brand.appListing.android.id;

/**
 * Where to send somebody who wants the app.
 *
 * Null for an unknown platform — a desktop browser, or a phone this cannot identify. The
 * caller shows both listings in that case rather than guessing, because guessing wrong
 * sends an Android user to an iPhone-only listing they cannot install from.
 */
export function storeUrlFor(platform: MobilePlatform | null): string | null {
  if (platform === "ios") return APP_STORE_URL;
  if (platform === "android") return PLAY_STORE_URL;
  return null;
}

/**
 * The phone platform behind a user agent, or null when it is not one this app ships to.
 *
 * **Pure, and takes its inputs rather than reading `navigator`**, so it is testable and so
 * the one place that *does* touch `navigator` is the component that has to.
 *
 * ## iPadOS is the case that makes this more than a regex
 *
 * Since iPadOS 13 an iPad reports itself as `Macintosh; Intel Mac OS X` — the same string a
 * desktop Mac sends — so a plain `/iPad/` test identifies every iPad as a desktop and offers
 * it no app at all. The distinguishing signal is touch: `navigator.maxTouchPoints` is 5 on an
 * iPad and 0 on a Mac, and that pair is the only reliable separator the platform gives.
 *
 * `maxTouchPoints` defaults to 0 so a caller with nothing to pass still gets the plain
 * answer for every other device.
 */
export function detectMobilePlatform(
  userAgent: string,
  maxTouchPoints = 0,
): MobilePlatform | null {
  // Android first: an Android UA also contains "Linux", and some contain "Mobile Safari",
  // so testing for it before the Apple branches keeps those from being misread.
  if (/Android/i.test(userAgent)) return "android";

  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";

  // An iPad on iPadOS 13+ masquerading as a Mac. A real Mac reports 0 touch points; the
  // `> 1` rather than `> 0` leaves room for a touch-capable Mac display without claiming it.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";

  return null;
}
