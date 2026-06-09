import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Screenshots are validated at 5 MB (MAX_SCREENSHOT_BYTES). The default
      // Server Action body limit is 1 MB, which would reject valid uploads
      // before our validation runs — raise it to leave headroom for the file
      // plus comment and multipart overhead.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;