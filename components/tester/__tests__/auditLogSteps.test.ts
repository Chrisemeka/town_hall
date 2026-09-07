import { describe, expect, it } from "vitest"
import {
  draftIsComplete,
  entryFieldName,
  firstIncompleteEntry,
  type DraftEntry,
} from "@/components/tester/AuditLogSteps"

/**
 * The audit log's one definition of "complete".
 *
 * Under vitest rather than beside scripts/focus.test.mts because these are
 * exported from a .tsx, which plain node can neither strip nor resolve "@/" for.
 */
function entry(over: Partial<DraftEntry> = {}): DraftEntry {
  return {
    step_id: "s",
    step_action: "Do the thing",
    step_expected: "The thing happens",
    status: "pass",
    actual_result: "It happened",
    expected_result: "The thing happens",
    issue_summary: "",
    steps_to_reproduce: "",
    ...over,
  }
}

const failing = entry({
  status: "fail",
  issue_summary: "It did not happen",
  steps_to_reproduce: "1. Do the thing",
})

describe("firstIncompleteEntry", () => {
  it("AUD-18 reports nothing missing on a complete log", () => {
    expect(firstIncompleteEntry([entry(), failing, entry()])).toBeNull()
  })

  it("AUD-19 names the step whose status is unanswered", () => {
    expect(firstIncompleteEntry([entry(), entry({ status: "" })])).toEqual({
      index: 1,
      field: "status",
    })
  })

  it("AUD-20 asks a failure for its issue detail, in rendered order", () => {
    expect(
      firstIncompleteEntry([entry(), entry({ status: "fail", steps_to_reproduce: "1. x" })]),
    ).toEqual({ index: 1, field: "issue_summary" })

    expect(firstIncompleteEntry([entry({ status: "fail", issue_summary: "Broken" })])).toEqual({
      index: 0,
      field: "steps_to_reproduce",
    })
  })

  it("never asks a pass for issue detail", () => {
    // Asking anyway is how the column fills up with "N/A".
    expect(firstIncompleteEntry([entry({ issue_summary: "", steps_to_reproduce: "" })])).toBeNull()
  })

  it("does not accept whitespace as an answer", () => {
    expect(firstIncompleteEntry([entry({ actual_result: "   " })])).toEqual({
      index: 0,
      field: "actual_result",
    })
    expect(firstIncompleteEntry([entry({ expected_result: "" })])).toEqual({
      index: 0,
      field: "expected_result",
    })
  })

  it("AUD-21 reports the first incomplete step, not the last", () => {
    // The tester is sent to the one they reach first by scrolling.
    expect(
      firstIncompleteEntry([entry({ status: "" }), entry({ actual_result: "" })]),
    ).toEqual({ index: 0, field: "status" })
  })
})

describe("draftIsComplete", () => {
  it("AUD-22 agrees with firstIncompleteEntry on every fixture", () => {
    // The drift guard. draftIsComplete drives the submit hint and
    // firstIncompleteEntry names the step; if they disagree the form either
    // refuses a valid log or sends one the server then rejects.
    const fixtures: DraftEntry[][] = [
      [],
      [entry()],
      [entry(), failing],
      [entry({ status: "" })],
      [entry({ actual_result: "" })],
      [entry({ expected_result: " " })],
      [entry({ status: "fail" })],
      [entry({ status: "fail", issue_summary: "x" })],
      [entry({ status: "blocked" })],
      [failing, entry({ status: "" }), entry()],
    ]
    for (const fixture of fixtures) {
      expect(draftIsComplete(fixture)).toBe(firstIncompleteEntry(fixture) === null)
    }
  })

  it("treats an empty log as complete", () => {
    // A mission with no test steps files a comment instead; the form checks
    // hasSteps before it checks this.
    expect(draftIsComplete([])).toBe(true)
  })
})

describe("entryFieldName", () => {
  it("matches the name the step inputs render", () => {
    expect(entryFieldName(3, "actual_result")).toBe("entries.3.actual_result")
    expect(entryFieldName(0, "status")).toBe("entries.0.status")
  })
})
