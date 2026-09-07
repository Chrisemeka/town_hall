# SPEC: Mission Notes, Conditional Audit Fields, and Screenshot Copy

**Status:** Shipped — migration applied 2026-09-07, verified against the live database
**Branch:** `feat/mission-notes-and-audit-fields`
**Base branch:** `main`, with `feat/form-focus-and-errors` merged
**Migration:** one — two column defaults and one function replacement
**Depends on:** PR 1, for the `reveal` callback the disclosure needs and for the shared `FieldError`
**Blocks:** nothing

## Summary

Four changes that all point the same way: **stop asking for text nobody needed to write.**

1. A mission's `task_description` stops being required and moves behind a disclosure — the test case
   above it is now the brief.
2. A **Pass** on an audit-log step stops asking "what actually happened", and a **Blocked** step
   starts asking for the issue detail it never collected.
3. "Proof of Visit" is renamed to say what to upload.
4. The tester's Save Draft button — which saves the wrong field to a key nothing reads — is deleted.

## Why

Since the test-case migration (`20260905_02`), `TestCaseEditor` collects the real brief as ordered
action / expected-result pairs. `task_description` is now supplementary, but it is still mandatory,
still twenty characters minimum, and still the largest control on the form. The form asks for the
brief twice and refuses to save without the redundant copy.

On the tester's side the asymmetry runs the other way. A passing step is made to describe an outcome
that has already been stated in "what you expected" — which is how a column fills up with "as
expected", "fine", "worked". A **blocked** step, meanwhile, reaches the builder with no issue summary
and no reproduction steps at all: the one status that means *something stopped me* is the one that
collects nothing actionable.

## Non-goals

- **No rename of the `task_description` column.** Only its visible label changes. Renaming it would
  touch the admin console, both mission detail pages, `ProjectDetailTabs`, the edit form and the
  server action for no behaviour.
- **No nullable columns.** Both changed columns keep `not null` and gain a `''` default. Every read
  site in the app types these as `string`; making them nullable means auditing all of them.
- **No backfill and no data change.** Every existing row already has both values.
- **No change to `expected_result`.** It stays required on all three statuses — it is the one field
  that is meaningful on a pass.
- **No change to the review flow, the AI pipeline, or the `test_results` table.**
- **No server-side draft storage.** The `localStorage` auto-save stays exactly as it is.

## Migration — `supabase/migrations/<date>_01_optional_notes_and_actual_result.sql`

### What the database actually holds

Probed read-only against the live database through the PostgREST OpenAPI definition, which lists
`NOT NULL` columns in `required` and emits `default` where one exists:

| Column | `NOT NULL`? | Default? | Evidence |
|---|---|---|---|
| `missions.task_description` | **yes** | **none** | in `definitions.missions.required`; no `default` key on the property |
| `test_result_entries.actual_result` | **yes** | **none** | same, and `20260906_02_tester_audit_log.sql:39` declares `actual_result text not null` |

For contrast, `missions.id` reports `"default": "gen_random_uuid()"`, `created_at` reports `now()`
and `device_target` reports `both` — so the absence of a `default` key on these two is a reading, not
a gap in the probe.

**Both get a default of `''` and keep `not null`**, per the brief's stated preference and for the
reason above.

```sql
alter table public.missions
  alter column task_description set default '';

alter table public.test_result_entries
  alter column actual_result set default '';
```

### `submit_audit_log` must survive an absent key

`20260906_02_tester_audit_log.sql:138` writes `v_entry->>'actual_result'` straight into a `not null`
column. `->>` on a missing key returns `NULL`, not `''` — and a default does not fire for an explicit
`NULL`. Once `actual_result` is `.optional()` in Zod, a passing entry parses to an object with the
key **absent**, and `actions/submissions.ts:145` hands that parsed object to the RPC verbatim. So
today's function would fail the insert on the first passing step.

The migration replaces the function with `coalesce(v_entry->>'actual_result', '')`. Same signature,
so `create or replace` keeps the `revoke … grant execute to service_role` grants from `20260906_02`;
they are restated anyway, because a spec that assumes a grant survived is how a `security definer`
function ends up callable by `anon`.

Nothing else in the function body changes. `issue_summary` and `steps_to_reproduce` already go
through `nullif(…, '')` and are nullable.

### Reversibility

Both `alter column … set default` statements are reversible with `drop default`. The function is
restorable from `20260906_02`. Unlike `20260906_03`, nothing here is destructive — no column is
dropped, no constraint narrowed, no row rewritten.

## 2.1 — "What to Test" becomes "Notes for Testers", optional, behind a disclosure

### The control

A checkbox labelled **"Add notes for testers"**, unchecked by default in `AddMissionForm`. Checking
it reveals a section headed **"Notes for Testers"** holding the textarea and the tip box. Unchecked,
neither is rendered.

In `EditMissionForm` it **starts checked with the section open whenever the mission already has a
`task_description`**. A builder opening the edit form must not see their notes apparently deleted.

The checkbox is not a `<details>` element: the field inside has to be reachable by PR 1's focus hook,
and the hook's `reveal` callback is wired to the checkbox's state setter so a server-side error on
`task_description` opens the section before focusing it. (Empty passes validation, so this path only
fires on the 1–19 character case — but that is exactly the case that must not be silent.)

### Copy

| Slot | Now | After |
|---|---|---|
| Field label | `What to Test` | `Notes for Testers` |
| Section heading | — | `Notes for Testers` |
| Checkbox | — | `Add notes for testers` |
| Placeholder | "Describe exactly what you want testers to do and what feedback you're looking for…" | "Anything the steps above don't cover — what the product is, what's already broken, logins testers will need." |
| Helper line | "Be specific — name the screens and the exact steps testers should follow." | "Optional. The steps say what to do; this says what to know first." |
| Tip box title | `Writing a Good Mission` | `Writing Useful Notes` |

The three tips are rewritten. The current ones ("Start with a verb…", "Describe the exact flow, not
just the feature.", "Tell testers what to look for…") are instructions for writing a brief, and the
test case does that job now. Proposed:

- `What the product is and who it's for — testers arrive with no context.`
- `What state it's in: seeded data, half-built screens, anything already known broken.`
- `Logins, test cards, or sample data they'll need — and anything they should not touch.`

The character counter and the `MISSION_DESCRIPTION_MIN` floor stay, applied only to a non-empty box.
The "N more characters needed" hint keeps working; the "0 chars" resting state now means valid.

### Schema — `lib/validation/schemas.ts:194`

```ts
task_description: z
  .string()
  .trim()
  .max(MISSION_DESCRIPTION_MAX)
  .refine((v) => v === "" || v.length >= MISSION_DESCRIPTION_MIN, {
    message: `Add at least ${MISSION_DESCRIPTION_MIN} characters, or leave the notes off.`,
  }),
```

Empty passes; 5 characters fails with a message that names both ways out. The field stays present on
`missionFields` and stays a `string` — no `.optional()`, because `FormData.get("task_description")`
always yields a string when the textarea is mounted and `""` when it is not. Making it optional would
add an `undefined` to the type that the column, the row type and every read site would then have to
carry for nothing.

`MISSION_DESCRIPTION_MAX` does not currently exist — the field has a floor and no ceiling. It is
added at 2000 alongside the refine, matching the shape of every other text field in the file.

### Display sites — omit the section entirely when empty

| Site | Change |
|---|---|
| `app/(tester)/mission/[id]/page.tsx:88–107` | wrap the "Your Mission" label and its voltage-bordered callout in `{mission.task_description && …}` |
| `app/(developer)/dashboard/[projectId]/mission/[missionId]/page.tsx:149–153` | same for `EXECUTION PARAMETERS` |
| `app/(admin)/admin/missions/[id]/page.tsx:180` | already handles empty; `"No task description."` → `"No notes."` and the `Task` label → `Notes` |
| `components/ProjectDetailTabs.tsx:15` | types the field, never renders it — **no change** |

Never an empty-state message. DESIGN.md §8's empty states exist for a screen with nothing on it; the
test case is directly below, so an absent notes block is not an empty state, it is an absent block.

`components/InlineEditMission.tsx` is in the brief's list but **does not exist on `main`** — deleted
in `21200cd chore(components): delete unused InlineEditMission`, surviving only on stale branches.
Nothing to do.

### The tour step

`components/tours/tours.tsx:133–144`, tour `mission-submission`, step 1, anchors `#tour-mission-brief`
with *"The submitter wrote this to tell you exactly what to test…"*.

The anchor will not break — the div at `app/(tester)/mission/[id]/page.tsx:88` wraps the notes, the
mission chips **and** the test steps, so it survives an empty `task_description`. But its copy
describes a block that may not be there.

Fix: move the id to a new `#tour-mission-testcase` wrapper around the `Test steps` heading and
`TestCaseView`, and re-point the step at it. New copy:

> **Work through the test case** — Each step says what to do and what should happen. Answer them in
> order; that is what makes feedback useful to the builder.

Steps 2 and 3 (`#tour-mission-project`, `#tour-mission-submit-form`) are unchanged and still read in
sequence: read the steps → open the project → capture and submit.

## 2.2 — Audit-log fields by status

| Field | Pass | Fail | Blocked |
|---|---|---|---|
| What you expected | shown, required | shown, required | shown, required |
| What actually happened | **hidden** | shown, required | shown, required |
| Summary of the issue | hidden | shown, required | **shown, required** |
| Steps to reproduce | hidden | shown, required | **shown, required** |

Three places have to agree, and them drifting apart is the likeliest bug in this PR:

**`lib/validation/schemas.ts:259–288` — the authority.** The client cannot be allowed to bypass it.

- `actual_result` drops its `.min(ENTRY_TEXT_MIN)` and becomes optional, plus a `.refine` requiring
  it when `status !== "pass"`, `path: ["actual_result"]`.
- The two existing refines change from `status !== "fail" || …` to `status === "pass" || …`, so they
  cover blocked. Their `path` is already set; the new one matches.
- The header comment at 279–281 currently justifies fail-only fields. It is rewritten to say why
  blocked joins them: a step nobody could reach still has a reason nobody could reach it, and that
  reason is the whole content of the report.

**`components/tester/AuditLogSteps.tsx`** — `actual_result` moves inside a conditional; the
`entry.status === "fail"` gate at line 138 becomes `entry.status !== "" && entry.status !== "pass"`.
The comment at 136–137 is updated to cover blocked.

**`draftIsComplete` / `firstIncompleteEntry` (`AuditLogSteps.tsx:41`)** — PR 1 collapses these into
one function; this PR changes its rule to match the table. It requires `actual_result` only for fail
and blocked, and `issue_summary` / `steps_to_reproduce` for both rather than fail alone.

**Builder-side rendering.** `components/submissions/SubmissionBody.tsx:70` renders
`<Row label="Actual" value={entry.actual_result} />` unconditionally. With `''` that prints a bare
`Actual: ` label. It gets the same guard `issue_summary` already has one line below:
`{entry.actual_result && <Row … />}`. Existing rows all carry a value and render unchanged.

## 2.3 — "Proof of Visit" → "Screenshots of Your Test"

The current label names the *purpose* and not the *artefact*; a first-time tester reads "Proof of
Visit" and does not know a screenshot is wanted. The helper text below it is good and stays.

| Site | Change |
|---|---|
| `components/tester/AuditLogForm.tsx:311` | heading → `Screenshots of Your Test` |
| `components/MissionResultRow.tsx:88` | builder-side header `PROOF OF VISIT` → `TEST SCREENSHOTS` |
| `components/MissionResultRow.tsx:103` | `alt="Proof of visit 1"` → `alt="Test screenshot 1 of 4"` |
| `components/MissionResultRow.tsx:255` | lightbox alt, same treatment |
| `app/guidelines/page.tsx:99` | "…as proof of visit, tied directly…" → "…screenshots of your test, tied directly…" |
| `app/guidelines/page.tsx:146` | section comment |
| `app/guidelines/page.tsx:156` | rewritten, keeping the reasoning — see below |
| `app/page.tsx:159` | landing copy: "…written feedback with screenshot proof of visit." → "…written feedback with screenshots of what they saw." |

The guidelines heading is already `The Screenshot Requirement` and does not change. The paragraph at
line 156 explains the dual purpose — evidence the tester really used the product, and visual context
written feedback cannot carry. That reasoning is worth more than the label was, so it is rewritten
around the new name rather than deleted:

> Your screenshots do two jobs — they show the builder you actually used their product, and they
> carry the visual context written feedback can't. Capture the journey, not just the last screen.

The alt text is a genuine accessibility fix, not just vocabulary: `alt="Proof of visit 1"` describes
the file's role in the process rather than the image, which is what DESIGN.md §10 asks for.

## 2.4 — Delete the tester's Save Draft button

`components/tester/AuditLogForm.tsx:421–429`.

**The button does not work.** It writes `feedback` — the free-text "anything else?" box, the smallest
part of the form — to `localStorage` under `` `draft:${missionId}` ``, and **nothing in the codebase
reads that key**. The auto-save that works is separate and unrelated: `AuditLogForm.tsx:89–97` writes
the whole `entries` array to `` `twnhall:audit-log:${missionId}` `` on every change, and lines 68–87
restore it on mount. So the button has been promising to save work it never saved, and discarding the
nine-tenths that matters.

- Delete the button and its `onClick`. Grep for `draft:${missionId}` and remove any other reference —
  a repo-wide search finds one write and no read.
- Keep the auto-save untouched.
- The CTA row becomes a single voltage button, which is what DESIGN.md §5.1's one-Primary-per-viewport
  rule wants anyway. The row's `flex items-center gap-3` is left as-is; with one child it lays out
  identically.
- Add the reassurance the button was accidentally providing, under the submit row:

  > Your answers save on this device as you go.

  Present tense, no promise of a server, and honest about the device — a tester who switches machines
  should not think their draft follows them.

## Tests

New vitest cases beside the existing `actions/__tests__/` suites, and additions to
`scripts/vocabulary.test.mts`'s neighbour for the pure predicates.

| ID | Case | Expected |
|---|---|---|
| ENT-01 | `auditEntrySchema`, `status: "pass"`, no `actual_result` | accepted |
| ENT-02 | `status: "fail"`, no `actual_result` | rejected on path `actual_result` |
| ENT-03 | `status: "blocked"`, no `actual_result` | rejected on path `actual_result` |
| ENT-04 | `status: "blocked"`, no `issue_summary` | rejected on path `issue_summary` |
| ENT-05 | `status: "blocked"`, no `steps_to_reproduce` | rejected on path `steps_to_reproduce` |
| ENT-06 | `status: "pass"`, no `issue_summary`/`steps_to_reproduce` | accepted (unchanged, `AUD-08`) |
| ENT-07 | `expected_result` missing on any status | rejected |
| ENT-08 | **`draftIsComplete` and `auditEntrySchema` agree** across a shared fixture table covering all three statuses × present/absent for each field | identical verdicts — the drift guard |
| MISS-13 | `createMission` with `task_description: ""` | succeeds, writes `""` |
| MISS-14 | `createMission` with `task_description: "short"` (5 chars) | field error, no write |
| MISS-15 | `updateMission` with `task_description: ""` | succeeds |
| MISS-16 | `updateMission` still writes only the explicit column set | unchanged (`MTC-11`) |
| RPC-01 | `submit_audit_log` with an entry whose `actual_result` key is absent | row written, column reads `''` — run against the live function after the migration |

ENT-08 is the one that matters. Two definitions of "complete" that disagree produce either a form
that refuses a valid submission or one that submits and gets rejected by the server; both are
invisible until a tester hits them.

Render tests for "a mission with no notes and a passing entry render without empty headings" are in
Open questions — the repo has no DOM test environment.

## Commits

Per `CLAUDE.md`: migration → shared logic → server action → UI → tests.

1. `feat(db): default task_description and actual_result to empty`
2. `refactor(validation): make notes optional and gate audit fields by status`
3. `feat(missions): put tester notes behind a disclosure`
4. `feat(tester): ask blocked steps what went wrong, stop asking passes`
5. `feat(ui): name the screenshots and drop the dead draft button`
6. `fix(tours): point the first tester step at the test case`
7. `test: cover optional notes and status-gated entry fields`
8. `docs: record the new optionality in CLAUDE.md and the checklist`

## Acceptance criteria

- A mission saves with no notes, from both the create and the edit form.
- A mission with 5 characters of notes is refused, with a message naming both ways out.
- Editing a mission that has notes opens with the checkbox ticked and the section expanded.
- A mission with no notes renders on all three detail pages with no heading over blank space.
- The tester tour runs end to end on a mission with no notes, all three steps anchored.
- Marking a step **Pass** hides "What actually happened"; marking it **Blocked** shows it along with
  the issue summary and reproduction steps, and all three are required to submit.
- A submission containing a passing step renders on the builder side with no bare `Actual:` label.
- `submit_audit_log` accepts an entry with no `actual_result` key.
- No occurrence of "proof of visit" survives in any user-facing string.
- No occurrence of `` draft:${missionId} `` survives.
- `npx tsc --noEmit` clean · `npm run lint` with no new `as any` · `npm run build` clean ·
  `npm test` green.

## Manual test plan

1. New mission, notes unchecked: title + one test step + category + device → publish. Succeeds.
2. Same, tick the box, type 5 characters, publish → refused, focus lands in the notes box (PR 1).
3. Edit that mission: box ticked, section open, text intact.
4. Untick and save → notes cleared; all three detail pages render with no gap.
5. As a tester open that mission: no "Your Mission" block, test steps present, tour step 1 points at
   the test case.
6. Answer step 1 **Pass** — only "What you expected" is asked. Submit-completeness accepts it.
7. Answer step 2 **Blocked** — expected, actual, summary and reproduction all appear; leaving any one
   empty holds the submission and names the step (PR 1).
8. Submit. Builder view: the passing step shows no `Actual:` row; the blocked step shows all four.
9. Screenshot section reads "Screenshots of Your Test"; the builder side reads "TEST SCREENSHOTS";
   the lightbox alt describes the image.
10. Only one button in the CTA row, and the line beneath it explains the auto-save. Reload
    mid-log — answers restored.

## Verified against the live database, after the migration

| Check | Result |
|---|---|
| `missions.task_description` default | `""` — and still `NOT NULL` |
| `test_result_entries.actual_result` default | `""` — and still `NOT NULL` |
| **RPC-01** — `submit_audit_log` with `actual_result` absent from the entry | accepted, row written |
| What the column actually holds | `""`, not `null` — the `coalesce` is doing the work |
| Cleanup | the verification row deleted, its entry cascaded, `0` of each remaining |
| `anon` calling `submit_audit_log` | `401`, `42501 permission denied for function` |

The entry sent carried exactly the keys `auditEntrySchema` produces for a pass —
`step_id`, `step_action`, `step_expected`, `status`, `expected_result` — and no
`actual_result` at all. Without the `coalesce` this is the insert that fails, so it
is the one thing here that reading the definition could not have settled.

The `anon` check is included because `create or replace` is exactly the operation
where a `revoke` quietly stops applying. It did not, but the migration restates the
grants rather than trusting that.

## Deviations from this spec, as built

- **2.4 (Save Draft) already landed in PR 1.** Rewriting the CTA row to enable the submit button
  removed the button in `c3a63ef`, on the previous branch, and that commit message did not say so.
  Nothing is missing — `draft:${missionId}` has no remaining reference — but the removal is recorded
  in the wrong PR. The reassurance line proposed here is what arrived on this branch.
- **The disclosure is one shared component**, `components/missions/MissionNotes.tsx`, rather than the
  same block written into both forms. Same reasoning `TestCaseEditor` carries.
- **`firstIncompleteEntry` now uses `ENTRY_TEXT_MIN`**, not "not blank". Writing ENT-08 found that
  the form and the schema had always disagreed about short answers: a two-character `expected_result`
  passed the form and was refused by the server. Not in the brief, fixed because the test that the
  brief did ask for is what exposed it.
- **`lib/ai.ts` needed a change nobody listed.** It rendered `What happened: ${e.actual_result}`
  unconditionally, so every passing step would have put `What happened: undefined` into the Gemini
  prompt. The line is now conditional like the two beside it.
- **The tester page's notes heading is "Notes from the Builder"**, not "Notes for Testers" — the
  builder-facing label reads wrong to the person reading them.
- **The builder mission page gained `whitespace-pre-wrap`.** It never had it while the tester page
  did, so the same text rendered differently on the two sides.

## To raise in the PR description

2.1 and 2.2 both make a previously required field optional, and 2.2 removes a field from the Pass
path entirely. **This is less data per submission by design** — the friction was producing filler,
not information. Worth watching after release: if builders report that passing steps tell them
nothing, the answer is a short *optional* note on Pass, not restoring the mandatory field.

Second thing worth flagging: `missions.task_description` has been `not null` since the table was
created and this PR does not drop that. A default of `''` means a row can never again be
distinguished between "no notes" and "notes cleared". Nothing in the product needs that distinction
today, and it is the price of not auditing every read site for `null`.

## Resolved questions

1. **Copy approved as written** — the three tips, the placeholder, the helper line, the rewritten
   guidelines paragraph and the auto-save reassurance all ship as drafted above.
2. **"Screenshots of Your Test"** on the tester side, **`TEST SCREENSHOTS`** on the builder side, to
   match the caps style already in `MissionResultRow`.
3. **`MISSION_DESCRIPTION_MAX = 2000`** is added. Every other text field in `schemas.ts` has a
   ceiling; a `text` column with a floor and no ceiling is the one shape that lets a paste bomb
   through.
4. **No render tests, no jsdom** — same answer as PR 1. ENT-01…08 and MISS-13…16 carry the load, and
   ENT-08 (the drift guard between `draftIsComplete` and the schema) is the test that actually
   matters here. Empty-heading rendering is covered by the manual pass.
5. **RPC-01 runs against the live function**, insert then delete, using the service role. A `not null`
   violation on an absent JSON key is exactly the failure that reading the definition talks you out
   of seeing; `coalesce` either fires or it does not, and one row proves which.

## Reference

- `DESIGN.md` §5.1 (one Primary per viewport), §5.2 (inputs, counters), §8 (empty states), §10
- `TEST.md` §1.4 (`MISS-*` mission-action cases), §1.5 (`SUB-*` submission cases)
- `CLAUDE.md` — Data Model, "fixed vocabularies live in `lib/vocabulary.ts`", commit granularity
- `docs/specs/SPEC-tester-audit-log.md` — `AUD-06`…`AUD-08`, which this PR extends
- `supabase/migrations/20260906_02_tester_audit_log.sql` — the function being replaced
