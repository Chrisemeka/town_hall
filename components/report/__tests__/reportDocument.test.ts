import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { ReportDocument } from "@/components/report/ReportDocument"
import { buildReport } from "@/lib/report"
import { ENTRY_STATUS_HINTS } from "@/lib/vocabulary"
import type { ScreenshotResult } from "@/lib/reportImages"
import { entry, FIVE, FLOW, report, STEPS, TESTER } from "@/lib/__tests__/reportFixtures"

// A real PDF, rendered and read back as text. Asserting on the model alone
// would miss anything the document adds on its own — which is exactly where
// a name would sneak in.

async function render(rows = FIVE, oneMission = true, images: Map<string, ScreenshotResult> | null = null) {
  const el = createElement(ReportDocument, { report: buildReport(rows, oneMission), images })
  return renderToBuffer(el as unknown as React.ReactElement<DocumentProps>)
}

/** Every page's text, whitespace collapsed so a wrapped line still matches. */
async function textOf(pdf: Buffer): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(pdf), useSystemFonts: false }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent()
    pages.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "))
  }
  return pages.join("\n").replace(/\s+/g, " ")
}

describe("a one-mission report", () => {
  it("carries the mission, every step and every tester", async () => {
    const text = await textOf(await render())
    expect(text).toContain("First impressions")
    for (const s of STEPS) expect(text).toContain(s.action)
    for (let n = 1; n <= 5; n++) expect(text).toContain(`Tester ${n}`)
    expect(text).toContain("4 of 5 testers: Unclear")
    expect(text).toContain("Page 1 of")
  }, 30_000)

  it("labels the AI summary as machine-written", async () => {
    const text = await textOf(await render())
    expect(text).toMatch(/AI-generated summary — written by a model/i)
    expect(text).toContain("The tester found the audience unclear.")
  }, 30_000)

  it("contains no tester name, email or id — read off the PDF's own text", async () => {
    // The fixtures carry all three on every row. A PDF cannot be unshared.
    const pdf = await render(FIVE, false)
    const text = await textOf(pdf)
    expect(text).not.toContain(TESTER.name)
    expect(text).not.toContain(TESTER.email)
    expect(text).not.toContain(TESTER.id)
    // Nor in the metadata, which text extraction does not cover.
    expect(pdf.toString("latin1")).not.toContain(TESTER.name)
  }, 30_000)

  it("renders the snapshot it was given, not the mission's current wording", async () => {
    const rows = [report("a", "2026-10-02T09:00:00Z", [entry(1, "fail", { step_action: "Who is this for, in a word?" })])]
    const text = await textOf(await render(rows))
    expect(text).toContain("Who is this for, in a word?")
    expect(text).not.toContain(STEPS[1].action)
  }, 30_000)
})

describe("labels follow the category", () => {
  it("Clear / Unclear / Couldn't tell on ui_design, Pass / Fail / Blocked elsewhere", async () => {
    const design = await textOf(await render())
    expect(design).toMatch(/Unclear/)
    expect(design).toMatch(/Couldn.t tell/)
    expect(design).not.toMatch(/· Fail\b/)

    const flow = await textOf(await render(FIVE.map((r) => ({ ...r, missions: FLOW }))))
    expect(flow).toContain("4 of 5 testers: Fail")
    expect(flow).not.toContain("Unclear")
  }, 30_000)
})

describe("screenshots", () => {
  const URL_A = "https://abc.supabase.co/storage/v1/object/public/screenshots/a.png"
  const withShot = [report("a", "2026-10-02T09:00:00Z", [entry(0, "pass")], { screenshot_urls: [URL_A] })]
  // A 1×1 PNG.
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  )

  it("off: no image in the file, and no caption either", async () => {
    const pdf = await render(withShot, true, null)
    expect(pdf.toString("latin1")).not.toContain("/Subtype /Image")
    expect(await textOf(pdf)).not.toMatch(/Screenshot|screenshots? couldn/)
  }, 30_000)

  it("on: the image is embedded", async () => {
    const pdf = await render(withShot, true, new Map([[URL_A, { data: PNG, format: "png" as const }]]))
    expect(pdf.toString("latin1")).toContain("/Subtype /Image")
  }, 30_000)

  it("a broken image is a caption naming its cause, never a broken box", async () => {
    const pdf = await render(withShot, true, new Map([[URL_A, { failed: "format" as const }]]))
    expect(pdf.toString("latin1")).not.toContain("/Subtype /Image")
    expect(await textOf(pdf)).toContain("Screenshot format not supported in PDF.")
  }, 30_000)

  it("every image failing still renders, with the count on the cover", async () => {
    const urls = ["a", "b", "c"].map((k) => `https://abc.supabase.co/storage/v1/object/public/screenshots/${k}.webp`)
    const rows = [report("a", "2026-10-02T09:00:00Z", [entry(0, "pass")], { screenshot_urls: urls })]
    const images = new Map<string, ScreenshotResult>([
      [urls[0], { failed: "unavailable", detail: "HTTP 404" }],
      [urls[1], { failed: "network" }],
      [urls[2], { failed: "foreign" }],
    ])
    const text = await textOf(await render(rows, true, images))
    expect(text).toContain("3 of 3 screenshots couldn't be included")
    expect(text.match(/Screenshot could not be loaded\./g)).toHaveLength(2)
    expect(text).toContain("Screenshot left out — not stored by Twnhall.")
  }, 30_000)
})

describe("every mission", () => {
  it("is one document with a contents page and a section per mission", async () => {
    const rows = [...FIVE, report("f1", "2026-10-06T09:00:00Z", [entry(0, "fail")], { mission_id: "m-flow", missions: FLOW })]
    const text = await textOf(await render(rows, false))
    expect(text).toContain("All tests")
    expect(text).toContain("In this report")
    expect(text).toContain("First impressions")
    expect(text).toContain("Checkout flow")
    expect(text).toContain("1 of 1 tester: Fail")
  }, 30_000)
})

describe("the front, for a reader who has never heard of Twnhall", () => {
  it("opens by saying what happened, on one mission and on every mission", async () => {
    expect(await textOf(await render())).toContain("Five people were asked to try Recipe Book")
    const rows = [...FIVE, report("f1", "2026-10-06T09:00:00Z", [entry(0, "fail")], { mission_id: "m-flow", missions: FLOW })]
    expect(await textOf(await render(rows, false))).toContain("In two separate tests, people were asked to try Recipe Book")
  }, 30_000)

  it("leads each finding with its sentence, the count after it", async () => {
    const text = await textOf(await render())
    const sentence = text.indexOf("Four of the five people said this did not come across the way it was meant to.")
    expect(sentence).toBeGreaterThan(-1)
    expect(text.indexOf("4 of 5 testers: Unclear", sentence)).toBeGreaterThan(sentence)
  }, 30_000)

  it("quotes the functional hints on a functional test", async () => {
    const text = await textOf(await render(FIVE.map((r) => ({ ...r, missions: FLOW }))))
    for (const hint of Object.values(ENTRY_STATUS_HINTS)) expect(text).toContain(hint)
  }, 30_000)

  it("carries no rating of any kind", async () => {
    expect(await textOf(await render())).not.toMatch(/\brat(ing|ed)\b|\/ 5/i)
  }, 30_000)

  it("explains only words the document uses, every one of them outside the glossary", async () => {
    const model = buildReport(FIVE, true)
    const text = await textOf(await render())
    const body = text.slice(0, text.lastIndexOf("What the words mean")).toLowerCase()
    for (const g of model.glossary) expect(body).toContain(g.term.toLowerCase())
  }, 30_000)
})
