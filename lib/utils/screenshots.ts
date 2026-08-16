/**
 * Read the screenshots off a test_result row.
 *
 * Submissions used to carry a single `screenshot_url`; they now carry a
 * `screenshot_urls` array. The migration backfills old rows, but this fallback
 * keeps pre-migration rows (and any deploy that lands before the migration is
 * applied) rendering instead of showing an empty strip.
 */
export function screenshotList(row: {
  screenshot_urls?: string[] | null
  screenshot_url?: string | null
}): string[] {
  if (row.screenshot_urls?.length) return row.screenshot_urls
  return row.screenshot_url ? [row.screenshot_url] : []
}

/**
 * Storage object paths for every screenshot on the given rows, for cleanup when
 * a submission or project is deleted. Rows carrying both the legacy column and
 * the array are de-duplicated by `screenshotList` picking one or the other.
 */
export function storagePathsFor(
  rows: { screenshot_urls?: string[] | null; screenshot_url?: string | null }[],
): string[] {
  const marker = "/screenshots/"
  return rows
    .flatMap(screenshotList)
    .map((url) => {
      const i = url.indexOf(marker)
      return i === -1 ? null : url.slice(i + marker.length)
    })
    .filter((p): p is string => !!p)
}
