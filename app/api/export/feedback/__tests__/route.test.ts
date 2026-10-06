import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({ requireAccount: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("server-only", () => ({}))
// The real tooManyResponse, a stubbed check: the store is rateLimitDb.test.ts's.
vi.mock("@/lib/rateLimitDb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rateLimitDb")>()),
  checkRateLimit: vi.fn(async () => ({ ok: true })),
}))

import { GET } from "@/app/api/export/feedback/route"
import { requireAccount } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rateLimitDb"

const ME = "11111111-1111-4111-8111-111111111111"
const TESTER = "22222222-2222-4222-8222-222222222222"

type Query = { table: string; filters: Record<string, unknown> }

/**
 * The route's one read: a chain ending in an await. `queries` records what was
 * asked for, which is how the ownership assertions check the filter rather
 * than only the output. `profiles` is offered so a test can prove it is never
 * read.
 */
function fakeAdmin(opts: {
  submissions?: unknown[]
  profiles?: { id: string; full_name: string | null }[]
  error?: { message: string }
} = {}) {
  const queries: Query[] = []

  const from = (table: string) => {
    const state: Query = { table, filters: {} }
    queries.push(state)
    const chain = {
      select: () => chain,
      order: () => chain,
      eq(column: string, value: unknown) {
        state.filters[column] = value
        return chain
      },
      in(column: string, values: unknown[]) {
        state.filters[column] = values
        return Promise.resolve({ data: opts.profiles ?? [], error: null })
      },
      then(resolve: (r: { data: unknown; error: unknown }) => unknown) {
        return Promise.resolve(
          resolve({ data: opts.submissions ?? [], error: opts.error ?? null }),
        )
      },
    }
    return chain
  }

  vi.mocked(createAdminClient).mockReturnValue(
    { from } as unknown as ReturnType<typeof createAdminClient>,
  )
  return queries
}

const BASE = "http://localhost:3000/api/export/feedback"
const req = (query = "") => new Request(`${BASE}${query}`)
const ONE_MISSION = "?project=p1&mission=m-auth"
const WHOLE_PROJECT = "?project=p1"

const project = { name: "Recipe Book", owner_id: ME }
const AUTH = { title: "Auth flow", created_at: "2026-09-01T00:00:00Z", category: "process_flow", device_target: "both", projects: project }
const PAY = { title: "Payment flow", created_at: "2026-09-05T00:00:00Z", category: "component", device_target: "mobile", projects: project }

/** A modern submission with two entries, on a project I own. */
const MINE = {
  id: "r-mine",
  mission_id: "m-auth",
  created_at: "2026-09-20T10:00:00.000Z",
  status: "approved",
  rating: 5,
  tester_comment: "Nothing else to add.",
  ai_sentiment: "POSITIVE",
  screenshot_urls: ["a.png", "b.png"],
  missions: AUTH,
  test_result_entries: [
    {
      step_index: 1,
      step_action: "Submit the form",
      step_expected: "The account is created",
      status: "fail",
      actual_result: "No email arrived",
      issue_summary: "Verification never sends",
      steps_to_reproduce: "1. Sign up. 2. Wait.",
    },
    {
      step_index: 0,
      step_action: "Open the app",
      step_expected: "A sign-up form appears",
      status: "pass",
      actual_result: "",
      issue_summary: null,
      steps_to_reproduce: null,
    },
  ],
}

/** A submission that predates the audit log: a comment and no entries. */
const LEGACY = {
  ...MINE,
  id: "r-legacy",
  created_at: "2026-09-21T10:00:00.000Z",
  tester_comment: "The checkout felt slow but nothing broke.",
  screenshot_urls: ["only.png"],
  test_result_entries: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAccount).mockResolvedValue({ userId: ME })
})

const body = async (r: Response) => await r.text()

/**
 * The workbook is a zip written uncompressed, so its XML is readable as text
 * straight off the bytes: sheet names, and each sheet's cells in order.
 */
async function workbook(r: Response) {
  const text = new TextDecoder().decode(await r.arrayBuffer())
  const sheets = [...text.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1])
  const sheetXml = [...text.matchAll(/<worksheet[\s\S]*?<\/worksheet>/g)].map((m) => m[0])
  return { text, sheets, sheetXml }
}

describe("authentication", () => {
  it("is rejected, without touching the database", async () => {
    // requireAccount redirects, which throws. app/api is outside the
    // middleware matcher, so this is the ONLY gate on the route.
    const queries = fakeAdmin()
    vi.mocked(requireAccount).mockRejectedValue(new Error("NEXT_REDIRECT"))

    await expect(GET(req(ONE_MISSION))).rejects.toThrow("NEXT_REDIRECT")
    expect(queries).toHaveLength(0)
  })

  it("asks for a verified builder specifically", async () => {
    fakeAdmin()
    await GET(req(ONE_MISSION))
    expect(requireAccount).toHaveBeenCalledWith("builder")
  })
})

describe("scope and ownership", () => {
  it("refuses a request with no project, before querying", async () => {
    const queries = fakeAdmin()
    const res = await GET(req())
    expect(res.status).toBe(400)
    expect(queries).toHaveLength(0)
  })

  it("always filters by the caller's own owner_id, and the project in addition", async () => {
    // Service role bypasses RLS, so the owner filter is the only thing keeping
    // one builder's export out of another's. A project id the caller does not
    // own then matches nothing.
    const queries = fakeAdmin({ submissions: [MINE] })
    await GET(req(WHOLE_PROJECT))
    expect(queries[0].filters["missions.projects.owner_id"]).toBe(ME)
    expect(queries[0].filters["missions.project_id"]).toBe("p1")
    expect(queries[0].filters["mission_id"]).toBeUndefined()
  })

  it("narrows to one mission in addition to the owner and project filters", async () => {
    const queries = fakeAdmin({ submissions: [MINE] })
    await GET(req(ONE_MISSION))
    expect(queries[0].filters["missions.projects.owner_id"]).toBe(ME)
    expect(queries[0].filters["missions.project_id"]).toBe("p1")
    expect(queries[0].filters["mission_id"]).toBe("m-auth")
  })

  it("answers the same 404 for someone else's project and for no reports", async () => {
    // Distinguishing "not yours" from "nothing yet" would confirm it exists.
    fakeAdmin({ submissions: [] })
    const a = await GET(req("?project=someone-elses"))
    const b = await GET(req("?project=p1&mission=empty"))
    expect(a.status).toBe(404)
    expect(b.status).toBe(404)
    expect(await body(a)).toBe(await body(b))
  })
})

describe("one mission, as CSV", () => {
  it("writes one row per entry, in step order, repeating the submission columns", async () => {
    fakeAdmin({ submissions: [MINE] })
    const rows = (await body(await GET(req(ONE_MISSION)))).split("\r\n")

    expect(rows).toHaveLength(3)
    // The fixture lists step 1 before step 0; the export sorts them.
    expect(rows[1]).toContain("Open the app")
    expect(rows[2]).toContain("Submit the form")
    expect(rows[1]).toContain("Recipe Book")
    expect(rows[2]).toContain("Recipe Book")
  })

  it("gives a legacy comment-only submission one row, with empty step columns", async () => {
    // Twenty-four submissions predate the audit log. An entries loop that
    // skipped them would drop all twenty-four silently.
    fakeAdmin({ submissions: [LEGACY] })
    const rows = (await body(await GET(req(ONE_MISSION)))).split("\r\n")

    expect(rows).toHaveLength(2)
    expect(rows[1]).toContain("The checkout felt slow")
    expect(rows[1]).toMatch(/,{7}/)
  })

  it("renders the vocabulary as labels rather than machine values", async () => {
    fakeAdmin({ submissions: [MINE] })
    const text = await body(await GET(req(ONE_MISSION)))
    expect(text).toContain("Process Flow Testing")
    expect(text).toContain("Mobile & Desktop")
    expect(text).not.toContain("process_flow")
  })

  it("starts with the BOM bytes, or Excel mangles non-ASCII", async () => {
    // Checked as BYTES, not through .text(): the UTF-8 decode algorithm
    // strips a leading BOM, so reading the body as a string cannot tell a
    // file that has one from a file that does not. Excel reads bytes.
    fakeAdmin({ submissions: [MINE] })
    const bytes = new Uint8Array(await (await GET(req(ONE_MISSION))).arrayBuffer())
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])
  })

  it("is named for the project and mission", async () => {
    fakeAdmin({ submissions: [MINE] })
    const res = await GET(req(ONE_MISSION))
    expect(res.headers.get("Content-Type")).toContain("text/csv")
    expect(res.headers.get("Content-Disposition")).toMatch(
      /attachment; filename="recipe-book-auth-flow-\d{4}-\d{2}-\d{2}\.csv"/,
    )
  })
})

describe("the whole project, as a workbook", () => {
  const TWO_MISSIONS = [
    { ...LEGACY, id: "a2", mission_id: "m-auth", created_at: "2026-09-02T10:00:00Z" },
    { ...LEGACY, id: "p1", mission_id: "m-pay", missions: PAY, created_at: "2026-09-03T10:00:00Z" },
    { ...LEGACY, id: "a1", mission_id: "m-auth", created_at: "2026-09-01T10:00:00Z" },
  ]

  it("is an .xlsx named for the project", async () => {
    fakeAdmin({ submissions: TWO_MISSIONS })
    const res = await GET(req(WHOLE_PROJECT))
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    expect(res.headers.get("Content-Disposition")).toMatch(
      /attachment; filename="recipe-book-feedback-\d{4}-\d{2}-\d{2}\.xlsx"/,
    )
    // A zip: "PK".
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b])
  })

  it("has one sheet per mission, named for it, oldest mission first", async () => {
    fakeAdmin({ submissions: TWO_MISSIONS })
    const { sheets, sheetXml } = await workbook(await GET(req(WHOLE_PROJECT)))
    expect(sheets).toEqual(["Auth flow", "Payment flow"])
    expect(sheetXml[0]).toContain("Auth flow")
    expect(sheetXml[0]).not.toContain("Payment flow")
    expect(sheetXml[1]).toContain("Payment flow")
  })

  it("numbers testers within each mission, restarting on each sheet", async () => {
    fakeAdmin({ submissions: TWO_MISSIONS })
    const { sheetXml } = await workbook(await GET(req(WHOLE_PROJECT)))
    // Column F is the tester number.
    const numbers = (xml: string) => [...xml.matchAll(/<c r="F\d+"><v>(\d+)<\/v><\/c>/g)].map((m) => m[1])
    // Sorted: the fake ignores .order(); the route sorts in the query.
    expect(numbers(sheetXml[0]).sort()).toEqual(["1", "2"])
    expect(numbers(sheetXml[1])).toEqual(["1"])
  })
})

describe("tester numbers", () => {
  const col = (row: string) => row.split(",")[5]

  it("heads the column as per-mission, and numbers oldest first", async () => {
    fakeAdmin({
      submissions: [
        { ...LEGACY, id: "a2", created_at: "2026-09-02T10:00:00Z" },
        { ...LEGACY, id: "a1", created_at: "2026-09-01T10:00:00Z" },
      ],
    })
    const [header, ...rows] = (await body(await GET(req(ONE_MISSION)))).split("\r\n")
    expect(col(header)).toBe("Tester # (per mission)")
    expect(rows.map(col).sort()).toEqual(["1", "2"])
  })

  it("gives the same numbers on a second export of the same data", async () => {
    const data = [
      { ...LEGACY, id: "x", created_at: "2026-09-01T10:00:00Z" },
      { ...LEGACY, id: "y", created_at: "2026-09-01T10:00:00Z" },
    ]
    fakeAdmin({ submissions: data })
    const first = await body(await GET(req(ONE_MISSION)))
    fakeAdmin({ submissions: [...data].reverse() })
    const second = await body(await GET(req(ONE_MISSION)))

    expect(second.split("\r\n").slice(1).sort()).toEqual(first.split("\r\n").slice(1).sort())
  })
})

describe("what the file must and must not contain", () => {
  it("carries no tester name, and never looks one up", async () => {
    // Builders do not learn who tested. The profiles read is gone, not merely
    // unused — this is what keeps it gone.
    const queries = fakeAdmin({
      submissions: [MINE],
      profiles: [{ id: TESTER, full_name: "Ada Lovelace" }],
    })
    for (const q of [ONE_MISSION, WHOLE_PROJECT]) {
      const text = new TextDecoder().decode(await (await GET(req(q))).arrayBuffer())
      expect(text).not.toContain("Ada Lovelace")
      expect(text).not.toContain(TESTER)
    }
    expect(queries.every((q) => q.table === "test_results")).toBe(true)
  })

  it("never carries an email address", async () => {
    // A CSV leaves your control the moment it is downloaded. The route does
    // not select the column at all, and this is what keeps it that way.
    const queries = fakeAdmin({ submissions: [MINE] })
    const text = await body(await GET(req(ONE_MISSION)))

    expect(text).not.toMatch(/@\w+\.\w/)
    expect(JSON.stringify(queries)).not.toContain("email")
  })

  it("is never cached — it is one person's own data", async () => {
    fakeAdmin({ submissions: [MINE] })
    expect((await GET(req(ONE_MISSION))).headers.get("Cache-Control")).toBe("no-store")
    expect((await GET(req(WHOLE_PROJECT))).headers.get("Cache-Control")).toBe("no-store")
  })
})

describe("failure", () => {
  it("answers 500 rather than a half-built file", async () => {
    fakeAdmin({ error: { message: "connection reset" } })
    const res = await GET(req(ONE_MISSION))
    expect(res.status).toBe(500)
    // A partial file is worse than no file: it looks like a complete export.
    expect(await body(res)).not.toContain("Project,Mission")
  })
})

describe("the export rate limit", () => {
  it("answers 429 with Retry-After, keyed on the account, before the query", async () => {
    const queries = fakeAdmin()
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 1200 })

    const res = await GET(req(ONE_MISSION))

    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("1200")
    expect(await body(res)).toBe("Too many attempts. Try again in 20 minutes.")
    expect(queries).toHaveLength(0)
    expect(checkRateLimit).toHaveBeenCalledWith(["export:account", ME])
  })
})
