"use client";

import { usePathname } from "next/navigation";
import { GuideLauncher } from "./guide-launcher";

/**
 * The guide button on the **public** pages, where the audience is a guess rather than a
 * fact.
 *
 * Inside the product the shell knows who is reading: the customer layout mounts the
 * customer guide, the console mounts the owner one. Out here nobody has signed in, so the
 * page is the only evidence there is — and there is exactly one page addressed to salons.
 * `/for-salons` is the sales pitch for the console (it already carries a written "How THO
 * works for a salon" section, which this plays), so it gets the owner walkthrough; the
 * homepage, the waitlist and the policy documents all get the customer one.
 *
 * A route test rather than a prop per page: `(marketing)` is one layout over seven routes,
 * and passing the audience down would mean each new marketing page choosing again — and
 * defaulting wrong by omission.
 *
 * Matched exactly rather than by prefix, for the reason `placement.ts` spells out about
 * `/salon` and `/salons`: a future `/for-salons-pricing` is a different page, and inheriting
 * the owner walkthrough by accident is the failure mode a prefix test always has.
 */
export function MarketingGuideLauncher() {
  const pathname = usePathname();
  const audience = pathname === "/for-salons" ? "owner" : "customer";
  return <GuideLauncher audience={audience} />;
}
