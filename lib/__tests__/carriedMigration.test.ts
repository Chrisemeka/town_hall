import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// close_mission is replaced whole in 20261103_01; only the kind may change.
// These pin the closed_at line it must keep, the kind guard and the grant.
const sql = readFileSync("supabase/migrations/20261103_01_carried_reports.sql", "utf8")
const start = sql.indexOf("create or replace function public.close_mission(")
const body = sql.slice(start, sql.indexOf("\n$$;", start))

describe("20261103_01 carried reports", () => {
  it("replaces close_mission and nothing else", () => {
    expect(start).toBeGreaterThan(-1)
    expect(sql.match(/create or replace function/g)).toHaveLength(1)
  })

  it("keeps closed_at", () => {
    expect(body).toContain("set is_active = false, closed_at = now() where id = p_mission_id")
  })

  it("lets a close write exactly released and carried", () => {
    expect(body).toContain("v_kind := coalesce(v_row->>'kind', 'released');")
    expect(body).toContain("if v_kind not in ('released', 'carried') then")
    expect(body).toContain("p_profile_id, p_account_id, p_mission_id, v_kind,")
  })

  it("restates the grant to service_role alone", () => {
    const sig = "close_mission(uuid, uuid, uuid, int, int, jsonb)"
    expect(sql).toContain(`revoke all on function public.${sig} from public, anon, authenticated;`)
    expect(sql).toContain(`grant execute on function public.${sig} to service_role;`)
  })
})
