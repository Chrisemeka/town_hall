import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AuditLogSteps, draftFor } from "@/components/tester/AuditLogSteps"

const STEPS = [
  {
    id: "11111111-2222-4333-8444-555555555555",
    action: "Land on the homepage and describe your first impression",
    expected_result: "The purpose of the product is clear within about five seconds",
  },
]

const render = (category: string | null) =>
  renderToStaticMarkup(
    createElement(AuditLogSteps, { entries: draftFor(STEPS), category, onChange: () => {} }),
  )

describe("AuditLogSteps by category", () => {
  it("asks a ui_design step for a description, then whether the expectation held", () => {
    const html = render("ui_design")
    for (const label of ["Clear", "Unclear", "Couldn&#x27;t tell"]) expect(html).toContain(label)
    expect(html).toContain("Did the builder&#x27;s expectation hold?")
    expect(html).not.toContain("How did it go?")
    // The description renders above the status question, and before any status is picked.
    expect(html.indexOf("What you saw")).toBeGreaterThan(-1)
    expect(html.indexOf("What you saw")).toBeLessThan(html.indexOf("Did the builder"))
  })

  for (const category of ["process_flow", "component", null, "retired"]) {
    it(`renders the original Pass / Fail / Blocked for ${String(category)}`, () => {
      const html = render(category)
      for (const label of [">Pass<", ">Fail<", ">Blocked<"]) expect(html).toContain(label)
      expect(html).toContain("How did it go?")
      expect(html).not.toContain("What you saw")
    })
  }
})
