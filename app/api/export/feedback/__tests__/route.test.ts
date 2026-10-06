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
 * The route's two reads: the submissions query (a chain ending in an await)
 * and the profile name lookup (`.in()`).
 *
 * `queries` records what was asked for, which is how the ownership assertions
 * check the filter rather than only the output.
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

const req = (url = "http://localhost:3000/api/export/feedback") => new Request(url)

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
  missions: {
    title: "Authentication Flow",
    category: "process_flow",
    device_target: "both",
    projects: { name: "My Project", owner_id: ME },
  },
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

describe("tester numbers", () => {
  const col = (row: string) => row.split(",")[5]

  it("numbers testers per mission, oldest first, restarting on each mission", async () => {
    fakeAdmin({
      submissions: [
        { ...LEGACY, id: "a2", mission_id: "A", created_at: "2026-09-02T10:00:00Z" },
        { ...LEGACY, id: "b1", mission_id: "B", created_at: "2026-09-03T10:00:00Z" },
        { ...LEGACY, id: "a1", mission_id: "A", created_at: "2026-09-01T10:00:00Z" },
      ],
    })
    const [header, ...rows] = (await body(await GET(req()))).split("\r\n")

    expect(col(header)).toBe("Tester # (per mission)")
    expect(rows.map(col)).toEqual(["2", "1", "1"])
  })

  it("gives the same numbers on a second export of the same data", async () => {
    const data = [
      { ...LEGACY, id: "x", mission_id: "A", created_at: "2026-09-01T10:00:00Z" },
      { ...LEGACY, id: "y", mission_id: "A", created_at: "2026-09-01T10:00:00Z" },
    ]
    fakeAdmin({ submissions: data })
    const first = await body(await GET(req()))
    fakeAdmin({ submissions: [...data].reverse() })
    const second = await body(await GET(req()))

    expect(second.split("\r\n").slice(1).sort()).toEqual(first.split("\r\n").slice(1).sort())
  })
})

describe("authentication", () => {
  it("is rejected, without touching the database", async () => {
    // requireAccount redirects, which throws. app/api is outside the
    // middleware matcher, so this is the ONLY gate on the route.
    const queries = fakeAdmin()
    vi.mocked(requireAccount).mockRejectedValue(new Error("NEXT_REDIRECT"))

    await expect(GET(req())).rejects.toThrow("NEXT_REDIRECT")
    expect(queries).toHaveLength(0)
  })

  it("asks for a verified builder specifically", async () => {
    fakeAdmin()
    await GET(req())
    expect(requireAccount).toHaveBeenCalledWith("builder")
  })
})

describe("ownership", () => {
  it("filters every read by the caller's own owner_id", async () => {
    // Service role bypasses RLS, so this filter is the only thing keeping one
    // builder's export out of another's.
    const queries = fakeAdmin({ submissions: [MINE] })
    await GET(req())
    expect(queries[0].filters["missions.projects.owner_id"]).toBe(ME)
  })

  it("narrows by project IN ADDITION to the owner filter, never instead", async () => {
    // A project id the caller does not own then matches nothing, rather than
    // returning somebody else's feedback.
    const queries = fakeAdmin({ submissions: [] })
    await GET(req("http://localhost:3000/api/export/feedback?project=someone-elses"))

    expect(queries[0].filters["missions.projects.owner_id"]).toBe(ME)
    expect(queries[0].filters["missions.project_id"]).toBe("someone-elses")
  })

  it("exports nothing but a header when the scope matches nothing", async () => {
    fakeAdmin({ submissions: [] })
    const text = await body(await GET(req("http://localhost:3000/api/export/feedback?project=nope")))

    expect(text).toContain("Project,Mission")
    expect(text.trim().split("\r\n")).toHaveLength(1)
  })
})

describe("the rows", () => {
  it("writes one per entry, in step order, repeating the submission columns", async () => {
    fakeAdmin({ submissions: [MINE], profiles: [{ id: TESTER, full_name: "Ada Lovelace" }] })
    const rows = (await body(await GET(req()))).split("\r\n")

    expect(rows).toHaveLength(3)
    // The fixture lists step 1 before step 0; the export sorts them.
    expect(rows[1]).toContain("Open the app")
    expect(rows[2]).toContain("Submit the form")
    // Submission columns repeat on both.
    expect(rows[1]).toContain("My Project")
    expect(rows[2]).toContain("My Project")
  })

  it("gives a legacy comment-only submission one row, with empty step columns", async () => {
    // Twenty-four submissions predate the audit log. An entries loop that
    // skipped them would drop all twenty-four silently.
    fakeAdmin({ submissions: [LEGACY], profiles: [{ id: TESTER, full_name: "Ada" }] })
    const rows = (await body(await GET(req()))).split("\r\n")

    expect(rows).toHaveLength(2)
    expect(rows[1]).toContain("The checkout felt slow")
    // Columns 10-16 are the step columns: empty, so a run of commas.
    expect(rows[1]).toMatch(/,{7}/)
  })

  it("renders the vocabulary as labels rather than machine values", async () => {
    fakeAdmin({ submissions: [MINE], profiles: [] })
    const text = await body(await GET(req()))
    expect(text).toContain("Process Flow Testing")
    expect(text).toContain("Mobile & Desktop")
    expect(text).not.toContain("process_flow")
  })
})

describe("what the file must and must not contain", () => {
  it("starts with the BOM bytes, or Excel mangles non-ASCII", async () => {
    // Checked as BYTES, not through .text(): the UTF-8 decode algorithm
    // strips a leading BOM, so reading the body as a string cannot tell a
    // file that has one from a file that does not. Excel reads bytes.
    fakeAdmin({ submissions: [] })
    const bytes = new Uint8Array(await (await GET(req())).arrayBuffer())
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf])
  })

  it("carries no tester name, and never looks one up", async () => {
    // Builders do not learn who tested. The profiles read is gone, not merely
    // unused — this is what keeps it gone.
    const queries = fakeAdmin({
      submissions: [MINE],
      profiles: [{ id: TESTER, full_name: "Ada Lovelace" }],
    })
    const text = await body(await GET(req()))

    expect(text).not.toContain("Ada Lovelace")
    expect(text).not.toContain(TESTER)
    expect(queries.map((q) => q.table)).toEqual(["test_results"])
  })

  it("never carries an email address", async () => {
    // A CSV leaves your control the moment it is downloaded. The route does
    // not select the column at all, and this is what keeps it that way.
    const queries = fakeAdmin({
      submissions: [MINE],
      profiles: [{ id: TESTER, full_name: "Ada Lovelace" }],
    })
    const text = await body(await GET(req()))

    expect(text).not.toMatch(/@\w+\.\w/)
    expect(JSON.stringify(queries)).not.toContain("email")
  })

  it("offers a dated attachment filename", async () => {
    fakeAdmin({ submissions: [] })
    const res = await GET(req())
    expect(res.headers.get("Content-Type")).toContain("text/csv")
    expect(res.headers.get("Content-Disposition")).toMatch(
      /attachment; filename="twnhall-feedback-\d{4}-\d{2}-\d{2}\.csv"/,
    )
  })

  it("is never cached — it is one person's own data", async () => {
    fakeAdmin({ submissions: [] })
    expect((await GET(req())).headers.get("Cache-Control")).toBe("no-store")
  })
})

describe("failure", () => {
  it("answers 500 rather than a half-built file", async () => {
    fakeAdmin({ error: { message: "connection reset" } })
    const res = await GET(req())
    expect(res.status).toBe(500)
    // A partial CSV is worse than no CSV: it looks like a complete export.
    expect(await body(res)).not.toContain("Project,Mission")
  })
})

describe("the export rate limit", () => {
  it("answers 429 with Retry-After, keyed on the account, before the query", async () => {
    const queries = fakeAdmin()
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 1200 })

    const res = await GET(req())

    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("1200")
    expect(await body(res)).toBe("Too many attempts. Try again in 20 minutes.")
    expect(queries).toHaveLength(0)
    expect(checkRateLimit).toHaveBeenCalledWith(["export:account", ME])
  })
})
