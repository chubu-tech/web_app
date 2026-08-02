import type { MetadataRoute } from "next";
import { brand } from "@/lib/content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `https://${brand.domain}/sitemap.xml`,
    host: `https://${brand.domain}`,
  };
}
