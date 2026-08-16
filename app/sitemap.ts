import { createClient } from "@supabase/supabase-js";
import type { MetadataRoute } from "next";
import { publishedPlaces, townOf } from "@/lib/places";
import { salonPath, stylistPath } from "@/lib/slug";
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
 * The public shapes are the marketing home, the four documents, the four list pages, a
 * place page, a salon and a stylist. Everything else is somebody's account or a role
 * shell — see `DISALLOWED_PATHS`, which `robots.ts` and the per-route `noindex` share.
 *
 * **`/waitlist` is no longer listed and its absence is the point.** It carries
 * `robots: { index: false }`, so listing it asked a crawler to fetch a page and then told
 * that crawler not to index what it found — a contradiction that costs budget and teaches
 * the engine that this file is not to be trusted. `/recommended` is absent for the same
 * reason: it is a personalised re-ordering of `/salons`, so it is `noindex` now.
 *
 * **URLs are the slugged form**, minted by `lib/slug.ts` — the same function the pages
 * canonicalise to. A sitemap listing the bare-id form would list, for every salon, a URL
 * that answers a 308 to the one the page actually claims. That is not fatal, but it is a
 * redirect per entry and a disagreement between two files that must not disagree.
 *
 * **The staff read is filtered by the salons above, not by RLS.** `staff_select` lets
 * `anon` read active staff of an `is_active` business and does **not** require
 * `status = 'approved'`, which `businesses_select` does — so an unfiltered staff read
 * lists stylists whose own page 404s (`Karma Lhendup` at `Highland Barbers` is the live
 * example). Filtering by the approved ids is what keeps the sitemap free of URLs that
 * answer 404, which is a ranking signal in its own right.
 *
 * **No `lastModified`.** `businesses` has no `updated_at` this app reads, and stamping
 * every entry with the build time would tell a crawler that all 10 salons changed at
 * once, every deploy — worse than saying nothing, because it is a claim rather than an
 * omission.
 */
export const revalidate = 86_400;

/** The pages that exist whether or not the database answers. */
const FIXED: MetadataRoute.Sitemap = [
  { url: absoluteUrl("/"), changeFrequency: "monthly", priority: 1 },
  { url: absoluteUrl("/discover"), changeFrequency: "daily", priority: 0.9 },
  { url: absoluteUrl("/salons"), changeFrequency: "daily", priority: 0.9 },
  { url: absoluteUrl("/for-salons"), changeFrequency: "monthly", priority: 0.8 },
  { url: absoluteUrl("/top-rated"), changeFrequency: "weekly", priority: 0.7 },
  { url: absoluteUrl("/map"), changeFrequency: "weekly", priority: 0.6 },
  { url: absoluteUrl("/help"), changeFrequency: "monthly", priority: 0.5 },
  { url: absoluteUrl("/legal/terms"), changeFrequency: "yearly", priority: 0.2 },
  { url: absoluteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
  { url: absoluteUrl("/legal/content-policy"), changeFrequency: "yearly", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

  // A sitemap that throws is a 500 where a short sitemap would have done. The fixed
  // entries are always right, so a failed read costs the salons and not the file.
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, address_text, lat, lng")
    .order("name");

  const salons = ((businesses ?? []) as {
    id: string;
    name: string;
    address_text: string | null;
    lat: number | null;
    lng: number | null;
  }[]).map((b) => ({
    id: b.id,
    name: b.name,
    addressText: b.address_text,
    lat: b.lat == null ? null : Number(b.lat),
    lng: b.lng == null ? null : Number(b.lng),
  }));

  if (salons.length === 0) return FIXED;

  const { data: staff } = await supabase
    .from("staff_members")
    .select("id, display_name")
    .in(
      "business_id",
      salons.map((s) => s.id),
    )
    .eq("is_active", true);

  /*
    Place pages, and **only the ones that hold a salon**.

    `publishedPlaces` is the guard: `lib/places.ts` registers all twenty dzongkhags and
    eighteen Thimphu neighbourhoods, and today four of those hold inventory. Listing the
    other thirty-four would be asking a search engine to index thirty-four pages that say
    "no salons here yet" — which is the doorway-page pattern, and the penalty for it is
    domain-wide rather than page-level.

    Nothing has to be edited when that changes. A salon approved in Punakha tomorrow puts
    `/salons/punakha` in this file at the next revalidation, with its own copy, its own
    `CollectionPage` markup and a real list under it.

    A neighbourhood gets a lower priority than its town: `/salons/thimphu` is the page
    that should rank for the query people actually type, and `/salons/thimphu/norzin-lam`
    is a refinement of it, not a competitor.
  */
  const places = publishedPlaces(salons).map(({ place }) => {
    const town = townOf(place);
    const path =
      place.kind === "area" ? `/salons/${town.slug}/${place.slug}` : `/salons/${place.slug}`;
    return {
      url: absoluteUrl(path),
      changeFrequency: "weekly" as const,
      priority: place.kind === "area" ? 0.6 : 0.85,
    };
  });

  return [
    ...FIXED,
    ...places,
    ...salons.map((s) => ({
      url: absoluteUrl(salonPath(s)),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...((staff ?? []) as { id: string; display_name: string | null }[]).map((s) => ({
      url: absoluteUrl(stylistPath({ id: s.id, displayName: s.display_name })),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
