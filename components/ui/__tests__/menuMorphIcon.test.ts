import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Menu, Plus } from "lucide-react"
import { MenuMorphIcon } from "@/components/ui/MenuMorphIcon"
import { PlusMorphIcon } from "@/components/ui/PlusMorphIcon"

const paths = (html: string) => [...html.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1])

describe("MenuMorphIcon", () => {
  it("draws lucide Menu's exact bars, so the hand-off to the bar's trigger cannot drift", () => {
    const ours = paths(renderToStaticMarkup(createElement(MenuMorphIcon)))
    expect(ours).toHaveLength(3)
    expect(ours).toEqual(paths(renderToStaticMarkup(createElement(Menu))))
  })
})

describe("PlusMorphIcon", () => {
  it("draws lucide Plus's exact bars, so the accordion icon cannot drift", () => {
    const ours = paths(renderToStaticMarkup(createElement(PlusMorphIcon)))
    expect(ours).toHaveLength(2)
    expect(ours).toEqual(paths(renderToStaticMarkup(createElement(Plus))))
  })
})
