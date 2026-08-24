import type { NextConfig } from "next";

const imageCdn = process.env.NEXT_PUBLIC_IMAGE_CDN?.trim();
const imageHostname = imageCdn
  ? new URL(
      /^https?:\/\//i.test(imageCdn) ? imageCdn : `https://${imageCdn}`,
    ).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: imageHostname
    ? {
        remotePatterns: [
          {
            protocol: "https",
            hostname: imageHostname,
          },
        ],
      }
    : undefined,
};

export default nextConfig;
