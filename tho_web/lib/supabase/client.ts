import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client. Publishable (anon) key — safe to ship: RLS is the gate and
 * every write goes through an RPC that authorises the caller server-side.
 *
 * Reads work with no session at all, which is what lets a visitor browse salons
 * before signing in. See `lib/auth.ts` for why a guest session is created lazily
 * rather than on arrival.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
