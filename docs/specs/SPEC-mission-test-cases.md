# SPEC: Structured Mission Test Cases

**Status:** Awaiting approval
**Branch:** `feat/mission-test-cases`
**Base branch:** `main` (with `feat/project-category` merged **and its migration applied**)
**Depends on:** PR 2 (`feat/project-category`)
**Blocks:** PR 4 (`feat/tester-audit-log`) — entirely. PR 4's audit entries key off `test_steps[].id`.

## Summary

A mission stops being a title plus free text. It becomes a **test category**, an ordered **test case**
of action / expected-result steps, and a **device target** — built from scratch or from a template.

`task_description` survives as the overall brief. The steps are the testable substance.

One migration with a backfill. Highest-risk PR in this sequence: it repurposes a live column and
changes the shape PR 4 is built on.

## Why

Today a builder writes a paragraph and a tester writes a paragraph back. Neither side can tell which
part of the app was actually exercised, and the AI summary in PR 4 has nothing to key off but tone.
Steps make the ask unambiguous and give the audit log something to file against.

## Non-goals

- **No per-step screenshots.** PR 4's non-goal too; the entry table is designed so adding
  `screenshot_urls text[]` later is additive.
- **No builder-authored templates.** Templates are curated content in TypeScript, not user data.
- **No drag-and-drop reordering.** Up/down buttons. A DnD dependency is not worth it here.
- **No step-level branching, conditions, or nesting.** A flat ordered list.
- **No migration of `task_description` into steps.** Existing missions get `test_steps = []` and are
  handled explicitly by the UI, not backfilled with a guess.
- **No change to `missions.payout_cents`.** Per CLAUDE.md it stays untouched outside paid-missions work.
- **No change to the review flow** (`actions/review.ts`, approve / changes-requested / rating).
- **No RLS policy changes.** See the security finding below — related, deliberately separate.

---

## Decision: writes move to `createAdminClient()`

The task asked me to choose between the anon server client (what `actions/missions.ts` uses today)
and the service-role client, on the merits. I probed the live database rather than reasoning from the
docs, because CLAUDE.md's description of the RLS setup turns out to be incomplete.

### What the database actually does

| Probe (non-destructive, values written back unchanged) | Result |
|---|---|
| Non-owner UPDATE another builder's project | blocked, 0 rows |
| Non-owner UPDATE another builder's mission | blocked, 0 rows |
| Non-owner INSERT a mission into another builder's project | blocked, policy violation |
| Non-owner DELETE another builder's mission | blocked, 0 rows |
| **Owner** UPDATE own project / mission / INSERT | allowed |
| **Owner** writes `projects.flagged_at` | **allowed** |
| **Owner** writes `projects.owner_id` | **allowed** |
| **Owner** writes `missions.payout_cents` | **allowed** |
| Owner writes own `profiles.role` | blocked |

So `projects` and `missions` carry working **owner-scoped** RLS policies — which CLAUDE.md does not
mention; it says the only anon policy is "tester can read their own submissions". Row-level ownership
is genuinely enforced today, and the missing `.eq("owner_id", ...)` in `updateProject` /
`updateMission` is backstopped by it.

But those policies carry **no column restriction**, which is exactly the failure CLAUDE.md predicts in
"Data Mutations". A builder holding their own session and the public anon key can call PostgREST
directly from the browser and set `flagged_at` on their own project — un-flagging themselves after an
admin moderates them — or write `payout_cents`, the column the repo says not to wire anything to.

### Why that decides it for PR 3

The deciding factor is not which client is safer in isolation — the server action controls its own
column list either way, and neither choice closes the browser-side hole.

It is that **PR 3 introduces `test_steps`, and PR 4 keys its audit entries off `test_steps[].id`.**
While a broad owner UPDATE policy exists on `missions`, a builder can PUT arbitrary JSON into
`test_steps` straight through PostgREST, bypassing Zod entirely — malformed steps, duplicate ids,
rewritten ids that orphan historical audit entries. Zod validating `test_steps` at the server action
is advisory for as long as a second, unvalidated write path exists.

The coherent end state is: **service-role writes in the action, and no anon write policy on
`missions`** — then the action is the only write path and the schema is actually enforcing. This PR
does the first half, which is the half that belongs in it.

### What this PR does

- `createMission`, `updateMission`, `deleteMission`, `toggleMissionStatus` move to
  `createAdminClient()` with explicit column lists.
- **A new `requireProjectOwner(projectId, userId)` guard in `lib/auth.ts`**, called by every one of
  them, throwing if the project is not the caller's. This is not optional: the service-role client
  bypasses RLS, so moving without it would trade a working ownership check for nothing. Today those
  actions have **no ownership check in code at all** — they lean entirely on RLS — so the guard is
  new code, not a port.
- `requireAccount("builder")` stays where it already is.

### What this PR does not do, and needs a separate decision

Dropping the broad owner-write RLS policies on `projects` and `missions` is what actually closes the
direct-PostgREST path. It is a live-database change that could break any surface still writing
through the anon client, it is explicitly out of this PR's scope, and CLAUDE.md says not to reach for
RLS to solve auth. **Flagging it, not doing it.** It wants its own branch, its own probe of every
remaining anon write, and your sign-off — and it should land before PR 4, because PR 4's audit log
inherits the same problem.

---

## Data model changes

`supabase/migrations/<date>_01_mission_test_cases.sql`

### The category backfill — evidence first

The task said to query before writing a destructive `UPDATE`. Of 16 live missions:

| Count | `category` | Disposition |
|---|---|---|
| 13 | `null` | untouched |
| 1 | `"Auth flow"` | **mapped to `process_flow`** — a sign-up/sign-in walkthrough is a process flow |
| 1 | `"Commerce"` | nulled — a domain tag, not a test category |
| 1 | `"CLI / Developer Tools"` | nulled — a domain tag, not a test category |

Two rows lose a value; one is preserved by mapping. The two being nulled describe *what the product
is*, which is now `projects.category` from PR 2 — they were never test categories, so nothing is lost
that the new column could have held.

```sql
-- Preserve the one existing tag that is genuinely a test category.
update public.missions set category = 'process_flow' where category = 'Auth flow';

-- Everything else was a domain tag, not a test category. Two rows.
update public.missions
   set category = null
 where category is not null
   and category not in ('process_flow', 'component', 'ui_design');

alter table public.missions
  add column if not exists test_steps    jsonb not null default '[]'::jsonb,
  add column if not exists device_target text  not null default 'both',
  add column if not exists template_id   text;
```

Notes, each of which belongs in the migration's own comment block:

- **No CHECK on `category` or `device_target`.** Enforced in Zod, consistent with `COUNTRIES`,
  `SKILLS` and `PROJECT_CATEGORIES`. Existing rows with `category = null` keep rendering.
- **`device_target` is one column with three values**, not an array. "Mobile or desktop or both" is
  three states. Defaulting existing missions to `'both'` is the honest reading: nobody specified, so
  nothing is excluded.
- **`test_steps` is jsonb, not a child table.** Steps are read and written whole with their mission,
  never queried across missions, never joined. A child table buys a join on every mission read for
  nothing. PR 4's entries *are* a child table because they are aggregated independently — the
  asymmetry is deliberate.
- **`test_steps` defaults to `'[]'`, not null**, so every consumer can iterate without a null check.

`lib/types/db.ts` — `MissionRow` gains `test_steps: TestStep[]`, `device_target: string`,
`template_id: string | null`. `category` is already there.

### Step shape

Defined once as a Zod schema in `lib/validation/schemas.ts`, with the TypeScript type derived from it:

```ts
export const testStepSchema = z.object({
  id: z.uuid(),
  action: z.string().trim().min(STEP_ACTION_MIN).max(STEP_ACTION_MAX),
  expected_result: z.string().trim().min(STEP_EXPECTED_MIN).max(STEP_EXPECTED_MAX),
})
export type TestStep = z.infer<typeof testStepSchema>

export const testStepsSchema = z
  .array(testStepSchema)
  .min(1, "Add at least one step.")
  .max(TEST_STEPS_MAX, `A test case can have at most ${TEST_STEPS_MAX} steps.`)
  .refine(unique-ids, "Each step needs its own id.")
```

`TEST_STEPS_MAX = 15`. Minimum lengths are deliberately low (around 4 and 4) — the point is to reject
blank and `"x"`, not to police phrasing.

**`id` must be stable across edits.** PR 4's entries reference it. Generated client-side with
`crypto.randomUUID()` when a step is added, carried through reordering, never derived from array
index. The uniqueness refine is what stops a duplicated step silently merging two audit histories.

## Vocabulary — `lib/vocabulary.ts`

```ts
export const TEST_CATEGORIES = ["process_flow", "component", "ui_design"] as const
export const DEVICE_TARGETS  = ["mobile", "desktop", "both"] as const
```

Machine values stored, human labels rendered — `testCategoryLabel()` and `deviceTargetLabel()` next
to the existing `countryName()`. Unlike `PROJECT_CATEGORIES` (stored as its own label, because that
list is display copy), these are enum-ish values a migration already writes, so a slug is right here.

`scripts/vocabulary.test.mts` extends to cover both: non-empty, no duplicates, snake_case shape, and
every value has a label.

## Templates — `lib/testTemplates.ts`, static TypeScript

Not a database table. They are content the team curates; a table means a migration to fix a typo.

```ts
export type TestTemplate = {
  id: string          // stored on missions.template_id — provenance only
  category: TestCategory
  name: string
  description: string
  steps: { action: string; expected_result: string }[]
}
```

**Proposed seeds — amend before implementation:**

- **Process Flow:** Authentication Flow, Password Reset, Checkout / Payment, Onboarding
- **Component:** Form Inputs & Validation, Buttons & Interactive States, Modals & Overlays,
  Navigation & Menus
- **UI Design:** First Impression & Clarity, Visual Hierarchy & Readability, Mobile Responsiveness,
  Consistency & Polish

UI Design steps are framed as prompts, not assertions — `action: "Land on the homepage and describe
your first impression"`, `expected_result: "The purpose of the product is clear within 5 seconds"`.
They are judgements, and PR 4's audit log has to accommodate a subjective answer against them.

**A template is copied, never referenced.** Steps get fresh `crypto.randomUUID()` ids on
instantiation; `template_id` records provenance only. If a template changes later, existing missions
must not change under their builders.

## Server actions — `actions/missions.ts`

`createMission` and `updateMission` add `category`, `test_steps`, `device_target`, `template_id` to
their explicit column lists, on the service-role client, behind `requireAccount("builder")` and the
new `requireProjectOwner()`.

`test_steps` arrives from `FormData` as a JSON string from a hidden input. It is `JSON.parse`d inside
a try/catch and run through `testStepsSchema` **before** it goes near the database; a parse failure is
a field error, not a 500. Malformed JSON must never be stored.

## UI

`AddMissionForm` and `EditMissionForm` are already near-duplicates sharing `MissionRewardFields`.
**The whole test-case editor goes into one shared `components/missions/TestCaseEditor.tsx`**, used by
both, the way `MissionRewardFields` already is. It is not built twice.

Flow inside the editor:

1. **Test category** — three selectable cards, not a dropdown, each with a one-line explanation
   (`"Component Testing — individual elements like buttons, inputs and checkboxes"`). Filters step 2.
2. **Start from** — "Blank test case" or a template, filtered to the chosen category, each showing
   name, description and step count.
3. **Steps** — ordered rows of `action` + `expected_result`. Add, remove, move up/down. Template steps
   arrive prefilled and fully editable.
4. **Device target** — three radios: Mobile / Desktop / Both.

Constraints: 1–15 steps, both fields required per step. Errors render **per step row**, not as one
message at the top — `fieldErrors["test_steps.3.action"]` maps to the row.

**One voltage CTA per viewport** (DESIGN.md §5.1, §7): that is "Create Mission". Add step, remove
step, template select and category cards are secondary or ghost. This form will be tempted toward
three prominent buttons; it gets one.

**Existing missions have `test_steps = []`.** The edit form renders the empty editor with a prompt to
add the first step — per DESIGN.md §8's empty-state shape — not a crash and not a misleading
"0 steps" state.

## Display

- **Mission detail, both roles:** the test case as a numbered list of action / expected pairs, plus
  category and device chips. `task_description` stays above it as the brief. This is where the tester
  reads what to do — PR 1 removed descriptions from *cards*, not here.
- **Mission cards:** gain category and device chips. Per DESIGN.md §5.4 a chip's colour never carries
  meaning alone; each has a text label. A mission with no category renders no chip rather than an
  "Uncategorised" one — unlike a project, an uncategorised mission is the norm right now (13 of 16).
- **Admin mission views** render the steps read-only.

## Tests

| ID | Case | Expected |
|---|---|---|
| MTC-01 | `createMission` unauthenticated / non-builder | throws, no write |
| MTC-02 | `createMission` against a project the caller does not own | throws, no write — the new guard |
| MTC-03 | `test_steps` round-trips through create | stored JSON matches input exactly |
| MTC-04 | Step ids preserved across an update | ids identical before and after an edit that reorders |
| MTC-05 | Malformed `test_steps` JSON | field error, no write, no throw |
| MTC-06 | Empty step list | rejected |
| MTC-07 | 16 steps | rejected |
| MTC-08 | Duplicate step ids | rejected |
| MTC-09 | Invalid `category` / `device_target` | rejected |
| MTC-10 | Template instantiation produces fresh ids | two instantiations of one template share no id |
| MTC-11 | `updateMission` writes only the explicit column set | `payout_cents`, `project_id` untouched |
| MTC-12 | Existing mission with `test_steps = []` | edit form renders, no crash |

Plus `scripts/vocabulary.test.mts` for both new vocabularies, and a `lib/__tests__/testTemplates.test.ts`
asserting every template's category is in `TEST_CATEGORIES`, ids are unique, and no template ships an
empty step list.

**Gates:** `tsc`, `lint` (at zero — this PR holds it there), `build`, `test`.

## Rollout

**Order: apply PR 2's migration → merge PR 2 → apply this migration → deploy this.** PR 2's
`projects.category` column is still not applied at time of writing, and `/explore` silently renders
empty without it.

This migration's `UPDATE` runs before the `ALTER`, so the two nulled rows are nulled under the old
meaning of the column, not the new one. Additive columns are safe to apply ahead of the code.

**Existing missions after this ships:** `test_steps = []`, `device_target = 'both'`, `template_id`
null, and `category` null except the one mapped row. They render, they are testable, and their
builders are prompted for steps on next edit. No backfill invents steps from `task_description` — a
guessed test case is worse than an honest empty one, because a tester would follow it.

**Rollback:** revert the code, then drop the three columns. `category` cannot be rolled back — the two
nulled values are gone. They are recorded in this spec above, which is the only copy; recover them by
hand from here if it matters.

## Acceptance criteria

1. Migration maps `"Auth flow"` → `process_flow` and nulls only the two domain tags.
2. Three columns added, defaults as specified, no CHECK constraints, safe to re-run.
3. `TEST_CATEGORIES` and `DEVICE_TARGETS` in `lib/vocabulary.ts` with label helpers, covered by
   `scripts/vocabulary.test.mts`.
4. `testStepSchema` / `testStepsSchema` in `lib/validation/schemas.ts`; `TestStep` derived from it.
5. Step ids are uuids, unique-checked, stable across edits and reorders, never index-derived.
6. `lib/testTemplates.ts` is static TypeScript with ≥3 templates per category; instantiation produces
   fresh ids.
7. `requireProjectOwner()` exists in `lib/auth.ts` and is called by all four mission actions.
8. All four mission actions use `createAdminClient()` with explicit column lists.
9. Malformed `test_steps` JSON is a field error, never stored, never a 500.
10. `TestCaseEditor` is one shared component used by both forms.
11. Per-step errors render on their row.
12. Exactly one voltage CTA on each mission form.
13. Missions with `test_steps = []` render an empty editor with a prompt.
14. Mission detail pages render the steps; cards render category and device chips with text labels.
15. All four gates pass, lint still at zero.

## Manual test plan

**Build from scratch:** create a mission in each category, 1 step, 15 steps, then try 16. Reorder and
confirm ids survive (check the row in the database).

**Build from template:** instantiate Authentication Flow, edit one step, drop another, save. Confirm
`template_id` is recorded and the stored steps are the edited ones, not the template's.

**Existing mission:** open one of the 13 with `test_steps = []`. Confirm the empty editor and prompt,
add a step, save.

**Ownership:** attempt `updateMission` against another builder's mission id (via the action, not the
database). Confirm it throws and nothing is written.

**Category backfill:** after the migration, confirm the `"Auth flow"` mission reads `process_flow` and
the other two read null.

## Reference

- Codebase patterns: `CLAUDE.md` — Data Mutations, Atomicity, Validation
- Buttons, inputs, cards, badges, empty states: `DESIGN.md` §5.1, §5.2, §5.3, §5.4, §8; hierarchy §7
- Test pattern and gates: `TEST.md` §1
- Prior specs: `SPEC-verification-gate.md`, `SPEC-profile-editor.md`, `SPEC-onboarding-polish.md`,
  `SPEC-project-category.md`
