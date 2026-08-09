import { createClient } from "@supabase/supabase-js";
import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/**
 * `/sitemap.xml` — every public page, including the ones only a database read knows
 * about.
 *
 * There was no sitemap, which on a marketplace is the difference between four
 * discoverable pages and four hundred: **a salon page is reachable only from Discover**,
 * which is a client-filtered list, and a stylist page only from a salon page. Nothing
 * links to them from outside, so without this a crawler that finds `/` has to guess.
 *
 * ## A bare anon client, not the request-scoped one
 *
 * `lib/supabase/server.ts` binds to the request's cookie jar, which would make this route
 * *dynamic* — recomputed per crawl, cookies read for a document that is identical for
 * everyone. The anon key grants nothing on its own (RLS is the gate), and every row here
 * is one an anonymous visitor may already read, so a cookie-free client is both correct
 * and cacheable.
 *
 * `revalidate` is a day: salons are approved by an operator, not minted continuously, and
 * a crawler re-reading this hourly would be the most-fetched route in the app.
 *
 * ## What is in it, and what is deliberately not
 *
 * The public shapes are Discover, the map, a salon and a stylist. Everything else is
 * somebody's account or a role shell — see `DISALLOWED_PATHS`, which `robots.ts` and the
 * per-route `noindex` share.
 *
 * **The staff read is filtered by the salons above, not by RLS.** `staff_select` lets
 * `anon` read active staff of an `is_active` business and does **not** require
 * `status = 'approved'`, which `businesses_select` does — so an unfiltered staff read
 * lists stylists whose own page 404s (`Karma Lhendup` at `Highland Barbers` is the live
 * example). Filtering by the approved ids is what keeps the sitemap free of URLs that
 * answer 404, which is a ranking signal in its own right.
 *
 * **No `lastModified`.** `businesses` has no `updated_at` this app reads, and stamping
 * every entry with the build time would tell a crawler that all 13 salons changed at
 * once, every deploy — worse than saying nothing, because it is a claim rather than an
 * omission.
 */
export const revalidate = 86_400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  const fixed: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/map"), changeFrequency: "weekly", priority: 0.6 },
  ];

  // A sitemap that throws is a 500 where a short sitemap would have done. The two fixed
  // entries are always right, so a failed read costs the salons and not the file.
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id")
    .order("name");

  const ids = ((businesses ?? []) as { id: string }[]).map((b) => b.id);
  if (ids.length === 0) return fixed;

  const { data: staff } = await supabase
    .from("staff_members")
    .select("id")
    .in("business_id", ids)
    .eq("is_active", true);

  return [
    ...fixed,
    ...ids.map((id) => ({
      url: absoluteUrl(`/salon/${id}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...((staff ?? []) as { id: string }[]).map((s) => ({
      url: absoluteUrl(`/stylist/${s.id}`),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
