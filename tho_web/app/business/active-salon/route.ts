import { NextResponse, type NextRequest } from "next/server";
import { fetchMyBusinesses } from "@/lib/api/owner";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/owner/active-business";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Switch which salon the console is showing.
 *
 * A route handler rather than a Server Action purely because it is a redirect with a
 * cookie on it and nothing else — there is no form state to keep, and this way the
 * switcher is an ordinary link that works before any JavaScript has loaded.
 *
 * **The id is checked against what the caller owns before it is written.** The cookie is
 * `httpOnly`, so a browser cannot set it, but a request can — and a cookie naming someone
 * else's salon would make the console *look* switched while every read came back empty.
 * `resolveActiveBusinessId` covers the same case on the way out; refusing to write it in
 * the first place means the console never briefly claims a salon it cannot show.
 *
 * RLS is still the authority: even a cookie that got through would return no rows.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const account = await getAccount();

  if (account.state !== "registered" || account.role !== "owner") {
    return NextResponse.redirect(new URL("/", url.origin), { status: 303 });
  }

  const form = await request.formData();
  const requested = form.get("businessId");

  const supabase = await createClient();
  const owned = await fetchMyBusinesses(supabase, account.user.id);
  const valid =
    typeof requested === "string" && owned.some((b) => b.id === requested);

  // 303 so the browser follows with GET — this was a form POST.
  const response = NextResponse.redirect(new URL("/business", url.origin), {
    status: 303,
  });

  if (valid) {
    response.cookies.set(ACTIVE_BUSINESS_COOKIE, requested as string, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      // A year: which salon you were last looking at is a preference, not a session, and
      // an owner who signs back in on Monday expects the same shop.
      maxAge: 60 * 60 * 24 * 365,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}
