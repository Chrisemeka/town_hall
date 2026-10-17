// Screenshots for the PDF report, fetched server-side.
//
// A server that fetches whatever URL a row holds is an SSRF waiting for the
// day something else writes that row. submitTestResult writes these today, but
// only our own public screenshots bucket is fetched regardless: anything else
// becomes the document's caption, the same as a failed fetch.

export type ReportImage = { data: Buffer; format: "png" | "jpg" }

const TIMEOUT_MS = 5000
const PARALLEL = 6

/** Whether `url` is in our own public screenshots bucket. */
export function isOwnScreenshot(url: string, supabaseUrl: string | undefined): boolean {
  if (!supabaseUrl) return false
  try {
    const u = new URL(url)
    const base = new URL(supabaseUrl)
    return u.origin === base.origin && u.pathname.startsWith("/storage/v1/object/public/screenshots/")
  } catch {
    return false
  }
}

/** PNG or JPEG by magic bytes — all react-pdf embeds. Anything else is null. */
export function imageFormat(bytes: Uint8Array): ReportImage["format"] | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png"
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg"
  return null
}

async function fetchOne(url: string): Promise<ReportImage | null> {
  if (!isOwnScreenshot(url, process.env.NEXT_PUBLIC_SUPABASE_URL)) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return null
    const data = Buffer.from(await res.arrayBuffer())
    const format = imageFormat(data)
    return format ? { data, format } : null
  } catch {
    return null
  }
}

/** URL → image, or null for anything that could not be included. Never throws. */
export async function fetchScreenshots(urls: string[]): Promise<Map<string, ReportImage | null>> {
  const out = new Map<string, ReportImage | null>()
  const queue = [...new Set(urls)]
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      for (let url = queue.shift(); url !== undefined; url = queue.shift()) out.set(url, await fetchOne(url))
    }),
  )
  return out
}
