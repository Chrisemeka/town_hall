import { createHmac } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/rateLimitDb", () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true })),
  clientIp: () => "1.2.3.4",
  tooManyResponse: () => new Response("slow down", { status: 429 }),
}))
const insert = vi.fn<(row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>>(async () => ({ error: null }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ insert }) }) }))
vi.mock("@/lib/alerts/run", () => ({
  isBillingProblem: (e: { outcome: string }) => e.outcome === "mismatch",
  runAlertsLater: vi.fn(),
}))
vi.mock("@/lib/paystack/events", async () => ({
  ...(await import("@/lib/paystack/eventFields")),
  handlePaystackEvent: vi.fn(async () => "ignored"),
}))

import { POST } from "@/app/api/webhooks/paystack/route"
import { handlePaystackEvent } from "@/lib/paystack/events"
import { checkRateLimit } from "@/lib/rateLimitDb"
import { runAlertsLater } from "@/lib/alerts/run"

const SECRET = "sk_test_secret"
const BODY = JSON.stringify({
  event: "something.new",
  data: {
    reference: "twnhall-sub-1",
    subscription: { subscription_code: "SUB_1" },
    customer: { email: "ada@example.ng" },
    authorization: { authorization_code: "AUTH_secret", last4: "4081" },
  },
})
const sign = (body: string, secret = SECRET) => createHmac("sha512", secret).update(body, "utf8").digest("hex")
const call = (body: string, signature: string | null) =>
  POST(new Request("http://x/api/webhooks/paystack", { method: "POST", body, headers: signature ? { "x-paystack-signature": signature } : {} }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("PAYSTACK_SECRET_KEY", SECRET)
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.mocked(handlePaystackEvent).mockResolvedValue("ignored")
  insert.mockResolvedValue({ error: null })
})

describe("POST /api/webhooks/paystack", () => {
  it("answers a forgery with 401 and records nothing", async () => {
    for (const res of [await call(BODY, sign(BODY, "wrong")), await call(BODY, null), await call(BODY, sign(BODY).replace(/.$/, "z"))]) {
      expect(res.status).toBe(401)
    }
    expect(handlePaystackEvent).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it("verifies the raw bytes: re-serialised JSON fails", async () => {
    const res = await call(JSON.stringify(JSON.parse(BODY), null, 2), sign(BODY))
    expect(res.status).toBe(401)
  })

  it("answers 503 with no key, so Paystack retries", async () => {
    vi.stubEnv("PAYSTACK_SECRET_KEY", "")
    expect((await call(BODY, sign(BODY))).status).toBe(503)
    expect(insert).not.toHaveBeenCalled()
  })

  it("answers 400 to signed garbage", async () => {
    expect((await call("{nope", sign("{nope"))).status).toBe(400)
    expect(insert).not.toHaveBeenCalled()
  })

  it("passes a rate-limited request back before reading anything", async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ ok: false, retryAfter: 60 } as never)
    expect((await call(BODY, sign(BODY))).status).toBe(429)
    expect(insert).not.toHaveBeenCalled()
  })

  it("acknowledges an unknown event and records one row, never the payload", async () => {
    const res = await call(BODY, sign(BODY))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, outcome: "ignored" })
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert.mock.calls[0][0]).toEqual({ event: "something.new", reference: "twnhall-sub-1", subscription_code: "SUB_1", outcome: "ignored" })
    expect(JSON.stringify(insert.mock.calls[0][0])).not.toMatch(/AUTH_secret|ada@example|4081/)
  })

  it("records a handler that throws as an error and answers 500, so it is redelivered", async () => {
    vi.mocked(handlePaystackEvent).mockRejectedValue(new Error("db down"))
    const res = await call(BODY, sign(BODY))
    expect(res.status).toBe(500)
    expect(insert.mock.calls[0][0]).toMatchObject({ outcome: "error" })
  })

  it("runs the billing alert at once on money that granted nothing, and acknowledges it", async () => {
    vi.mocked(handlePaystackEvent).mockResolvedValue("mismatch")
    expect((await call(BODY, sign(BODY))).status).toBe(200)
    expect(runAlertsLater).toHaveBeenCalledWith(["billing_mismatch"])
  })

  it("answers 500 when the event can't be recorded", async () => {
    insert.mockResolvedValue({ error: { message: "nope" } })
    expect((await call(BODY, sign(BODY))).status).toBe(500)
  })
})
