export default function sitemap() {
  const lastModified = new Date()

  return [
    {
      url: 'https://twnhall.com',
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://twnhall.com/guidelines',
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: 'https://twnhall.com/privacy',
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: 'https://twnhall.com/terms',
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
