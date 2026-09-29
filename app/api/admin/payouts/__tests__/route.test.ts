import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/cohortDb", () => ({ payoutSheet: vi.fn() }))

import { GET } from "@/app/api/admin/payouts/route"
import { requireAdmin } from "@/lib/auth"
import { payoutSheet } from "@/lib/cohortDb"

// app/api has no middleware, so requireAdmin() in the route is the only gate.

describe("GET /api/admin/payouts", () => {
  it("answers a non-admin with 403 and no body, without reading anything", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Not authorized"))
    const res = await GET(new Request("http://x/api/admin/payouts?month=2026-10"))
    expect(res.status).toBe(403)
    expect(await res.text()).toBe("")
    expect(payoutSheet).not.toHaveBeenCalled()
  })

  it("exports the month an admin asks for, with a hostile name neutralised", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({} as never)
    vi.mocked(payoutSheet).mockResolvedValue({
      totalNgn: 1000,
      rows: [
        { testerId: "t1", name: "=cmd()", email: "t@x.ng", payable: 1, unpaid: 0, bonus: false, total: 1000, rating: null, flagged: false },
      ],
    })
    const res = await GET(new Request("http://x/api/admin/payouts?month=2026-10"))
    expect(payoutSheet).toHaveBeenCalledWith("2026-10-01")
    const text = await res.text()
    expect(text).toContain("'=cmd()")
    expect(text).toContain("Month total")
  })
})
