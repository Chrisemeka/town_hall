/**
 * Row shapes for the five live tables and the one view.
 *
 * The Supabase client is constructed without a `Database` generic, so every
 * `.select()` comes back as `any`. That `any` was spreading outward: pages
 * annotated their `.map()` callbacks with it, so a typo in a column name
 * type-checked and failed at runtime instead.
 *
 * These are hand-written against the live schema rather than generated, because
 * generating them needs the Supabase CLI and an access token in CI, and this
 * app reads a handful of tables. If the table count grows, replace this file
 * with `supabase gen types typescript` output and type the client itself — the
 * shape of the fix stays the same.
 *
 * Keep in step with `supabase/migrations/` and the Data Model table in
 * CLAUDE.md. Columns whose values are a fixed vocabulary are typed as `string`,
 * not as unions: the database has no CHECK constraints backing them (see the
 * RLS/validation notes in CLAUDE.md — the vocabularies are enforced in Zod at
 * the write boundary), so a union here would claim a guarantee that nothing
 * upholds. Callers that need one narrow it themselves, which several already do.
 */

export type ProfileRow = {
  id: string
  full_name: string | null
  avatar_url: string | null
  updated_at: string | null
  email: string | null
  role: string | null
  moderation_status: string | null
  ban_reason: string | null
  banned_at: string | null
  banned_by: string | null
  accepted_terms_at: string | null
  seen_tours: string[] | null
  country: string | null
  phone: string | null
  timezone: string | null
  bio: string | null
  skills: string[] | null
}

export type AccountRow = {
  id: string
  user_id: string
  type: string
  created_at: string
  verification_completed_at: string | null
}

export type ProjectRow = {
  id: string
  owner_id: string
  name: string
  description: string | null
  app_url: string | null
  created_at: string
  flagged_at: string | null
  flag_reason: string | null
  flagged_by: string | null
}

export type MissionRow = {
  id: string
  project_id: string
  title: string
  task_description: string
  created_at: string
  is_active: boolean | null
  payout_cents: number | null
  category: string | null
  load_test_at: string | null
  testers_needed: number | null
}

export type TestResultRow = {
  id: string
  mission_id: string
  tester_id: string
  screenshot_url: string | null
  screenshot_urls: string[] | null
  tester_comment: string
  ai_summary: string | null
  ai_sentiment: string | null
  created_at: string
  status: string | null
  rating: number | null
  review_note: string | null
  reviewed_at: string | null
}

/** Public view. Exists so tester comments stay private while counts do not. */
export type MissionFeedbackCountRow = {
  mission_id: string
  count: number
}

/**
 * How an embedded relation actually arrives.
 *
 * `.select("*, projects(*)")` hangs the relation off the parent, and PostgREST
 * decides on its own whether a to-one embed comes back as an object or as a
 * one-element array. `one()` in lib/utils/project.ts normalises it; this is the
 * type that says the question exists.
 */
export type Embedded<T> = T | T[] | null | undefined
