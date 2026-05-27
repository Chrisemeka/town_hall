export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Block authenticated/private areas. Everything else (landing page,
        // legal pages, sitemap.xml) stays crawlable.
        disallow: [
          '/api/',
          '/admin',
          '/dashboard',
          '/explore',
          '/mission/',
          '/settings',
          '/terms-accept',
        ],
      },
    ],
    sitemap: 'https://twnhall.com/sitemap.xml',
    host: 'https://twnhall.com',
  }
}
