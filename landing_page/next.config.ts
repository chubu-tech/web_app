import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /*
      Next 16 changed `images.qualities` from "allow anything" to `[75]`, and an unlisted
      `quality` prop is **coerced to the nearest allowed value rather than rejected** — see
      `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`. So the hero's
      `quality={68}` compiled, linted, built and served `q=75` with no warning anywhere; it
      was caught only by reading the emitted `srcset`. Anything setting `quality` has to be
      listed here or it does nothing at all.

      68 is the hero, the LCP element, and the reasoning for that number is at its call site.
      75 stays because it is the default every other image on the site uses.
    */
    qualities: [68, 75],
    // Placeholder marketing photography. Once real salon photos land in
    // `public/photos/`, this allow-list can go away entirely.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        // Real salon cover photos, uploaded by owners to Supabase storage.
        protocol: "https",
        hostname: "izlyevebmxqlxinigote.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  /**
   * iOS refuses an Associated Domains file that is not served as JSON, and the
   * file must have no extension — so nothing infers the type for us. Android's
   * `assetlinks.json` needs no rule; its `.json` extension is enough.
   *
   * Both files live in `public/.well-known/`. Without this header, universal
   * links fail silently: the OS fetches the file, cannot parse it, and simply
   * opens the URL in a browser instead of the app.
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
