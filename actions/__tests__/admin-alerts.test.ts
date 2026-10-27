import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth", () => ({ requireAdmin: vi.fn() }))

import { acknowledgeAlert, resolveAlert, updateAlertRule } from "@/actions/admin/alerts"
import { requireAdmin } from "@/lib/auth"

const ADMIN = "11111111-1111-4111-8111-111111111111"
const ALERT = "33333333-3333-4333-8333-333333333333"

let writes: { table: string; patch: Record<string, unknown>; where: [string, unknown][] }[]
function asAdmin(error: { message: string } | null = null) {
  writes = []
  vi.mocked(requireAdmin).mockResolvedValue({
    adminUserId: ADMIN,
    admin: {
      from: (table: string) => ({
        update: (patch: Record<string, unknown>) => {
          const w = { table, patch, where: [] as [string, unknown][] }
          writes.push(w)
          const q = {
            eq: (c: string, v: unknown) => (w.where.push([c, v]), q),
            neq: (c: string, v: unknown) => (w.where.push([`not ${c}`, v]), q),
            then: (r: (v: unknown) => void) => r({ error }),
          }
          return q
        },
      }),
    },
  } as never)
}

beforeEach(() => vi.clearAllMocks())

describe("alert actions", () => {
  it("refuse a non-admin without writing", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Not authorized"))
    await expect(acknowledgeAlert(ALERT)).rejects.toThrow("Not authorized")
    await expect(resolveAlert(ALERT)).rejects.toThrow("Not authorized")
  })

  it("acknowledge records who, and only moves an open alert", async () => {
    asAdmin()
    await acknowledgeAlert(ALERT)
    expect(writes[0]).toMatchObject({ table: "alerts", patch: { status: "acknowledged", acknowledged_by: ADMIN } })
    expect(writes[0].where).toEqual([["id", ALERT], ["status", "open"]])
  })

  it("resolve closes a live alert and surfaces a database error", async () => {
    asAdmin({ message: "connection reset" })
    await expect(resolveAlert(ALERT)).rejects.toThrow("connection reset")
    expect(writes[0].patch.status).toBe("resolved")
  })

  it("updates a rule from its form, refusing an unknown key", async () => {
    asAdmin()
    const fd = new FormData()
    fd.set("key", "server_errors")
    fd.set("threshold", "8")
    fd.set("cooldown_minutes", "120")
    fd.set("enabled", "on")
    await updateAlertRule(fd)
    expect(writes[0]).toMatchObject({ table: "alert_rules", patch: { threshold: 8, cooldown_minutes: 120, enabled: true, email: false } })
    fd.set("key", "drop_tables")
    await expect(updateAlertRule(fd)).rejects.toThrow()
  })
})
