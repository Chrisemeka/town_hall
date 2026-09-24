import { describe, expect, it } from "vitest"
import {
  DEFAULT_TAB,
  SETTINGS_TABS,
  nextTabIndex,
  tabFromParam,
  tabHref,
  tabIndex,
} from "@/lib/settingsTabs"

describe("tabFromParam", () => {
  it("resolves a known tab", () => {
    expect(tabFromParam("plan")).toBe("plan")
    expect(tabFromParam("account")).toBe("account")
    expect(tabFromParam("activity")).toBe("activity")
    expect(tabFromParam("profile")).toBe("profile")
  })

  it("opens Profile for anything it does not recognise", () => {
    // A bad URL should open the page, not produce an error. Someone editing
    // the address bar is not a threat, and a 404 for a query string nobody
    // typed deliberately is a worse answer than the default tab.
    expect(tabFromParam(undefined)).toBe(DEFAULT_TAB)
    expect(tabFromParam("")).toBe(DEFAULT_TAB)
    expect(tabFromParam("billing")).toBe(DEFAULT_TAB)
    expect(tabFromParam("PLAN")).toBe(DEFAULT_TAB)
    expect(tabFromParam(" plan")).toBe(DEFAULT_TAB)
  })

  it("takes the first value when the param is repeated", () => {
    // ?tab=plan&tab=account arrives as an array.
    expect(tabFromParam(["plan", "account"])).toBe("plan")
    expect(tabFromParam([])).toBe(DEFAULT_TAB)
  })
})

describe("nextTabIndex", () => {
  const last = SETTINGS_TABS.length - 1

  it("moves one step with the arrows", () => {
    expect(nextTabIndex(0, "ArrowRight")).toBe(1)
    expect(nextTabIndex(2, "ArrowLeft")).toBe(1)
  })

  it("wraps at both ends, which is the APG contract", () => {
    expect(nextTabIndex(0, "ArrowLeft")).toBe(last)
    expect(nextTabIndex(last, "ArrowRight")).toBe(0)
  })

  it("jumps to the ends with Home and End", () => {
    expect(nextTabIndex(2, "Home")).toBe(0)
    expect(nextTabIndex(1, "End")).toBe(last)
  })

  it("stays put for a key it does not handle", () => {
    // The caller uses "did it move" to decide whether to preventDefault, so
    // an unhandled key has to be distinguishable from a handled one.
    expect(nextTabIndex(2, "ArrowUp")).toBe(2)
    expect(nextTabIndex(2, "a")).toBe(2)
    expect(nextTabIndex(2, "Tab")).toBe(2)
  })
})

describe("the strip can always be rendered", () => {
  it("has four tabs, Profile first", () => {
    expect(SETTINGS_TABS).toHaveLength(4)
    expect(SETTINGS_TABS[0].id).toBe(DEFAULT_TAB)
  })

  it("gives every tab a non-empty label", () => {
    // A blank tab reads as a bug rather than as missing copy.
    for (const tab of SETTINGS_TABS) {
      expect(tab.label.trim().length).toBeGreaterThan(0)
    }
  })

  it("has no duplicate ids", () => {
    // The ids become DOM ids for aria-controls and aria-labelledby; a
    // duplicate would wire a tab to the wrong panel.
    const ids = SETTINGS_TABS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("round-trips every tab through its own href", () => {
    for (const tab of SETTINGS_TABS) {
      const query = tabHref(tab.id).split("=")[1]
      expect(tabFromParam(query)).toBe(tab.id)
      expect(tabIndex(tab.id)).toBe(SETTINGS_TABS.indexOf(tab))
    }
  })
})
