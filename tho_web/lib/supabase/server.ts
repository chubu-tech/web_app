import { cookies } from "next/headers";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";

/**
 * Server client bound to the request's cookie jar.
 *
 * Uses the publishable (anon) key, which grants nothing on its own: RLS guards
 * every table and every write goes through a SECURITY DEFINER RPC that
 * authorises the caller itself. There is no service-role client in this app.
 *
 * ## `cache()` — one client per request, and it is a latency fix
 *
 * Measured on `/salon/[id]` before this: **five** clients constructed per request, and
 * `getAccount` alone accounted for three of them. Constructing one is cheap, but each
 * carries its **own auth state**, so `supabase.auth.getUser()` on a fresh client cannot
 * reuse what a sibling already fetched — and `getUser()` is a network round trip to the
 * Auth server, timed at **~1.2 s cold** on this project. Three clients meant three of them.
 *
 * React's `cache()` memoises per request, so every caller in one render now shares one
 * client and therefore one validated user. This is what Supabase's own SSR guidance
 * assumes; the app was constructing per call site instead.
 *
 * Sharing is safe because the scope is a single request: `cache()` does not persist across
 * requests, so no session can leak from one visitor to another. A mutation of the shared
 * client's session — `ensureGuestSession` signing in anonymously — is *better* shared, as
 * later callers in the same render then see the session that was just created rather than
 * re-reading a cookie jar that has not been written back yet.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // `proxy.ts` refreshes the session, so this is safe to swallow.
          }
        },
      },
    },
  );
});
