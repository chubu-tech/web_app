import { createClient } from "@supabase/supabase-js";
import { placeOf } from "../places";

/**
 * The salon index, read once at build time and prerendered into the page.
 *
 * This is the site's only data dependency. Everything read here is anon-readable
 * by Row-Level Security in the `tho` project — approved, active businesses and
 * their services, categories, opening hours and ratings — so the publishable key
 * is all it takes and there is nothing to authorise.
 *
 * Fetched at build (plus ISR) rather than in the browser, deliberately: the
 * whole payload is a few kilobytes for a few dozen salons, so search stays
 * instant and the page stays statically served with no loading state.
 *
 * If the fetch fails or the env vars are missing, this returns an empty index
 * and the page renders without the salon sections. A marketing site must not
 * fail to build because a database was briefly unreachable.
 */

export type SalonHours = {
  /** 0 = Sunday, matching `business_hours.day_of_week`. */
  day: number;
  /** Minutes from midnight, so comparisons are plain arithmetic. */
  openMin: number;
  closeMin: number;
};

export type Salon = {
  id: string;
  name: string;
  /**
   * The town this salon is really in — **derived, not the `city` column.**
   *
   * `businesses.city` disagrees with `address_text` on seven of the ten live salons, and
   * the coordinates side with the address every time: `Norzin Salon & Spa` on Norzin Lam
   * is filed under Paro, `Lotus Spa & Wellness` on Doebum Lam under Phuentsholing, and
   * `Paro Glow Beauty Lounge` — whose pin is in the Paro valley — under Thimphu.
   *
   * That column fed two things a visitor sees: this field, which the search band's
   * "Where" dropdown filters on by exact string equality, and the location line on every
   * salon card. So the homepage was **offering Paro as a filter and returning Thimphu
   * salons under it**, and telling every reader and every crawler that six shops were in
   * towns they are not in.
   *
   * `placeOf` resolves from coordinates first and the owner-typed address second and
   * returns null rather than guessing — rendered as "Bhutan", which is the honest answer
   * for a salon nobody can place. `lib/api/mappers.ts` reached the same conclusion for
   * the product side and omits `city` from `Business` entirely; this is that decision
   * applied to the one surface that still needs a town name.
   */
  city: string | null;
  /** As the owner typed it. The input `placeOf` reads, and the card's second line. */
  addressText: string | null;
  lat: number | null;
  lng: number | null;
  coverUrl: string | null;
  plan: "basic" | "growth" | "pro";
  genderFocus: string | null;
  rating: number | null;
  reviewCount: number;
  /** Category names from `business_categories` — the real taxonomy. */
  categories: string[];
  /** Service names as the salon typed them. */
  services: string[];
  hours: SalonHours[];
};

export type Treatment = { name: string; salonCount: number };
export type TreatmentGroup = {
  category: string;
  salonCount: number;
  treatments: Treatment[];
};
export type CityOption = { name: string; salonCount: number };

export type SalonIndex = {
  salons: Salon[];
  groups: TreatmentGroup[];
  cities: CityOption[];
  professionals: number;
};

export const EMPTY_INDEX: SalonIndex = {
  salons: [],
  groups: [],
  cities: [],
  professionals: 0,
};

/**
 * Seed and smoke-test rows that exist in the live database.
 *
 * The operator console can approve anything, and a salon called "Test 2" is
 * currently live. This site is public, so obvious placeholders are dropped here
 * rather than shown to visitors. Suspending them in the console is the real fix;
 * this is the safety net.
 */
const PLACEHOLDER_NAME = /^(test|demo|sample|asdf|xxx)\b|^test\s*\d*$/i;

function toMinutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":");
  const hours = Number(h);
  const mins = Number(m);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  return hours * 60 + mins;
}

export async function getSalonIndex(): Promise<SalonIndex> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn(
      "[salons] NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY not set — the salon sections will be empty.",
    );
    return EMPTY_INDEX;
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // RLS already restricts `businesses` to approved + active, but say it out
    // loud: this query's result set is the site's public surface.
    const [
      businesses,
      ratings,
      services,
      businessCategories,
      categories,
      hours,
      staff,
    ] = await Promise.all([
      supabase
        .from("businesses")
        .select(
          "id, name, city, address_text, lat, lng, cover_url, plan, gender_focus, is_active, status",
        )
        .eq("status", "approved")
        .eq("is_active", true)
        .is("deleted_at", null),
      supabase.from("business_rating_summary").select("*"),
      supabase
        .from("services")
        .select("business_id, name")
        .eq("is_active", true)
        .is("deleted_at", null),
      supabase.from("business_categories").select("business_id, category_id"),
      supabase.from("categories").select("id, name"),
      supabase
        .from("business_hours")
        .select("business_id, day_of_week, open_time, close_time"),
      supabase
        .from("staff_members")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

    if (businesses.error) throw businesses.error;

    const rows = (businesses.data ?? []).filter(
      (b) => b.name && !PLACEHOLDER_NAME.test(b.name.trim()),
    );

    const ratingBy = new Map(
      (ratings.data ?? []).map((r) => [
        r.business_id as string,
        {
          rating: r.avg_rating == null ? null : Number(r.avg_rating),
          count: Number(r.review_count ?? 0),
        },
      ]),
    );

    const categoryName = new Map(
      (categories.data ?? []).map((c) => [c.id as string, c.name as string]),
    );

    const categoriesBy = new Map<string, string[]>();
    for (const link of businessCategories.data ?? []) {
      const name = categoryName.get(link.category_id as string);
      if (!name) continue;
      const list = categoriesBy.get(link.business_id as string) ?? [];
      if (!list.includes(name)) list.push(name);
      categoriesBy.set(link.business_id as string, list);
    }

    const servicesBy = new Map<string, string[]>();
    for (const row of services.data ?? []) {
      const name = (row.name as string | null)?.trim();
      if (!name) continue;
      const list = servicesBy.get(row.business_id as string) ?? [];
      if (!list.includes(name)) list.push(name);
      servicesBy.set(row.business_id as string, list);
    }

    const hoursBy = new Map<string, SalonHours[]>();
    for (const row of hours.data ?? []) {
      const openMin = toMinutes(row.open_time as string | null);
      const closeMin = toMinutes(row.close_time as string | null);
      if (openMin == null || closeMin == null) continue;
      const list = hoursBy.get(row.business_id as string) ?? [];
      list.push({ day: Number(row.day_of_week), openMin, closeMin });
      hoursBy.set(row.business_id as string, list);
    }

    const salons: Salon[] = rows.map((b) => {
      const summary = ratingBy.get(b.id as string);
      const lat = b.lat == null ? null : Number(b.lat);
      const lng = b.lng == null ? null : Number(b.lng);
      const addressText = (b.address_text as string | null)?.trim() || null;
      // Derived, never `b.city` — see the note on `Salon.city`.
      const { town } = placeOf({ addressText, lat, lng });
      return {
        id: b.id as string,
        name: (b.name as string).trim(),
        city: town?.name ?? null,
        addressText,
        lat,
        lng,
        coverUrl: (b.cover_url as string | null) || null,
        plan: ((b.plan as string) || "basic") as Salon["plan"],
        genderFocus: (b.gender_focus as string | null) || null,
        rating: summary?.rating ?? null,
        reviewCount: summary?.count ?? 0,
        categories: categoriesBy.get(b.id as string) ?? [],
        services: (servicesBy.get(b.id as string) ?? []).sort((a, c) =>
          a.localeCompare(c),
        ),
        hours: (hoursBy.get(b.id as string) ?? []).sort((a, c) => a.day - c.day),
      };
    });

    // Treatment groups come from `business_categories`, not `service_catalog`:
    // only 2 of 31 live services carry a `catalog_id`, so a catalogue join would
    // match almost nothing. Categories are properly assigned, and the service
    // names underneath them are real, so the dropdown is built from what the
    // salons have actually filled in.
    const groupMap = new Map<string, { salons: Set<string>; services: Map<string, Set<string>> }>();
    for (const salon of salons) {
      for (const category of salon.categories) {
        const group =
          groupMap.get(category) ?? { salons: new Set<string>(), services: new Map() };
        group.salons.add(salon.id);
        for (const service of salon.services) {
          const holders = group.services.get(service) ?? new Set<string>();
          holders.add(salon.id);
          group.services.set(service, holders);
        }
        groupMap.set(category, group);
      }
    }

    const groups: TreatmentGroup[] = [...groupMap.entries()]
      .map(([category, group]) => ({
        category,
        salonCount: group.salons.size,
        treatments: [...group.services.entries()]
          .map(([name, holders]) => ({ name, salonCount: holders.size }))
          .sort((a, b) => b.salonCount - a.salonCount || a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => b.salonCount - a.salonCount || a.category.localeCompare(b.category));

    const cityMap = new Map<string, number>();
    for (const salon of salons) {
      if (!salon.city) continue;
      cityMap.set(salon.city, (cityMap.get(salon.city) ?? 0) + 1);
    }
    const cities: CityOption[] = [...cityMap.entries()]
      .map(([name, salonCount]) => ({ name, salonCount }))
      .sort((a, b) => b.salonCount - a.salonCount || a.name.localeCompare(b.name));

    return {
      salons: salons.sort((a, b) => a.name.localeCompare(b.name)),
      groups,
      cities,
      professionals: staff.count ?? 0,
    };
  } catch (error) {
    console.warn(
      "[salons] Could not load the salon index; rendering without it.",
      error,
    );
    return EMPTY_INDEX;
  }
}
