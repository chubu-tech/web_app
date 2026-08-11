import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Session refresh only.
 *
 * Next 16 renamed Middleware to Proxy; the behaviour is unchanged.
 *
 * Deliberately different from the operator console's proxy, which redirects
 * every unauthenticated request to `/login`. This app is public: a visitor
 * arriving from a search result or a QR code must be able to browse salons
 * before they have any account. Route protection lives in the role layouts
 * instead — `app/(customer)`, `app/business`, `app/staff` — and the real gate is
 * always RLS plus the RPC's own authorisation.
 *
 * It also does **not** create a guest session. `signInAnonymously()` mints a real
 * `auth.users` row, and doing that per uncredentialed request would fill the
 * table with one junk user per crawler hit. The Flutter app can be eager about
 * it because an install is a person; on the open web the session is created
 * lazily, at the first action that actually needs an identity. See
 * `ensureGuestSession` in `lib/auth.ts`.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshes the token when there is one, and writes it back onto the
  // response. A missing session is normal here, not an error.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
