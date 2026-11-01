import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/cohortDb", () => ({ missionsForTester: vi.fn() }))

import { newMissionCount, newMissionsFor } from "@/lib/newMissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { missionsForTester } from "@/lib/cohortDb"

const ME = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const SINCE = "2026-11-01T00:00:00.000Z"

type Row = Record<string, unknown>
const mission = (id: string, over: Row = {}, project: Row = {}): Row => ({
  id,
  title: `Test ${id}`,
  category: "process_flow",
  device_target: "both",
  is_active: true,
  first_published_at: "2026-11-02T00:00:00.000Z",
  projects: { name: "Acme", owner_id: OTHER, flagged_at: null, ...project },
  ...over,
})

/** A query builder that applies eq / is / gt / order to rows in memory, so the filters are tested, not just called. */
function table(rows: Row[]) {
  const preds: ((r: Row) => boolean)[] = []
  let order: string | null = null
  const get = (r: Row, col: string) => col.split(".").reduce<unknown>((v, k) => (v as Row | null)?.[k], r)
  const q = {
    select: () => q,
    eq: (c: string, v: unknown) => (preds.push((r) => get(r, c) === v), q),
    is: (c: string, v: unknown) => (preds.push((r) => get(r, c) === v), q),
    gt: (c: string, v: string) => (preds.push((r) => String(get(r, c) ?? "") > v), q),
    order: (c: string) => ((order = c), q),
    maybeSingle: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
    then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: run(), error: null }).then(ok),
  }
  const run = () => {
    const out = rows.filter((r) => preds.every((p) => p(r)))
    return order ? out.sort((a, b) => String(get(b, order!)).localeCompare(String(get(a, order!)))) : out
  }
  return q
}

function db(missions: Row[], tested: string[] = [], accounts: Row[] = []) {
  vi.mocked(createAdminClient).mockReturnValue({
    from: (name: string) =>
      name === "missions"
        ? table(missions)
        : name === "accounts"
          ? table(accounts)
          : table(tested.map((id) => ({ mission_id: id, tester_id: ME }))),
  } as unknown as ReturnType<typeof createAdminClient>)
}

beforeEach(() => {
  vi.mocked(missionsForTester).mockImplementation(async (_u, ids) => new Set(ids))
})

describe("newMissionsFor", () => {
  it("leaves out own projects, tested ones, drafts, flagged projects and anything not after since", async () => {
    db(
      [
        mission("keep"),
        mission("own", {}, { owner_id: ME }),
        mission("tested"),
        mission("draft", { is_active: false }),
        mission("flagged", {}, { flagged_at: "2026-11-02T00:00:00Z" }),
        mission("old", { first_published_at: SINCE }),
      ],
      ["tested"],
    )
    expect((await newMissionsFor(ME, SINCE)).map((m) => m.id)).toEqual(["keep"])
  })

  it("applies the cohort's courtesy filter", async () => {
    db([mission("paid"), mission("unpaid")])
    vi.mocked(missionsForTester).mockResolvedValue(new Set(["paid"]))
    expect((await newMissionsFor(ME, SINCE)).map((m) => m.id)).toEqual(["paid"])
  })

  it("is newest first and respects the limit", async () => {
    db([
      mission("a", { first_published_at: "2026-11-02T00:00:00Z" }),
      mission("c", { first_published_at: "2026-11-04T00:00:00Z" }),
      mission("b", { first_published_at: "2026-11-03T00:00:00Z" }),
    ])
    expect((await newMissionsFor(ME, SINCE)).map((m) => m.id)).toEqual(["c", "b", "a"])
    expect((await newMissionsFor(ME, SINCE, 2)).map((m) => m.id)).toEqual(["c", "b"])
  })

  it("never returns the owner", async () => {
    db([mission("a")])
    const [m] = await newMissionsFor(ME, SINCE)
    expect(JSON.stringify(m)).not.toContain(OTHER)
    expect(m).toEqual(expect.objectContaining({ projectName: "Acme", title: "Test a" }))
  })
})

describe("newMissionCount", () => {
  it("counts from the tester's missions_seen_at", async () => {
    db([mission("a"), mission("b", { first_published_at: "2026-10-01T00:00:00Z" })], [], [
      { user_id: ME, type: "tester", missions_seen_at: SINCE },
    ])
    expect(await newMissionCount(ME)).toBe(1)
  })

  it("is 0 rather than a thrown page when the read fails", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("column does not exist")
    })
    expect(await newMissionCount(ME)).toBe(0)
  })
})

describe("the migration", () => {
  it("sets first_published_at once, so a close and reopen is not new again", () => {
    const sql = readFileSync("supabase/migrations/20261101_02_tester_notifications.sql", "utf8")
    expect(sql).toContain("first_published_at = coalesce(first_published_at, now())")
    expect(sql).toMatch(/grant execute on function public\.publish_mission\([^)]*\) to service_role/)
  })
})
