export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        // Allow the landing page and the public legal/community pages.
        // `/$` anchors the root exactly; the others match those paths and any
        // sub-paths (none today, but safe to leave open).
        allow: ['/$', '/privacy', '/terms', '/guidelines'],
        // Block everything else (dashboard, explore, admin, mission, settings, api, …).
        disallow: '/',
      },
    ],
    sitemap: 'https://twnhall.com/sitemap.xml',
    host: 'https://twnhall.com',
  }
}
