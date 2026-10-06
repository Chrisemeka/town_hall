import { describe, expect, it } from "vitest"
import { testerLabel, testerNumbers } from "@/lib/testerNumbers"

const r = (id: string, mission_id: string, created_at: string) => ({ id, mission_id, created_at })

const REPORTS = [
  r("a2", "A", "2026-09-02T10:00:00+00:00"),
  r("b1", "B", "2026-09-01T09:00:00+00:00"),
  r("a1", "A", "2026-09-01T10:00:00+00:00"),
  r("a3", "A", "2026-09-03T10:00:00+00:00"),
  r("b2", "B", "2026-09-05T09:00:00+00:00"),
]

describe("testerNumbers", () => {
  it("numbers from 1 within each mission, oldest first, restarting per mission", () => {
    const n = testerNumbers(REPORTS)
    expect([n.get("a1"), n.get("a2"), n.get("a3")]).toEqual([1, 2, 3])
    expect([n.get("b1"), n.get("b2")]).toEqual([1, 2])
  })

  it("gives the same numbers whatever order the rows arrive in", () => {
    // Two exports of the same data must agree.
    const forward = testerNumbers(REPORTS)
    const reversed = testerNumbers([...REPORTS].reverse())
    expect([...reversed].sort()).toEqual([...forward].sort())
  })

  it("breaks identical timestamps on id", () => {
    const t = "2026-09-01T10:00:00.123456+00:00"
    const n = testerNumbers([r("zz", "A", t), r("aa", "A", t)])
    expect(n.get("aa")).toBe(1)
    expect(n.get("zz")).toBe(2)
  })

  it("orders sub-second timestamps correctly as text", () => {
    const n = testerNumbers([
      r("later", "A", "2026-09-01T10:00:00.5+00:00"),
      r("earlier", "A", "2026-09-01T10:00:00+00:00"),
    ])
    expect(n.get("earlier")).toBe(1)
  })

  it("labels a number, and falls back without one", () => {
    expect(testerLabel(3)).toBe("Tester 3")
    expect(testerLabel(undefined)).toBe("Tester")
  })
})
