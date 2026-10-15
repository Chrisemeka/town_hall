import { describe, expect, it } from "vitest"
import { inputClass, textareaClass } from "@/components/ui/Field"

describe("inputClass", () => {
  it("sits on the surface by default", () => {
    expect(inputClass(false).split(" ")).toContain("bg-surface")
  })

  it("takes the raised ground when asked, and only that one", () => {
    const classes = inputClass(false, { raised: true }).split(" ")
    expect(classes).toContain("bg-surface-raised")
    expect(classes).not.toContain("bg-surface")
  })
})

describe("textareaClass", () => {
  it("resizes vertically unless told not to, never both", () => {
    expect(textareaClass(false).split(" ")).toContain("resize-y")
    const fixed = textareaClass(false, { resizable: false }).split(" ")
    expect(fixed).toContain("resize-none")
    expect(fixed).not.toContain("resize-y")
  })
})
