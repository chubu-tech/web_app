import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
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
};

export default nextConfig;
