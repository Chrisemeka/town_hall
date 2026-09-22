export default function sitemap() {
  // Legal pages were last revised alongside the onboarding flow update.
  const legalLastModified = new Date('2026-05-25')
  // The public marketing pages all landed together in the Stage 1 revamp.
  const publicLastModified = new Date('2026-09-22')

  // /guidelines is deliberately absent: the page is gone and next.config.ts
  // answers the URL with a permanent redirect to /guides. Listing a redirect
  // in a sitemap asks crawlers to index a hop.
  return [
    {
      url: 'https://twnhall.com',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://twnhall.com/pricing',
      lastModified: publicLastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://twnhall.com/guides',
      lastModified: publicLastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://twnhall.com/guides/builder',
      lastModified: publicLastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://twnhall.com/guides/tester',
      lastModified: publicLastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: 'https://twnhall.com/about',
      lastModified: publicLastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: 'https://twnhall.com/contact',
      lastModified: publicLastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: 'https://twnhall.com/privacy',
      lastModified: legalLastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: 'https://twnhall.com/terms',
      lastModified: legalLastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
