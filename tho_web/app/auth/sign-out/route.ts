import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  ACTIVE_BUSINESS_COOKIE,
  ACTIVE_BUSINESS_COOKIE_OPTIONS,
} from "@/lib/owner/active-business";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign out, on the server.
 *
 * ## Why this exists at all
 *
 * Sign-out used to be a client `auth.signOut()` inside a button, and that button was rendered by
 * exactly one file — `app/(customer)/profile/page.tsx`. The owner console has no `/profile` and
 * nothing links to one, so **an owner had no reachable way out of it**. That is the bug this route
 * is here to fix, and putting the work on the server rather than adding a second button fixes two
 * more things at the same time.
 *
 * ## `tho_active_business` can only be cleared from here
 *
 * It is `httpOnly`, so browser JavaScript cannot touch it — a client-side `signOut()` was
 * *architecturally incapable* of clearing it, and nothing else ever did. It was written with a
 * one-year `maxAge`, so a shared machine at a till kept sending a previous user's salon id on every
 * request, to every route, for a year. `resolveActiveBusinessId` and RLS meant it was never a data
 * leak; it was still the exact residue a sign-out is supposed to remove.
 *
 * ## A form POST, not a fetch
 *
 * So it works before JavaScript has loaded, which is the same reason `app/business/active-salon`
 * is a route handler and the salon switcher is a form. And POST rather than GET because it changes
 * state: a `GET /auth/sign-out` would be followed by any link prefetcher or crawler that saw it.
 *
 * `next` is deliberately **not** honoured. Every other redirect in this app runs an attacker-supplied
 * `next` through `safeNext`, but there is no legitimate reason to land anywhere except the front
 * door after signing out, and the fewer parameters this route reads the less there is to get wrong.
 */
export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin;

  // The server client writes the auth cookies through this same store, so signing out and clearing
  // the salon happen in one response rather than two round trips.
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  // `set(…, maxAge: 0)` rather than `delete(name)`: deletion has to match the path and protocol the
  // cookie was written with, and repeating the write's own attributes is what guarantees that.
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, "", {
    ...ACTIVE_BUSINESS_COOKIE_OPTIONS,
    maxAge: 0,
  });

  // 303 so the browser follows with GET — this was a form POST.
  return NextResponse.redirect(new URL("/", origin), { status: 303 });
}
