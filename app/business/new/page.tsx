import type { Metadata } from "next";
import { CreateSalonForm } from "@/components/owner/create-salon-form";
import { getOwnerContext } from "@/lib/owner/context";

export const metadata: Metadata = { title: "Add a salon" };

/**
 * Create a salon — a port of `_CreateBusiness` in `business_home.dart`.
 *
 * **No `NoSalonYet` branch here**, deliberately: this is the one owner route that is *for*
 * someone with no salon, and the gate in `getOwnerContext` has already established that they
 * are an owner. It is equally reachable by an owner adding a second shop, from the switcher.
 *
 * Three fields, matching the app, and no more — everything that decides money or visibility
 * takes its column default (`basic`, `pending`), which is what `20260804000004` guarantees by
 * keeping `plan` and `status` out of the INSERT grant.
 */
export default async function NewSalonPage() {
  const { businesses } = await getOwnerContext();
  return <CreateSalonForm isFirst={businesses.length === 0} />;
}
