import { describe, expect, it } from "vitest"
import { TEST_TEMPLATES, instantiate, templatesFor } from "@/lib/testTemplates"
import { TEST_CATEGORIES } from "@/lib/vocabulary"
import { testStepsSchema } from "@/lib/validation/schemas"

describe("TEST_TEMPLATES", () => {
  it("gives every category something to start from", () => {
    for (const category of TEST_CATEGORIES) {
      expect(templatesFor(category).length).toBeGreaterThanOrEqual(3)
    }
  })

  it("has unique ids", () => {
    // template_id is stored on the mission, so a collision would make
    // provenance ambiguous for every mission built from either one.
    const ids = TEST_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("declares only known categories", () => {
    for (const template of TEST_TEMPLATES) {
      expect(TEST_CATEGORIES).toContain(template.category)
    }
  })

  it("ships no empty template", () => {
    for (const template of TEST_TEMPLATES) {
      expect(template.steps.length).toBeGreaterThan(0)
      expect(template.name.trim()).not.toBe("")
      expect(template.description.trim()).not.toBe("")
    }
  })

  it("produces steps the mission schema accepts", () => {
    // The templates and the schema are edited independently. This is what stops
    // a template shipping a step too short or too long to save.
    for (const template of TEST_TEMPLATES) {
      const parsed = testStepsSchema.safeParse(instantiate(template))
      expect(parsed.success, `${template.id} produces invalid steps`).toBe(true)
    }
  })
})

describe("instantiate", () => {
  it("mints a fresh id for every step", () => {
    const steps = instantiate(TEST_TEMPLATES[0])
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length)
  })

  it("shares no id between two instantiations of the same template", () => {
    // The whole reason a template is copied rather than referenced: two missions
    // built from one template must not collide in PR 4's audit entries.
    const a = instantiate(TEST_TEMPLATES[0])
    const b = instantiate(TEST_TEMPLATES[0])
    const overlap = a.filter((step) => b.some((other) => other.id === step.id))
    expect(overlap).toHaveLength(0)
  })

  it("copies the text verbatim", () => {
    const template = TEST_TEMPLATES[0]
    const steps = instantiate(template)
    expect(steps.map((s) => s.action)).toEqual(template.steps.map((s) => s.action))
    expect(steps.map((s) => s.expected_result)).toEqual(
      template.steps.map((s) => s.expected_result),
    )
  })
})
