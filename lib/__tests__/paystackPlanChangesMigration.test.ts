import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// The three ways a refund is created (SPEC-paystack-plan-changes §2.2, §6, §7).
// Their ordering is what makes "no refund before Pro succeeds" and "never sent
// twice" true whatever calls them. Pinned against the migration's own text; the
// numbers were also run against Postgres (PGlite) from §2.1's table.
const sql = readFileSync("supabase/migrations/20261104_03_paystack_plan_changes.sql", "utf8")

const fn = (name: string) => {
  const start = sql.indexOf(`create function public.${name}(`)
  return sql.slice(start, sql.indexOf("\n$$;", start))
}
const at = (body: string, text: string) => {
  const i = body.indexOf(text)
  expect(i, text).toBeGreaterThan(-1)
  return i
}

describe("settle_upgrade", () => {
  const body = fn("settle_upgrade")

  it("takes the account lock before anything else", () => {
    const lock = at(body, "from public.accounts where user_id = p_user_id and type = 'builder' for update")
    expect(lock).toBeLessThan(at(body, "public.apply_subscription("))
  })

  it("starts Pro through apply_subscription, and returns before any refund on anything but 'ok'", () => {
    const apply = at(body, "v_result := public.apply_subscription(")
    const bail = at(body, "if v_result <> 'ok' then")
    const insert = at(body, "insert into public.subscription_refunds")
    expect(apply).toBeLessThan(bail)
    expect(bail).toBeLessThan(insert)
    expect(body.slice(apply, bail)).toContain("'start', p_user_id, 'pro'")
    expect(body.slice(apply, bail)).toContain("'upgrade'")
  })

  it("locks the Starter payment before base_ngn is read", () => {
    const lock = at(body, "for update;\n  if not found then")
    expect(lock).toBeLessThan(at(body, "select v_starter.amount_ngn - coalesce(sum(r.amount_ngn), 0) into v_base"))
    expect(body).toContain("r.status <> 'failed'")
  })

  it("uses Lagos dates for all three, and the period [start, end)", () => {
    expect(body.match(/at time zone 'Africa\/Lagos'\)::date/g)!.length).toBeGreaterThanOrEqual(5)
    expect(body).toContain("v_upgrade_on := (p_paid_at at time zone 'Africa/Lagos')::date")
    expect(body).toContain("<= v_upgrade_on\n    and v_upgrade_on < (pay.period_end at time zone 'Africa/Lagos')::date")
  })

  it("counts the upgrade day as used, in whole naira rounded down", () => {
    expect(body).toContain("v_refundable := v_end_on - v_upgrade_on - 1;")
    expect(body).toContain("v_amount := (v_base * v_refundable) / v_days;")
    expect(body).toMatch(/v_amount\s+integer;/)
  })

  it("stores the rule and its key, and a second one is refused, not raised", () => {
    expect(body).toContain("'proration-v1'")
    expect(body).toContain("'upgrade:' || p_pro_reference")
    expect(body).toMatch(/\)\s+on conflict do nothing;\s+return jsonb_build_object\('result', 'ok', 'refund_ngn', v_amount\)/)
  })
})

describe("queue_refund", () => {
  const body = fn("queue_refund")

  it("locks the payment, then clamps to what's left, failed refunds excluded", () => {
    const lock = at(body, "from public.subscription_payments where id = p_payment_id for update")
    expect(lock).toBeLessThan(at(body, "into v_left"))
    expect(body).toContain("least(coalesce(p_amount_ngn, v_from.amount_ngn), v_left)")
    expect(body).toContain("where payment_id = v_pay.id and status <> 'failed'")
  })

  it("answers the same key with the first row, and starts only queued or settled_outside", () => {
    expect(at(body, "where idempotency_key = p_key")).toBeLessThan(at(body, "insert into public.subscription_refunds"))
    expect(body).toContain("if p_status not in ('queued', 'settled_outside') then")
  })

  it("an upgrade retry keeps the stored days and reads only base again", () => {
    expect(body).toContain("v_amount := (greatest(v_left, 0) * v_from.refundable_days) / v_from.days_in_period;")
  })
})

describe("record_unwanted_charge", () => {
  const body = fn("record_unwanted_charge")

  it("takes the account lock and stops on a reference already recorded", () => {
    const lock = at(body, "where user_id = p_profile_id and type = 'builder' for update")
    const dup = at(body, "return 'duplicate'")
    expect(lock).toBeLessThan(dup)
    expect(dup).toBeLessThan(at(body, "insert into public.subscription_payments"))
  })

  it("refunds the whole charge, keyed on its reference, and switches the subscription off", () => {
    expect(body).toContain("p_reference, v_payment, p_reference, p_amount_ngn")
    expect(body).toContain("'stray:' else 'duplicate:' end || p_reference")
    expect(body).toContain("'disable_subscription'")
    expect(body).not.toMatch(/update public\.accounts|public\.apply_subscription\(/)
  })

  it("buys nothing: no period, so it never counts toward MRR", () => {
    expect(body).toMatch(/'stray' else 'duplicate' end, now\(\), null\)/)
  })
})

describe("grants", () => {
  it.each([
    "settle_upgrade(uuid, text, integer, timestamptz, timestamptz, uuid, text, text, text, text, text, text, text, jsonb)",
    "queue_refund(uuid, integer, text, text, text, text, uuid)",
    "record_unwanted_charge(text, text, uuid, integer, text, text)",
  ])("%s runs as the service role only", (sig) => {
    expect(sql).toContain(`revoke all on function public.${sig} from public, anon, authenticated;`)
    expect(sql).toContain(`grant execute on function public.${sig} to service_role;`)
  })

  it("never stores an authorization code", () => {
    expect(sql).not.toMatch(/authorization_code/)
  })
})
