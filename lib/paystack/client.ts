import "server-only"

import { paystackKey } from "@/lib/paystack/config"

// The Paystack HTTP client. Plain fetch against a documented REST API; the HTTP
// shape is ported from the payments-wip tag.
//
// Every call returns a result rather than throwing, because the caller has to
// tell a permanent refusal from a transient one, and an exception flattens that
// into "something broke".
//
// Amounts cross this boundary in kobo: every function here takes and returns
// naira, and nothing above lib/paystack/ ever sees kobo or a raw Paystack
// object. An authorization code is never mapped out of a payload.

const BASE = "https://api.paystack.co"

/** Requests that outlive this are treated as transient. */
const TIMEOUT_MS = 15_000

export type ApiResult<T> =
  | { ok: true; data: T }
  /** `permanent` means retrying sends the same request to the same refusal. */
  | { ok: false; message: string; permanent: boolean }

type Raw = Record<string, unknown>

const rec = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {})
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null)
const num = (v: unknown): number | null => (typeof v === "number" ? v : null)

async function call<T>(path: string, init: RequestInit, extract: (data: unknown) => T, label: string): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${paystackKey()}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    // Includes the timeout. Never permanent: a request that never got an answer
    // may still have been received, so conclude nothing about the money.
    const message = e instanceof Error ? e.message : "Network error"
    console.error(`[paystack/${label}] request failed:`, message)
    return { ok: false, message, permanent: false }
  }

  const text = await res.text()
  let body: Raw = {}
  try {
    body = text ? rec(JSON.parse(text)) : {}
  } catch {
    // An API we no longer understand: unavailable, rather than a guess at success.
    return { ok: false, message: "Unreadable response from Paystack", permanent: false }
  }

  if (!res.ok) {
    const message = str(body.message) ?? `Paystack returned ${res.status}`
    console.error(`[paystack/${label}] ${res.status}:`, message)
    // 4xx is Paystack saying no and meaning it, except 429, which is rate limiting.
    return { ok: false, message, permanent: res.status >= 400 && res.status < 500 && res.status !== 429 }
  }
  return { ok: true, data: extract(body.data) }
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) })
const GET: RequestInit = { method: "GET" }

export type PaystackCard = { last4: string | null; brand: string | null; reusable: boolean }

function mapCard(authorization: unknown): PaystackCard {
  const a = rec(authorization)
  return { last4: str(a.last4), brand: str(a.brand), reusable: a.reusable === true }
}

export type PaystackTransaction = {
  reference: string | null
  status: string | null
  /** Not rounded: a fractional naira is a mismatch to catch, not to tidy. */
  amountNgn: number
  currency: string | null
  planCode: string | null
  customerCode: string | null
  customerId: number | null
  subscriptionCode: string | null
  nextPaymentDate: string | null
  card: PaystackCard
  metadata: Record<string, unknown>
  paidAt: string | null
}

/** `plan` is a code on verify and an object on a webhook; both land here. */
export function mapTransaction(raw: unknown): PaystackTransaction {
  const t = rec(raw)
  const subscription = rec(t.subscription)
  const customer = rec(t.customer)
  return {
    reference: str(t.reference),
    status: str(t.status),
    amountNgn: Number(t.amount ?? 0) / 100,
    currency: str(t.currency),
    planCode: str(t.plan) ?? str(rec(t.plan).plan_code) ?? str(rec(t.plan_object).plan_code),
    customerCode: str(customer.customer_code),
    customerId: num(customer.id),
    subscriptionCode: str(t.subscription_code) ?? str(subscription.subscription_code),
    nextPaymentDate: str(t.next_payment_date) ?? str(subscription.next_payment_date),
    card: mapCard(t.authorization),
    metadata: rec(t.metadata),
    paidAt: str(t.paid_at) ?? str(t.paidAt),
  }
}

export type PaystackSubscription = {
  subscriptionCode: string | null
  createdAt: string | null
  status: string | null
  emailToken: string | null
  nextPaymentDate: string | null
  planCode: string | null
  customerCode: string | null
  customerId: number | null
  card: PaystackCard
}

export function mapSubscription(raw: unknown): PaystackSubscription {
  const s = rec(raw)
  const customer = rec(s.customer)
  return {
    subscriptionCode: str(s.subscription_code),
    createdAt: str(s.createdAt) ?? str(s.created_at),
    status: str(s.status),
    emailToken: str(s.email_token),
    nextPaymentDate: str(s.next_payment_date),
    planCode: str(rec(s.plan).plan_code),
    customerCode: str(customer.customer_code),
    customerId: num(customer.id),
    card: mapCard(s.authorization),
  }
}

export function initializeTransaction(input: {
  email: string
  amountNgn: number
  planCode: string
  reference: string
  callbackUrl: string
  metadata: Record<string, string>
}): Promise<ApiResult<{ authorizationUrl: string; accessCode: string }>> {
  return call(
    "/transaction/initialize",
    post({
      email: input.email,
      amount: Math.round(input.amountNgn * 100),
      currency: "NGN",
      plan: input.planCode,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      // A renewing subscription needs a reusable authorization; transfer and USSD don't give one.
      channels: ["card"],
    }),
    (data) => ({ authorizationUrl: str(rec(data).authorization_url) ?? "", accessCode: str(rec(data).access_code) ?? "" }),
    "initialize",
  )
}

export function verifyTransaction(reference: string): Promise<ApiResult<PaystackTransaction>> {
  return call(`/transaction/verify/${encodeURIComponent(reference)}`, GET, mapTransaction, "verify")
}

export function fetchSubscription(code: string): Promise<ApiResult<PaystackSubscription>> {
  return call(`/subscription/${encodeURIComponent(code)}`, GET, mapSubscription, "subscription")
}

/**
 * One customer's subscriptions on one plan, newest first. Takes the codes we
 * hold. Paystack's list filters on the customer's numeric id, and an unknown
 * filter answers 200 with nothing, which would read as "no subscription" here:
 * so it resolves the id first, and checks both codes on what comes back.
 */
export async function listSubscriptions(filter: { customer: string; plan: string }): Promise<ApiResult<PaystackSubscription[]>> {
  const customer = await call(`/customer/${encodeURIComponent(filter.customer)}`, GET, (data) => num(rec(data).id), "customer")
  if (!customer.ok) return customer
  if (customer.data === null) return { ok: true, data: [] }
  const res = await call(`/subscription?customer=${customer.data}`, GET, (data) => (Array.isArray(data) ? data.map(mapSubscription) : []), "subscriptions")
  if (!res.ok) return res
  const time = (s: PaystackSubscription) => (s.createdAt ? Date.parse(s.createdAt) : 0)
  return {
    ok: true,
    data: res.data
      .filter((s) => s.planCode === filter.plan && (s.customerCode === null || s.customerCode === filter.customer))
      .sort((a, b) => time(b) - time(a)),
  }
}

/** Disabling is idempotent at Paystack: a subscription already off is the goal met. */
export const isAlreadyOff = (res: { ok: false; message: string; permanent: boolean }): boolean =>
  res.permanent && /not found|already|inactive/i.test(res.message)

export function disableSubscription(input: { code: string; token: string }): Promise<ApiResult<null>> {
  return call("/subscription/disable", post({ code: input.code, token: input.token }), () => null, "disable")
}
