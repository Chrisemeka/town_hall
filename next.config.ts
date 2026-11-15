import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Every app page is dynamic, and since Next.js 15 the client Router Cache
    // keeps dynamic pages 0 seconds, so a revisit by link re-ran the whole
    // server render (1.1-3.4 s measured, docs/perf/DIAGNOSIS-2026-11.md F2).
    // 30 s is the agreed freshness. The cache is per browser, never shared
    // between users; a Server Action that revalidates or sets a cookie
    // (every write, sign-out, account switch) clears it at once.
    staleTimes: {
      dynamic: 30,
    },
    serverActions: {
      // Screenshots are validated at 5 MB (MAX_SCREENSHOT_BYTES). The default
      // Server Action body limit is 1 MB, which would reject valid uploads
      // before our validation runs — raise it to leave headroom for the file
      // plus comment and multipart overhead.
      bodySizeLimit: "6mb",
    },
  },
  // The PDF report reads its fonts off disk (components/report/ReportDocument.tsx);
  // file tracing cannot see a path.join, so the function is told to ship them.
  outputFileTracingIncludes: {
    "/api/export/report": ["./components/report/fonts/**"],
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