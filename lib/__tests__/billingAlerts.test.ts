import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }))
vi.mock("@/lib/auth", () => ({ adminRecipients: vi.fn(async () => []) }))
vi.mock("@/lib/mail", () => ({ sendNotice: vi.fn() }))
vi.mock("@/lib/cohortDb", () => ({ payoutSheet: vi.fn() }))

import { isBillingProblem } from "@/lib/alerts/run"
import { RATE_LIMITS } from "@/lib/rateLimit"
import { fires, RULE_LINKS } from "@/lib/alerts/rules"

describe("billing_mismatch", () => {
  it("fires on money that granted nothing", () => {
    for (const outcome of ["mismatch", "duplicate_charge", "stray"]) expect(isBillingProblem({ event: "charge.success", outcome })).toBe(true)
    expect(isBillingProblem({ event: "charge.success", outcome: "unmatched" })).toBe(true)
    expect(isBillingProblem({ event: "invoice.payment_failed", outcome: "unmatched" })).toBe(true)
    expect(fires("billing_mismatch", { value: 1 }, 0)).toBe(true)
  })

  it("doesn't fire on what's healthy, or on subscription.create beating its charge", () => {
    for (const outcome of ["settled", "duplicate", "ignored", "error"]) expect(isBillingProblem({ event: "charge.success", outcome })).toBe(false)
    expect(isBillingProblem({ event: "subscription.create", outcome: "unmatched" })).toBe(false)
    expect(fires("billing_mismatch", { value: 0 }, 0)).toBe(false)
  })
})

describe("the checkout rate limit", () => {
  it("is closed: both actions call Paystack", () => {
    expect(RATE_LIMITS["checkout:account"]).toMatchObject({ limit: 5, mode: "closed" })
  })
})

describe("20261104_02", () => {
  const sql = readFileSync("supabase/migrations/20261104_02_paystack_subscriptions.sql", "utf8")

  it("allows one open checkout per builder, plan and kind", () => {
    expect(sql).toMatch(/create unique index paystack_checkouts_one_open\s+on public\.paystack_checkouts \(profile_id, plan_id, kind\)\s+where completed_at is null and superseded_at is null/)
  })

  it("is service role only, and stores no card or authorization code", () => {
    expect(sql).toContain("alter table public.paystack_checkouts enable row level security;")
    expect(sql).not.toMatch(/create policy|authorization_code/i)
  })

  it("seeds both alert rules as critical, without overwriting edited thresholds", () => {
    expect(sql).toMatch(/\('billing_mismatch',[\s\S]*'critical'/)
    expect(sql).toMatch(/\('billing_actions_failing',[\s\S]*'critical'/)
    expect(sql).toContain("on conflict (key) do nothing")
  })
})

describe("the refund and cap rules", () => {
  it("refund_failed and refund_stuck fire on any; the cap on gross collections over its threshold", () => {
    expect(fires("refund_failed", { value: 1 }, 0)).toBe(true)
    expect(fires("refund_failed", { value: 0 }, 0)).toBe(false)
    expect(fires("refund_stuck", { value: 1 }, 0)).toBe(true)
    expect(fires("paystack_cap_near", { value: 6_000_001 }, 6_000_000)).toBe(true)
    expect(fires("paystack_cap_near", { value: 6_000_000 }, 6_000_000)).toBe(false)
    expect(RULE_LINKS.paystack_cap_near).toBe("/admin/money")
  })
})
