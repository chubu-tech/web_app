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
 * - **The icons are the generated ones.** `app/icon.tsx` and `app/apple-icon.tsx` are
 *   route handlers, so they have stable URLs and are named here directly rather than
 *   duplicated as files in `public/`.
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
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
