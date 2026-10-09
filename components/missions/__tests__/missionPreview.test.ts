import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { TesterView, splitSteps, type MissionSnapshot } from "@/components/missions/MissionPreview"

const STEP = {
  id: "11111111-2222-4333-8444-555555555555",
  action: "Check the thing works",
  expected_result: "It works",
}
const PROJECT = { name: "Acme", app_url: "https://acme.test", description: "A thing" }

const mission = (over: Partial<MissionSnapshot> = {}): MissionSnapshot => ({
  title: "Sign-up flow",
  notes: "",
  category: "process_flow",
  deviceTarget: "both",
  steps: [STEP],
  ...over,
})

const render = (m: MissionSnapshot, phone = false) =>
  renderToStaticMarkup(createElement(TesterView, { mission: m, project: PROJECT, phone }))

afterEach(() => vi.unstubAllGlobals())

describe("TesterView", () => {
  it("shows the form's current step text, unsaved", () => {
    const html = render(mission({ steps: [{ ...STEP, action: "Typed just now, never saved" }] }))
    // Twice: once in the test case, once above the answer buttons — as on the tester page.
    expect(html.split("Typed just now, never saved").length - 1).toBe(2)
  })

  it("previews ui_design with Clear / Unclear / Couldn't tell and a required description", () => {
    const html = render(mission({ category: "ui_design" }))
    for (const label of [">Clear<", ">Unclear<", ">Couldn&#x27;t tell<"]) expect(html).toContain(label)
    expect(html).toContain("What you saw")
  })

  for (const category of ["process_flow", "component"]) {
    it(`previews ${category} with Pass / Fail / Blocked`, () => {
      const html = render(mission({ category }))
      for (const label of [">Pass<", ">Fail<", ">Blocked<"]) expect(html).toContain(label)
      expect(html).not.toContain("What you saw")
    })
  }

  it("is inert and disabled, wrapping every control", () => {
    const html = render(mission())
    expect(html.startsWith("<fieldset disabled")).toBe(true)
    expect(html).toMatch(/^<fieldset[^>]* inert=""/)
    expect(html.trimEnd().endsWith("</fieldset>")).toBe(true)
  })

  it("never touches localStorage, and never mounts AuditLogForm", () => {
    const setItem = vi.fn(() => {
      throw new Error("preview wrote localStorage")
    })
    vi.stubGlobal("localStorage", { setItem, getItem: () => null, removeItem: setItem })
    render(mission({ category: "ui_design" }))
    expect(setItem).not.toHaveBeenCalled()
    // Static markup runs no effects, so the render alone cannot catch a future
    // useEffect. The source can.
    for (const file of [
      "components/missions/MissionPreview.tsx",
      "components/missions/MissionBrief.tsx",
      "components/missions/TestCaseView.tsx",
      "components/tester/AuditLogSteps.tsx",
    ]) {
      const src = readFileSync(file, "utf8")
      // Calls and imports, not mentions — the comments say why it is excluded.
      expect(src, file).not.toMatch(/localStorage\s*[.[]|from\s+["'][^"']*AuditLogForm["']/)
    }
  })

  it("renders at phone width when asked, full width otherwise", () => {
    expect(render(mission(), true)).toContain("max-w-[360px]")
    expect(render(mission(), false)).not.toContain("max-w-[360px]")
  })

  it("uses TestCaseView's own empty state for zero steps, and nothing else", () => {
    const html = render(mission({ steps: [] }))
    expect(html.split("No steps yet — follow the brief above.").length - 1).toBe(1)
    expect(html).not.toContain("Work through the test case")
    expect(html).not.toContain("could not be read")
  })
})

describe("splitSteps", () => {
  it("keeps finished steps and names unfinished ones by number", () => {
    const half = { ...STEP, id: "22222222-2222-4333-8444-555555555555", expected_result: "" }
    const { ready, unfinished } = splitSteps([STEP, half])
    expect(ready.map((s) => s.id)).toEqual([STEP.id])
    expect(unfinished).toEqual([2])
  })

  it("treats a non-array as no steps", () => {
    expect(splitSteps(null)).toEqual({ ready: [], unfinished: [] })
  })
})
