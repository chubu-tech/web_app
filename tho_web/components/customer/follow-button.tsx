"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setFollowStaff } from "@/lib/api/staff";
import { ensureGuestSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Follow / Following on a specialist's profile, ported from
 * `staff_profile_screen.dart:172`.
 *
 * **A guest may follow, and that is deliberate.** `follows_insert` requires only
 * `follower_profile_id = auth.uid()` — no `private.is_real_user()` — so following sits
 * on the favourites side of the line rather than the booking side: nobody is committed
 * to anything, no salon has to answer, and because upgrading a guest keeps the same
 * user id, what they followed survives signing up. So `ensureGuestSession` at press
 * time, and **no wall**.
 *
 * **The count moves with the button.** It has to live here rather than on the server
 * page: the number and the pressed state are one fact, and a server-rendered count
 * beside a client button would disagree with itself for as long as the page stayed
 * open. Optimistic, and **rolled back together on failure** — the app does the same
 * (`staff_profile_screen.dart:47`), because a button reading "Following" after the
 * write failed is a lie about something the stylist can see.
 */
export function FollowButton({
  staffId,
  name,
  initialFollowing,
  initialFollowers,
  reviewCount,
}: {
  staffId: string;
  name: string;
  initialFollowing: boolean;
  initialFollowers: number;
  /**
   * Rendered here rather than by the page even though it never changes: the app puts
   * the two counts side by side (`staff_profile_screen.dart:146`), and one of them is
   * client state. Splitting them across the boundary would mean two components
   * agreeing on typography and spacing by hand.
   */
  reviewCount: number;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [followers, setFollowers] = useState(initialFollowers);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !following;
    setFollowing(next);
    setFollowers((n) => Math.max(0, n + (next ? 1 : -1)));

    startTransition(async () => {
      try {
        const supabase = createClient();
        const user = await ensureGuestSession(supabase);
        if (!user) throw new Error("no session");
        await setFollowStaff(supabase, staffId, next);
      } catch {
        setFollowing(!next);
        setFollowers((n) => Math.max(0, n + (next ? -1 : 1)));
        toast.error(next ? `Couldn't follow ${name}.` : `Couldn't unfollow ${name}.`);
      }
    });
  }

  return (
    <div className="flex flex-col items-center">
      <div className="gap-xl flex items-center">
        <Stat value={followers} label="Followers" />
        <Stat value={reviewCount} label="Reviews" />
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
        className={cn(
          "text-title mt-md min-h-12 rounded-full px-8 font-medium",
          following
            ? "bg-rausch-cta text-on-primary hover:bg-rausch-cta-pressed"
            : "border-rausch text-rausch-cta hover:bg-rausch/10 border",
        )}
      >
        {following ? "Following" : "Follow"}
      </button>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="text-display-sm text-ink font-medium tabular-nums">{value}</span>
      <span className="text-body-sm text-muted">{label}</span>
    </span>
  );
}
