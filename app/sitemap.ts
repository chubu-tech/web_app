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
      url: `https://${brand.domain}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
