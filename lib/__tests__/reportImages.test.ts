import { createElement } from "react"
import { describe, expect, it } from "vitest"
import sharp from "sharp"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { ReportDocument } from "@/components/report/ReportDocument"
import { buildReport } from "@/lib/report"
import { imageFormat, toEmbeddable, type ReportImage } from "@/lib/reportImages"
import { SCREENSHOT_FORMATS } from "@/lib/utils/screenshots"
import { ALLOWED_SCREENSHOT_TYPES } from "@/lib/validation/schemas"
import { entry, report } from "@/lib/__tests__/reportFixtures"

// Real images, made by sharp, through the real conversion — a fake byte
// prefix proves the sniffing and nothing about whether react-pdf embeds it.

const canvas = () => sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 128, b: 255, alpha: 0.5 } } })

/** One encoder per accepted upload type. A type missing here fails the drift test. */
const ENCODE: Record<string, () => Promise<Buffer>> = {
  "image/png": () => canvas().png().toBuffer(),
  "image/jpeg": () => canvas().jpeg().toBuffer(),
  "image/webp": () => canvas().webp().toBuffer(),
}

describe("every accepted upload format embeds in the PDF", () => {
  it("upload and PDF read one map", () => {
    expect([...ALLOWED_SCREENSHOT_TYPES].sort()).toEqual(Object.keys(SCREENSHOT_FORMATS).sort())
  })

  it.each(Object.keys(SCREENSHOT_FORMATS))("%s comes out as PNG or JPEG", async (type) => {
    expect(ENCODE[type], `no fixture for ${type} — and does the PDF embed it?`).toBeDefined()
    const out = await toEmbeddable(await ENCODE[type]())
    expect(out).not.toBeNull()
    expect(["png", "jpg"]).toContain(imageFormat(out!.data))
    expect(out!.format).toBe(imageFormat(out!.data))
  })

  it("an undecodable WebP is left out, not thrown", async () => {
    expect(await toEmbeddable(Buffer.from("RIFF\0\0\0\0WEBPgarbage"))).toBeNull()
  })

  it("a converted WebP is an image in the rendered PDF", async () => {
    const url = "https://abc.supabase.co/storage/v1/object/public/screenshots/u/1.webp"
    const img = await toEmbeddable(await ENCODE["image/webp"]())
    const rows = [report("r1", "2026-09-02T10:00:00Z", [entry(0, "pass")], { screenshot_urls: [url] })]
    const el = createElement(ReportDocument, {
      report: buildReport(rows, true),
      images: new Map<string, ReportImage | null>([[url, img]]),
    })
    const pdf = await renderToBuffer(el as unknown as React.ReactElement<DocumentProps>)
    // What `pdfimages -list` counts: an image XObject.
    expect(pdf.toString("latin1")).toMatch(/\/Subtype \/Image/)
  })
})
