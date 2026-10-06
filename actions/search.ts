"use server"

import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActiveAccount } from "@/lib/auth"
import { one } from "@/lib/utils/project"

export type SearchResult =
  | { kind: "project"; id: string; name: string; description: string | null }
  | { kind: "mission"; id: string; title: string; projectName: string; projectId: string }

const querySchema = z.string().trim().min(2).max(100)

/**
 * The top-bar search, server-side.
 *
 * It ran in the browser until 20261006_01 took projects.owner_id away from
 * signed-in users: a builder's search is scoped to their own projects, and that
 * filter cannot run where the column cannot be read. The role comes from the
 * session here, never from the caller — the component's `account` prop only
 * decides where a result links.
 *
 * A tester searches the community: every unflagged project and active mission.
 * A builder searches their own work.
 */
export async function searchEverything(raw: string): Promise<SearchResult[]> {
  const parsed = querySchema.safeParse(raw)
  if (!parsed.success) return []

  const resolved = await getActiveAccount()
  if (!resolved) return []
  const mine = resolved.active === "builder" ? resolved.userId : null

  const pattern = `%${parsed.data}%`
  const admin = createAdminClient()

  let projectQuery = admin
    .from("projects")
    .select("id, name, description")
    .is("flagged_at", null)
    .ilike("name", pattern)

  // !inner is what makes the embedded project filterable.
  let missionQuery = admin
    .from("missions")
    .select("id, title, project_id, projects!inner(name)")
    .eq("is_active", true)
    .is("projects.flagged_at", null)
    .ilike("title", pattern)

  // A builder's results have to be things they can open: every /dashboard
  // route is theirs alone.
  if (mine) {
    projectQuery = projectQuery.eq("owner_id", mine)
    missionQuery = missionQuery.eq("projects.owner_id", mine)
  }

  const [projectRes, missionRes] = await Promise.all([
    projectQuery.limit(5),
    missionQuery.limit(5),
  ])

  const results: SearchResult[] = []
  for (const p of projectRes.data ?? []) {
    results.push({ kind: "project", id: p.id, name: p.name, description: p.description })
  }
  for (const m of (missionRes.data ?? []) as {
    id: string
    title: string
    project_id: string
    projects: { name: string } | { name: string }[] | null
  }[]) {
    results.push({
      kind: "mission",
      id: m.id,
      title: m.title,
      projectName: one(m.projects)?.name ?? "Unknown",
      projectId: m.project_id,
    })
  }
  return results
}
