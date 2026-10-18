// Screenshots for the PDF report, fetched server-side.
//
// A server that fetches whatever URL a row holds is an SSRF waiting for the
// day something else writes that row. submitTestResult writes these today, but
// only our own public screenshots bucket is fetched regardless: anything else
// becomes the document's caption, the same as a failed fetch.

import sharp from "sharp"
import type { ScreenshotFormat } from "@/lib/utils/screenshots"

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

const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))

/**
 * An accepted upload format by magic bytes, or null. Never the Content-Type or
 * the extension: both came from the tester's device.
 */
export function imageFormat(bytes: Uint8Array): ScreenshotFormat | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png"
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg"
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp"
  return null
}

/**
 * Bytes react-pdf can embed — PNG or JPEG — or null. Exhaustive over
 * SCREENSHOT_FORMATS: accepting a new upload format without saying here how
 * it embeds is a type error.
 */
export async function toEmbeddable(data: Buffer): Promise<ReportImage | null> {
  const format = imageFormat(data)
  switch (format) {
    case null:
      return null
    case "png":
    case "jpg":
      return { data, format }
    case "webp":
      // JPEG, not PNG: forty phone screenshots as PNG is a 50 MB PDF, and the
      // WebP is lossy already. Flattened, or a transparent area turns black.
      try {
        return { data: await sharp(data).flatten({ background: "#ffffff" }).jpeg({ quality: 85 }).toBuffer(), format: "jpg" }
      } catch {
        return null
      }
    default: {
      const unhandled: never = format
      return unhandled
    }
  }
}

async function fetchOne(url: string): Promise<ReportImage | null> {
  if (!isOwnScreenshot(url, process.env.NEXT_PUBLIC_SUPABASE_URL)) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return null
    return await toEmbeddable(Buffer.from(await res.arrayBuffer()))
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
