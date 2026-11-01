import { beforeEach, describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NOT_FOUND") }) }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/cohortDb", () => ({
  isCohortTester: vi.fn(async () => false),
  missionsForTester: vi.fn(async (_u: string, ids: string[]) => new Set(ids)),
}))
// The form and the brief are their own tests; here they only need to show up.
vi.mock("@/components/tester/AuditLogForm", () => ({
  default: (p: { startToken: string | null }) => createElement("form", { "data-token": p.startToken ?? "none" }),
}))
vi.mock("@/components/missions/MissionBrief", () => ({ MissionBrief: () => createElement("section", null, "brief") }))

import MissionDetailPage from "@/app/(tester)/mission/[id]/page"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyStartToken } from "@/lib/reportStart"

const ID = "33333333-3333-4333-8333-333333333333"
const TESTER = "11111111-1111-4111-8111-111111111111"

function given(opts: { isActive?: boolean | null; testersNeeded?: number; received?: number; owner?: boolean; tested?: boolean }) {
  const mission = {
    id: ID,
    title: "Checkout flow",
    task_description: "",
    category: "process_flow",
    device_target: "both",
    test_steps: [],
    is_active: opts.isActive === undefined ? true : opts.isActive,
    testers_needed: opts.testersNeeded ?? 3,
    projects: { id: "p1", name: "Acme", app_url: "https://acme.test", description: "", flagged_at: null },
  }
  const missionQuery = { select: () => missionQuery, eq: () => missionQuery, single: async () => ({ data: mission }) }
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: TESTER } } }) },
    from: () => missionQuery,
  } as unknown as Awaited<ReturnType<typeof createClient>>)

  vi.mocked(createAdminClient).mockReturnValue({
    from: (table: string) => {
      if (table === "projects") {
        const q = { select: () => q, eq: () => q, then: (ok: (v: unknown) => unknown) => Promise.resolve({ count: opts.owner ? 1 : 0 }).then(ok) }
        return q
      }
      // test_results: the tester's own report (rows), or the report count (head).
      const q = {
        select: (_c: string, o?: { head?: boolean }) => ((q.head = !!o?.head), q),
        head: false,
        eq: () => q,
        order: () => q,
        limit: async () => ({ data: opts.tested ? [{ status: "pending", rating: null, review_note: null }] : [] }),
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ count: opts.received ?? 0 }).then(ok),
      }
      return q
    },
  } as unknown as ReturnType<typeof createAdminClient>)
}

const render = async () => renderToStaticMarkup(await MissionDetailPage({ params: Promise.resolve({ id: ID }) }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("SIGNING_SECRET", "test-secret")
})

describe("/mission/[id] and a test case's state", () => {
  it("renders the form for a live test case, with a start token for this tester", async () => {
    given({})
    const html = await render()
    const token = html.match(/data-token="([^"]+)"/)![1]
    expect(verifyStartToken(token, ID, TESTER)).toEqual(expect.any(Number))
  })

  it("treats a legacy null is_active as live", async () => {
    given({ isActive: null })
    expect(await render()).toContain("data-token=")
  })

  it("shows the full panel, and no form, once it got its reports", async () => {
    given({ isActive: false, testersNeeded: 3, received: 3 })
    const html = await render()
    expect(html).toContain("This test case isn&#x27;t taking reports")
    expect(html).toContain("It got all the reports it needed.")
    expect(html).not.toContain("data-token")
    expect(html).toContain('href="/explore/missions"')
  })

  it("shows the other line for a pause, or a draft never published", async () => {
    given({ isActive: false, testersNeeded: 3, received: 1 })
    expect(await render()).toContain("The builder isn&#x27;t taking reports on it right now.")
    given({ isActive: false, testersNeeded: 0, received: 0 })
    expect(await render()).toContain("The builder isn&#x27;t taking reports on it right now.")
  })

  it("keeps the owner and already-tested panels ahead of it", async () => {
    given({ isActive: false, owner: true })
    expect(await render()).toContain("Project Owner")
    given({ isActive: false, tested: true })
    const html = await render()
    expect(html).toContain("You&#x27;ve tested this test case")
    expect(html).not.toContain("isn&#x27;t taking reports")
  })

  it("still renders the form without a secret — only the grace is lost", async () => {
    vi.stubEnv("SIGNING_SECRET", "")
    given({})
    expect(await render()).toContain('data-token="none"')
  })
})
