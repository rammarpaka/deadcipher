import type { NextConfig } from "next";

const imageCdn = process.env.NEXT_PUBLIC_IMAGE_CDN;

const nextConfig: NextConfig = {
  images: imageCdn
    ? {
        remotePatterns: [
          {
            protocol: "https",
            hostname: new URL(imageCdn).hostname,
          },
        ],
      }
    : undefined,
};

export default nextConfig;
