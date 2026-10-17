import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth", () => ({ requireAccount: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/rateLimitDb", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rateLimitDb")>()),
  checkRateLimit: vi.fn(async () => ({ ok: true })),
}))

import { GET } from "@/app/api/export/report/route"
import { requireAccount } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rateLimitDb"
import { REPORT_CAP, SCREENSHOT_CAP } from "@/lib/report"
import { FIVE, OWNER, report, entry } from "@/lib/__tests__/reportFixtures"

type Query = { table: string; filters: Record<string, unknown> }

/** The route's one read, recorded so the owner filter is asserted, not inferred. */
function fakeAdmin(submissions: unknown[] = []) {
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
      then(resolve: (r: { data: unknown; error: unknown }) => unknown) {
        return Promise.resolve(resolve({ data: submissions, error: null }))
      },
    }
    return chain
  }
  vi.mocked(createAdminClient).mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>)
  return queries
}

const req = (query: string) => new Request(`http://localhost:3000/api/export/report${query}`)
// Only screenshot fetches are stubbed: react-pdf's layout engine loads its
// WebAssembly through fetch too.
const realFetch = globalThis.fetch
const fetchSpy = vi.spyOn(globalThis, "fetch")
const screenshotFetches = () =>
  fetchSpy.mock.calls.filter(([url]) => String(url).startsWith("https://x.supabase.co"))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAccount).mockResolvedValue({ userId: OWNER })
  fetchSpy.mockImplementation((input, init) =>
    String(input).startsWith("https://x.supabase.co")
      ? Promise.resolve(new Response("not an image"))
      : realFetch(input, init),
  )
})

describe("the gate", () => {
  it("asks for a verified builder, and touches nothing when refused", async () => {
    // app/api is outside the middleware matcher: this is the only gate.
    const queries = fakeAdmin()
    vi.mocked(requireAccount).mockRejectedValueOnce(new Error("NEXT_REDIRECT"))
    await expect(GET(req("?project=p1"))).rejects.toThrow("NEXT_REDIRECT")
    expect(queries).toHaveLength(0)
    expect(requireAccount).toHaveBeenCalledWith("builder")
  })

  it("is rate limited on its own rule, before the query", async () => {
    const queries = fakeAdmin(FIVE)
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 1200 })
    const res = await GET(req("?project=p1"))
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("1200")
    expect(checkRateLimit).toHaveBeenCalledWith(["export:pdf:account", OWNER])
    expect(queries).toHaveLength(0)
  })
})

describe("ownership", () => {
  it("filters on the caller's own owner_id, and the project and mission in addition", async () => {
    const queries = fakeAdmin(FIVE)
    await GET(req("?project=p1&mission=m-design&screenshots=0"))
    expect(queries[0].filters).toEqual({
      "missions.projects.owner_id": OWNER,
      "missions.project_id": "p1",
      mission_id: "m-design",
    })
  })

  it("gives a builder who does not own the project nothing but the empty answer", async () => {
    // The owner filter matches no rows for someone else's project.
    fakeAdmin([])
    const res = await GET(req("?project=someone-elses"))
    expect(res.status).toBe(404)
    expect(res.headers.get("Content-Type")).not.toBe("application/pdf")
    expect(await res.text()).toBe("Nothing to export there yet.")
  })
})

describe("the cap", () => {
  it("refuses too many reports with a message, without fetching or rendering", async () => {
    const many = Array.from({ length: REPORT_CAP + 1 }, (_, i) =>
      report(`r${i}`, `2026-10-02T09:00:${String(i % 60).padStart(2, "0")}Z`, [entry(0, "pass")]),
    )
    fakeAdmin(many)
    const res = await GET(req("?project=p1"))
    expect(res.status).toBe(413)
    expect(await res.text()).toMatch(/choose a single mission/)
    expect(screenshotFetches()).toEqual([])
  })

  it("counts screenshots only when they are on", async () => {
    const shots = Array.from({ length: SCREENSHOT_CAP + 1 }, (_, i) => `https://x.supabase.co/s/${i}.png`)
    fakeAdmin([report("r1", "2026-10-02T09:00:00Z", [entry(0, "pass")], { screenshot_urls: shots })])

    const on = await GET(req("?project=p1&mission=m-design"))
    expect(on.status).toBe(413)
    expect(await on.text()).toMatch(/turn off screenshots/)

    const off = await GET(req("?project=p1&mission=m-design&screenshots=0"))
    expect(off.status).toBe(200)
    expect(screenshotFetches()).toEqual([])
  }, 30_000)
})

describe("the file", () => {
  it("is a PDF named for the project and mission, never cached", async () => {
    fakeAdmin(FIVE)
    const res = await GET(req("?project=p1&mission=m-design&screenshots=0"))
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("application/pdf")
    expect(res.headers.get("Cache-Control")).toBe("no-store")
    expect(res.headers.get("Content-Disposition")).toMatch(
      /attachment; filename="recipe-book-first-impressions-report-\d{4}-\d{2}-\d{2}\.pdf"/,
    )
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-")
  }, 30_000)

  it("names a whole-project report for all missions", async () => {
    fakeAdmin(FIVE)
    const res = await GET(req("?project=p1&screenshots=0"))
    expect(res.headers.get("Content-Disposition")).toMatch(/recipe-book-all-missions-report-/)
  }, 30_000)
})
