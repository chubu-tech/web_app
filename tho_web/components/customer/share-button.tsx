"use client";

import { toast } from "sonner";
import { ActionCircle, HeroCircleButton } from "@/components/ui/detail-bits";
import { Icons } from "@/components/ui/icons";

/**
 * Share a salon.
 *
 * The app copies name · address · phone to the clipboard
 * (`business_detail_screen.dart:230`) because a phone has no URL to share. A browser
 * does, so this shares the **link** — via the Web Share API where the platform
 * offers one, clipboard otherwise. Either way the toast says what actually happened.
 */
export function ShareButton({
  name,
  variant,
}: {
  name: string;
  variant: "hero" | "action";
}) {
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch {
        // A dismissed share sheet rejects. That is not a failure worth reporting,
        // and it must not fall through to silently copying instead.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied — paste anywhere to share.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  if (variant === "hero") {
    return <HeroCircleButton icon={Icons.share} label={`Share ${name}`} onClick={share} />;
  }
  return <ActionCircle icon={Icons.share} label="Share" onClick={share} />;
}
