import "server-only"

// The one definition of "a new test case for this tester" — the sidebar
// counter and the daily digest both read it, so they cannot disagree.
//
// Service role: projects.owner_id is not readable otherwise (20261006_01). It
// is read only to leave out the tester's own projects and is never returned —
// the tester is never sent the builder's identity (CLAUDE.md).

import { createAdminClient } from "@/lib/supabase/admin"
import { missionsForTester } from "@/lib/cohortDb"
import { one } from "@/lib/utils/project"
import type { Embedded, MissionRow, ProjectRow } from "@/lib/types/db"

/** What the counter and the digest render. Never the owner. */
export type NewMission = Pick<MissionRow, "id" | "title" | "category" | "device_target"> & {
  projectName: string
  firstPublishedAt: string
}

type Filterable = {
  eq(column: string, value: boolean): Filterable
  is(column: string, value: null): Filterable
}

/**
 * What counts as live: published and on an unflagged project. Shared with
 * Available Test Cases, so the page and the counter agree. The query must
 * embed `projects!inner(...)` for the flagged filter to remove rows.
 */
export function liveMissionFilter<Q>(query: Q): Q {
  // ponytail: cast rather than constrain Q — a constraint against the PostgREST
  // builder's generics is "excessively deep" for tsc. Both calls exist on
  // every filter builder.
  return (query as unknown as Filterable).eq("is_active", true).is("projects.flagged_at", null) as unknown as Q
}

/**
 * Live test cases this tester can see, first published after `since`, newest
 * first. The page's rules minus two things a "new" signal must never include:
 * the tester's own projects (a dual-role person publishing their own test
 * case) and test cases they have already tested (reachable through search).
 * Then the cohort's courtesy filter, the same one the page applies.
 */
export async function newMissionsFor(userId: string, since: string, limit?: number): Promise<NewMission[]> {
  const admin = createAdminClient()
  const [missions, tested] = await Promise.all([
    liveMissionFilter(
      admin
        .from("missions")
        .select("id, title, category, device_target, first_published_at, projects!inner(name, owner_id, flagged_at)"),
    )
      .gt("first_published_at", since)
      .order("first_published_at", { ascending: false }),
    admin.from("test_results").select("mission_id").eq("tester_id", userId),
  ])
  if (missions.error) throw new Error(missions.error.message)
  if (tested.error) throw new Error(tested.error.message)

  type Row = Pick<MissionRow, "id" | "title" | "category" | "device_target"> & {
    first_published_at: string
    projects: Embedded<Pick<ProjectRow, "name" | "owner_id">>
  }
  const done = new Set((tested.data ?? []).map((r) => r.mission_id as string))
  const candidates = ((missions.data ?? []) as unknown as Row[]).filter(
    (m) => one(m.projects)?.owner_id !== userId && !done.has(m.id),
  )
  const shown = await missionsForTester(userId, candidates.map((m) => m.id))
  return candidates
    .filter((m) => shown.has(m.id))
    .slice(0, limit)
    .map((m) => ({
      id: m.id,
      title: m.title,
      category: m.category,
      device_target: m.device_target,
      projectName: one(m.projects)?.name ?? "",
      firstPublishedAt: m.first_published_at,
    }))
}

/**
 * The counter on Available Test Cases: new since the tester last opened it.
 * Never throws — it runs in the layout of every tester page, and a broken
 * count must cost the badge, not the page.
 */
export async function newMissionCount(userId: string): Promise<number> {
  try {
    const { data, error } = await createAdminClient()
      .from("accounts")
      .select("missions_seen_at")
      .eq("user_id", userId)
      .eq("type", "tester")
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data?.missions_seen_at) return 0
    return (await newMissionsFor(userId, data.missions_seen_at)).length
  } catch (err) {
    console.error("[newMissionCount] failed:", err)
    return 0
  }
}
