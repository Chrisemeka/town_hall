import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/auth", () => ({ adminRecipients: vi.fn(async () => [{ id: "a", email: "ops@twnhall.com", name: "Ops" }]) }))
vi.mock("@/lib/mail", () => ({ sendNotice: vi.fn() }))
vi.mock("@/lib/cohortDb", () => ({ payoutSheet: vi.fn() }))

import { paidSlotsWaiting, runAlerts } from "@/lib/alerts/run"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendNotice } from "@/lib/mail"

type Alert = { id: string; rule_key: string; status: string; value: number; notified_at: string | null; resolved_at?: string }

/** alert_rules, alerts and the uncredited count, in memory. */
function world(uncredited: { n: number }) {
  const alerts: Alert[] = []
  const rules = [{ key: "uncredited_reports", name: "Uncredited reports", description: "Make them whole.", severity: "critical", threshold: 0, window_minutes: null, cooldown_minutes: 360, email: true, enabled: true }]
  vi.mocked(createAdminClient).mockReturnValue({
    rpc: async () => ({ data: uncredited.n, error: null }),
    from: (table: string) => {
      if (table === "alert_rules") {
        const q = { select: () => q, eq: () => q, in: () => q, then: (r: (v: unknown) => void) => r({ data: rules, error: null }) }
        return q
      }
      const q = {
        select: () => q,
        eq: () => q,
        neq: () => q,
        maybeSingle: async () => ({ data: alerts.find((a) => a.status !== "resolved") ?? null }),
        insert: async (row: Omit<Alert, "id" | "status">) => (alerts.push({ ...row, id: String(alerts.length), status: "open" }), { error: null }),
        update: (patch: Partial<Alert>) => ({
          eq: async (_c: string, id: string) => Object.assign(alerts.find((a) => a.id === id)!, patch),
        }),
      }
      return q
    },
  } as never)
  return alerts
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("runAlerts", () => {
  it("opens one alert and sends one email; a re-run inside the cooldown bumps without emailing; clearing resolves", async () => {
    const state = { n: 2 }
    const alerts = world(state)

    expect(await runAlerts()).toBe(1)
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ rule_key: "uncredited_reports", status: "open", value: 2 })
    expect(sendNotice).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendNotice).mock.calls[0][0]).toMatchObject({ to: "ops@twnhall.com", template: "admin-alert" })

    state.n = 3
    await runAlerts()
    expect(alerts).toHaveLength(1)
    expect(alerts[0].value).toBe(3)
    expect(sendNotice).toHaveBeenCalledTimes(1)

    state.n = 0
    await runAlerts()
    expect(alerts[0].status).toBe("resolved")
    expect(sendNotice).toHaveBeenCalledTimes(1)
  })

  it("never throws, even when the store is gone", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("down")
    })
    await expect(runAlerts()).resolves.toBe(0)
  })
})

describe("paidSlotsWaiting", () => {
  const now = new Date("2026-11-10T12:00:00Z")
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()
  const reserved = (mission: string, bucket: string, slots: number, at: string) => ({
    mission_id: mission,
    kind: "reserved",
    bucket,
    period: bucket === "monthly" ? "2026-11-01" : null,
    slots: -slots,
    created_at: at,
  })

  it("fires on a paid slot waiting 4 days, not on one waiting 2", () => {
    const rows = [reserved("old", "monthly", 5, daysAgo(4)), reserved("new", "monthly", 5, daysAgo(2))]
    const missions = [{ id: "old", received: 1 }, { id: "new", received: 1 }]
    expect(paidSlotsWaiting(missions, rows, now, 3)).toEqual(["old"])
  })

  it("counts carried slots as paid", () => {
    expect(paidSlotsWaiting([{ id: "m", received: 0 }], [reserved("m", "carried", 2, daysAgo(4))], now, 3)).toEqual(["m"])
  })

  it("ignores a test case funded only by the free grant", () => {
    expect(paidSlotsWaiting([{ id: "m", received: 0 }], [reserved("m", "grant", 3, daysAgo(10))], now, 3)).toEqual([])
  })

  it("ignores a full one", () => {
    expect(paidSlotsWaiting([{ id: "m", received: 5 }], [reserved("m", "monthly", 5, daysAgo(10))], now, 3)).toEqual([])
  })

  it("ignores a closed one: its slots were released", () => {
    const rows = [
      reserved("m", "monthly", 5, daysAgo(10)),
      { mission_id: "m", kind: "released", bucket: "monthly", period: "2026-11-01", slots: 4, created_at: daysAgo(9) },
    ]
    expect(paidSlotsWaiting([{ id: "m", received: 1 }], rows, now, 3)).toEqual([])
  })

  it("measures a reopened test case from its latest reservation", () => {
    const rows = [
      reserved("m", "monthly", 5, daysAgo(30)),
      { mission_id: "m", kind: "released", bucket: "monthly", period: "2026-11-01", slots: 5, created_at: daysAgo(29) },
      reserved("m", "monthly", 5, daysAgo(1)),
    ]
    expect(paidSlotsWaiting([{ id: "m", received: 0 }], rows, now, 3)).toEqual([])
  })
})
