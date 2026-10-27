import { describe, expect, it } from "vitest"
import { ALERT_RULE_KEYS, RULE_LINKS, decide, fires } from "@/lib/alerts/rules"
import { readFileSync } from "node:fs"

describe("fires", () => {
  it("alarms read zero when healthy", () => {
    expect(fires("uncredited_reports", { value: 0 }, 0)).toBe(false)
    expect(fires("uncredited_reports", { value: 1 }, 0)).toBe(true)
    expect(fires("flagged_projects", { value: 2 }, 0)).toBe(true)
  })

  it("counted rules fire at the threshold", () => {
    expect(fires("server_errors", { value: 4 }, 5)).toBe(false)
    expect(fires("server_errors", { value: 5 }, 5)).toBe(true)
    expect(fires("rate_limit_spike", { value: 50 }, 50)).toBe(true)
  })

  it("an AI failure rate needs enough analyses to mean anything", () => {
    expect(fires("ai_failure_rate", { value: 50, base: 4 }, 10)).toBe(false)
    expect(fires("ai_failure_rate", { value: 20, base: 5 }, 10)).toBe(true)
    expect(fires("ai_failure_rate", { value: 10, base: 50 }, 10)).toBe(false)
  })

  it("signups stall only while people are visiting", () => {
    expect(fires("signups_stalled", { value: 0, base: 0 }, 0)).toBe(false)
    expect(fires("signups_stalled", { value: 0, base: 120 }, 0)).toBe(true)
    expect(fires("signups_stalled", { value: 1, base: 120 }, 0)).toBe(false)
  })
})

describe("decide", () => {
  const rule = { email: true, cooldown_minutes: 60 }
  const now = new Date("2026-10-27T12:00:00Z")

  it("opens and emails a new alert", () => {
    expect(decide(true, null, rule, now)).toEqual({ op: "open", email: true })
    expect(decide(true, null, { ...rule, email: false }, now)).toEqual({ op: "open", email: false })
  })

  it("does not re-email inside the cooldown, and does once it has passed", () => {
    expect(decide(true, { status: "open", notified_at: "2026-10-27T11:30:00Z" }, rule, now)).toEqual({ op: "bump", email: false })
    expect(decide(true, { status: "open", notified_at: "2026-10-27T11:00:00Z" }, rule, now)).toEqual({ op: "bump", email: true })
  })

  it("never re-emails an acknowledged alert", () => {
    expect(decide(true, { status: "acknowledged", notified_at: "2026-10-26T00:00:00Z" }, rule, now)).toEqual({ op: "bump", email: false })
  })

  it("resolves when the condition clears, silently", () => {
    expect(decide(false, { status: "open", notified_at: null }, rule, now)).toEqual({ op: "resolve", email: false })
    expect(decide(false, null, rule, now)).toEqual({ op: "none", email: false })
  })
})

describe("the seeded rules", () => {
  const sql = readFileSync("supabase/migrations/20261027_03_alerts.sql", "utf8")
  it("seed exactly the keys the code knows, each with a link", () => {
    const seeded = [...sql.matchAll(/^\s+\('([a-z_]+)',/gm)].map((m) => m[1])
    expect(seeded.sort()).toEqual([...ALERT_RULE_KEYS].sort())
    for (const key of ALERT_RULE_KEYS) expect(RULE_LINKS[key]).toMatch(/^\/admin/)
  })
})
