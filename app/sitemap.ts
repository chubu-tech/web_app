import type { MetadataRoute } from "next";
import { brand } from "@/lib/content";

/**
 * Add an entry here for each new route (terms, the dashboard, …).
 *
 * `/q/<id>` is deliberately absent: those are per-shop utility pages carrying
 * `noindex`, not content to rank.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `https://${brand.domain}`,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      // The QR's landing page. Listed so the URL is discoverable and stable —
      // it is printed on things — but its own metadata sets `index: false`,
      // because a bare signup form is not what should rank for "Bhutan salons".
      url: `https://${brand.domain}/waitlist`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `https://${brand.domain}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
