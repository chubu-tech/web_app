import type { MetadataRoute } from "next";
import { absoluteUrl, DISALLOWED_PATHS, SITE_URL } from "@/lib/site";

/**
 * `/robots.txt`.
 *
 * There was none, which is not the same as "allow everything": with no robots and no
 * sitemap, a crawler's only route into this app is whatever links to it, and it spends
 * its budget on `/bookings`, `/cart` and `/profile` — 25 customer routes and 26 console
 * routes, nearly all of which redirect a signed-out visitor. The public half is four
 * shapes: Discover, a salon, a stylist, the map.
 *
 * The disallow list is `DISALLOWED_PATHS`, shared with the `noindex` metadata on those
 * routes, so the two cannot disagree about what is private. **Both are needed and they
 * do different jobs**: `robots.txt` stops the fetch, `noindex` stops the *indexing* of a
 * URL that was reached some other way — a shared link, a referrer — which robots.txt
 * alone cannot, because a disallowed URL can still be indexed from external links with
 * no snippet.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...DISALLOWED_PATHS],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
