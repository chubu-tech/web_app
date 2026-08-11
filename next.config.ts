import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /*
      From `landing_page/next.config.ts`, and it is load-bearing rather than cosmetic.

      Next 16 changed `images.qualities` from "allow anything" to `[75]`, and an unlisted
      `quality` prop is **coerced to the nearest allowed value rather than rejected** — see
      `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`. The marketing
      hero's `quality={68}` compiled, linted, built and served `q=75` for a while precisely
      because this list was missing. Anything that sets `quality` must be listed here.
    */
    qualities: [68, 75],
    /**
     * `next/image` refuses any host not listed here, so this is an allow-list of
     * everywhere a salon photo can legitimately come from.
     *
     * - **The Supabase project host** is the only one an owner can produce: the app
     *   uploads to storage and stores the URL or path, so every cover, staff photo,
     *   service image, review photo and booking attachment lands here.
     * - **`images.unsplash.com`** is seed data — 25 live rows across covers, staff,
     *   services, products and the one salon gallery. Listed so the catalogue
     *   renders today; it can come out once real photos replace them.
     *
     * The path is `/storage/v1/object/**`, deliberately **not** `.../object/public/**`.
     * A reference photo lives in the private `booking-media` bucket and is read through
     * a signed URL under `/object/sign/…`; restricting to `public` meant `next/image`
     * threw `Invalid src prop` *during render*, which took the whole booking page down
     * rather than degrading — `onError` cannot catch a render-time throw. Found by
     * attaching a real photo and loading the booking.
     *
     * An unlisted host still degrades gracefully: the request 400s at load time, the
     * browser fires `error`, and `CoverImage`/`Avatar` fall back to the monogram.
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "izlyevebmxqlxinigote.supabase.co",
        pathname: "/storage/v1/object/**",
      },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  /*
    The merge left two privacy policies on one domain: the marketing site's `/privacy`,
    which the app-store listings point at and crawlers index, and the product's
    `/legal/privacy`, a sibling of `/legal/terms` and `/legal/content-policy`.

    One canonical document, at the URL the stores already carry. A 308 rather than a
    rendered page, so in-product links keep working with no second copy to maintain — and
    permanent because it is: the marketing URL is the published one.

    `/legal/terms` and `/legal/content-policy` are untouched; only the duplicate moves.
  */
  async redirects() {
    return [{ source: "/legal/privacy", destination: "/privacy", permanent: true }];
  },

  /*
    From the marketing site's config, and it has to come with `public/.well-known/`.

    iOS refuses an Associated Domains file that is not served as JSON, and the file has no
    extension, so nothing infers the type. Android's `assetlinks.json` needs no rule — its
    extension is enough.

    Without this, universal links fail silently: the OS fetches the file, cannot parse it,
    and opens the URL in a browser instead of the app. `netlify.toml` carries the same rule
    for the Netlify CDN, which serves `public/` without going through Next at all.
  */
  async headers() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
};

export default nextConfig;
