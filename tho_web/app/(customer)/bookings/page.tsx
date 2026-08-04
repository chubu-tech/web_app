import type { Metadata } from "next";
import Link from "next/link";
import { BookingsList } from "@/components/customer/bookings-list";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { fetchMyBookings } from "@/lib/api/booking";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My bookings" };

export default async function BookingsPage() {
  const account = await getAccount();

  // A guest can hold favourites but never a booking — `private.is_real_user()`
  // refuses `create_booking` — so this page has nothing to fetch for them. Say so
  // rather than showing an empty list that looks like data loss.
  if (account.state !== "registered") {
    return (
      <Shell>
        <EmptyState
          icon={Icons.booking}
          title="Sign in to see your bookings"
          message="Your appointments live with your account, so they're on every device you sign in on."
          action={
            <Link
              href="/sign-in?next=/bookings"
              className="bg-rausch-cta text-on-primary text-title hover:bg-rausch-cta-pressed inline-flex min-h-12 items-center rounded-sm px-4 font-medium"
            >
              Sign in
            </Link>
          }
        />
      </Shell>
    );
  }

  const supabase = await createClient();
  // The id is passed rather than left to RLS: `bookings_select` OR-matches business
  // membership, so an owner would otherwise see their salon's whole book here.
  const bookings = await fetchMyBookings(supabase, account.user.id).catch(() => []);

  return (
    <Shell>
      <BookingsList bookings={bookings} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-base py-lg mx-auto w-full max-w-[1128px] tablet:px-lg">
      <h1 className="text-display-lg text-ink mb-lg font-medium">My bookings</h1>
      {children}
    </div>
  );
}
