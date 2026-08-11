import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
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
