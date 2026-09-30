import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))

import {
  closeMission,
  grantSignup,
  publishMission,
  reportLanded,
} from "@/lib/allowanceDb"
import { createAdminClient } from "@/lib/supabase/admin"

// An in-memory stand-in for the three tables and the RPCs, implementing the
// same contract as supabase/migrations/20260930_01_report_ledger.sql: an RPC
// refuses ("stale") when the ledger no longer has the row count the caller
// computed against. That contract is what stops two publishes spending the
// same slot, so it is what these tests exercise.

const BUILDER = "b0000000-0000-4000-8000-000000000001"
const M1 = "m1"
const M2 = "m2"

type Ledger = { profile_id: string; mission_id: string | null; kind: string; bucket: string; period: string | null; slots: number }

let ledger: Ledger[]
let missions: Record<string, { owner: string; is_active: boolean | null; testers_needed: number | null }>
let received: Record<string, number>
let planId: string | null

const tick = () => new Promise((r) => setTimeout(r, 0))

function install() {
  const admin = {
    from(table: string) {
      const filters: Record<string, unknown> = {}
      const chain = {
        select: () => chain,
        eq(col: string, val: unknown) {
          filters[col] = val
          return chain
        },
        async maybeSingle() {
          await tick()
          return { data: { id: "acct-builder", plan_id: planId } }
        },
        async insert(row: Ledger) {
          await tick()
          if (row.kind === "grant" && ledger.some((l) => l.kind === "grant" && l.profile_id === row.profile_id)) {
            return { error: { code: "23505", message: "duplicate" } }
          }
          ledger.push({ ...row, mission_id: row.mission_id ?? null, period: row.period ?? null })
          return { error: null }
        },
        then(resolve: (r: unknown) => unknown) {
          return tick().then(() => {
            if (table === "report_ledger") {
              return resolve({ data: ledger.filter((l) => l.profile_id === filters.profile_id), error: null })
            }
            if (table === "test_results") {
              return resolve({ count: received[filters.mission_id as string] ?? 0, error: null })
            }
            return resolve({ data: null, error: null })
          })
        },
      }
      return chain
    },
    async rpc(name: string, a: Record<string, unknown>) {
      await tick()
      const rows = a.p_rows as { bucket: string; period: string | null; slots: number }[]
      const mission = missions[a.p_mission_id as string]
      if (name === "report_landed") throw new Error("connection reset")
      if (!mission || mission.owner !== a.p_profile_id) return { data: "not_found", error: null }
      const count = ledger.filter((l) => l.profile_id === a.p_profile_id).length

      if (name === "publish_mission") {
        if (mission.is_active !== false) return { data: "already", error: null }
        if (count !== a.p_seen_rows) return { data: "stale", error: null }
        const live = Object.values(missions).filter((m) => m.owner === a.p_profile_id && m.is_active !== false)
        if (live.length >= (a.p_active_limit as number)) return { data: "active_limit", error: null }
        for (const r of rows) ledger.push({ profile_id: BUILDER, mission_id: a.p_mission_id as string, kind: "reserved", ...r })
        mission.is_active = true
        mission.testers_needed = a.p_testers as number
        return { data: "ok", error: null }
      }
      if (name === "close_mission") {
        if (count !== a.p_seen_rows || (received[a.p_mission_id as string] ?? 0) !== a.p_seen_received) {
          return { data: "stale", error: null }
        }
        for (const r of rows) ledger.push({ profile_id: BUILDER, mission_id: a.p_mission_id as string, kind: "released", ...r })
        mission.is_active = false
        return { data: "ok", error: null }
      }
      throw new Error(`unexpected rpc ${name}`)
    },
  }
  vi.mocked(createAdminClient).mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>)
}

const reservedFor = (mission: string) =>
  ledger.filter((l) => l.mission_id === mission && l.kind === "reserved")
const releasedFor = (mission: string) =>
  ledger.filter((l) => l.mission_id === mission && l.kind === "released")
const grantRow = (): Ledger => ({ profile_id: BUILDER, mission_id: null, kind: "grant", bucket: "grant", period: null, slots: 3 })

beforeEach(() => {
  vi.clearAllMocks()
  ledger = []
  missions = {
    [M1]: { owner: BUILDER, is_active: false, testers_needed: null },
    [M2]: { owner: BUILDER, is_active: false, testers_needed: null },
  }
  received = {}
  planId = null
  install()
})

describe("publishMission", () => {
  it("caps a Community builder with 3 reports to a 3-tester mission", async () => {
    ledger.push(grantRow())
    const outcome = await publishMission(M1, BUILDER)
    expect(outcome).toEqual({ status: "published", slots: 3, requested: 5 })
    expect(missions[M1]).toMatchObject({ is_active: true, testers_needed: 3 })
    expect(reservedFor(M1)).toEqual([expect.objectContaining({ bucket: "grant", slots: -3 })])
  })

  it("refuses at zero and leaves the mission a draft", async () => {
    expect(await publishMission(M1, BUILDER)).toEqual({ status: "empty" })
    expect(missions[M1].is_active).toBe(false)
    expect(ledger).toEqual([])
  })

  it("spends a Pro builder's monthly allowance, not their earned credit", async () => {
    planId = "pro"
    ledger.push({ profile_id: BUILDER, mission_id: "x", kind: "earned", bucket: "earned", period: null, slots: 1 })
    await publishMission(M1, BUILDER)
    expect(reservedFor(M1)).toEqual([expect.objectContaining({ bucket: "monthly", slots: -5 })])
  })

  it("lets only one of two concurrent publishes take the last slots", async () => {
    ledger.push(grantRow())
    const [a, b] = await Promise.all([publishMission(M1, BUILDER), publishMission(M2, BUILDER)])
    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual(["empty", "published"])
    expect(ledger.filter((l) => l.kind === "reserved").reduce((n, l) => n + l.slots, 0)).toBe(-3)
  })

  it("does not reserve twice for a double-click", async () => {
    planId = "pro"
    await publishMission(M1, BUILDER)
    expect(await publishMission(M1, BUILDER)).toEqual({ status: "already" })
    expect(reservedFor(M1)).toHaveLength(1)
  })

  it("refuses at the active-mission limit", async () => {
    ledger.push(grantRow(), { ...grantRow(), kind: "earned", bucket: "earned", mission_id: "y" })
    missions.a = { owner: BUILDER, is_active: true, testers_needed: null }
    missions.b = { owner: BUILDER, is_active: null, testers_needed: null } // null counts as live
    expect(await publishMission(M1, BUILDER)).toEqual({ status: "active_limit", limit: 2 })
    expect(reservedFor(M1)).toEqual([])
  })
})

describe("closeMission", () => {
  it("returns the unused remainder", async () => {
    ledger.push(grantRow())
    await publishMission(M1, BUILDER)
    received[M1] = 1
    await closeMission(M1, BUILDER)
    expect(releasedFor(M1)).toEqual([expect.objectContaining({ bucket: "grant", slots: 2 })])
    expect(missions[M1].is_active).toBe(false)
  })

  it("returns nothing when every slot was filled", async () => {
    ledger.push(grantRow())
    await publishMission(M1, BUILDER)
    received[M1] = 3
    await closeMission(M1, BUILDER)
    expect(releasedFor(M1)).toEqual([])
  })

  it("releases once when closed twice, even concurrently", async () => {
    ledger.push(grantRow())
    await publishMission(M1, BUILDER)
    received[M1] = 1
    await Promise.all([closeMission(M1, BUILDER), closeMission(M1, BUILDER)])
    await closeMission(M1, BUILDER)
    expect(releasedFor(M1).reduce((n, l) => n + l.slots, 0)).toBe(2)
  })

  it("closes a mission published before the ledger without releasing anything", async () => {
    missions[M1].is_active = null
    await closeMission(M1, BUILDER)
    expect(ledger).toEqual([])
    expect(missions[M1].is_active).toBe(false)
  })

  it("refuses someone else's mission", async () => {
    missions[M1].owner = "someone-else"
    await expect(closeMission(M1, BUILDER)).rejects.toThrow("Not authorized")
  })
})

describe("grantSignup", () => {
  it("grants once per profile, silently refusing the second account's grant", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    await grantSignup(BUILDER, "acct-builder")
    await grantSignup(BUILDER, "acct-tester")
    expect(ledger.filter((l) => l.kind === "grant")).toHaveLength(1)
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })
})

describe("reportLanded", () => {
  it("never throws, and logs the alert tag", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(reportLanded("r1")).resolves.toBeUndefined()
    expect(log).toHaveBeenCalledWith("[allowance] missed credit", "report", "r1", expect.anything())
    log.mockRestore()
  })
})
