import { describe, expect, it } from "vitest"
import {
  agreementHeadline,
  buildReport,
  findingSentence,
  legendsFor,
  REPORT_CAP,
  reportCapMessage,
  SCREENSHOT_CAP,
  screenshotCaption,
  screenshotNote,
  screenshotsMissing,
} from "@/lib/report"
import type { ScreenshotResult } from "@/lib/reportImages"
import { imageFormat, isOwnScreenshot } from "@/lib/reportImages"
import { entryStatusCopy, ENTRY_STATUS_HINTS, ENTRY_STATUSES } from "@/lib/vocabulary"
import { entry, FIVE, FLOW, report, STEPS, TESTER } from "./reportFixtures"

describe("agreement", () => {
  it("is the headline, ordered by how many testers hit the step", () => {
    const m = buildReport(FIVE, true).missions[0]
    expect(m.fixFirst.map((s) => [s.number, s.headline])).toEqual([
      [2, "4 of 5 testers: Unclear"],
      [1, "1 of 5 testers: Unclear"],
      [3, "1 of 5 testers: Couldn't tell"],
    ])
    expect(m.clean).toEqual([])
  })

  it("breaks a tie by step order", () => {
    const m = buildReport(FIVE, true).missions[0]
    // Steps 1 and 3 both have one problem.
    expect(m.fixFirst.slice(1).map((s) => s.number)).toEqual([1, 3])
  })

  it("says one of one, in the singular", () => {
    expect(agreementHeadline(["fail"], "process_flow")).toBe("1 of 1 tester: Fail")
  })

  it("reports an even split as it is", () => {
    expect(agreementHeadline(["fail", "pass", "fail", "pass"], "process_flow")).toBe("2 of 4 testers: Fail")
  })

  it("names both when fail and blocked are mixed", () => {
    expect(agreementHeadline(["fail", "blocked", "fail", "pass", "pass"], "process_flow")).toBe(
      "3 of 5 testers hit a problem — 2 Fail, 1 Blocked",
    )
  })

  it("lists clean steps in one line, and says so when every step passed", () => {
    const allPass = [report("a", "2026-10-02T09:00:00Z", [entry(0, "pass"), entry(1, "pass")])]
    const m = buildReport(allPass, true).missions[0]
    expect(m.fixFirst).toEqual([])
    expect(m.clean).toEqual([1, 2])
  })
})

describe("labels follow the category", () => {
  it("ui_design says Clear / Unclear / Couldn't tell", () => {
    const m = buildReport(FIVE, true).missions[0]
    expect(m.mix).toBe("Across 15 answers: 9 Clear · 5 Unclear · 1 Couldn't tell")
    expect(m.steps[1].answers.map((a) => a.label)).toContain("Unclear")
  })

  it("anything else says Pass / Fail / Blocked", () => {
    const rows = FIVE.map((r) => ({ ...r, missions: FLOW }))
    const m = buildReport(rows, true).missions[0]
    expect(m.fixFirst[0].headline).toBe("4 of 5 testers: Fail")
    expect(m.mix).toBe("Across 15 answers: 9 Pass · 5 Fail · 1 Blocked")
  })
})

describe("the snapshot is the record", () => {
  it("heads a step with the newest report's wording and marks the older one", () => {
    const rows = [
      report("old", "2026-10-02T09:00:00Z", [entry(1, "fail", { step_action: "Who is this for?" })]),
      report("new", "2026-10-03T09:00:00Z", [entry(1, "pass")]),
    ]
    const step = buildReport(rows, true).missions[0].steps[0]
    expect(step.action).toBe(STEPS[1].action)
    expect(step.answers[0].askedAs).toEqual({ action: "Who is this for?", expected: STEPS[1].expected })
    expect(step.answers[1].askedAs).toBeNull()
  })
})

describe("testers", () => {
  it("are numbered oldest first, and the same number throughout", () => {
    const m = buildReport(FIVE, true).missions[0]
    expect(m.testers.map((t) => t.tester)).toEqual(["Tester 1", "Tester 2", "Tester 3", "Tester 4", "Tester 5"])
    expect(m.steps[1].answers.map((a) => a.tester)).toEqual(["Tester 1", "Tester 2", "Tester 3", "Tester 4", "Tester 5"])
  })

  it("never carry a name, email or id", () => {
    const text = JSON.stringify(buildReport(FIVE, false))
    expect(text).not.toContain(TESTER.name)
    expect(text).not.toContain(TESTER.email)
    expect(text).not.toContain(TESTER.id)
  })

  it("keeps a legacy report in the closing section and out of every step count", () => {
    const rows = [...FIVE, report("legacy", "2026-10-12T09:00:00Z", [], { tester_comment: "It was fine." })]
    const m = buildReport(rows, true).missions[0]
    expect(m.fixFirst[0].headline).toBe("4 of 5 testers: Unclear")
    expect(m.testers.at(-1)).toMatchObject({ tester: "Tester 6", legacy: true, comment: "It was fine." })
  })

  it("leave the builder's ratings out of the model entirely", () => {
    // FIVE carries ratings 4 and 3. They describe the reports, not the product.
    expect(JSON.stringify(buildReport(FIVE, true))).not.toMatch(/\brat(ing|ed)\b|\/ 5/i)
  })
})

describe("the cover", () => {
  it("counts testers and the date range on one mission", () => {
    const r = buildReport(FIVE, true, new Date("2026-10-17T12:00:00Z"))
    expect(r.scope).toBe("First impressions")
    expect(r.generated).toBe("Generated 17 Oct 2026")
    expect(r.evidence).toBe("5 testers · filed 2 Oct 2026 – 11 Oct 2026")
  })

  it("covers every mission, oldest first, in one document", () => {
    const rows = [...FIVE, report("f1", "2026-10-06T09:00:00Z", [entry(0, "pass")], { mission_id: "m-flow", missions: FLOW })]
    const r = buildReport(rows, false)
    expect(r.allMissions).toBe(true)
    expect(r.scope).toBe("All tests")
    expect(r.missions.map((m) => m.title)).toEqual(["First impressions", "Checkout flow"])
    expect(r.evidence).toMatch(/^6 reports across 2 tests/)
  })
})

describe("the cap", () => {
  it("fits at the caps and refuses past them, naming the way out", () => {
    expect(reportCapMessage(REPORT_CAP, SCREENSHOT_CAP, false)).toBeNull()
    expect(reportCapMessage(REPORT_CAP + 1, 0, false)).toMatch(/choose a single mission/)
    expect(reportCapMessage(REPORT_CAP + 1, 0, true)).toMatch(/CSV export/)
    expect(reportCapMessage(1, SCREENSHOT_CAP + 1, true)).toMatch(/turn off screenshots/)
    expect(reportCapMessage(1, SCREENSHOT_CAP + 1, false)).toMatch(/single mission, or turn off screenshots/)
  })
})

describe("screenshots", () => {
  it("captions say which kind of failure it was", () => {
    expect(screenshotCaption("format")).toBe("Screenshot format not supported in PDF.")
    expect(screenshotCaption("unavailable")).toBe("Screenshot could not be loaded.")
    expect(screenshotCaption("network")).toBe("Screenshot could not be loaded.")
    expect(screenshotCaption("foreign")).toMatch(/not stored by Twnhall/)
  })

  it("counts what was left out, and says nothing when nothing was", () => {
    const ok: ScreenshotResult = { data: Buffer.from([]), format: "png" }
    const some = new Map<string, ScreenshotResult>([["a", ok], ["b", { failed: "format" }], ["c", ok]])
    expect(screenshotsMissing(null)).toBeNull()
    expect(screenshotsMissing(new Map([["a", ok]]))).toBeNull()
    expect(screenshotNote(new Map([["a", ok]]))).toBeNull()
    expect(screenshotsMissing(some)).toEqual({ failed: 1, total: 3 })
    expect(screenshotNote(some)).toBe("1 of 3 screenshots couldn't be included — each is marked where it would appear.")
    expect(screenshotNote(new Map([["a", { failed: "network" }]]))).toMatch(/^1 of 1 screenshot couldn't/)
  })

  it("reads the legacy column through screenshotList", () => {
    const old = report("r1", "2026-09-02T10:00:00Z", [entry(0, "pass")], { screenshot_url: "legacy.png" })
    expect(buildReport([old], true).missions[0].testers[0].screenshots).toEqual(["legacy.png"])
  })

  const BASE = "https://abc.supabase.co"
  it("only fetches our own public screenshots bucket", () => {
    expect(isOwnScreenshot(`${BASE}/storage/v1/object/public/screenshots/u/1.png`, BASE)).toBe(true)
    expect(isOwnScreenshot(`${BASE}/storage/v1/object/public/avatars/1.png`, BASE)).toBe(false)
    expect(isOwnScreenshot("http://169.254.169.254/storage/v1/object/public/screenshots/x", BASE)).toBe(false)
    expect(isOwnScreenshot("not a url", BASE)).toBe(false)
    expect(isOwnScreenshot(`${BASE}/storage/v1/object/public/screenshots/x.png`, undefined)).toBe(false)
  })

  it("knows PNG, JPEG and WebP by their bytes, and nothing else", () => {
    expect(imageFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe("png")
    expect(imageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg")
    expect(imageFormat(new TextEncoder().encode("RIFF....WEBP"))).toBe("webp")
    expect(imageFormat(new TextEncoder().encode("GIF89a"))).toBeNull()
  })
})

describe("the opening", () => {
  it("says what happened, to whom and when, and names a mission once", () => {
    const r = buildReport(FIVE, true)
    const text = r.opening.join(" ")
    expect(r.opening[0]).toBe(
      "Five people were asked to try Recipe Book on a phone or a computer and answer a set of questions about it, between 2 Oct 2026 and 11 Oct 2026.",
    )
    expect(text.match(/mission/gi)).toHaveLength(1)
    expect(text).toContain("Tester 1")
  })

  it("is there on an all-missions report too, without claiming to count people", () => {
    const rows = [...FIVE, report("f1", "2026-10-06T09:00:00Z", [entry(0, "pass")], { mission_id: "m-flow", missions: FLOW })]
    const r = buildReport(rows, false)
    expect(r.opening[0]).toMatch(/^In two separate tests, people were asked to try Recipe Book/)
    expect(r.opening[0]).toContain("6 reports in all")
    expect(r.opening.join(" ").match(/mission/gi)).toHaveLength(1)
  })

  it("says one person, in the singular", () => {
    const r = buildReport([report("a", "2026-10-02T09:00:00Z", [entry(0, "fail")], { missions: FLOW })], true)
    expect(r.opening[0]).toBe(
      "One person was asked to try Recipe Book on a phone and answer a set of questions about it, on 2 Oct 2026.",
    )
  })
})

describe("findings are sentences", () => {
  it("lead every problem step, with the count kept beside", () => {
    const m = buildReport(FIVE, true).missions[0]
    expect(m.fixFirst[0].sentence).toBe("Four of the five people said this did not come across the way it was meant to.")
    expect(m.fixFirst[0].headline).toBe("4 of 5 testers: Unclear")
  })

  it("follow the category", () => {
    expect(findingSentence(["fail", "pass"], "process_flow")).toBe(
      "One of the two people found this step did not work the way it should.",
    )
    expect(findingSentence(["blocked", "blocked", "blocked"], "component")).toBe(
      "All three people could not get to this step at all.",
    )
    expect(findingSentence(["blocked"], "ui_design")).toBe(
      "The one person who tried this could not judge this — it did not load, or was not there.",
    )
    expect(findingSentence(["fail", "blocked", "pass"], null)).toBe(
      "Two of the three people ran into a problem here: one found it did not work, one could not get to it.",
    )
    expect(findingSentence(["fail", "blocked", "pass"], "ui_design")).toMatch(
      /one said it did not come across as meant, one could not judge it/,
    )
  })

  it("use digits past ten", () => {
    expect(findingSentence([...Array(11).fill("fail"), "pass"], "process_flow")).toMatch(/^11 of the 12 people/)
  })

  it("say which steps were clean, as a sentence", () => {
    const rows = [report("a", "2026-10-02T09:00:00Z", [entry(0, "pass"), entry(1, "fail"), entry(2, "pass")])]
    expect(buildReport(rows, true).missions[0].cleanLine).toBe("Nobody reported a problem on steps 1 and 3.")
    expect(buildReport(FIVE, true).missions[0].cleanLine).toBeNull()
  })
})

describe("the legend", () => {
  it("quotes ENTRY_STATUS_HINTS on a functional test — the constant itself, never a copy", () => {
    const [legend] = legendsFor(["process_flow"])
    expect(legend.entries.map((e) => e.hint)).toEqual(ENTRY_STATUSES.map((s) => ENTRY_STATUS_HINTS[s]))
  })

  it("quotes the design copy on ui_design, and none of the functional hints", () => {
    const [legend] = legendsFor(["ui_design"])
    expect(legend.entries).toEqual(ENTRY_STATUSES.map((s) => entryStatusCopy(s, "ui_design")))
    for (const hint of Object.values(ENTRY_STATUS_HINTS)) expect(legend.entries.map((e) => e.hint)).not.toContain(hint)
  })

  it("lists both sets once each when a document holds both kinds", () => {
    const both = legendsFor(["ui_design", "process_flow", "component", null])
    // Functional first whatever the order, so "use these instead" heads the design set.
    expect(both.map((l) => l.entries[0].label)).toEqual(["Pass", "Clear"])
    expect(both[1].intro).toMatch(/looks and reads/)
    expect(legendsFor(["component", null])).toHaveLength(1)
  })
})

describe("the glossary", () => {
  it("holds only the terms this document contains", () => {
    const terms = buildReport(FIVE, true).glossary.map((g) => g.term)
    expect(terms).toEqual(expect.arrayContaining(["Step", "Expected", "Issue", "Approved", "AI-generated summary"]))
    expect(terms).not.toContain("Asked as")
    expect(terms).not.toContain("Filed before step-by-step reports")
  })
})
