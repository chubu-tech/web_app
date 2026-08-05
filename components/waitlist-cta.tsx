"use client";

import { waitlist } from "@/lib/content";
import type { WaitlistSource } from "@/lib/waitlist";
import { Button } from "./ui/button";
import { useWaitlist } from "./waitlist-provider";

/**
 * A download call to action, in its pre-launch form: it opens the waitlist
 * rather than pointing at a store that has nothing to serve.
 *
 * The thin client wrapper exists so the bands that use it — the header, the
 * pricing panel, the download band — can stay server components. Only the
 * button needs the hook.
 */
export function WaitlistCta({
  source,
  variant,
  size,
  className,
  children,
}: {
  source: WaitlistSource;
  variant?: "primary" | "ink" | "ghost" | "light";
  size?: "md" | "lg";
  className?: string;
  children?: React.ReactNode;
}) {
  const { open } = useWaitlist();

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => open(source)}
    >
      {children ?? waitlist.cta}
    </Button>
  );
}
