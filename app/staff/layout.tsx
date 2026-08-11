import type { Metadata } from "next";
import { StaffHeader } from "@/components/staff/staff-nav";
import { IdleTimeout } from "@/components/ui/idle-timeout";
import { getStaffContext } from "@/lib/staff/context";

export const metadata: Metadata = { title: "My day" };

/**
 * The staff shell — the third role-scoped shell, and the smallest.
 *
 * It renders on the **editorial** token layer, like every other shell. This comment used to
 * say the opposite — that a stylist at work belongs on the product layer with the console —
 * and that reasoning went when the console moved too: one product should not present three
 * canvases depending on who signed in. `data-shell="owner"` rather than a `staff` value
 * because the scope block matches on the attribute's *presence*, and this header is the
 * console's `tone`, so it keeps the console's label.
 *
 * `getStaffContext` is called here **and** in each page. That is not a double read — it is
 * `cache`d for the request, so the header's name and the page's bookings resolve from one
 * `staff_members` row. It is also where the redirects live, which is why the layout calls it
 * at all: a stylist who is not signed in, or an owner who lands here, is sent on before any
 * of this renders.
 */
export default async function StaffLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { me } = await getStaffContext();

  return (
    <div data-shell="owner" className="bg-canvas flex min-h-full flex-col">
      <StaffHeader displayName={me?.displayName ?? null} />
      <main className="flex-1">{children}</main>

      {/* Same idle cut as the owner console — a stylist's shell runs on the same shared
          machine. See `lib/session-timeout.ts`. */}
      <IdleTimeout />
    </div>
  );
}
