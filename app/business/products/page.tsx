import type { Metadata } from "next";
import { LockedTeaser } from "@/components/owner/insight-card";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { PaywallButton } from "@/components/owner/paywall-button";
import { ProductList } from "@/components/owner/product-list";
import { fetchOwnerProducts } from "@/lib/api/owner-back-office";
import { hasFeature } from "@/lib/entitlements";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Products" };

/**
 * The salon's storefront.
 *
 * **The Growth gate here is half enforced, and the honest half is the one that matters.**
 * `products_write_owner` checks ownership and nothing else, so a Basic owner *can* create
 * products — but `products_select_public` requires `plan in ('growth','pro')`, so no customer
 * would ever see them. Writing rows into a shop nobody can visit is worse than being told the
 * shop is closed, which is why the locked state comes first.
 */
export default async function OwnerProductsPage() {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  if (!hasFeature(active.plan, "productStore")) {
    return (
      <div className="px-base py-lg mx-auto w-full max-w-[860px] tablet:px-lg">
        <h1 className="text-display-lg text-ink mb-lg font-medium">Products</h1>
        <LockedTeaser
          title="Sell products from your salon page"
          message="Customers order, you get a notification, they pay and collect at the counter. On Growth and Pro."
          action={<PaywallButton feature="productStore" label="See plans" />}
        />
      </div>
    );
  }

  const supabase = await createClient();
  const products = await fetchOwnerProducts(supabase, active.id);

  return <ProductList businessId={active.id} products={products} />;
}
