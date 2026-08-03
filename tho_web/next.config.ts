import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * `next/image` refuses any host not listed here, so this is an allow-list of
     * everywhere a salon photo can legitimately come from.
     *
     * - **The Supabase project host** is the only one an owner can produce: the app
     *   uploads to storage and stores the public URL, so every future cover, staff
     *   photo, service image and review photo lands here.
     * - **`images.unsplash.com`** is seed data — 25 live rows across covers, staff,
     *   services, products and the one salon gallery. Listed so the catalogue
     *   renders today; it can come out once real photos replace them.
     *
     * Anything else degrades rather than breaking: the request 400s, the browser
     * fires `error`, and `CoverImage`/`Avatar` fall back to the gradient monogram.
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "izlyevebmxqlxinigote.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
