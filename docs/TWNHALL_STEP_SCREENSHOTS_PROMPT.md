# Twnhall — Screenshots on the Step That Went Wrong: Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

Screenshots are attached to the whole report today: at least one is required, up to 10, shown in a carousel above the steps. The builder has to guess which screenshot shows which step.

The change:

- A screenshot is **offered only on a step that didn't pass**: Fail or Blocked on a functional test, Unclear or Couldn't tell on a UI / Design test. All four are stored as `fail` / `blocked`, so the rule is one predicate, `status !== "pass"`.
- It is **stored on that step** and shown under that step everywhere a report is read.

**The spec is already written:** `docs/specs/SPEC-step-screenshots.md`. It has the inventory of every reader, the migration, the write path, the decisions and the full test list. This prompt is the order of work and the traps. It does not repeat the spec.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions. Pay particular attention to the `submit_audit_log` paragraph (the `coalesce` trap, restated grants), the mission preview rule, tester anonymity and "every screenshot read goes through `screenshotList()`".
2. Read the spec end to end.
3. **Check its Status line.** If decisions 1–4 are not marked decided, **stop and ask**. Do not pick for me. The recommendations are: 1 optional, 2(a), 3 three per step and ten per report, 4 unchanged.
4. Read `actions/submissions.ts`, `components/tester/AuditLogForm.tsx`, `components/tester/AuditLogSteps.tsx`, `components/missions/MissionPreview.tsx`, `components/MissionResultRow.tsx`, `components/submissions/SubmissionBody.tsx`, `lib/utils/screenshots.ts`, `lib/ai.ts`, `lib/report.ts`, `components/report/ReportDocument.tsx` and `supabase/migrations/20261027_01_admin_events.sql` (the current `submit_audit_log`).
5. Read `TEST.md` §1.
6. **Run one read-only query** and write the result into spec §0: how many **live** missions (`is_active`) have an empty `test_steps`. Decision 4 depends on it. Report it before building if decision 4 is still open.

All four gates before done: `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test`.

**Branch:** `feat/step-screenshots`
**Migration:** `supabase/migrations/20261101_01_step_screenshots.sql`. **It must be applied before the code deploys.** Say so in the PR description, in bold.

---

## Commits, in this order

**1 — `feat(db): screenshot_urls on test_result_entries`**
The column and the `submit_audit_log` replacement, as in spec §2. Same six-argument signature, so it's `create or replace` and not a drop. Still restate `revoke`/`grant`, and add the rollback note in the file's usual style. **`coalesce` the array**: a missing key is `NULL`, and a column default does not fire for an explicit `NULL`.

**2 — `feat(vocab): takesScreenshots and the step cap`**
`takesScreenshots(status)` in `lib/vocabulary.ts`, beside `ENTRY_STATUSES`. `MAX_STEP_SCREENSHOTS` in `lib/validation/schemas.ts`, beside `MAX_SCREENSHOTS`. `screenshotsSchema` splits into required (min 1) and optional forms. `entryScreenshots()` and `allScreenshots()` in `lib/utils/screenshots.ts`, with `screenshotList()` left exactly as it is. Add tests for each.

**3 — `feat(submit): per-step uploads in submitTestResult`**
Spec §2's server side. Two traps:
- **The server builds every URL.** Read files from `screenshots.<step_id>` keys. Never accept a URL from the payload. Assert in a test that a `screenshot_urls` key in the client's `entries` JSON never reaches the RPC.
- **Every refusal happens before the first upload**: a file on a pass step, over the step cap, over the report cap, an unknown step key. A refused report must cost no storage. That ordering is already the rule in this action; keep it.
Then the `lib/ai.ts` change in spec §5. Add the call-site tests from spec §7.

**4 — `feat(tester): screenshots on the step card`**
`StepScreenshots` and the optional props on `AuditLogSteps`, as in spec §3. Then remove the report-level section for missions with steps, and update the pre-unlock line, `isReady`, the submit hint, `ReportProgressBar` / `progressLabel()` and the unsaved-changes warning. Three things to keep:
- **Do not put `File`s in `DraftEntry`.** It's JSON in `localStorage`.
- **Switching a step to Pass hides its screenshots and never deletes them.**
- **The anonymity line moves to the new control.** It isn't dropped.
The no-steps branch keeps today's uploader unchanged. Reuse `StepScreenshots`' thumbnail markup there if it fits, so there's one copy of the upload UI.

**5 — `feat(review): step screenshots on every reader`**
Every row of the spec §4 table: builder mission page (reuse the existing lightbox, scoped to the step), lists, tester feed, admin, CSV/XLSX, PDF, storage cleanup, and `screenshot_urls` added to every `test_result_entries(...)` select and to the row types. **`grep -rn "test_result_entries(" app components lib actions`** and make sure no select was missed. A missed one renders a report with its step screenshots silently absent. Name the columns; no `select("*")`, so `scripts/anonymity.test.mts` stays green.

**6 — `docs: step screenshots`**
Everything in spec §8: the guides, the tour, the email line, `CLAUDE.md` and the checklist rows. Set the spec's Status to `Implemented on feat/step-screenshots`.

---

## Before calling the PR done

Four gates, then end to end on a preview deployment with the migration applied:

1. As a tester, on a process-flow test: Fail one step and attach 2 screenshots; Block another and attach 1; Pass the rest. Submit. On the builder's mission page, each screenshot sits under its own step, and nothing renders above the steps.
2. On a UI / Design test: Clear shows no upload control; Unclear and Couldn't tell do.
3. Attach a screenshot to a failed step, switch it to Pass, and submit. In the database, that entry's `screenshot_urls` is `{}` and no object was uploaded for it.
4. An all-pass report submits with no screenshot.
5. Download the PDF for that mission and check `pdfimages -list` shows 3 images. Do not judge by eye.
6. Open a report filed **before** this deploy. Its screenshots render exactly as they did.
7. Delete the new report from admin. Its 3 objects are gone from the `screenshots` bucket.
8. Both themes, 360px and desktop: the per-step thumbnails wrap inside the card, there's no horizontal scroll, and touch targets are 48px.

## Out of scope

Everything in the spec's Out of scope section, in particular moving old screenshots onto steps and account deletion's storage cleanup.
