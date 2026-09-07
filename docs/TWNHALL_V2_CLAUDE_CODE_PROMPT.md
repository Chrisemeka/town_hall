# Twnhall v2 — Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble — read before you write any code

You are implementing a set of changes to Twnhall driven by a week of market validation. These changes alter the core testing model: missions stop being a free-text task description and become a **structured test case**, and tester feedback stops being a comment box and becomes a **per-step audit log**.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over every other doc in this repo, including this prompt, on codebase conventions.
2. Read `DESIGN.md` §5 and §8 before building any UI.
3. Read `TEST.md` §1 for the server-action test pattern.
4. Read the two existing specs in `docs/specs/` — `SPEC-verification-gate.md` and `SPEC-profile-editor.md`. **Match their structure and level of detail** when you write new specs.

### Housekeeping first (do this before PR 1)

The working tree currently shows ~155 modified files that are pure CRLF line-ending churn (29,089 insertions against 29,089 deletions). This makes every diff unreadable. Fix it first, on its own branch:

```
chore/normalize-line-endings
```

- Add `.gitattributes` with `* text=auto eol=lf`
- Run `git add --renormalize .`
- Commit. Do not mix any other change into this commit.

Also: `feat/profile-editor` is unmerged and three weeks stale. Confirm with the user whether it should be merged to `main` before this work starts. **Do not branch PR 1 off `feat/profile-editor`** — branch off `main`.

### Delivery shape

Four sequential PRs, in this order. Each depends on the one before it. **Do not start a PR until the previous one is merged.** For each PR:

1. Write the spec first into `docs/specs/SPEC-<name>.md`, matching the existing spec format (Status, Branch, Depends on, Blocks, Summary, Why, Non-goals, Data model changes, Server actions, UI, Tests, Rollout).
2. **Stop and get the spec approved before implementing.**
3. Implement with the commit granularity `CLAUDE.md` requires: schema migration → server action → UI → tests, each a separate commit.
4. All four gates must pass before you call it done: `npx tsc --noEmit` clean, `npm run lint` with no new `as any`, `npm run build` clean, `npm test` green.

### Decisions already made — do not relitigate these

- **Audit log granularity:** one audit-log entry **per test-case step**. Not one per mission, not one per issue.
- **`missions.category`:** repurpose the existing free-text column into the test-category enum. Do not add a parallel `test_category` column.
- **Delivery:** four sequential PRs as laid out below.

### Rules that apply to every PR here

- Every new column is **nullable or defaulted**. There are ~36 live accounts and real project/mission/submission rows. Nothing you write may break an existing row's ability to render.
- Anything requiring atomicity is a **plpgsql function** in `supabase/migrations/` invoked via `supabase.rpc()`. There is no ORM and no `$transaction`. This is not optional — PR 4 needs it.
- All input validated with Zod at the boundary in `lib/validation/schemas.ts`. Not in helpers, not in components. At the entry point.
- Writes go through `createAdminClient()` (service role) with an **explicit column list**, gated by `requireAccount()`. Do not add RLS policies to solve auth.
- Fixed vocabularies (categories, device targets, template ids) live in `lib/vocabulary.ts` alongside `SKILLS`, `COUNTRIES`, `TIMEZONES`. One definition, no duplicates. Extend `scripts/vocabulary.test.mts` to cover each new vocabulary.
- Design tokens: Syne Bold 700 headings, DM Mono body/UI, all spacing divisible by 4, accent `#E8FF47` (voltage), **one voltage CTA per viewport**, colour never conveys state without a text label, dark dashboard surfaces (`obsidian` / `graphite` / `iron` / `chalk` / `ash` / `ember`).

---

# PR 1 — Onboarding polish and mission-card cleanup

**Branch:** `feat/onboarding-polish`
**Base:** `main`
**Migration:** none
**Risk:** low

Four small, independent changes bundled because none of them justifies its own PR and none touches the database.

## 1.1 — Builder onboarding collects timezone

Currently only testers are asked for a timezone. `components/verification/VerificationFlow.tsx` gates the field behind `role === "tester"` with the comment *"builders have no timezone-dependent surface yet."* That is no longer true — scheduled load-test windows will need it on both sides.

Changes:

- `lib/validation/schemas.ts` — `builderStep1Schema` becomes `z.object({ ...identityFields, ...timezoneField })`. It is then identical to `testerStep1Schema`; keep both names for call-site clarity but define one and alias the other, so they cannot drift.
- `components/verification/VerificationFlow.tsx` — add `"timezone"` to the builder step's `fields` array in the `STEPS` record. Remove the `role === "tester" &&` conditional wrapping the timezone `<Field>` in `IdentityStep`, and delete the now-false comment above it.
- The existing `useEffect` that auto-detects the browser timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) will now fire for builders too. That is intended — verify it does not overwrite a saved value on revisit (it already guards on `if (values.timezone) return`).
- `actions/verification.ts` — `completeVerification` already selects `timezone` and validates through `verificationSchemaFor(role)`. Confirm the builder path now requires it. No other change should be needed.

**Migration note for existing builders:** every builder verified before this ships has `timezone = NULL` but `verification_completed_at` set. They are already through the gate and will **not** be re-prompted. That is correct — do not force re-verification. If a builder-facing feature later hard-requires timezone, it prompts then. State this explicitly in the spec's Rollout section.

Tests: extend `actions/__tests__/verification.test.ts` to prove a builder completion is now **rejected** when timezone is missing and accepted when present.

## 1.2 — Auto-populate the phone country code from the selected country

Currently the phone field is empty with the helper *"Include your country code — e.g. +234 801 234 5678."* Users are typing it manually.

`libphonenumber-js` is already a dependency. Use `getCountryCallingCode` from it.

Behaviour, in `IdentityStep`'s country `onChange` in `VerificationFlow.tsx`:

- Country selected, phone field **empty** → set phone to `+<callingCode> ` (trailing space).
- Country changed, phone field contains **only** the previous country's dial code (with or without trailing whitespace) → replace it with the new one.
- Country changed, phone field contains a **real number the user typed** → do **not** clobber it. Keep the existing behaviour of re-running `formatPhoneAsYouType(values.phone, code)` to re-group it.

That third case is the one that matters. A user who types their number and then corrects the country dropdown must not lose their number.

Also update the helper text — it should no longer instruct the user to do something the form now does for them. Something like *"We've filled in your country code."* is enough.

Put the "is this value just a dial code?" logic in `lib/phone.ts` as an exported, unit-testable function (e.g. `isBareDialCode(value, country)`), not inline in the component. `lib/phone.ts` already carries the UX-only phone helpers and documents that the schema stays the authority on validity — keep that boundary.

Tests: add cases to the phone helpers covering all three branches above, including a country with a shared calling code (e.g. US/CA both `+1`) — switching between them must not double-prefix.

## 1.3 — Loading state between onboarding and the dashboard

`onComplete()` in `VerificationFlow.tsx` calls `completeVerification(role)` inside `startTransition`, then `router.push(result.redirectTo)`. The `pending` flag from `useTransition` covers the server action, but there is a visible dead gap between the push and the destination route painting — the user sits on the review step with nothing happening.

Two fixes, both needed:

**a) A terminal navigating state in the flow.** Add `const [navigating, setNavigating] = useState(false)`. Set it `true` immediately before `router.push(...)` and **never set it back to false** — this component is being torn down, and clearing it would flash the review step back into view. When `navigating` is true, render a full-panel loading state in place of the form: the Twnhall logo or a voltage spinner, plus a line of copy that names the destination (`"Setting up your builder dashboard…"` / `"…tester dashboard…"`). Disable every control.

**b) Route-level `loading.tsx` files.** There are currently none in the app. Add them for the destinations `homeFor()` can return and for the heavy authenticated surfaces:

- `app/(developer)/dashboard/loading.tsx`
- `app/(tester)/explore/loading.tsx`
- `app/(tester)/tester/loading.tsx`

Each should be a **skeleton matching that route's actual layout** — card outlines in `graphite` with `iron` borders at the real dimensions — not a centred spinner. Read the corresponding `page.tsx` to get the shape right. Follow `DESIGN.md` on empty and loading states; if it specifies a skeleton treatment, use that rather than inventing one.

Do not add a `loading.tsx` at `app/layout.tsx` level — it would fire on every navigation including cheap ones.

## 1.4 — Remove the description from mission cards

Mission cards should show title and metadata only, for both roles. Confirmed locations to change:

- `components/ProjectDetailTabs.tsx` line ~146 — renders `mission.task_description` inside the mission list. Remove it.

Then **search the whole app** for other mission-card surfaces rendering a description and remove there too. Check at minimum: `components/BrowseMissions.tsx`, `components/MissionListPaged.tsx`, `components/tester/MissionStrip.tsx`, `components/ExploreGrid.tsx`, `app/(tester)/explore/missions/page.tsx`, `app/(developer)/dashboard/missions/page.tsx`.

**Scope boundary — do not overreach:**

- **Mission cards** lose the description. **Mission detail pages keep it.** Do not touch `app/(tester)/mission/[id]/page.tsx` line ~93 or `app/(developer)/dashboard/[projectId]/mission/[missionId]/page.tsx` line ~108 — the tester needs to read the task before testing it.
- `components/ExploreGrid.tsx` line ~178 renders **`project.description`**, not the mission's. That is a project card, not a mission card. Leave it (PR 2 changes it for a different reason).
- Do not remove `task_description` from any admin view.

If removing the description leaves a card looking thin, add the metadata that is actually useful now — submission count, active/draft status, created date — rather than leaving whitespace. Check what each card already has before adding.

---

# PR 2 — Project category and two-sentence summary

**Branch:** `feat/project-category`
**Base:** `main` (with PR 1 merged)
**Migration:** one
**Risk:** low-medium — touches an existing required field on live rows

## What changes

The project creation form currently collects name, URL, and a free "Brief Summary" up to 300 characters. Replace the summary's framing: add a **category**, and constrain the summary to **two sentences**.

## Data model

```sql
ALTER TABLE projects ADD COLUMN category text NULL;
```

**Keep the `description` column.** Do not rename it to `summary`. It is read by `ExploreGrid`, the admin console, and the project detail pages; renaming buys nothing and breaks all of them. Change what the form asks for and what the schema enforces — the column name stays.

**Do not add a NOT NULL constraint or a CHECK on `category`.** Every existing project row has `category = NULL`, and existing rows must keep rendering. Enforce the vocabulary in Zod at the boundary, per the repo's existing pattern (`COUNTRIES` and `SKILLS` are enforced in Zod, not in Postgres). Render a neutral "Uncategorised" chip for null.

## Vocabulary

Add to `lib/vocabulary.ts`, following the shape of `SKILLS` and `COUNTRIES` — a `const` array plus a derived type:

```ts
export const PROJECT_CATEGORIES = [
  "Fintech", "HealthTech", "EdTech", "E-commerce", "SaaS / B2B Tools",
  "Developer Tools", "AI / ML", "Social & Community", "Marketplace",
  "Productivity", "Media & Entertainment", "Logistics & Mobility",
  "Gaming", "Other",
] as const
```

Propose this list in the spec and let the user amend it before you implement. `"Other"` must be last and must exist — a builder whose category is missing will otherwise pick a wrong one, which is worse than an honest catch-all.

Extend `scripts/vocabulary.test.mts` to cover it: no duplicates, no empty strings, `"Other"` present.

## Validation — the two-sentence rule

This is the one genuinely awkward requirement. **Sentence counting is fuzzy** and a naive count of `.`/`!`/`?` will reject legitimate summaries containing "e.g.", "Inc.", "v2.0", or a URL.

Implement it as a Zod `.refine()` on `description` in `projectSchema`:

- Strip known abbreviation patterns and decimal numbers before counting.
- Count terminators matching `/[.!?](\s|$)/`.
- Allow **1 or 2**. Reject 0 (no terminator at all — they wrote a fragment) and 3+.
- Error message must be actionable: `"Keep it to two sentences — say what it does and who it's for."`
- Lower `PROJECT_SUMMARY_MAX` from 300 to **200**. Two sentences do not need 300 characters, and the cap is a cheaper enforcement mechanism than the regex.

Put the counting function in `lib/vocabulary.ts` or a new `lib/sentences.ts`, exported and unit-tested against the abbreviation cases above. **Do not inline the regex in the schema.**

Be honest in the spec: this heuristic will occasionally be wrong. The character cap is the real constraint; the sentence check is a nudge. If it proves annoying in practice, the fallback is to drop the refine and keep the 200-char cap.

**Existing rows:** projects created before this ships may have 300-character, five-sentence descriptions. They are not re-validated and must keep rendering. The new rule applies at write time only. Editing an old project **will** force its description down to the new rule — call this out in the spec and confirm the user accepts it.

## Server actions and UI

- `actions/project.ts` — add `category` to the explicit column list in both `createProject` and `updateProject`.
- `components/CreateProjectForm.tsx` — add a category `<select>` above the summary field; relabel "Brief Summary" to something that signals the constraint (e.g. "What is it? (2 sentences)"); update the placeholder to a genuine two-sentence example; update the helper text and character counter to the new 200 cap.
- `components/EditProjectForm.tsx` and `components/InlineEditProject.tsx` — same field, same validation. These three forms must not drift.
- `components/ExploreGrid.tsx` — render the category as a chip on the project card, and add it to the client-side filter alongside the existing name/description search at line ~66. A category filter dropdown would be genuinely useful here; propose it in the spec.

Tests: `actions/__tests__/` coverage for `createProject`/`updateProject` — auth rejection, category persisted, invalid category rejected, sentence-rule rejection, happy path.

---

# PR 3 — Structured mission test cases

**Branch:** `feat/mission-test-cases`
**Base:** `main` (with PR 2 merged)
**Migration:** one, with a backfill
**Risk:** high — repurposes a live column and changes the mission model

This is the largest and most architecturally consequential PR. **PR 4 depends entirely on it.** Write the spec carefully.

## What changes

A mission stops being a title plus a free-text `task_description`. It becomes:

- a **test category** (Process Flow / Component / UI Design)
- a **structured test case**: an ordered list of steps, each with an action and an expected result
- a **device target** (mobile / desktop / both)
- built either from **scratch** or from a **customisable template**

`task_description` survives as the mission's overall brief — the context paragraph. The steps are the testable substance.

## Data model

```sql
-- 1. Repurpose category into the test-category enum.
--    Existing values are free-text tags and do not map to the new vocabulary.
UPDATE missions SET category = NULL
  WHERE category IS NOT NULL
    AND category NOT IN ('process_flow', 'component', 'ui_design');

-- 2. The structured test case.
ALTER TABLE missions
  ADD COLUMN test_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN device_target text NOT NULL DEFAULT 'both',
  ADD COLUMN template_id text NULL;
```

Notes, each of which belongs in the spec:

- **The `UPDATE` destroys data.** Every existing free-text category tag is nulled. Before writing the migration, run a read-only query against the live database to see what values actually exist and how many rows carry them, and **show the user that list**. If a tag maps cleanly onto a new category, map it in the migration instead of nulling it. Do not run the destructive update blind.
- **No CHECK constraint on `category` or `device_target`.** Enforce in Zod, consistent with the rest of the repo. Existing rows with `category = NULL` must keep rendering.
- **`device_target`** is a single column with three values (`mobile` | `desktop` | `both`), not an array. The requirement is "mobile or desktop or both" — three states, one column. Defaulting existing missions to `'both'` is the honest choice: nobody specified, so nothing is excluded.
- **`test_steps` is jsonb, not a child table.** Steps are always read and written as a whole with their mission, never queried across missions, and never joined to. A child table would buy nothing and cost a join on every mission read. PR 4's audit-log entries *are* a child table, because those are queried and aggregated independently — the asymmetry is deliberate, and the spec should say so.

`test_steps` element shape — define it once as a Zod schema in `lib/validation/schemas.ts` and derive the TypeScript type from it:

```ts
{
  id: string,              // stable uuid, generated client-side on step add
  action: string,          // what the tester does — "Enter a valid email and submit"
  expected_result: string, // what should happen — "A verification email arrives within 60s"
}
```

The `id` must be **stable across edits**. PR 4's audit entries reference it. If a builder reorders steps, the ids must travel with them — never key off array index.

## Vocabulary and templates

`lib/vocabulary.ts`:

```ts
export const TEST_CATEGORIES = ["process_flow", "component", "ui_design"] as const
export const DEVICE_TARGETS = ["mobile", "desktop", "both"] as const
```

Store the machine value, render a human label (`"Process Flow Testing"`, `"Component Testing"`, `"UI Design Testing"`). Add a `testCategoryLabel()` helper next to the existing `countryName()`.

**Templates live in a new `lib/testTemplates.ts` as static TypeScript. Not in the database.** They are content the team curates, not user data — a DB table means a migration every time you fix a typo in a template step. Revisit only if builders ever need to save their own templates.

Shape:

```ts
export type TestTemplate = {
  id: string                    // stored on missions.template_id
  category: TestCategory
  name: string                  // "Authentication Flow"
  description: string           // one line, shown in the picker
  steps: { action: string; expected_result: string }[]
}
```

Seed at least three per category. Suggested — propose in the spec, let the user amend:

- **Process Flow:** Authentication Flow (sign up → verify → sign in → sign out), Password Reset, Checkout / Payment Flow, Onboarding Flow
- **Component:** Form Inputs & Validation, Buttons & Interactive States, Modals & Overlays, Navigation & Menus
- **UI Design:** First Impression & Clarity, Visual Hierarchy & Readability, Mobile Responsiveness, Consistency & Polish

UI Design templates are the odd ones out — "expected result" is subjective there. Frame those steps as prompts (`action: "Land on the homepage and describe your first impression"`, `expected_result: "The purpose of the product is clear within 5 seconds"`). Do not pretend they are pass/fail assertions; PR 4's audit log needs to accommodate a subjective answer.

Template steps get a fresh `id` when instantiated onto a mission. A template is a starting point that is copied, never a live reference — `template_id` records provenance only. If a template later changes, existing missions must not change under their builders.

## UI — mission creation

`components/AddMissionForm.tsx` and `components/EditMissionForm.tsx` are already near-duplicates sharing `MissionRewardFields.tsx`. This change will make the duplication painful. **Extract the whole test-case editor into one shared component** (`components/missions/TestCaseEditor.tsx`) used by both, the way `MissionRewardFields` already is. Do not build it twice.

Flow:

1. **Test category** — three selectable cards, not a dropdown. Each names the category and explains it in a line (`"Component Testing — individual elements like buttons, inputs, and checkboxes"`). Picking one filters the templates in step 2.
2. **Start from** — "Blank test case" or a template from the picker, filtered to the chosen category. Show each template's name, description, and step count.
3. **Step editor** — the core of it. Ordered list of step rows, each with an `action` input and an `expected_result` input. Add step, remove step, reorder (up/down buttons are fine; do not add a drag-and-drop dependency). Template steps arrive prefilled and fully editable — the requirement is explicitly *"still customizable where builders can add or drop fields"*.
4. **Device target** — three radio options: Mobile / Desktop / Both.

Constraints: minimum 1 step, maximum 15. Both `action` and `expected_result` required per step, with sensible minimum lengths. Enforce in Zod; surface errors per step row, not as one message at the top.

Watch the design rules: this form will be tempted toward multiple prominent buttons. **One voltage CTA per viewport** — that is "Create Mission". Add-step, remove-step, and template-select are `ghost` or secondary variants.

Existing missions have `test_steps = []`. The edit form must handle that gracefully — show an empty editor with a prompt to add the first step, not a crash or a misleading "0 steps" state.

## Server actions

`actions/missions.ts` — `createMission` and `updateMission` add `category`, `test_steps`, `device_target`, `template_id` to their explicit column lists. `test_steps` arrives from `FormData` as a JSON string; parse and validate it through the Zod array schema before it goes near the database. A malformed `test_steps` payload must be rejected at the boundary, not stored.

## Display

Mission detail pages (both roles) render the test case as a numbered list of action/expected pairs, plus category and device-target chips. This is where the tester actually reads what to do — PR 1 removed the description from *cards*, not from here.

Mission cards gain category and device-target chips. Per `DESIGN.md`, a chip's colour never carries the meaning alone — always pair with the text label.

Tests: `test_steps` round-trip through create and update; step ids preserved across an edit; malformed JSON rejected; invalid category rejected; empty step list rejected; template instantiation produces fresh ids.

---

# PR 4 — Tester audit log

**Branch:** `feat/tester-audit-log`
**Base:** `main` (with PR 3 merged)
**Migration:** one table plus one plpgsql function
**Risk:** high — replaces the primary tester-facing surface and changes the AI pipeline

## What changes

The tester feedback form stops being a single comment box (currently minimum 100 characters, `test_results.tester_comment`) and becomes a **structured audit log filed against the builder's test-case steps**. One entry per step. Screenshots stay.

The point, in the user's words, is to prevent miscommunication and stop testers doing the wrong thing — so the builder's step must be **visible, verbatim, immediately above the fields the tester fills in for it**. Not linked, not collapsed by default. On screen.

## Data model

```sql
CREATE TABLE test_result_entries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_result_id     uuid NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
  step_id            text NOT NULL,   -- references the mission's test_steps[].id
  step_index         int  NOT NULL,   -- order at submission time
  step_action        text NOT NULL,   -- SNAPSHOT of the builder's action text
  step_expected      text NOT NULL,   -- SNAPSHOT of the builder's expected result
  status             text NOT NULL,   -- 'pass' | 'fail' | 'blocked'
  issue_summary      text,
  steps_to_reproduce text,
  actual_result      text NOT NULL,
  expected_result    text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_test_result_entries_result ON test_result_entries (test_result_id);

ALTER TABLE test_results ALTER COLUMN tester_comment DROP NOT NULL;
```

The two design points that matter, both of which belong in the spec:

**Snapshot the builder's step text into the entry.** `step_action` and `step_expected` are copies, not lookups. If the builder edits the mission after submissions exist, every historical audit log must still read correctly against what the tester was actually asked to do. A join to the live mission would silently rewrite history. `step_id` is kept for correlation, but the snapshot is the record.

**`issue_summary` and `steps_to_reproduce` are nullable; `actual_result` and `expected_result` are not.** A passing step has an actual and an expected result but no issue and nothing to reproduce. Forcing a tester to type "N/A" four times per passing step is exactly the friction that produces garbage data. Enforce conditionally in Zod: `status === 'fail'` requires `issue_summary` and `steps_to_reproduce`; `status === 'pass'` does not.

**`tester_comment` becomes nullable and is retained.** Every existing submission has one and no entries. Do not backfill and do not drop it. Keep it in the new form as an optional free-text "Anything else?" field at the end — a tester will always have something that does not fit the structure, and losing that is a real cost. `COMMENT_MIN = 100` no longer applies; the minimum moves to the per-entry fields.

## Atomicity — this is the part that will go wrong if you skip it

A submission writes one `test_results` row plus N `test_result_entries` rows. That must be **all or nothing**. A partial write leaves a submission with three of five steps logged, which is worse than a failed submission because it looks complete.

There is no ORM and no `$transaction`. Per `CLAUDE.md`, write a **plpgsql function** in the migration and call it via `supabase.rpc()`:

```sql
CREATE OR REPLACE FUNCTION submit_audit_log(
  p_mission_id      uuid,
  p_tester_id       uuid,
  p_screenshot_urls text[],
  p_tester_comment  text,
  p_entries         jsonb
) RETURNS uuid AS $$ ... $$ LANGUAGE plpgsql SECURITY DEFINER;
```

Insert the `test_results` row, then iterate `p_entries` inserting each. Return the new `test_results.id`. **Do not simulate this with sequential `.from().insert()` calls** — the repo explicitly forbids it, and this is the case it was forbidden for.

Note the existing ordering constraint in `actions/submissions.ts`: screenshots upload to Storage *before* the database insert, so a failed upload short-circuits. Keep that. The RPC replaces the insert step only. AI analysis stays **after** the insert and stays non-fatal — a Gemini outage must never lose a submission (this is covered by `SUB-04` in the checklist; keep it passing).

## The form

Rename `components/TesterSubmissionForm.tsx` → `components/tester/AuditLogForm.tsx`, or keep the filename and rewrite it — your call, but say which in the spec.

Structure: the mission's test case rendered as an ordered sequence. For each step:

- **Read-only header** — the step number, the builder's `action`, and the builder's `expected_result`, visually distinct from the tester's inputs (`obsidian` panel inside the `graphite` card, or similar). This is the anti-miscommunication mechanism. It must be unmissable.
- **Status** — Pass / Fail / Blocked. Three states, text-labelled (never colour alone).
- **Actual Result** — required always.
- **Expected Result** — required always. Prefill from the builder's `step_expected` and let the tester edit it. Prefilling is deliberate: it makes the common case one click, and a tester who *disagrees* about what should have happened is exactly the signal the builder wants.
- **Summary of Issue** and **Steps to Reproduce** — revealed when status is Fail. Required then.

Then, once for the whole submission: screenshots (unchanged — existing multi-upload, compression, 10 max, 5 MB each, at least one required) and the optional free-text comment.

**Screenshots stay at submission level for this PR.** Per-step screenshots are the obviously better product and will be asked for. They are also a materially larger change — per-entry upload state, per-entry storage paths, per-entry compression. Ship submission-level, note per-step as the first follow-up in the spec's Non-goals, and design the entry table so adding `screenshot_urls text[]` to it later is additive.

Save progress as the tester works. A ten-step audit log is a long form, and losing it to a closed tab will lose you the tester. `localStorage` keyed by mission id is enough — do not build a server-side draft system for this. Clear it on successful submit. (Note: `useUnsavedChangesWarning` already exists in `lib/hooks/` — use it here too.)

## The AI pipeline

`lib/ai.ts` — `ANALYSIS_PROMPT(comment, imageCount)` takes a single comment string. It must be rewritten to consume the structured log: pass the entries with their step context, statuses, actual and expected results.

The output contract stays the same — `ai_summary` and `ai_sentiment` (POSITIVE / NEUTRAL / FRUSTRATED) on `test_results`. Do not change the column shape; the admin AI-reports page aggregates on it.

The summary should get **better**, not just different. It now knows which steps failed and how, so it can lead with that rather than paraphrasing a comment. Sentiment should weigh the pass/fail distribution, not just tone.

`parseSentiment` behaviour must be preserved — `SUB-05` in the checklist covers it.

## Builder-side rendering

Everything that renders a submission needs updating. At minimum:

- `components/MissionResultRow.tsx`
- `components/SubmissionReview.tsx`
- `components/FeedbackListPaged.tsx`
- `app/(developer)/dashboard/feedback/page.tsx`
- `app/(developer)/dashboard/[projectId]/mission/[missionId]/page.tsx`
- `app/(admin)/admin/submissions/page.tsx`
- `app/(admin)/admin/ai-reports/page.tsx`
- `components/tester/SubmissionsFeed.tsx` (tester's own history)

**Every one of these must handle both shapes**: legacy submissions with a `tester_comment` and zero entries, and new submissions with entries. Write one shared renderer that branches on whether entries exist, rather than adding the same conditional in eight files. A builder scrolling their feedback list will see both kinds interleaved by date — that has to look deliberate, not broken.

Give the builder a pass/fail count at the top of each new-style submission (`"3 of 5 steps passed"`). That is the single most useful thing the structure buys them, and it should not require expanding the log to see.

The existing review flow (approve / changes-requested / rating / review note) is unchanged. Do not touch `actions/review.ts` or the review status machinery.

## Email

`emails/` — the new-submission notification currently includes the AI summary. Check whether it renders `tester_comment` directly; if so, update it to the pass/fail count plus AI summary. Keep it short — it is a notification, not the report.

## Tests

Substantial coverage required here:

- Audit-log submission: auth rejection, own-project rejection (`SUB-02` must keep passing), happy path, screenshot-before-insert ordering, AI failure non-fatal.
- **Atomicity**: an entry insert failing must leave no `test_results` row. Test the RPC directly.
- Conditional validation: `status = 'fail'` without `issue_summary` rejected; `status = 'pass'` without it accepted.
- Snapshot integrity: edit the mission's steps after submission, confirm the entry still reads the original text.
- Legacy rendering: a submission with `tester_comment` and no entries renders without error in every surface listed above.

---

## After all four PRs

Update these — they will be stale and they are what the next session reads:

- **`CLAUDE.md`** — the Data Model table (four new mission columns, the new `test_result_entries` table, `projects.category`), the plpgsql examples list (add `submit_audit_log`), and the note that `tester_comment` is now legacy/optional.
- **`TownHall_Checklist (1).xlsx`** — the QA sheets describe the old feedback form and the old project form. Several items are now wrong rather than merely unchecked (`QA-2.4-3`, `QA-2.4-4`, `QA-2.2-2`, `EU-3.2-3`). Add rows for the audit log, test-case editor, templates, and device targets.
- **`README.md`** — "submit their results in the form of a screenshot and a written summary" is no longer what the product does.

Leave `ARCHITECTURE.md` alone. It is already marked stale.

## Known issues you will encounter — do not fix them in these PRs

These are real and logged in the QA checklist. They are out of scope here; note them if you hit them, do not scope-creep:

- Mobile ≤480px layout breaks on `/explore`, `/dashboard`, `/admin`
- No light mode
- Back button reaches the dashboard after logout
- Engineer test suite §1 is 0/46

The mobile one is worth flagging to the user separately: PR 3 and PR 4 add the two densest forms in the product, and they are being built on a layout that already breaks on mobile. A `device_target` of "mobile" is also a slightly strange promise from a product whose own mobile layout is broken. That is not a reason to delay these PRs — it is a reason to schedule the responsive fix right after them.
