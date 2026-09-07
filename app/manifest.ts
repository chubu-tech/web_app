import type { MetadataRoute } from "next";
import { brand, hero } from "@/lib/marketing/content";

/**
 * `/manifest.webmanifest`.
 *
 * There was none, so "Add to home screen" offered the URL and a screenshot of the page
 * rather than a named, iconed launcher — on a product whose customers are on phones and
 * whose native apps have not shipped yet, that is the difference between the web app
 * being installable and not.
 *
 * Three decisions worth stating:
 *
 * - **`start_url` is `/discover`, not `/`.** Somebody who installed this did so to book a
 *   haircut; `/` is the marketing page that persuaded them to, and they have already been
 *   persuaded. `/` stays the canonical entry for a *search result*, which is a different
 *   audience arriving for a different reason.
 * - **`display: "standalone"`, not `"fullscreen"`.** The queue and booking screens are
 *   navigational; hiding the status bar takes away the clock, which is the single most
 *   relevant piece of information to somebody watching a walk-in line.
 * - **The install icons are files; the tab icons are routes.** `app/icon.tsx` and
 *   `app/apple-icon.tsx` are route handlers and are named here directly rather than
 *   duplicated. The 192 and 512 are static files in `public/` on purpose: Chrome will not
 *   offer to install without both of those sizes, and the alternative — Next's
 *   `app/icon1.tsx` convention — would also emit them as `<link rel="icon">` on every page,
 *   which is markup no browser needs and one more candidate for Google's favicon picker to
 *   choose between. A manifest icon should be reachable from the manifest and nowhere else.
 *
 *   They are cut from the Flutter app's `Icon-App-1024x1024@1x.png`, which is the only
 *   1024px copy of the mark in either repo — `assets/tho-logo.png` is 192 square and cannot
 *   produce a 512 that is not upscaled. Regenerate from that same file if the mark changes;
 *   the web app and the store app then cannot disagree about their own icon.
 *
 * `theme_color` matches the root layout's `viewport.themeColor` deliberately — a manifest
 * that disagrees with the meta tag produces a different chrome colour depending on how
 * the app was launched.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${brand.name} — book a salon in Bhutan`,
    short_name: brand.name,
    description: hero.purpose,
    start_url: "/discover",
    scope: "/",
    display: "standalone",
    background_color: "#f6f3ee",
    theme_color: "#ffffff",
    lang: "en-BT",
    categories: ["lifestyle", "shopping", "business"],
    icons: [
      { src: "/icon", sizes: "96x96", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      // Chrome's install criteria name these two sizes specifically. Without both, the
      // browser reports the app as not installable and no prompt is ever offered.
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
