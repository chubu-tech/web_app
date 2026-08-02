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
    ],
  },
};

export default nextConfig;
