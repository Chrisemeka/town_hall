export default function sitemap() {
  // Legal pages were last revised alongside the onboarding flow update.
  const legalLastModified = new Date('2026-05-25')

  return [
    {
      url: 'https://twnhall.com',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://twnhall.com/guidelines',
      lastModified: legalLastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
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
