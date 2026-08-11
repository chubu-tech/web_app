/**
 * Where this app is served from, and the one place that answers it.
 *
 * Everything SEO needs an absolute origin: `metadataBase` resolves relative `openGraph`
 * URLs against it, `alternates.canonical` has to be absolute to mean anything to a
 * crawler, `sitemap.xml` lists absolute URLs by spec, and `robots.txt` names the sitemap
 * by absolute URL. Next has no built-in notion of it, so without this every one of those
 * is either missing or wrong.
 *
 * ## The shape, and why it mirrors `../landing_page`
 *
 * That repo already solved the same problem in the other direction —
 * `brand.appUrl` there points *here*, from `NEXT_PUBLIC_APP_URL` with a localhost
 * fallback. This is its mirror, and the three rules are the same ones, for the same
 * reasons:
 *
 * - **`||`, not `??`.** A declared-but-blank `NEXT_PUBLIC_SITE_URL=` is a common CI
 *   accident, and `??` lets `""` through — which would make every canonical a bare path
 *   and every `og:image` resolve against nothing.
 * - **Trailing slashes are stripped here**, at the one point the raw value enters the
 *   app, because somebody will eventually paste `https://app.example.com/` into a host
 *   dashboard and `//salon/x` is not a URL this app serves.
 * - **A direct `process.env.X` access.** Next inlines only that literal form; a
 *   destructure or a `getEnv()` indirection compiles to `undefined` in the browser
 *   bundle.
 *
 * ## The one real risk
 *
 * `NEXT_PUBLIC_*` is inlined at **build** time. Forget to set it on the deploy host and
 * every canonical, OG URL and sitemap entry points at `localhost:3000` — with a clean
 * lint and a green build, and nothing in the codebase able to catch it. Set it before
 * the first production build. Setting it afterwards and re-deploying the *same* build
 * does nothing; the old origin is already compiled in.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

/** An absolute URL for a path this app serves. `path` must start with `/`. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

/**
 * The routes a crawler may index, expressed as what it may **not**.
 *
 * A marketplace has two kinds of page and only one of them belongs in an index. The
 * public half — Discover, a salon, a stylist, the map — is the reason this app has SEO
 * at all. The other half is somebody's account, and it is listed here rather than left
 * to `noindex` alone because a crawler that has to fetch a page to learn it is private
 * is a crawler spending its budget on 25 signed-out redirects.
 *
 * **`/business` and `/staff` are role shells**, not customer pages: every route under
 * them refuses anyone without the role, so there is nothing there to rank.
 *
 * `/q/` is the printed-QR target. It is excluded deliberately and it is *not* an
 * oversight to revisit: `../landing_page`'s sitemap says the same thing about its own
 * `/q/<id>` — a join form is a utility page, not content, and letting it rank for a
 * salon's name would put a queue form above that salon's actual page.
 */
export const DISALLOWED_PATHS = [
  "/api/",
  "/auth/",
  "/sign-in",
  "/sign-up",
  "/business",
  "/staff",
  "/bookings",
  "/cart",
  "/messages",
  "/notifications",
  "/orders",
  "/profile",
  "/q/",
  "/queue/",
  "/rewards",
  "/saved",
] as const;
