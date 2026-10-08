import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { SubmissionsFeed, type FeedSubmission } from "@/components/tester/SubmissionsFeed"

// Server-rendered first paint: page 1, no dialog open. The dialog itself is a
// native <dialog> driven by showModal() — checked by hand, not here.

const sub = (i: number, over: Partial<FeedSubmission> = {}): FeedSubmission => ({
  id: `r${i}`,
  missionId: `m${i}`,
  missionTitle: `Mission ${i}`,
  projectName: "Recipe Book",
  status: "pending",
  createdAt: "2026-10-01T10:00:00Z",
  screenshots: [],
  reviewNote: null,
  rating: null,
  reviewedAt: null,
  ...over,
})

const render = (submissions: FeedSubmission[]) =>
  renderToStaticMarkup(createElement(SubmissionsFeed, { submissions }))

describe("SubmissionsFeed", () => {
  it("shows at most six submissions, with a pager for the rest", () => {
    const html = render(Array.from({ length: 8 }, (_, i) => sub(i + 1)))
    expect(html).toContain("Mission 6")
    expect(html).not.toContain("Mission 7")
    expect(html).toContain("Page 1 of 2")
  })

  it("has no pager when everything fits on one page", () => {
    expect(render([sub(1), sub(2)])).not.toContain("Page 1 of")
  })

  it("shows an approved report's rating on the card, in words as well as stars", () => {
    const html = render([sub(1, { status: "approved", rating: 4 })])
    expect(html).toContain("4/5")
  })

  it("keeps a long note off the card — it only says one exists", () => {
    const note = "Thorough work. ".repeat(60)
    const html = render([sub(1, { status: "approved", rating: 5, reviewNote: note })])
    expect(html).toContain("Note from the builder")
    expect(html).not.toContain(note.trim())
  })
})
