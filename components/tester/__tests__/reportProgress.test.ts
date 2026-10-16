import { describe, expect, it } from "vitest"
import { answeredCount, firstIncompleteEntry, type DraftEntry } from "@/components/tester/AuditLogSteps"
import { progressLabel } from "@/components/tester/ReportProgressBar"
import { DESCRIPTION_MIN } from "@/lib/validation/schemas"

function entry(over: Partial<DraftEntry> = {}): DraftEntry {
  return {
    step_id: "s",
    step_action: "Do the thing",
    step_expected: "The thing happens",
    status: "pass",
    actual_result: "",
    issue_summary: "",
    steps_to_reproduce: "",
    ...over,
  }
}

const pass = entry()
const blank = entry({ status: "" })
const failNoIssue = entry({ status: "fail" })
const failDone = entry({ status: "fail", issue_summary: "It did not happen", steps_to_reproduce: "Open it, click it" })
const blockedHalf = entry({ status: "blocked", issue_summary: "Sign-up is broken" })

describe("answeredCount", () => {
  it("counts a pass, and a fail only once it has both its issue fields", () => {
    expect(answeredCount([pass])).toBe(1)
    expect(answeredCount([failNoIssue])).toBe(0)
    expect(answeredCount([failDone])).toBe(1)
    expect(answeredCount([blockedHalf])).toBe(0)
  })

  it("holds a design step to its description, at any status", () => {
    const short = entry({ actual_result: "Too short" })
    const long = entry({ actual_result: "x".repeat(DESCRIPTION_MIN) })
    expect(answeredCount([short], "ui_design")).toBe(0)
    expect(answeredCount([long], "ui_design")).toBe(1)
  })

  it("says every step is answered exactly when Submit would accept the log", () => {
    // The bar must never read "6 of 6" while Submit still refuses.
    const fixtures: [DraftEntry[], string | null][] = [
      [[pass, pass], null],
      [[pass, blank], null],
      [[failDone, failNoIssue], null],
      [[blockedHalf], null],
      [[failDone, pass, failDone], null],
      [[entry({ actual_result: "x".repeat(DESCRIPTION_MIN) })], "ui_design"],
      [[pass], "ui_design"],
      [[], null],
    ]
    for (const [entries, category] of fixtures) {
      expect(answeredCount(entries, category) === entries.length).toBe(firstIncompleteEntry(entries, category) === null)
    }
  })
})

describe("progressLabel", () => {
  it("counts while steps are open, then asks for a screenshot, then says ready", () => {
    expect(progressLabel(4, 6, 0)).toBe("4 of 6 steps answered")
    expect(progressLabel(6, 6, 0)).toBe("All steps answered · add a screenshot")
    expect(progressLabel(6, 6, 2)).toBe("Ready to submit")
  })
})
