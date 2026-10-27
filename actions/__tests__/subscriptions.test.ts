import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/server", () => ({ after: vi.fn((fn: () => unknown) => fn()) }))
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/billing", () => ({ applySubscription: vi.fn(async () => "ok") }))
vi.mock("@/lib/mail", () => ({ sendNotice: vi.fn() }))
vi.mock("@/lib/events", () => ({ recordEventLater: vi.fn() }))

import { changePlan, downgrade, extend } from "@/actions/admin/subscriptions"
import { requireAdmin } from "@/lib/auth"
import { applySubscription } from "@/lib/billing"
import { sendNotice } from "@/lib/mail"
import { recordEventLater } from "@/lib/events"

const ADMIN = "11111111-1111-4111-8111-111111111111"
const USER = "22222222-2222-4222-8222-222222222222"
const NEXT_YEAR = `${new Date().getUTCFullYear() + 1}-01-15`

/** The builder as current() reads them: their account, profile and active subscription. */
function given(state: { plan?: string | null; active?: { id: string; period_end: string | null } | null; noAccount?: boolean }) {
  const rows: Record<string, unknown> = {
    accounts: state.noAccount ? null : { id: "acc", plan_id: state.plan ?? null },
    profiles: { full_name: "Ada Obi", email: "ada@example.ng" },
    subscriptions: state.active ?? null,
  }
  const chain = (table: string) => {
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: rows[table] }) }
    return q
  }
  vi.mocked(requireAdmin).mockResolvedValue({ admin: { from: chain }, user: { id: ADMIN }, adminUserId: ADMIN } as never)
}

const base = { userId: USER, reason: "Paid by transfer", notify: true }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(applySubscription).mockResolvedValue("ok")
})

describe("changePlan", () => {
  it("rejects a non-admin without writing", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Not authorized"))
    await expect(changePlan({ ...base, planId: "pro", periodEnd: NEXT_YEAR })).rejects.toThrow("Not authorized")
    expect(applySubscription).not.toHaveBeenCalled()
  })

  it("starts the plan through apply_subscription, logs the change and emails the builder", async () => {
    given({ plan: null })
    const res = await changePlan({ ...base, planId: "pro", periodEnd: NEXT_YEAR, amountNgn: 30000, paymentReference: "TRF-1" })
    expect(res).toEqual({ ok: true })
    expect(applySubscription).toHaveBeenCalledWith(
      expect.objectContaining({ action: "start", userId: USER, planId: "pro", amountNgn: 30000, paymentReference: "TRF-1", changedBy: ADMIN }),
    )
    expect(recordEventLater).toHaveBeenCalledWith(expect.objectContaining({ name: "plan.changed", props: { from: "community", to: "pro", source: "manual" } }))
    expect(sendNotice).toHaveBeenCalledWith(expect.objectContaining({ to: "ada@example.ng", template: "plan-changed" }))
  })

  it("requires a reason, and refuses a period that has already ended", async () => {
    given({ plan: null })
    expect(await changePlan({ ...base, reason: "", planId: "pro", periodEnd: NEXT_YEAR })).toMatchObject({ ok: false })
    expect(await changePlan({ ...base, planId: "pro", periodEnd: "2020-01-01" })).toMatchObject({ ok: false })
    expect(applySubscription).not.toHaveBeenCalled()
  })

  it("does not email when notify is off", async () => {
    given({ plan: null })
    await changePlan({ ...base, notify: false, planId: "starter", periodEnd: NEXT_YEAR })
    expect(sendNotice).not.toHaveBeenCalled()
  })

  it("refuses a downgrade dressed as a change", async () => {
    given({ plan: "pro", active: { id: "s", period_end: null } })
    expect(await changePlan({ ...base, planId: "starter", periodEnd: NEXT_YEAR })).toMatchObject({ ok: false })
  })

  it("surfaces a database refusal", async () => {
    given({ plan: null })
    vi.mocked(applySubscription).mockResolvedValue("no_account")
    expect(await changePlan({ ...base, planId: "pro", periodEnd: NEXT_YEAR })).toEqual({ ok: false, error: "That user has no builder account." })
  })
})

describe("downgrade", () => {
  it("at period end writes a scheduled row and changes no plan yet", async () => {
    given({ plan: "pro", active: { id: "s", period_end: "2099-01-01T00:00:00Z" } })
    expect(await downgrade({ ...base, planId: "community", when: "period_end" })).toEqual({ ok: true })
    expect(applySubscription).toHaveBeenCalledWith(expect.objectContaining({ action: "schedule", planId: "community" }))
    expect(recordEventLater).not.toHaveBeenCalled()
  })

  it("to Community now ends the active subscription", async () => {
    given({ plan: "starter", active: { id: "s", period_end: "2099-01-01T00:00:00Z" } })
    await downgrade({ ...base, planId: "community", when: "now" })
    expect(applySubscription).toHaveBeenCalledWith(expect.objectContaining({ action: "end", userId: USER, changedBy: ADMIN }))
  })

  it("refuses an upgrade, and a period-end downgrade with no period", async () => {
    given({ plan: "starter", active: { id: "s", period_end: null } })
    expect(await downgrade({ ...base, planId: "starter", when: "now" })).toMatchObject({ ok: false })
    expect(await downgrade({ ...base, planId: "community", when: "period_end" })).toMatchObject({ ok: false })
    expect(applySubscription).not.toHaveBeenCalled()
  })
})

describe("extend", () => {
  it("moves the period end and refuses one that is not later", async () => {
    given({ plan: "pro", active: { id: "s", period_end: "2026-11-01T00:00:00Z" } })
    expect(await extend({ userId: USER, periodEnd: NEXT_YEAR, notify: false })).toEqual({ ok: true })
    expect(applySubscription).toHaveBeenCalledWith(expect.objectContaining({ action: "extend" }))
    expect(await extend({ userId: USER, periodEnd: "2026-10-01", notify: false })).toMatchObject({ ok: false })
  })
})
