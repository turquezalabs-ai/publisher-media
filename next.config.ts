import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel handles output automatically — no "standalone" needed
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // Allow images from external domains (if needed for banners)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lottong-pinoy.com',
      },
    ],
  },
};

export default nextConfig;
