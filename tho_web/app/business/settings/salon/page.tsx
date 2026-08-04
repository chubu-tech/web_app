import type { Metadata } from "next";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { SalonProfileForm } from "@/components/owner/salon-profile-form";
import { fetchCategories } from "@/lib/api/discovery";
import { fetchBusinessCategoryIds } from "@/lib/api/owner-setup";
import { fetchBusinessPhotos } from "@/lib/api/salon";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Salon details" };

/**
 * Everything about the salon itself — a port of `business_settings_tab.dart`'s five
 * accordion groups, as one page with real section headings.
 *
 * The app collapses them because a phone screen cannot hold the lot; a browser can, and
 * scrolling past a heading is cheaper than opening five disclosures to find one field. What is
 * *not* here is what the app moved out of this tab as well: Plans, Loyalty, Payroll, Tax and
 * the client book are all 3c.
 *
 * Every field this writes is inside `businesses`' UPDATE grant. `plan`, `status`, `is_active`,
 * `suspended_at`, the review columns and `timezone` are not, since `20260804000004` — which is
 * the check that migration exists to pass.
 */
export default async function OwnerSalonProfilePage() {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const supabase = await createClient();
  const [categories, categoryIds, photos] = await Promise.all([
    fetchCategories(supabase),
    fetchBusinessCategoryIds(supabase, active.id),
    fetchBusinessPhotos(supabase, active.id),
  ]);

  return (
    <SalonProfileForm
      business={active}
      categories={categories}
      initialCategoryIds={categoryIds}
      initialPhotos={photos}
    />
  );
}
