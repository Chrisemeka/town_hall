import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

// The panels import server actions; rendering them needs none of it.
vi.mock("@/actions/auth", () => ({ deleteAccountAction: vi.fn() }))
vi.mock("@/actions/accounts", () => ({ switchAccount: vi.fn() }))

import { AccountPanel } from "@/components/settings/AccountPanel"
import { GiveAndTake } from "@/components/settings/GiveAndTake"
import { reciprocityFrom } from "@/lib/reciprocity"
import { tabsFor } from "@/lib/settingsTabs"
import type { AccountType } from "@/lib/access"

// Settings assuming a builder is looking, in its last two places: the export
// section and the Activity numbers.

const account = (active: AccountType, hasFeedback = false) =>
  renderToStaticMarkup(
    createElement(AccountPanel, { active, holdsOther: false, projects: [], hasFeedback }),
  )

const activity = (active: AccountType, stats: Parameters<typeof reciprocityFrom>[0]) =>
  renderToStaticMarkup(
    createElement(GiveAndTake, { active, stats: reciprocityFrom(stats), hasTesterAccount: true }),
  )

describe("Account tab export section", () => {
  it("is absent on a tester account", () => {
    const html = account("tester", true)
    expect(html).not.toContain("Export your data")
    expect(html).not.toContain("reports on your")
  })

  it("renders with its empty state for a builder with no feedback yet", () => {
    const html = account("builder", false)
    expect(html).toContain("Export your data")
    expect(html).toContain("Nothing to export yet")
  })
})

describe("Activity tab", () => {
  const stats = { given: 4, received: 0, approved: 3, ratings: [4, 5, null, null] }

  it("is tester-shaped on a tester: no received, no ratio", () => {
    const html = activity("tester", stats)
    expect(html).toContain("Reports written")
    expect(html).toContain("Approved")
    expect(html).toContain("Average rating")
    expect(html).not.toContain("Reports received")
    expect(html).not.toContain("Give / take")
  })

  it("is unchanged on a builder", () => {
    const html = activity("builder", stats)
    expect(html).toContain("Reports received")
    expect(html).toContain("Give / take")
  })

  it("renders an unrated tester's rating as —, never 0.0", () => {
    const html = activity("tester", { given: 2, received: 0, approved: 0, ratings: [null, null] })
    expect(html).toContain("—")
    expect(html).not.toContain("0.0")
  })

  it("says nothing about pay or earnings to a tester", () => {
    expect(activity("tester", stats)).not.toMatch(/earn|pay|rank/i)
  })

  it("gives a tester with no reports an empty state, not zeros", () => {
    const html = activity("tester", { given: 0, received: 5, approved: 0, ratings: [] })
    expect(html).toContain("No reports yet")
  })
})

it("tabsFor still hides Plan from a tester", () => {
  expect(tabsFor("tester").some((t) => t.id === "plan")).toBe(false)
})
