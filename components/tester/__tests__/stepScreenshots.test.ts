import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AuditLogSteps, draftFor, type StepShots } from "@/components/tester/AuditLogSteps"
import type { Shot } from "@/components/tester/StepScreenshots"

const STEP = { id: "11111111-1111-4111-8111-111111111111", action: "Open it", expected_result: "It opens" }

function render(status: "" | "pass" | "fail" | "blocked", held: Shot[] = [], category: string | null = null) {
  const entries = draftFor([STEP]).map((e) => ({ ...e, status }))
  const shots: StepShots = { for: () => held, onChange: () => {}, room: 10, errors: {} }
  return renderToStaticMarkup(createElement(AuditLogSteps, { entries, category, onChange: () => {}, shots }))
}

const held: Shot[] = [{ file: new File([new Uint8Array(1)], "bug.png", { type: "image/png" }), url: "blob:bug" }]

describe("the step screenshot control", () => {
  it("renders on a step that did not pass, and only there", () => {
    expect(render("fail")).toContain("Add a screenshot")
    expect(render("blocked")).toContain("Add a screenshot")
    expect(render("pass")).not.toContain("type=\"file\"")
    expect(render("")).not.toContain("type=\"file\"")
  })

  it("says required on a fail and optional on blocked", () => {
    expect(render("fail")).toContain("Screenshot — required")
    expect(render("blocked")).toContain("Screenshot — optional")
  })

  it("follows the stored status on a design test: Unclear and Couldn't tell show it, Clear doesn't", () => {
    expect(render("fail", [], "ui_design")).toContain("Add a screenshot")
    expect(render("blocked", [], "ui_design")).toContain("Add a screenshot")
    expect(render("pass", [], "ui_design")).not.toContain("Add a screenshot")
  })

  it("hides a step's files on Pass and shows the same ones again on Fail", () => {
    // The files live in the parent's state, so Fail -> Pass -> Fail is the
    // control unmounting and remounting over the same list.
    expect(render("fail", held)).toContain("blob:bug")
    expect(render("pass", held)).not.toContain("blob:bug")
    expect(render("fail", held)).toContain("blob:bug")
  })

  it("names the button for the focus hook and carries the anonymity line", () => {
    const html = render("fail")
    expect(html).toContain('id="entries.0.screenshots"')
    expect(html).toContain("We don&#x27;t share your name with builders")
  })
})
