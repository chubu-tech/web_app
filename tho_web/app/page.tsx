import { MapPin, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccount } from "@/lib/session";
import { cn } from "@/lib/utils";

/**
 * Foundations proof, not the real Discover screen.
 *
 * This exists to show the whole Phase 1 stack working end to end against the
 * live database: the cookie-bound server client reads real salons with no
 * session at all (RLS lets `anon` see approved, active businesses), the ported
 * design tokens render, and role resolution reports who is asking.
 *
 * Phase 2 replaces it with the ported Discover screen.
 */
export default async function Home() {
  const account = await getAccount();
  const supabase = await createClient();

  const [{ data: salons, error }, { data: ratings }] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, name, city, cover_url, plan")
      .eq("status", "approved")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name")
      .limit(12),
    supabase.from("business_rating_summary").select("*"),
  ]);

  const ratingBy = new Map(
    (ratings ?? []).map((r) => [
      r.business_id as string,
      { rating: Number(r.avg_rating), count: Number(r.review_count ?? 0) },
    ]),
  );

  return (
    <main className="mx-auto w-full max-w-[1128px] px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-caption-sm text-muted font-semibold tracking-[0.16em] uppercase">
            Tho · Phase 1
          </p>
          <h1 className="text-display-xl mt-1 font-bold">Foundations are up</h1>
          <p className="text-body-md text-body mt-2 max-w-prose">
            Reading the live <code className="font-mono">bsalons</code> database
            with the publishable key and no session — exactly what a first-time
            visitor gets.
          </p>
        </div>
        <span
          className={cn(
            "text-caption rounded-full px-3 py-2 font-semibold",
            account.state === "registered"
              ? "bg-success-soft text-success-text"
              : "bg-surface-strong text-muted",
          )}
        >
          {account.state === "registered"
            ? `Signed in · ${account.role}`
            : account.state === "guest"
              ? "Guest session"
              : "No session"}
        </span>
      </header>

      {error ? (
        <p className="text-error-text text-body-md mt-6">
          Could not reach the database: {error.message}
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {(salons ?? []).map((salon) => {
            const summary = ratingBy.get(salon.id as string);
            const featured = salon.plan === "growth" || salon.plan === "pro";
            return (
              <li
                key={salon.id as string}
                className="shadow-card overflow-hidden rounded-md"
              >
                <div className="bg-surface-strong aspect-[4/3] w-full">
                  {salon.cover_url ? (
                    // Plain <img> on the proof page. next/image host
                    // allow-listing arrives with the real salon card in Phase 2.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={salon.cover_url as string}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-title font-semibold">
                      {salon.name as string}
                    </h2>
                    {summary && summary.count > 0 ? (
                      <span className="text-caption inline-flex shrink-0 items-center gap-1 font-medium tabular-nums">
                        <Star
                          className="text-star size-3.5 fill-current"
                          aria-hidden
                        />
                        {summary.rating.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-body-sm text-muted mt-1 inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {(salon.city as string) ?? "Bhutan"}
                    {featured && (
                      <span className="text-rausch ml-1 font-medium">
                        Featured
                      </span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-body-sm text-muted-soft mt-8">
        Next: the customer app — Discover, search, salon detail and the booking
        flow. See <code className="font-mono">AGENTS.md</code>.
      </p>
    </main>
  );
}
