import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,

  // Tree-shake lucide-react: hanya import ikon yang dipakai, bukan seluruh library
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 3600,
  },
};

export default nextConfig;
