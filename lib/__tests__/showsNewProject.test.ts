import { describe, expect, it } from "vitest"
import { showsNewProject } from "@/lib/appNav"

describe("showsNewProject", () => {
  it("shows on the builder's list and detail pages", () => {
    for (const p of ["/dashboard", "/dashboard/missions", "/dashboard/abc123", "/dashboard/abc123/mission/m1"])
      expect(showsNewProject(p), p).toBe(true)
  })

  it("steps aside on the four form routes, which have their own submit", () => {
    for (const p of ["/dashboard/new", "/dashboard/abc123/edit", "/dashboard/abc123/mission/new", "/dashboard/abc123/mission/m1/edit"])
      expect(showsNewProject(p), p).toBe(false)
  })
})
