/**
 * Every screenshot format a tester may upload, and how the PDF report embeds
 * it. The upload schema's accepted types are this map's keys, and
 * lib/reportImages.ts switches over its values exhaustively — so a format
 * cannot be accepted at upload without the PDF knowing what to do with it.
 * react-pdf embeds PNG and JPEG only; WebP is converted to JPEG there.
 */
export const SCREENSHOT_FORMATS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const

export type ScreenshotFormat = (typeof SCREENSHOT_FORMATS)[keyof typeof SCREENSHOT_FORMATS]

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

type ReportShots = { screenshot_urls?: string[] | null; screenshot_url?: string | null }
type EntryShots = { step_index: number; screenshot_urls?: string[] | null }

/** One step's own screenshots. Absent on every entry filed before 20261101_01. */
export function entryScreenshots(entry: { screenshot_urls?: string[] | null }): string[] {
  return entry.screenshot_urls ?? []
}

/**
 * Every screenshot on a report, each with the step it belongs to (1-based) or
 * null for a report-level one: report-level first, then each step's in step
 * order. For surfaces that list a report's screenshots without its steps.
 */
export function labelledScreenshots(
  row: ReportShots,
  entries?: EntryShots[] | null,
): { url: string; step: number | null }[] {
  return [
    ...screenshotList(row).map((url) => ({ url, step: null })),
    ...[...(entries ?? [])]
      .sort((a, b) => a.step_index - b.step_index)
      .flatMap((e) => entryScreenshots(e).map((url) => ({ url, step: e.step_index + 1 }))),
  ]
}

/** Every screenshot on a report, for counts, caps and cleanup. */
export function allScreenshots(row: ReportShots, entries?: EntryShots[] | null): string[] {
  return labelledScreenshots(row, entries).map((s) => s.url)
}

/**
 * Storage object paths for every screenshot on the given rows, for cleanup when
 * a submission or project is deleted — the steps' too, or deleting a report
 * would orphan them in the bucket. Rows carrying both the legacy column and
 * the array are de-duplicated by `screenshotList` picking one or the other.
 */
export function storagePathsFor(
  rows: (ReportShots & { test_result_entries?: EntryShots[] | null })[],
): string[] {
  const marker = "/screenshots/"
  return rows
    .flatMap((r) => allScreenshots(r, r.test_result_entries))
    .map((url) => {
      const i = url.indexOf(marker)
      return i === -1 ? null : url.slice(i + marker.length)
    })
    .filter((p): p is string => !!p)
}
