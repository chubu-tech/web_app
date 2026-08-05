import { createClient } from "@supabase/supabase-js";
import { waitlist } from "./content";

/**
 * The waitlist submit — and **the one runtime network call this site makes**.
 *
 * `AGENTS.md` says this page is statically served with no runtime calls, and
 * that stayed true for the salon index: it is read at build time and inlined.
 * A signup cannot be. So the divergence is deliberate and bounded to exactly
 * this: nothing happens on load, on scroll or on navigation — only when
 * somebody presses the button.
 *
 * It goes to Supabase from the browser rather than through a Next Route
 * Handler, for the same reason there are no API routes: a handler would make
 * the site need a server, and the whole page would stop being a static file.
 * The publishable key is already in the client bundle, and RLS is the gate —
 * `app_waitlist` has RLS on with **no policies at all**, so this key cannot
 * read the list, only call the one function below.
 *
 * `join_app_waitlist` is where the real validation lives (see the migration in
 * tho). The check here is the fast one that saves a round trip on an obvious
 * typo; it is not the authority and must never be treated as one.
 */

/** Outcome of a submit. `already` is a success, not a failure. */
export type WaitlistResult =
  | { ok: true; status: "joined" | "already" }
  | { ok: false; message: string };

/**
 * Which call to action produced a signup, stored on the row as `source`.
 * Analytics, not behaviour — nothing branches on it.
 */
export type WaitlistSource =
  | "download_button"
  | "app_store"
  | "google_play"
  | "header"
  | "pricing"
  | "qr"
  | "waitlist_page";

const SOURCES = new Set<string>([
  "download_button",
  "app_store",
  "google_play",
  "header",
  "pricing",
  "qr",
  "waitlist_page",
]);

/**
 * Narrow a `?src=` value to a known source.
 *
 * The query string is attacker-controlled and this value is written to the
 * database, so it is matched against the list rather than trusted. Anything
 * unrecognised becomes `waitlist_page` — the honest answer for "arrived at the
 * page by some other route".
 */
export function readSource(raw: string | null | undefined): WaitlistSource {
  return raw && SOURCES.has(raw) ? (raw as WaitlistSource) : "waitlist_page";
}

/**
 * A deliberately loose format check, mirroring the database constraint.
 *
 * The only email validation that is ever fully correct is sending one, and
 * every clever regex rejects somebody's real address. This catches "no @ at
 * all" and "nothing after the dot", which is the whole population of mistakes
 * a form can usefully catch before the round trip.
 */
export function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length >= 6 &&
    trimmed.length <= 254 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(trimmed)
  );
}

/** Client-side pre-check. Returns the message to show, or null when it passes. */
export function validateEmail(value: string): string | null {
  if (value.trim().length === 0) return waitlist.errors.empty;
  if (!looksLikeEmail(value)) return waitlist.errors.invalid;
  return null;
}

/**
 * The one function this site may call, typed by hand.
 *
 * `lib/salons.ts` gets away with an untyped client because it only uses
 * `.from()`. `.rpc()` is stricter: with no schema generic, supabase-js infers
 * the argument type as `undefined` and refuses every call. Rather than
 * generate the whole `Database` type for a marketing site that touches one
 * function, this declares that function — which doubles as the contract, right
 * next to the code that depends on it.
 *
 * Mirrors `join_app_waitlist` in
 * `tho/supabase/migrations/20260805000002_app_waitlist.sql`.
 */
type WaitlistSchema = {
  Tables: Record<string, never>;
  Views: Record<string, never>;
  Functions: {
    join_app_waitlist: {
      Args: { p_email: string; p_source?: string | null };
      Returns: { status: "joined" | "already" };
    };
  };
  Enums: Record<string, never>;
  CompositeTypes: Record<string, never>;
};

type WaitlistDatabase = { public: WaitlistSchema };

/**
 * A browser client, created once and only when somebody actually submits.
 *
 * `persistSession: false` matters: this site has no accounts, and without it
 * supabase-js writes a session entry to localStorage on every visitor who
 * touches the form.
 */
let client: ReturnType<typeof createClient<WaitlistDatabase>> | null = null;

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  client ??= createClient<WaitlistDatabase>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export async function joinWaitlist(
  email: string,
  source: WaitlistSource,
): Promise<WaitlistResult> {
  const local = validateEmail(email);
  if (local) return { ok: false, message: local };

  const supabase = getClient();
  // Missing env vars must not throw in a visitor's face. The build already
  // tolerates them being absent (see `getSalonIndex`); so does this.
  if (!supabase) return { ok: false, message: waitlist.errors.failed };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, message: waitlist.errors.offline };
  }

  try {
    const { data, error } = await supabase.rpc("join_app_waitlist", {
      p_email: email.trim(),
      p_source: source,
    });

    if (error) {
      // 22023 is the function's own "you typed something that isn't an
      // address" — its message is written for a visitor, so show it. Anything
      // else is ours to own, not theirs to read.
      return {
        ok: false,
        message: error.code === "22023" ? error.message : waitlist.errors.failed,
      };
    }

    return { ok: true, status: data?.status === "already" ? "already" : "joined" };
  } catch {
    return { ok: false, message: waitlist.errors.failed };
  }
}
