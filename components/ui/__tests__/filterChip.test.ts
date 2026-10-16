import { describe, expect, it } from "vitest"
import { createElement, type ComponentProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { FilterChip } from "@/components/ui/FilterChip"

const render = (pressed: boolean, count?: number) =>
  renderToStaticMarkup(
    // Children as the third argument (react/no-children-prop); the cast is for
    // the props type, which counts children as required.
    createElement(FilterChip, { pressed, onClick: () => {}, count } as ComponentProps<typeof FilterChip>, "Pending"),
  )

describe("FilterChip", () => {
  it("says pressed in aria-pressed and in accent ink, not colour alone", () => {
    const on = render(true)
    expect(on).toContain('aria-pressed="true"')
    expect(on).toContain("border-accent-ink")
    expect(render(false)).toContain('aria-pressed="false"')
  })

  it("is tappable over 48px while drawn at 32px", () => {
    const html = render(false)
    expect(html).toContain("h-8")
    expect(html).toContain("after:-inset-y-2")
  })

  it("renders the count after the label", () => {
    expect(render(false, 12)).toMatch(/Pending<span[^>]*>12<\/span>/)
  })
})
