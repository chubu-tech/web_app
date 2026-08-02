import type { MetadataRoute } from "next";
import { brand } from "@/lib/content";

/** Add an entry here for each new route (privacy, terms, the dashboard, …). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `https://${brand.domain}`,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
