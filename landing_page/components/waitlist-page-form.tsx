"use client";

import { useSearchParams } from "next/navigation";
import { readSource } from "@/lib/waitlist";
import { WaitlistForm } from "./waitlist-form";

/**
 * The `/waitlist` form, reading `?src=` in the browser.
 *
 * Resolving the query on the server would make the route `ƒ` — rendered per
 * request — and this site is served as static files. `useSearchParams` inside
 * a Suspense boundary keeps the page prerendered: the HTML ships from the CDN,
 * and the source is filled in during hydration. Nobody can submit before that
 * happens, so nothing is lost by resolving it a moment late.
 */
export function WaitlistPageForm({ className }: { className?: string }) {
  const source = readSource(useSearchParams().get("src"));
  return <WaitlistForm source={source} className={className} />;
}
