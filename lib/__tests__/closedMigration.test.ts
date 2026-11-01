import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// The three allowance functions are replaced whole; only their closed_at line
// may change. These pin that line and the grants they must keep.
const sql = readFileSync("supabase/migrations/20261101_03_closed_test_cases.sql", "utf8")
/** One function's create statement, from its header to its closing $$; */
const fn = (name: string) => {
  const start = sql.indexOf(`create or replace function public.${name}(`)
  return sql.slice(start, sql.indexOf("\n$$;", start))
}

describe("20261101_03 closed_at", () => {
  it("report_landed sets closed_at only in the update that closes it when full", () => {
    const body = fn("report_landed")
    expect(body).toMatch(/if v_held > 0 and v_received >= v_held then\s+update public\.missions set is_active = false, closed_at = now\(\)/)
    expect(body.match(/closed_at/g)).toHaveLength(1)
  })

  it("close_mission sets it", () => {
    expect(fn("close_mission")).toContain("set is_active = false, closed_at = now() where id = p_mission_id")
  })

  it("publish_mission clears it on reopen, and keeps first_published_at", () => {
    const body = fn("publish_mission")
    expect(body).toContain("closed_at = null")
    expect(body).toContain("first_published_at = coalesce(first_published_at, now())")
  })

  it("restates every grant to service_role alone", () => {
    for (const sig of [
      "publish_mission(uuid, uuid, uuid, int, int, int, jsonb)",
      "close_mission(uuid, uuid, uuid, int, int, jsonb)",
      "report_landed(uuid)",
    ]) {
      expect(sql).toContain(`revoke all on function public.${sig} from public, anon, authenticated;`)
      expect(sql).toContain(`grant execute on function public.${sig} to service_role;`)
    }
  })
})
