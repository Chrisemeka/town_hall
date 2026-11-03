import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/billingRecordDb", () => ({ loadBillingInput: vi.fn() }))

import { GET } from "@/app/api/admin/accounts/[id]/billing-record/route"
import { requireAdmin } from "@/lib/auth"
import { loadBillingInput } from "@/lib/billingRecordDb"
import { MERCHANT } from "@/lib/merchant"

// app/api has no middleware, so requireAdmin() in the route is the only gate.

const ID = "22222222-2222-4222-8222-222222222222"
const call = (id: string) => GET(new Request(`http://x/api/admin/accounts/${id}/billing-record`), { params: Promise.resolve({ id }) })

describe("GET /api/admin/accounts/[id]/billing-record", () => {
  it("answers a non-admin with 403 and no body, without reading anything", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Not authorized"))
    const res = await call(ID)
    expect(res.status).toBe(403)
    expect(await res.text()).toBe("")
    expect(loadBillingInput).not.toHaveBeenCalled()
  })

  it("answers a non-UUID with 404", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({} as never)
    const res = await call("not-a-uuid")
    expect(res.status).toBe(404)
    expect(loadBillingInput).not.toHaveBeenCalled()
  })

  it("neutralises a builder-written title and ends with the prepared-by note", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({} as never)
    vi.mocked(loadBillingInput).mockResolvedValue({
      firstName: "Ada/../",
      subscriptions: [],
      planChanges: [],
      ledger: [{ kind: "reserved", bucket: "monthly", slots: -5, mission_id: "m1", created_at: "2026-10-25T10:00:00Z" }],
      reports: [],
      missions: [{ id: "m1", title: "=HYPERLINK(\"http://evil\")" }],
    })
    const res = await call(ID)
    expect(res.headers.get("Content-Disposition")).toMatch(/filename="twnhall-billing-ada-\d{4}-\d{2}-\d{2}\.csv"/)
    const text = await res.text()
    expect(text).toContain(`"'=HYPERLINK(""http://evil"")"`)
    expect(text).toContain("2026-10-25 11:00")
    expect(text.trimEnd().split("\r\n").at(-1)).toMatch(new RegExp(`^Prepared by ${MERCHANT.legalName} on \\d{4}-\\d{2}-\\d{2}\\. Testers are identified by number only\\.$`))
  })
})
