import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RedemptionCode } from "@/components/customer/redemption-code";
import { Icons, IconSize } from "@/components/ui/icons";
import { fetchMyRedemptionById } from "@/lib/api/shop";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Your reward",
  robots: { index: false, follow: false },
};

/**
 * A claimed reward, and the code that proves it.
 *
 * **Its own route, where the app pushes a screen.** A customer at the counter may well reload or come
 * back to this, and a code with no URL would be reachable only by claiming the reward again — which
 * `request_redemption` would refuse for want of points, since the first claim is already holding them.
 *
 * The read is scoped to the caller (`customer_profile_id`), so somebody else's code 404s rather than
 * rendering. `loyalty_redemptions_select` would also admit the salon's staff; that is right for the
 * owner's inbox and wrong here, which is why the filter is explicit.
 */
export default async function RewardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccount();
  if (account.state !== "registered") notFound();

  const supabase = await createClient();
  const redemption = await fetchMyRedemptionById(supabase, account.user.id, id);
  if (!redemption) notFound();

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[560px] tablet:px-lg">
      <Link
        href="/rewards"
        className="text-caption text-muted hover:text-ink gap-xs mb-md inline-flex items-center"
      >
        <Icons.back style={{ width: IconSize.xxs, height: IconSize.xxs }} aria-hidden />
        My rewards
      </Link>

      <RedemptionCode initial={redemption} userId={account.user.id} />
    </div>
  );
}
