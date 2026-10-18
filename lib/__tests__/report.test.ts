import { describe, expect, it } from "vitest"
import { agreementHeadline, buildReport, REPORT_CAP, reportCapMessage, SCREENSHOT_CAP } from "@/lib/report"
import { imageFormat, isOwnScreenshot } from "@/lib/reportImages"
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

  it("averages only approved, rated reports", () => {
    expect(buildReport(FIVE, true).missions[0].rating).toBe("Average rating 3.5 / 5 from 2 reviewed reports")
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
    expect(r.scope).toBe("All missions")
    expect(r.missions.map((m) => m.title)).toEqual(["First impressions", "Checkout flow"])
    expect(r.evidence).toMatch(/^6 reports across 2 missions/)
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
