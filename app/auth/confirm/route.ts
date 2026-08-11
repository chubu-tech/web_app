import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { homeForRole, type Role } from "@/lib/auth";
import { DEFAULT_NEXT, safeNext } from "@/lib/next-path";

/**
 * Where the confirmation email lands.
 *
 * This is the piece a sheet cannot provide, and the reason sign-up needed a real
 * route: Supabase mails a link, the person clicks it in their mail client, and it has
 * to arrive somewhere that can exchange the token for a session and set the cookie.
 *
 * On success they are already signed in, so they go straight to wherever they were
 * headed. On failure they go to `/sign-in` with a reason rather than a blank page —
 * an expired link is the common case, and "try signing in" is the right next step.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"));

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/sign-in?confirm=missing", url.origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(new URL("/sign-in?confirm=failed", url.origin));
  }

  // Same rule as `landAfterAuth`: an explicit `?next=` wins, and the role only picks
  // the default. Without this an owner confirming their email arrived on the customer
  // side — the one sign-in path that used to skip the role check entirely, because a
  // mail client's link carries no memory of who is behind it.
  let destination = next;
  if (destination === DEFAULT_NEXT && data.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    destination = homeForRole((profile?.role as Role | undefined) ?? "customer");
  }

  // `next` is already reduced to a same-origin path by `safeNext`; resolving it
  // against our own origin means a crafted link cannot turn the confirmation
  // endpoint into a redirector.
  return NextResponse.redirect(new URL(destination, url.origin));
}
