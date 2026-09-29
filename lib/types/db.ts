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
  /** null means Community. Read by lib/allowanceDb.ts through planIdFor(). */
  plan_id: string | null
}

/** report_ledger — append-only. Arithmetic in lib/allowance.ts. */
export type ReportLedgerRow = {
  id: string
  profile_id: string
  account_id: string | null
  mission_id: string | null
  kind: string
  bucket: string
  /** Monthly bucket only: the Lagos month the slots belong to. */
  period: string | null
  /** Negative on a reserved row. */
  slots: number
  created_at: string
}

export type ProjectRow = {
  id: string
  owner_id: string
  name: string
  description: string | null
  app_url: string | null
  category: string | null
  created_at: string
  flagged_at: string | null
  flag_reason: string | null
  flagged_by: string | null
}

export type MissionRow = {
  id: string
  project_id: string
  title: string
  /** The overall brief. The testable substance is `test_steps`. */
  task_description: string
  created_at: string
  is_active: boolean | null
  /** A TEST_CATEGORIES value since the test-case migration. Null on older rows. */
  category: string | null
  /**
   * The ordered test case. Defaulted to '[]' in the database, so this is never
   * null — but it is very often empty, on every mission that predates it.
   *
   * Typed as unknown rather than TestStep[]: this is what came out of a jsonb
   * column, and nothing in the database constrains its shape. Parse it through
   * testStepsSchema before trusting it.
   */
  test_steps: unknown
  /** A DEVICE_TARGETS value. Defaulted to 'both', so never null. */
  device_target: string
  /** Which template this was built from, if any. Provenance only. */
  template_id: string | null
  load_test_at: string | null
  testers_needed: number | null
}

export type TestResultRow = {
  id: string
  mission_id: string
  tester_id: string
  screenshot_url: string | null
  screenshot_urls: string[] | null
  /** Optional since the audit log — "anything else?" at the end of the form.
   *  Every submission written before it carries this and nothing else. */
  tester_comment: string | null
  ai_summary: string | null
  ai_sentiment: string | null
  created_at: string
  status: string | null
  rating: number | null
  review_note: string | null
  reviewed_at: string | null
}

/**
 * One tester's answer to one of the builder's test-case steps.
 *
 * step_action and step_expected are snapshots of the builder's wording at
 * submission time, not lookups. A builder editing the mission afterwards must
 * not rewrite what the tester appears to have been asked — step_id is kept for
 * correlation, but the snapshot is the record.
 */
export type TestResultEntryRow = {
  id: string
  test_result_id: string
  step_id: string
  step_index: number
  step_action: string
  step_expected: string
  status: string
  issue_summary: string | null
  steps_to_reproduce: string | null
  actual_result: string
  expected_result: string
  created_at: string
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
