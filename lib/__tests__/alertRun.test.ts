import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/auth", () => ({ adminRecipients: vi.fn(async () => [{ id: "a", email: "ops@twnhall.com", name: "Ops" }]) }))
vi.mock("@/lib/mail", () => ({ sendNotice: vi.fn() }))
vi.mock("@/lib/cohortDb", () => ({ payoutSheet: vi.fn() }))

import { runAlerts } from "@/lib/alerts/run"
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
