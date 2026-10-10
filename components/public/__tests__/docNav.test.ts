import { existsSync, readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { DOCS, docSection, jumpToSection } from "@/lib/docNav"
import { DocLayout } from "@/components/public/DocNav"

const pageFile = (href: string) => `app/(public)${href}/page.tsx`

afterEach(() => vi.unstubAllGlobals())

describe("doc nav data matches the pages", () => {
  // The drift check: asserted from the data, so a section added, renamed or
  // removed on one side without the other fails here.
  for (const doc of DOCS) {
    describe(doc.href, () => {
      const source = readFileSync(pageFile(doc.href), "utf8")

      it("exists, so the switcher never links a 404", () => {
        expect(existsSync(pageFile(doc.href))).toBe(true)
      })

      it("renders every section heading from the data, exactly once", () => {
        for (const { id } of doc.sections) {
          const calls = source.split(`docSection("${doc.slug}", "${id}")`).length - 1
          expect(calls, `${doc.slug}#${id}`).toBe(1)
        }
      })

      it("has no heading the nav does not know about", () => {
        const used = [...source.matchAll(/docSection\("(\w+)", "([\w-]+)"\)/g)]
        expect(used.map(([, slug]) => slug).every((slug) => slug === doc.slug)).toBe(true)
        expect(used.length).toBe(doc.sections.length)
        // A hand-written Section title bypasses the data entirely.
        expect(source).not.toMatch(/<Section[^>]*\btitle="/)
      })

      it("is framed by DocLayout for its own slug", () => {
        expect(source).toContain(`<DocLayout slug="${doc.slug}">`)
      })
    })
  }

  it("keeps ids unique within each document", () => {
    for (const doc of DOCS) {
      const ids = doc.sections.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it("numbers sections by position and leaves the privacy policy unnumbered", () => {
    expect(docSection("terms", "contact")).toEqual({ id: "contact", number: "12", title: "Contact Information" })
    expect(docSection("privacy", "contact")).toEqual({ id: "contact", title: "Contact Us" })
  })
})

describe("DocLayout", () => {
  const html = renderToStaticMarkup(createElement(DocLayout, { slug: "builder" }, "body"))

  it("switches to all four documents and marks the current one", () => {
    for (const doc of DOCS) expect(html).toContain(`href="${doc.href}"`)
    expect(html).toMatch(/aria-current="page"[^>]*href="\/guides\/builder"|href="\/guides\/builder"[^>]*aria-current="page"/)
    expect(html).toContain("(you are here)")
  })

  it("links every section of the current document", () => {
    for (const { id } of DOCS[0].sections) expect(html).toContain(`href="#${id}"`)
  })

  it("is collapsed by default on a phone", () => {
    expect(html).toMatch(/<details(?![^>]*\bopen\b)[^>]*lg:hidden/)
  })
})

describe("jumpToSection", () => {
  function stub(reduced: boolean) {
    const heading = { scrollIntoView: vi.fn(), focus: vi.fn() }
    const replaceState = vi.fn()
    vi.stubGlobal("document", { getElementById: (id: string) => (id === "notes" ? heading : null) })
    vi.stubGlobal("history", { replaceState })
    vi.stubGlobal("window", { matchMedia: () => ({ matches: reduced }) })
    return { heading, replaceState }
  }

  it("moves focus to the heading, not just the viewport", () => {
    const { heading, replaceState } = stub(false)
    jumpToSection("notes")
    expect(heading.focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(heading.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" })
    expect(replaceState).toHaveBeenCalledWith(null, "", "#notes")
  })

  it("does not animate under reduced motion", () => {
    const { heading } = stub(true)
    jumpToSection("notes")
    expect(heading.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" })
  })

  it("does nothing for an id that is not on the page", () => {
    const { replaceState } = stub(false)
    jumpToSection("missing")
    expect(replaceState).not.toHaveBeenCalled()
  })
})
