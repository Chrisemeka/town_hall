import { describe, expect, it } from "vitest"
import { ANALYSIS_PROMPT } from "@/lib/ai"
import {
  ENTRY_STATUSES,
  entryStatusCopy,
  entryStatusLabel,
  statusQuestionFor,
} from "@/lib/vocabulary"

describe("status copy by category", () => {
  it("reads Clear / Unclear / Couldn't tell on a ui_design mission", () => {
    expect(ENTRY_STATUSES.map((s) => entryStatusCopy(s, "ui_design").label)).toEqual([
      "Clear",
      "Unclear",
      "Couldn't tell",
    ])
    expect(entryStatusCopy("pass", "ui_design").hint).not.toMatch(/did what/i)
    expect(statusQuestionFor("ui_design")).toMatch(/expectation/)
  })

  it("keeps Pass / Fail / Blocked everywhere else, including null and unknown categories", () => {
    for (const category of ["process_flow", "component", null, undefined, "retired"]) {
      expect(ENTRY_STATUSES.map((s) => entryStatusCopy(s, category).label)).toEqual([
        entryStatusLabel("pass"),
        entryStatusLabel("fail"),
        entryStatusLabel("blocked"),
      ])
      expect(statusQuestionFor(category)).toBe("How did it go?")
    }
  })
})

describe("the AI prompt is not relabelled", () => {
  it("reasons over the stored statuses for a ui_design log", () => {
    const prompt = ANALYSIS_PROMPT(
      {
        comment: "",
        entries: [
          {
            step_action: "Describe your first impression",
            step_expected: "The purpose is clear within five seconds",
            status: "pass",
            actual_result: "Clear straight away — it is a habit tracker",
          },
          {
            step_action: "Point at the main action",
            step_expected: "The sign-up button stands out",
            status: "fail",
            actual_result: "I pointed at the logo; the button is grey",
            issue_summary: "Primary action blends in",
            steps_to_reproduce: "1. Open the homepage",
          },
        ],
      },
      0,
    )
    expect(prompt).toContain("Step 1 — PASS")
    expect(prompt).toContain("Step 2 — FAIL")
    expect(prompt).not.toMatch(/Clear —|UNCLEAR|Couldn't tell/)
  })
})
