import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/newMissions", () => ({ newMissionsFor: vi.fn() }))
vi.mock("@/lib/mail", () => ({ sendTesterDigests: vi.fn(async (m: unknown[]) => m.length) }))

import {
  DIGEST_LIST,
  digestItems,
  digestSince,
  digestSubject,
  isDigestRecipient,
  runTesterDigest,
  type DigestAccount,
} from "@/lib/digest"
import { createAdminClient } from "@/lib/supabase/admin"
import { newMissionsFor, type NewMission } from "@/lib/newMissions"
import { sendTesterDigests, type DigestMessage } from "@/lib/mail"
import { verifyUnsubscribe } from "@/lib/unsubscribe"

const SITE = "https://www.twnhall.com"
const NOW = new Date("2026-11-02T06:00:00.000Z")

const account = (over: Partial<DigestAccount> = {}): DigestAccount => ({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  user_id: "11111111-1111-4111-8111-111111111111",
  verification_completed_at: "2026-10-01T00:00:00Z",
  digest_opted_out_at: null,
  digest_through: "2026-11-01T06:00:00.000Z",
  missions_seen_at: "2026-10-30T00:00:00.000Z",
  profiles: { email: "tester@example.com", moderation_status: "active" },
  ...over,
})

const mission = (id: string, over: Partial<NewMission> = {}): NewMission => ({
  id,
  title: `Test ${id}`,
  category: "process_flow",
  device_target: "mobile",
  projectName: "Acme",
  firstPublishedAt: "2026-11-01T12:00:00.000Z",
  ...over,
})

/** accounts, with the claim applied compare-and-set the way Postgres would. */
function db(rows: DigestAccount[]) {
  const state = rows.map((r) => ({ ...r }))
  vi.mocked(createAdminClient).mockReturnValue({
    from: () => ({
      select: () => {
        const q = { eq: () => q, is: () => q, not: () => q, then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: state.map((r) => ({ ...r })), error: null }).then(ok) }
        return q
      },
      update: (patch: { digest_through: string }) => {
        const f: Record<string, unknown> = {}
        const q = {
          eq: (c: string, v: unknown) => ((f[c] = v), q),
          select: async () => {
            const row = state.find((r) => r.id === f.id && r.digest_through === f.digest_through)
            if (!row) return { data: [], error: null }
            row.digest_through = patch.digest_through
            return { data: [{ id: row.id }], error: null }
          },
        }
        return q
      },
    }),
  } as unknown as ReturnType<typeof createAdminClient>)
  return state
}

const sent = () => vi.mocked(sendTesterDigests).mock.calls.flatMap(([m]) => m as DigestMessage[])

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret")
  // Respects `since`, as the real query's gt filter does.
  vi.mocked(newMissionsFor).mockImplementation(async (_u, since) => [mission("m1")].filter((m) => m.firstPublishedAt > since))
})
afterEach(() => vi.unstubAllEnvs())

describe("who gets a digest", () => {
  it("skips opted-out, unverified, banned, suspended and address-less testers", () => {
    expect(isDigestRecipient(account())).toBe(true)
    expect(isDigestRecipient(account({ digest_opted_out_at: "2026-10-01T00:00:00Z" }))).toBe(false)
    expect(isDigestRecipient(account({ verification_completed_at: null }))).toBe(false)
    expect(isDigestRecipient(account({ profiles: { email: "x@y.z", moderation_status: "banned" } }))).toBe(false)
    expect(isDigestRecipient(account({ profiles: { email: "x@y.z", moderation_status: "suspended" } }))).toBe(false)
    expect(isDigestRecipient(account({ profiles: { email: null, moderation_status: null } }))).toBe(false)
  })

  it("starts from the later of the last digest and the last visit", () => {
    expect(digestSince(account())).toBe("2026-11-01T06:00:00.000Z")
    expect(digestSince(account({ missions_seen_at: "2026-11-01T22:00:00.000Z" }))).toBe("2026-11-01T22:00:00.000Z")
  })
})

describe("what it says", () => {
  it("names one test case, counts several", () => {
    expect(digestSubject([mission("a")])).toBe("New test case: Test a")
    expect(digestSubject([mission("a"), mission("b"), mission("c")])).toBe("3 new test cases on Twnhall")
  })

  it(`lists ${DIGEST_LIST}, then "and N more", with absolute links`, () => {
    const { missions: items, more } = digestItems(["a", "b", "c", "d", "e", "f", "g"].map((id) => mission(id)), SITE)
    expect(items).toHaveLength(DIGEST_LIST)
    expect(more).toBe(2)
    expect(items[0]).toEqual({ title: "Test a", projectName: "Acme", meta: "Process Flow Testing · Mobile", url: `${SITE}/mission/a` })
  })
})

describe("runTesterDigest", () => {
  it("claims the window, then sends one email with one-click headers whose token verifies", async () => {
    const state = db([account()])
    expect(await runTesterDigest(NOW, SITE)).toBe(1)
    expect(state[0].digest_through).toBe(NOW.toISOString())
    const [m] = sent()
    expect(m.to).toBe("tester@example.com")
    expect(m.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click")
    const url = new URL(m.headers["List-Unsubscribe"].slice(1, -1))
    expect(url.origin + url.pathname).toBe(`${SITE}/api/unsubscribe`)
    expect(verifyUnsubscribe(url.searchParams.get("a")!, url.searchParams.get("t")!)).toBe(true)
    expect(newMissionsFor).toHaveBeenCalledWith(account().user_id, "2026-11-01T06:00:00.000Z")
  })

  it("sends once across two runs on top of each other", async () => {
    db([account()])
    await Promise.all([runTesterDigest(NOW, SITE), runTesterDigest(NOW, SITE)])
    expect(sent()).toHaveLength(1)
  })

  it("sends nothing on a second run", async () => {
    db([account()])
    await runTesterDigest(NOW, SITE)
    await runTesterDigest(new Date(NOW.getTime() + 60_000), SITE)
    expect(sent()).toHaveLength(1)
  })

  it("moves the window even when there is nothing new, and sends nothing", async () => {
    const state = db([account()])
    vi.mocked(newMissionsFor).mockResolvedValue([])
    expect(await runTesterDigest(NOW, SITE)).toBe(0)
    expect(state[0].digest_through).toBe(NOW.toISOString())
    expect(sendTesterDigests).not.toHaveBeenCalled()
  })

  it("leaves anything published after the run started for tomorrow", async () => {
    db([account()])
    vi.mocked(newMissionsFor).mockResolvedValue([mission("late", { firstPublishedAt: "2026-11-02T06:00:01.000Z" }), mission("m1")])
    await runTesterDigest(NOW, SITE)
    expect(sent()[0].props.missions.map((i) => i.url)).toEqual([`${SITE}/mission/m1`])
  })

  it("skips a tester who is not a recipient, without claiming", async () => {
    const state = db([account({ profiles: { email: "x@y.z", moderation_status: "banned" } })])
    await runTesterDigest(NOW, SITE)
    expect(sendTesterDigests).not.toHaveBeenCalled()
    expect(state[0].digest_through).toBe(account().digest_through)
  })
})
