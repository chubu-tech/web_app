import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { PlaceFaq } from "@/components/customer/place-faq";
import { SalonGrid } from "@/components/customer/salon-grid";
import { Icons, IconSize } from "@/components/ui/icons";
import {
  fetchAllBusinessCategories,
  fetchBusinesses,
  fetchCategories,
} from "@/lib/api/discovery";
import { fetchMyFavouriteIds } from "@/lib/api/favourites";
import { emptyPlaceCopy, placeCopy, placeLabel } from "@/lib/place-copy";
import { areasOf, placeBySlug, salonsIn, type Place } from "@/lib/places";
import {
  breadcrumbSchema,
  faqSchema,
  jsonLdScript,
  salonListSchema,
} from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import type { Business } from "@/lib/types/salon";

/**
 * Salons in a place — `/salons/thimphu`, `/salons/thimphu/norzin-lam`.
 *
 * ## Why this route exists
 *
 * "Salon booking in Thimphu" is the query this product has to win, and nothing on the site
 * answered it. `/salons` is *every* salon in the country with no place in its title, its
 * heading or its URL; a salon's own page names a town but is about one shop. There was no
 * page whose subject was a place, which is the shape of the query.
 *
 * ## The registry is deliberately much larger than the published set
 *
 * `lib/places.ts` names all twenty dzongkhags and eighteen Thimphu neighbourhoods. Four of
 * those have a salon today. **Publishing the other thirty-four as indexable pages is the
 * thing not to do** — a page per town with no inventory is a doorway page, and Google
 * treats a network of them as a domain-level violation rather than a per-page one.
 *
 * So the rule is one line, applied in three places that cannot disagree because they all
 * read the same function:
 *
 * - `publishedPlaces()` decides what `app/sitemap.ts` lists.
 * - The same predicate decides `robots` here: a place with no salons answers
 *   `noindex, follow`.
 * - The copy in `lib/place-copy.ts` is composed from the salons themselves, so a page that
 *   *is* published says something true and specific about its own inventory rather than
 *   being a template with a place name substituted in.
 *
 * The registered-but-empty pages still render, and that is not a contradiction: they are
 * reachable from a breadcrumb or a guessed URL, `noindex` keeps them out of the index, and
 * the day a salon in Punakha is approved the page indexes itself at the next revalidation
 * with no code change and no new file.
 *
 * ## One catch-all, not two routes
 *
 * `[...place]` serves both depths. A town is one segment, a neighbourhood is two, and the
 * second must actually belong to the first — `/salons/paro/norzin-lam` is not a place, so
 * it 404s rather than rendering Paro's salons under a Thimphu street's name.
 */

export const revalidate = 3600;

type Resolved = { place: Place; town: Place; canonical: string };

/** The place a path names, or `null`. Also the guard against a mismatched pair. */
function resolve(segments: string[]): Resolved | null {
  if (segments.length === 0 || segments.length > 2) return null;

  const [first, second] = segments;
  const town = placeBySlug(first);
  if (!town || town.kind !== "dzongkhag") return null;

  if (second === undefined) {
    return { place: town, town, canonical: `/salons/${town.slug}` };
  }

  const area = placeBySlug(second);
  // The area has to be *in* this town. Without this check `/salons/paro/norzin-lam` would
  // render a Thimphu street under Paro — a URL that invents a place.
  if (!area || area.kind !== "area" || area.parent !== town.slug) return null;
  return { place: area, town, canonical: `/salons/${town.slug}/${area.slug}` };
}

/** Everything both `generateMetadata` and the page need. Read once per request. */
async function load(place: Place) {
  const supabase = await createClient();
  const [all, favouriteIds, categories, categoriesByBusiness] = await Promise.all([
    fetchBusinesses(supabase, { sort: "rating" }),
    fetchMyFavouriteIds(supabase).catch(() => new Set<string>()),
    fetchCategories(supabase).catch(() => []),
    fetchAllBusinessCategories(supabase).catch(() => ({}) as Record<string, Set<string>>),
  ]);

  const salons = salonsIn(all, place);

  // Category names present among *these* salons, most common first — the input to the
  // "covering hair, barber and spa" clause. Composed from the same join the cards use.
  const counts = new Map<string, number>();
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  for (const salon of salons) {
    for (const categoryId of categoriesByBusiness[salon.id] ?? []) {
      const name = nameById.get(categoryId);
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  const categoryNames = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);

  return { all, salons, favouriteIds: [...favouriteIds], categoryNames };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ place: string[] }>;
}): Promise<Metadata> {
  const { place: segments } = await params;
  const resolved = resolve(segments);
  if (!resolved) return { title: "Salons" };

  const loaded = await load(resolved.place).catch(() => null);
  const salons: Business[] = loaded?.salons ?? [];

  if (salons.length === 0) {
    const copy = emptyPlaceCopy(resolved.place);
    return {
      title: copy.title,
      description: copy.description,
      alternates: { canonical: resolved.canonical },
      /*
        **`noindex, follow` — and `follow` is the half that matters.**

        `noindex` keeps a page with no inventory out of the index, which is the whole
        doorway-page guard. `follow` keeps its links live, so the crawl still reaches
        `/salons` and the real place pages through it. `nofollow` here would turn an empty
        page into a dead end for the crawler as well as for the reader.
      */
      robots: { index: false, follow: true },
    };
  }

  // The price floor is only needed for the description, so this read lives here rather
  // than in `load` — the page body does its own for the visible copy.
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("price")
    .in("business_id", salons.map((s) => s.id))
    .eq("is_active", true)
    .is("deleted_at", null);

  const copy = placeCopy({
    place: resolved.place,
    salons,
    categoryNames: loaded?.categoryNames ?? [],
    services: ((data ?? []) as { price: number }[]).map((s) => ({ price: Number(s.price) })),
  });

  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: resolved.canonical },
    openGraph: {
      type: "website",
      url: resolved.canonical,
      title: copy.title,
      description: copy.description,
    },
  };
}

export default async function PlacePage({
  params,
}: {
  params: Promise<{ place: string[] }>;
}) {
  const { place: segments } = await params;

  // A slug is only ever lowercase, so an upper-cased link is the same page rather than a
  // missing one — redirect instead of 404ing on a capital letter somebody typed.
  const lowered = segments.map((s) => s.toLowerCase());
  if (lowered.join("/") !== segments.join("/")) {
    const target = resolve(lowered);
    if (target) permanentRedirect(target.canonical);
  }

  const resolved = resolve(segments);
  if (!resolved) notFound();

  const { place, town, canonical } = resolved;
  const { salons, favouriteIds, categoryNames } = await load(place);

  const supabase = await createClient();
  const { data: serviceRows } =
    salons.length > 0
      ? await supabase
          .from("services")
          .select("price")
          .in("business_id", salons.map((s) => s.id))
          .eq("is_active", true)
          .is("deleted_at", null)
      : { data: [] };

  const copy =
    salons.length > 0
      ? placeCopy({
          place,
          salons,
          categoryNames,
          services: ((serviceRows ?? []) as { price: number }[]).map((s) => ({
            price: Number(s.price),
          })),
        })
      : emptyPlaceCopy(place);

  const trail = [
    { name: "Salons", path: "/salons" },
    ...(place.kind === "area" ? [{ name: town.name, path: `/salons/${town.slug}` }] : []),
    { name: place.name, path: canonical },
  ];

  // Sibling areas that have salons — internal links between the pages a reader is most
  // likely to want next, and the only thing linking a town page to its neighbourhoods.
  const siblingAreas =
    place.kind === "dzongkhag"
      ? areasOf(place.slug)
          .map((area) => ({ area, count: salonsIn(salons, area).length }))
          .filter((entry) => entry.count > 0)
      : [];

  return (
    <div className="px-base py-lg tablet:px-lg w-full">
      {salons.length > 0 ? (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: jsonLdScript(
                salonListSchema({
                  name: copy.h1,
                  description: copy.description,
                  path: canonical,
                  salons,
                }),
              ),
            }}
          />
          {copy.faq.length > 0 ? (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: jsonLdScript(faqSchema(copy.faq, canonical)),
              }}
            />
          ) : null}
        </>
      ) : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbSchema(trail)) }}
      />

      <header className="mb-lg">
        <nav aria-label="Breadcrumb" className="mb-sm">
          <ol className="text-caption text-muted gap-xxs flex flex-wrap items-center font-medium">
            {trail.slice(0, -1).map((crumb) => (
              <li key={crumb.path} className="gap-xxs flex items-center">
                <Link href={crumb.path} className="hover:text-ink">
                  {crumb.name}
                </Link>
                <Icons.chevronRight
                  style={{ width: IconSize.xxs, height: IconSize.xxs }}
                  aria-hidden
                />
              </li>
            ))}
            <li aria-current="page" className="text-ink">
              {place.name}
            </li>
          </ol>
        </nav>

        <h1 className="text-display-xl text-ink font-semibold">{copy.h1}</h1>
        <p className="text-body-md text-body mt-xs max-w-[52rem]">{copy.intro}</p>
      </header>

      {salons.length > 0 ? (
        <>
          <h2 className="text-display-md text-ink mb-md font-semibold">
            {salons.length === 1
              ? `1 salon in ${placeLabel(place)}`
              : `${salons.length} salons in ${placeLabel(place)}`}
          </h2>
          <SalonGrid businesses={salons} favouriteIds={favouriteIds} />
        </>
      ) : (
        <p className="text-body-md text-body">
          <Link href="/salons" className="text-rausch-cta font-medium">
            Browse every salon in Bhutan
          </Link>
        </p>
      )}

      {siblingAreas.length > 0 ? (
        <section className="mt-xl" aria-labelledby="areas-heading">
          <h2 id="areas-heading" className="text-display-md text-ink mb-md font-semibold">
            Areas of {place.name}
          </h2>
          <ul className="gap-sm flex flex-wrap">
            {siblingAreas.map(({ area, count }) => (
              <li key={area.slug}>
                <Link
                  href={`/salons/${place.slug}/${area.slug}`}
                  className="border-hairline text-body-sm text-ink hover:bg-surface-soft px-base py-xs inline-flex rounded-full border font-medium"
                >
                  {area.name}
                  <span className="text-muted ml-1">({count})</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {copy.faq.length > 0 ? <PlaceFaq items={copy.faq} place={placeLabel(place)} /> : null}

      <section className="mt-xl" aria-labelledby="elsewhere-heading">
        <h2 id="elsewhere-heading" className="text-display-md text-ink mb-md font-semibold">
          Salons elsewhere in Bhutan
        </h2>
        <ul className="gap-sm flex flex-wrap">
          {["thimphu", "paro", "phuentsholing"]
            .filter((slug) => slug !== town.slug)
            .map((slug) => placeBySlug(slug))
            .filter((p): p is Place => p !== null)
            .map((other) => (
              <li key={other.slug}>
                <Link
                  href={`/salons/${other.slug}`}
                  className="border-hairline text-body-sm text-ink hover:bg-surface-soft px-base py-xs inline-flex rounded-full border font-medium"
                >
                  Salons in {other.name}
                </Link>
              </li>
            ))}
          <li>
            <Link
              href="/salons"
              className="border-hairline text-body-sm text-ink hover:bg-surface-soft px-base py-xs inline-flex rounded-full border font-medium"
            >
              All salons in Bhutan
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
