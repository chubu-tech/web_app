"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Icons, IconSize } from "@/components/ui/icons";
import { ensureGuestSession } from "@/lib/auth";
import { setFavourite } from "@/lib/api/favourites";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * The save heart, ported from the favourite affordance on `BusinessCard` and the
 * salon hero.
 *
 * Optimistic, and **rolls back on failure** — the app does the same
 * (`customer_home.dart:364`), because a heart that stays filled after the write
 * failed tells someone their salon is saved when it is not.
 *
 * Saving is one of only two things a guest may do. `ensureGuestSession` is called
 * **here**, at the first action that needs an identity, never on page load: each
 * anonymous sign-in mints a real `auth.users` row, and doing it eagerly on a public
 * site would create one per crawler hit. Because an upgrade keeps the same user id,
 * whatever a guest saves survives signing up — which is the whole reason the guest
 * tier exists.
 */
export function FavouriteButton({
  businessId,
  name,
  initial,
  variant = "card",
}: {
  businessId: string;
  name: string;
  initial: boolean;
  /** `card` is the small disc over a cover; `hero` matches the detail controls. */
  variant?: "card" | "hero";
}) {
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      try {
        const supabase = createClient();
        const user = await ensureGuestSession(supabase);
        if (!user) throw new Error("no session");
        await setFavourite(supabase, businessId, next);
      } catch {
        setSaved(!next);
        toast.error(
          next ? `Couldn't save ${name}.` : `Couldn't remove ${name} from saved.`,
        );
      }
    });
  }

  const size = variant === "hero" ? IconSize.sm : IconSize.xs;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`}
      className={cn(
        "bg-canvas/92 shadow-card flex items-center justify-center rounded-full",
        variant === "hero" ? "size-11 backdrop-blur-sm" : "size-9",
      )}
    >
      <Icons.favourite
        style={{ width: size, height: size }}
        strokeWidth={saved ? 2.4 : 1.9}
        className={cn(saved ? "text-rausch fill-current" : "text-ink")}
        aria-hidden
      />
    </button>
  );
}
