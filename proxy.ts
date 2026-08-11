import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SESSION_ENDED_COOKIE } from "@/lib/session-timeout";

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

  /*
    Did this request arrive holding a session?

    Read **before** `getUser()`, because that call is what destroys the evidence: on a
    refresh token the Auth server rejects, `@supabase/ssr` clears the auth cookies onto the
    response, so by the time a page renders there is nothing left to distinguish *"their
    session just died"* from *"they never had one"*. Those two need opposite treatment — one
    deserves an explanation, the other is an ordinary first visit — and this is the only
    place in the request where both facts are available at once.

    Matched on the cookie *name* pattern rather than a constant: `@supabase/ssr` derives it
    from the project ref and chunks large tokens with a `.0`/`.1` suffix.
  */
  const arrivedWithSession = request.cookies
    .getAll()
    .some((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name) && c.value.length > 0);

  // Refreshes the token when there is one, and writes it back onto the
  // response. A missing session is normal here, not an error.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (arrivedWithSession && !user) {
    /*
      The session was real and is now gone — expired, revoked, or signed out elsewhere.

      A short-lived breadcrumb rather than a redirect, because this proxy must not redirect:
      the app is public, and a customer whose session lapsed while reading a salon page
      should keep reading it. What this does is let the surfaces that *do* require an
      account say why they are asking again — see `sessionEndedRedirect`.

      60 seconds is deliberately brief. It only has to survive the redirect it triggers, and
      a stale breadcrumb would explain a session that ended an hour ago. It is not
      `httpOnly`, carries no identity, and says nothing an attacker could not already
      observe by watching their own session end.
    */
    response.cookies.set(SESSION_ENDED_COOKIE, "1", {
      path: "/",
      maxAge: 60,
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
