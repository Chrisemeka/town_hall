import { describe, expect, it } from "vitest"
import {
  auditEntrySchema,
  auditLogSchemaFor,
  DESCRIPTION_MIN,
  ENTRY_TEXT_MIN,
} from "@/lib/validation/schemas"
import { draftIsComplete, firstIncompleteEntry, type DraftEntry } from "@/components/tester/AuditLogSteps"
import { ENTRY_STATUSES } from "@/lib/vocabulary"

/**
 * Which fields each status owes, and the guarantee that the form and the server
 * agree about it.
 *
 * auditEntrySchema is the authority — the client must not be able to submit
 * something it rejects, and must not refuse something it would accept.
 */
const STEP_ID = "11111111-2222-4333-8444-555555555555"

function draft(over: Partial<DraftEntry> = {}): DraftEntry {
  return {
    step_id: STEP_ID,
    step_action: "Submit the sign-up form",
    step_expected: "A confirmation email arrives",
    status: "pass",
    actual_result: "The email arrived",
    issue_summary: "",
    steps_to_reproduce: "",
    ...over,
  }
}

/** What the form actually sends: the draft, minus the keys it left empty. */
function payload(d: DraftEntry): Record<string, unknown> {
  return { ...d }
}

describe("auditEntrySchema by status", () => {
  it("ENT-01 accepts a pass with no actual_result", () => {
    const parsed = auditEntrySchema.safeParse(payload(draft({ actual_result: "" })))
    expect(parsed.success).toBe(true)
  })

  it("ENT-01b accepts a pass with the key absent entirely", () => {
    // What .optional() actually produces on the way back out, and what
    // submit_audit_log then has to coalesce.
    const rest: Record<string, unknown> = { ...draft() }
    delete rest.actual_result
    expect(auditEntrySchema.safeParse(rest).success).toBe(true)
  })

  it("ENT-02 rejects a failure with no actual_result", () => {
    const parsed = auditEntrySchema.safeParse(
      payload(draft({
        status: "fail",
        actual_result: "",
        issue_summary: "Nothing happened",
        steps_to_reproduce: "1. Click submit",
      })),
    )
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues.map((i) => i.path.join("."))).toContain("actual_result")
  })

  it("ENT-03 rejects a blocked step with no actual_result", () => {
    const parsed = auditEntrySchema.safeParse(
      payload(draft({
        status: "blocked",
        actual_result: "",
        issue_summary: "Blocked by step 2",
        steps_to_reproduce: "1. Try step 2",
      })),
    )
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues.map((i) => i.path.join("."))).toContain("actual_result")
  })

  it("ENT-04 rejects a blocked step with no issue_summary", () => {
    const parsed = auditEntrySchema.safeParse(
      payload(draft({
        status: "blocked",
        actual_result: "Could not reach this step",
        steps_to_reproduce: "1. Try step 2",
      })),
    )
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues.map((i) => i.path.join("."))).toContain("issue_summary")
  })

  it("ENT-05 rejects a blocked step with no steps_to_reproduce", () => {
    const parsed = auditEntrySchema.safeParse(
      payload(draft({
        status: "blocked",
        actual_result: "Could not reach this step",
        issue_summary: "Blocked by step 2",
      })),
    )
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues.map((i) => i.path.join("."))).toContain("steps_to_reproduce")
  })

  it("ENT-06 still accepts a pass with neither issue field", () => {
    // Unchanged from AUD-08. A passing step has no issue and nothing to
    // reproduce; asking anyway is how the data becomes "N/A".
    expect(auditEntrySchema.safeParse(payload(draft())).success).toBe(true)
  })

  it("ENT-09 accepts an entry that carries no expected_result at all", () => {
    // The field left the schema in 20260908_01 — it was prefilled from the
    // builder's step_expected and ten of the first eleven testers sent it back
    // unchanged.
    for (const status of ENTRY_STATUSES) {
      const parsed = auditEntrySchema.safeParse(
        payload(draft({
          status,
          actual_result: "Something else entirely",
          issue_summary: "It went wrong",
          steps_to_reproduce: "1. Do the thing",
        })),
      )
      expect(parsed.success, `${status} was rejected`).toBe(true)
    }
  })

  it("ENT-10 strips a stale expected_result rather than failing on it", () => {
    // A localStorage draft written before this still carries the key, and the
    // action passes the PARSED entries to the RPC — so it must not survive.
    const stale = { ...payload(draft()), expected_result: "left over from an old draft" }
    const parsed = auditEntrySchema.safeParse(stale)
    expect(parsed.success).toBe(true)
    expect(parsed.data).not.toHaveProperty("expected_result")
  })

  it("ENT-11 accepts a pass carrying nothing but its status", () => {
    const parsed = auditEntrySchema.safeParse(
      payload(draft({ actual_result: "", issue_summary: "", steps_to_reproduce: "" })),
    )
    expect(parsed.success).toBe(true)
  })

  it("every refine names its own field, so the focus hook can reach it", () => {
    const parsed = auditEntrySchema.safeParse(payload(draft({ status: "blocked", actual_result: "" })))
    expect(parsed.success).toBe(false)
    for (const issue of parsed.error!.issues) {
      expect(issue.path.length, `an issue with no path: ${issue.message}`).toBeGreaterThan(0)
    }
  })
})

describe("ENT-08 the form and the server agree on complete", () => {
  it("across every category, every status and every combination of the text fields", () => {
    // The drift guard, and the reason firstIncompleteEntry exists at all.
    // Disagreement in one direction is a form that refuses valid work; in the
    // other it is a submission the server rejects with a message the tester
    // cannot act on.
    // Short clears ENTRY_TEXT_MIN but not DESCRIPTION_MIN, so the design rule
    // is crossed too, not only the functional one.
    const short = "x".repeat(ENTRY_TEXT_MIN)
    const long = "x".repeat(DESCRIPTION_MIN)
    const values = ["", "  ", short, long]
    let checked = 0

    for (const category of [null, "process_flow", "component", "ui_design", "not_a_category"])
    for (const status of [...ENTRY_STATUSES, ""] as const) {
      for (const actual_result of values) {
        for (const issue_summary of values) {
          for (const steps_to_reproduce of values) {
            const d = draft({ status, actual_result, issue_summary, steps_to_reproduce })
            const formSaysComplete = draftIsComplete([d], category)
            // An unanswered status can never reach the server — the form holds
            // it — and the schema has no representation for "".
            if (status === "") {
              expect(formSaysComplete).toBe(false)
              checked++
              continue
            }
            const serverAccepts = auditLogSchemaFor(category).safeParse([payload(d)]).success
            expect(
              formSaysComplete,
              `category=${category} status=${status} actual=${JSON.stringify(actual_result)} ` +
                `issue=${JSON.stringify(issue_summary)} repro=${JSON.stringify(steps_to_reproduce)}`,
            ).toBe(serverAccepts)
            checked++
          }
        }
      }
    }
    expect(checked).toBe(5 * 4 * 64)
  })
})

describe("ENT-12 ui_design: the description is the deliverable", () => {
  const design = auditLogSchemaFor("ui_design")
  const described = "The headline is clear but the button is hard to find"

  it("rejects a pass with an empty description, on actual_result", () => {
    // The bug: Pass on "describe your first impression", with nothing written.
    const parsed = design.safeParse([payload(draft({ actual_result: "" }))])
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0].path).toEqual([0, "actual_result"])
  })

  it("rejects a description shorter than DESCRIPTION_MIN", () => {
    expect(design.safeParse([payload(draft({ actual_result: "ok" }))]).success).toBe(false)
  })

  it("accepts a described pass", () => {
    expect(design.safeParse([payload(draft({ actual_result: described }))]).success).toBe(true)
  })

  it("still requires the issue fields on a fail", () => {
    const parsed = design.safeParse([payload(draft({ status: "fail", actual_result: described }))])
    expect(parsed.success).toBe(false)
  })

  it("puts the description first in the form's order", () => {
    const d = draft({ status: "", actual_result: "" })
    expect(firstIncompleteEntry([d], "ui_design")).toEqual({ index: 0, field: "actual_result" })
    expect(firstIncompleteEntry([d], "process_flow")).toEqual({ index: 0, field: "status" })
  })
})

describe("ENT-13 every other category keeps 20260907_01", () => {
  for (const category of ["process_flow", "component", null, undefined, "legacy_value"]) {
    it(`accepts a pass with no actual_result for ${String(category)}`, () => {
      const parsed = auditLogSchemaFor(category).safeParse([payload(draft({ actual_result: "" }))])
      expect(parsed.success).toBe(true)
      expect(draftIsComplete([draft({ actual_result: "" })], category)).toBe(true)
    })
  }
})
