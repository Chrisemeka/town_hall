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
  // /guidelines predates the v2 testing model and is gone — the page is
  // deleted, not left behind this. The redirect stays permanently for traffic
  // we do not control: anything already linking or bookmarked, and the search
  // results the old page still holds.
  async redirects() {
    return [
      {
        source: "/guidelines",
        destination: "/guides",
        permanent: true,
      },
    ];
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