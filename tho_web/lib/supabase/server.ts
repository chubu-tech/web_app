import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server client bound to the request's cookie jar.
 *
 * Uses the publishable (anon) key, which grants nothing on its own: RLS guards
 * every table and every write goes through a SECURITY DEFINER RPC that
 * authorises the caller itself. There is no service-role client in this app.
 */
export async function createClient() {
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
}
