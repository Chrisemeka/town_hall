import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// The ordering in apply_subscription is what makes two simultaneous deliveries
// of one charge safe, and the refunds table's check and indexes are what make a
// wrong or duplicate refund impossible whatever code calls it. Pinned here.
const sql = readFileSync("supabase/migrations/20261104_01_paystack_foundation.sql", "utf8")

const start = sql.indexOf("create function public.apply_subscription(")
const fn = sql.slice(start, sql.indexOf("\n$$;", start))
const SIG = "apply_subscription(text, uuid, text, timestamptz, integer, text, text, uuid, text, text, text, text, uuid, text, text, text, text, text, text, jsonb)"

const branch = (action: string) => {
  const from = fn.indexOf(`p_action = '${action}'`)
  const next = fn.slice(from + 1).search(/\n\s*elsif p_action|\n  else\n/)
  return fn.slice(from, from + 1 + next)
}

describe("apply_subscription", () => {
  it("checks for a duplicate after the account lock and before any write", () => {
    const lock = fn.indexOf("for update;")
    const duplicate = fn.indexOf("return 'duplicate'")
    const check = fn.indexOf("select 1 from public.subscription_payments where reference = p_payment_reference")
    const firstWrite = fn.search(/\b(update public\.|insert into public\.)/)
    expect(lock).toBeGreaterThan(-1)
    expect(check).toBeGreaterThan(lock)
    expect(duplicate).toBeGreaterThan(check)
    expect(firstWrite).toBeGreaterThan(duplicate)
  })

  it("records the payment on start, extend and apply only", () => {
    for (const action of ["start", "extend", "apply"]) expect(branch(action)).toContain("v_paid_row")
    expect(branch("schedule")).not.toContain("v_paid_row")
    expect(branch("end")).not.toContain("v_paid_row")
    expect(branch("attach")).not.toContain("v_paid_row")
    expect(fn).toMatch(/if v_paid_row is not null and p_amount_ngn is not null then\s+insert into public\.subscription_payments/)
    expect(fn.match(/insert into public\.subscription_payments/g)).toHaveLength(1)
  })

  it("queues p_actions on the 'ok' path only, after the duplicate check", () => {
    const queue = fn.indexOf("insert into public.billing_actions")
    expect(queue).toBeGreaterThan(fn.indexOf("return 'duplicate'"))
    // Nothing but the final return after it, and every early return before it.
    expect(fn.slice(queue).match(/return /g)).toHaveLength(1)
    expect(fn.slice(queue)).toContain("return 'ok';")
    expect(fn.slice(queue)).toContain("on conflict (idempotency_key) do nothing")
    expect(fn.match(/return 'ok'/g)).toHaveLength(1)
  })

  it("never creates a refund", () => {
    expect(fn).not.toContain("subscription_refunds")
  })

  it("attach writes no log line and changes no plan", () => {
    const attach = branch("attach")
    expect(attach).not.toContain("admin_account_changes")
    expect(attach).not.toContain("v_to")
    expect(attach).not.toContain("plan_id")
    // v_to starts equal to v_from, so the log block at the end stays shut.
    expect(fn).toMatch(/v_from := v_account\.plan_id;\s+v_to := v_from;/)
  })

  it("extend keeps the row's latest amount and reference", () => {
    expect(branch("extend")).toContain("amount_ngn = coalesce(p_amount_ngn, amount_ngn)")
    expect(branch("extend")).toContain("payment_reference = coalesce(p_payment_reference, payment_reference)")
  })

  it("apply takes Paystack's date when given", () => {
    expect(branch("apply")).toContain("period_end = coalesce(p_period_end, v_due.period_end, now() + interval '1 month')")
  })

  it("restates the grants to service_role alone, on the new signature", () => {
    expect(sql).toContain(`drop function public.apply_subscription(text, uuid, text, timestamptz, integer, text, text, uuid, text, text, text, text, uuid);`)
    expect(sql).toContain(`revoke all on function public.${SIG} from public, anon, authenticated;`)
    expect(sql).toContain(`grant execute on function public.${SIG} to service_role;`)
    expect(sql.match(/grant execute/g)).toHaveLength(1)
  })
})

describe("subscription_refunds", () => {
  it("refuses an upgrade refund whose numbers disagree", () => {
    expect(sql).toContain("constraint upgrade_refund_explains_itself check")
    expect(sql).toContain("days_in_period = period_end_on - period_start_on")
    expect(sql).toContain("refundable_days = period_end_on - upgrade_on - 1")
    expect(sql).toContain("upgrade_on >= period_start_on and upgrade_on < period_end_on")
    expect(sql).toContain("amount_ngn = (base_ngn * refundable_days) / days_in_period")
  })

  it("allows one live refund per cause and one live upgrade refund per payment", () => {
    expect(sql).toMatch(/create unique index subscription_refunds_one_per_cause\s+on public\.subscription_refunds \(causing_payment_id, reason\)\s+where causing_payment_id is not null and status <> 'failed'/)
    expect(sql).toMatch(/create unique index subscription_refunds_one_upgrade_per_payment\s+on public\.subscription_refunds \(payment_id\)\s+where reason = 'upgrade' and status <> 'failed'/)
    expect(sql).toContain("idempotency_key             text not null unique")
  })
})

describe("the new tables", () => {
  it("are service role only", () => {
    for (const table of ["subscription_payments", "subscription_refunds", "billing_actions", "paystack_events"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security;`)
    }
    expect(sql).not.toMatch(/create policy/i)
  })

  it("keep no authorization code and no payload", () => {
    expect(sql).not.toMatch(/authorization_code\s+text/)
    const events = sql.slice(sql.indexOf("create table public.paystack_events"), sql.indexOf("alter table public.paystack_events"))
    expect(events).not.toMatch(/payload/)
  })

  it("backfill one payment per paid subscription, safely", () => {
    expect(sql).toContain("coalesce(payment_reference, 'backfill-' || id)")
    expect(sql).toContain("where amount_ngn is not null")
    expect(sql).toContain("on conflict (reference) do nothing")
  })
})
