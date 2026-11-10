import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import {
  createRefund,
  createSubscriptionFrom,
  disableSubscription,
  fetchSubscription,
  initializeTransaction,
  listRefunds,
  listSubscriptions,
  manageLink,
  mapTransaction,
  verifyTransaction,
} from "@/lib/paystack/client"
import { paystackConfigured, planCodeFor, planIdForCode } from "@/lib/paystack/config"

const fetchMock = vi.fn()
const reply = (status: number, body: unknown) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })
const sent = () => JSON.parse(fetchMock.mock.calls[0][1].body as string)

const INIT = { email: "a@b.ng", amountNgn: 15000, planCode: "PLN_s", reference: "twnhall-sub-1", callbackUrl: "https://x/return", metadata: { profile_id: "p" } }

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_x")
  vi.stubEnv("PAYSTACK_PLAN_STARTER", "PLN_s")
  vi.stubEnv("PAYSTACK_PLAN_PRO", "PLN_p")
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("the money boundary", () => {
  it("sends kobo, with the plan and card only", async () => {
    fetchMock.mockResolvedValue(reply(200, { data: { authorization_url: "https://pay", access_code: "ac" } }))
    const res = await initializeTransaction(INIT)
    expect(res).toEqual({ ok: true, data: { authorizationUrl: "https://pay", accessCode: "ac" } })
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.paystack.co/transaction/initialize")
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer sk_test_x")
    expect(sent()).toMatchObject({ amount: 1_500_000, plan: "PLN_s", channels: ["card"], currency: "NGN", reference: "twnhall-sub-1" })
    expect(sent()).not.toHaveProperty("amountNgn")
  })

  it("returns naira, in a narrow shape with no authorization code", async () => {
    fetchMock.mockResolvedValue(
      reply(200, {
        data: {
          reference: "r",
          status: "success",
          amount: 1_500_000,
          currency: "NGN",
          plan: "PLN_s",
          paid_at: "2026-11-04T10:00:00Z",
          metadata: { profile_id: "p" },
          customer: { id: 7, customer_code: "CUS_1", email: "a@b.ng" },
          authorization: { authorization_code: "AUTH_secret", last4: "4081", brand: "visa", reusable: true },
        },
      }),
    )
    const res = await verifyTransaction("r")
    expect(res).toMatchObject({
      ok: true,
      data: { amountNgn: 15000, planCode: "PLN_s", customerCode: "CUS_1", customerId: 7, card: { last4: "4081", brand: "visa", reusable: true }, paidAt: "2026-11-04T10:00:00Z" },
    })
    expect(JSON.stringify(res)).not.toContain("AUTH_secret")
    expect(JSON.stringify(res)).not.toContain("a@b.ng")
  })

  it("doesn't round away an underpayment", () => {
    expect(mapTransaction({ amount: 1_499_999 }).amountNgn).toBe(14999.99)
  })

  it("reads the plan as a webhook sends it too", () => {
    expect(mapTransaction({ plan: { plan_code: "PLN_p" } }).planCode).toBe("PLN_p")
    expect(mapTransaction({ plan: {}, plan_object: { plan_code: "PLN_p" } }).planCode).toBe("PLN_p")
    expect(mapTransaction({ plan: {} }).planCode).toBeNull()
  })
})

describe("permanent or transient", () => {
  it("calls a 4xx permanent", async () => {
    fetchMock.mockResolvedValue(reply(400, { message: "Duplicate" }))
    expect(await initializeTransaction(INIT)).toEqual({ ok: false, message: "Duplicate", permanent: true })
  })

  it("calls 429 and 5xx transient", async () => {
    for (const status of [429, 500, 503]) {
      fetchMock.mockResolvedValueOnce(reply(status, { message: "x" }))
      expect(await verifyTransaction("r")).toMatchObject({ ok: false, permanent: false })
    }
  })

  it("calls a timeout or network error transient, and never throws", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation timed out", "TimeoutError"))
    expect(await verifyTransaction("r")).toMatchObject({ ok: false, permanent: false })
  })

  it("sets a timeout on every call", async () => {
    fetchMock.mockResolvedValue(reply(200, { data: {} }))
    await verifyTransaction("r")
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  it("calls non-JSON transient, even from a 200", async () => {
    fetchMock.mockResolvedValue(reply(200, "<html>gateway</html>"))
    expect(await verifyTransaction("r")).toMatchObject({ ok: false, permanent: false })
  })
})

describe("subscriptions", () => {
  const SUB = { subscription_code: "SUB_1", email_token: "tok", status: "active", next_payment_date: "2026-12-04T00:00:00Z", plan: { plan_code: "PLN_s" }, customer: { id: 7, customer_code: "CUS_1" }, authorization: { authorization_code: "AUTH_secret", last4: "4081" } }

  it("fetches one, with no authorization code", async () => {
    fetchMock.mockResolvedValue(reply(200, { data: SUB }))
    const res = await fetchSubscription("SUB_1")
    expect(res).toMatchObject({ ok: true, data: { subscriptionCode: "SUB_1", emailToken: "tok", nextPaymentDate: "2026-12-04T00:00:00Z", planCode: "PLN_s", customerCode: "CUS_1" } })
    expect(JSON.stringify(res)).not.toContain("AUTH_secret")
  })

  it("lists by the customer's numeric id, keeping only this plan, newest first", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { data: { id: 7 } }))
    fetchMock.mockResolvedValueOnce(
      reply(200, {
        data: [
          { ...SUB, subscription_code: "SUB_old", createdAt: "2026-01-01T00:00:00Z" },
          { ...SUB, subscription_code: "SUB_other", plan: { plan_code: "PLN_p" } },
          { ...SUB, subscription_code: "SUB_new", createdAt: "2026-06-01T00:00:00Z" },
        ],
      }),
    )
    const res = await listSubscriptions({ customer: "CUS_1", plan: "PLN_s" })
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.paystack.co/customer/CUS_1")
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.paystack.co/subscription?customer=7")
    expect(res.ok && res.data.map((s) => s.subscriptionCode)).toEqual(["SUB_new", "SUB_old"])
  })

  it("passes a failed customer lookup back rather than answering 'none'", async () => {
    fetchMock.mockResolvedValue(reply(500, { message: "down" }))
    expect(await listSubscriptions({ customer: "CUS_1", plan: "PLN_s" })).toMatchObject({ ok: false, permanent: false })
  })

  it("disables with the code and the email token", async () => {
    fetchMock.mockResolvedValue(reply(200, { status: true }))
    expect((await disableSubscription({ code: "SUB_1", token: "tok" })).ok).toBe(true)
    expect(sent()).toEqual({ code: "SUB_1", token: "tok" })
  })

  it("names the charges a subscription made, from its invoices", async () => {
    fetchMock.mockResolvedValue(reply(200, { data: { ...SUB, invoices: [{ reference: "twnhall-sub-1" }, { reference: "df70" }] } }))
    const res = await fetchSubscription("SUB_1")
    expect(res.ok && res.data.invoiceReferences).toEqual(["twnhall-sub-1", "df70"])
  })

  it("creates a subscription on the same card without handing the authorization back", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { data: SUB }))
    fetchMock.mockResolvedValueOnce(reply(200, { data: { subscription_code: "SUB_new", email_token: "tok2", plan: 9, customer: 7, next_payment_date: "2026-12-04T00:00:00Z" } }))
    const res = await createSubscriptionFrom({ fromCode: "SUB_1", planCode: "PLN_s", startDate: "2026-12-04T00:00:00Z" })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({ customer: "CUS_1", plan: "PLN_s", authorization: "AUTH_secret", start_date: "2026-12-04T00:00:00Z" })
    expect(res).toMatchObject({ ok: true, data: { subscriptionCode: "SUB_new", emailToken: "tok2" } })
    expect(JSON.stringify(res)).not.toContain("AUTH_secret")
  })
})

describe("refunds", () => {
  it("sends kobo, the reference and our key as the merchant note", async () => {
    fetchMock.mockResolvedValue(reply(200, { data: { id: 19053807, status: "pending", amount: 950_000, merchant_note: "upgrade:p" } }))
    const res = await createRefund({ reference: "twnhall-sub-1", amountNgn: 9500, merchantNote: "upgrade:p" })
    expect(sent()).toEqual({ transaction: "twnhall-sub-1", amount: 950_000, currency: "NGN", merchant_note: "upgrade:p" })
    expect(res).toEqual({ ok: true, data: { id: "19053807", status: "pending", amountNgn: 9500, merchantNote: "upgrade:p", createdAt: null } })
  })

  it("lists by the transaction's numeric id, which a reference doesn't filter on", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { data: { id: 6733575822, reference: "twnhall-sub-1" } }))
    fetchMock.mockResolvedValueOnce(reply(200, { data: [{ id: 1, status: "processed", amount: 10_000, merchant_note: "k" }] }))
    const res = await listRefunds("twnhall-sub-1")
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.paystack.co/refund?transaction=6733575822&perPage=100")
    expect(res.ok && res.data).toEqual([{ id: "1", status: "processed", amountNgn: 100, merchantNote: "k", createdAt: null }])
  })

  it("the test-only timeout switch sends, then reports a timeout; never with a live key", async () => {
    fetchMock.mockImplementation(async () => reply(200, { data: { id: 1, status: "pending", amount: 100 } }))
    vi.stubEnv("PAYSTACK_TEST_REFUND_TIMEOUT", "1")
    expect(await createRefund({ reference: "r", amountNgn: 1, merchantNote: "k" })).toMatchObject({ ok: false, permanent: false })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_live_x")
    expect((await createRefund({ reference: "r", amountNgn: 1, merchantNote: "k" })).ok).toBe(true)
  })

  it("the manage link is fetched, never built", async () => {
    fetchMock.mockResolvedValue(reply(200, { data: { link: "https://paystack.com/manage/abc" } }))
    expect(await manageLink("SUB_1")).toEqual({ ok: true, data: "https://paystack.com/manage/abc" })
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.paystack.co/subscription/SUB_1/manage/link")
  })
})

describe("config", () => {
  it("maps plan codes both ways, from the env", () => {
    expect(planCodeFor("pro")).toBe("PLN_p")
    expect(planIdForCode("PLN_s")).toBe("starter")
    expect(planIdForCode("PLN_other")).toBeNull()
    expect(planIdForCode(null)).toBeNull()
  })

  it("is configured only with the key and both plans", () => {
    expect(paystackConfigured()).toBe(true)
    vi.stubEnv("PAYSTACK_PLAN_PRO", "")
    expect(paystackConfigured()).toBe(false)
  })

  it("never treats an unset plan env as a match for an empty code", () => {
    vi.stubEnv("PAYSTACK_PLAN_STARTER", "")
    expect(planIdForCode("")).toBeNull()
  })
})
