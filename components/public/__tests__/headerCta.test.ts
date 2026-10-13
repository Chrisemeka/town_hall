import { describe, expect, it } from "vitest"
import { AUTH_ROUTES, showsGetStarted } from "@/components/public/HeaderCta"

describe("showsGetStarted", () => {
  it("shows on the marketing pages", () => {
    for (const p of ["/", "/pricing", "/guides/builder"]) expect(showsGetStarted(p), p).toBe(true)
  })

  it("hides on every auth route, where the form's submit is the Voltage fill", () => {
    for (const p of AUTH_ROUTES) expect(showsGetStarted(p), p).toBe(false)
    expect(showsGetStarted("/signup")).toBe(false)
    expect(showsGetStarted("/confirm-email")).toBe(false)
  })

  it("matches by path segment, not by string prefix", () => {
    expect(showsGetStarted("/login/anything")).toBe(false)
    expect(showsGetStarted("/loginx")).toBe(true)
  })
})
