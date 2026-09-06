# SPEC: Tester Audit Log

**Status:** Awaiting approval
**Branch:** `feat/tester-audit-log`
**Base branch:** `main` (with PR 3 and `chore/tighten-rls` merged, both migrations applied)
**Depends on:** PR 3 (`feat/mission-test-cases`) — entirely. Entries reference `test_steps[].id`.
**Blocks:** Nothing. Last of the four.

## Summary

Tester feedback stops being one comment box and becomes a **structured audit log filed against the
builder's test-case steps** — one entry per step, with the builder's instruction visible verbatim
above the fields the tester fills in for it.

One migration: a child table, a plpgsql function, and one nullability change. Highest-risk PR of the
four: it replaces the primary tester-facing surface, changes the AI pipeline, and every builder-side
surface has to render both the old shape and the new one.

## Why

The current form asks for 100+ characters of free text against a paragraph of instructions. Neither
side can tell which part of the app was exercised, the builder cannot see which steps passed, and the
AI has nothing to key off but tone. Filing against steps makes the ask unambiguous — which is the
point: it stops testers doing the wrong thing and then reporting on it.

## Non-goals

- **No per-step screenshots.** The obviously better product and the first thing that will be asked
  for. It is also materially larger — per-entry upload state, storage paths, compression — so
  screenshots stay at submission level and `test_result_entries` is shaped so adding
  `screenshot_urls text[]` to it later is purely additive.
- **No change to the review flow.** `actions/review.ts`, approve / changes-requested / rating /
  review note are untouched.
- **No backfill of the 24 existing submissions.** They keep their `tester_comment` and have no
  entries. Inventing entries for them would fabricate answers nobody gave.
- **No removal of `tester_comment`.** It becomes nullable and optional, never dropped.
- **No server-side draft storage.** `localStorage` only.
- **No AI output-contract change.** `ai_summary` and `ai_sentiment` keep their shape; the admin
  AI-reports page aggregates on them.
- **No per-entry AI analysis.** One summary per submission, as now.

## Data model changes

`supabase/migrations/<date>_01_tester_audit_log.sql`

```sql
create table if not exists public.test_result_entries (
  id                 uuid primary key default gen_random_uuid(),
  test_result_id     uuid not null references public.test_results(id) on delete cascade,
  step_id            text not null,
  step_index         int  not null,
  step_action        text not null,
  step_expected      text not null,
  status             text not null,
  issue_summary      text,
  steps_to_reproduce text,
  actual_result      text not null,
  expected_result    text not null,
  created_at         timestamptz not null default now()
);

create index if not exists idx_test_result_entries_result
  on public.test_result_entries (test_result_id);

alter table public.test_results alter column tester_comment drop not null;

alter table public.test_result_entries enable row level security;
```

RLS on, no policy: reads and writes both go through the service-role client, matching what
`chore/tighten-rls` just established for `projects` and `missions`. Nothing reaches this table from
the browser.

### The two design points that matter

**The builder's step text is snapshotted, not joined.** `step_action` and `step_expected` are copies
taken at submission time. If the builder edits the mission afterwards — which PR 3 makes easy — a
join to the live mission would silently rewrite what the tester appears to have been asked. The
entries must still read correctly against the instruction that was actually on screen. `step_id` is
kept for correlation, but the snapshot is the record. This is the whole reason the table is wide.

**`issue_summary` and `steps_to_reproduce` are nullable; `actual_result` and `expected_result` are
not.** A passing step has an actual and an expected result but no issue and nothing to reproduce.
Making a tester type "N/A" four times per passing step is precisely the friction that produces
garbage data. Enforced conditionally in Zod, not in the database — a CHECK would have to encode the
status vocabulary, and CLAUDE.md keeps vocabularies in Zod.

**No CHECK on `status`.** `'pass' | 'fail' | 'blocked'` lives in `lib/vocabulary.ts`, consistent with
every other vocabulary in this codebase.

## Atomicity — the part that breaks if skipped

A submission writes one `test_results` row plus N `test_result_entries` rows. That has to be all or
nothing. A partial write leaves a submission with three of five steps logged, which is **worse than a
failed submission** because it looks complete — the builder reads it as a finished audit.

There is no ORM and no `$transaction`. Per CLAUDE.md this is a plpgsql function called via `.rpc()`:

```sql
create or replace function public.submit_audit_log(
  p_mission_id      uuid,
  p_tester_id       uuid,
  p_screenshot_urls text[],
  p_tester_comment  text,
  p_entries         jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$ ... $$;
```

Inserts the `test_results` row, iterates `p_entries` inserting each, returns the new id. A raise
anywhere rolls the whole thing back, because a plpgsql function body is one transaction.

`security definer` with a pinned `search_path` — the standard hardening, so a caller cannot shadow
`public` with their own schema.

**Ordering stays as it is today.** `actions/submissions.ts` uploads screenshots to Storage *before*
the database write, so a failed upload short-circuits before anything is persisted. The RPC replaces
the insert only. AI analysis stays **after**, inside `after()`, and stays non-fatal — a Gemini outage
must never lose a submission. That is `SUB-04`, and it keeps passing.

## Server actions

`submitTestResult` in `actions/submissions.ts`:

- Auth unchanged: `getActiveAccount()` must resolve to `tester` (deliberately not `requireAccount()`,
  which redirects — the existing comment explains why, and it still holds).
- Own-project rejection unchanged — `SUB-02` keeps passing.
- Parses `entries` from a JSON string through a new `auditLogSchema`, the same way PR 3 parses
  `test_steps`, so a malformed body is a field error rather than a 500.
- **Validates the submitted entries against the mission's live `test_steps`**: every `step_id` must
  exist on the mission, and the count must match. Without that check a tester could file entries
  against steps that do not exist, and the snapshot would make it unfalsifiable afterwards.
- Calls `supabase.rpc("submit_audit_log", …)` through the **service-role** client and takes the
  returned id for the `after()` AI update.

The current code generates the row id client-side to avoid a `returning` select, because testers had
insert-but-not-select rights under RLS. The RPC returns the id, so that workaround goes.

## The form

`components/TesterSubmissionForm.tsx` → **`components/tester/AuditLogForm.tsx`** (moved, not kept —
the name describes what it now is, and the old name would mislead every future reader).

Per step, in order:

- **Read-only header** — step number, the builder's `action`, the builder's `expected_result`. This
  is the anti-miscommunication mechanism and it must be unmissable: an `obsidian` panel inside the
  `graphite` card, visually distinct from the tester's own inputs. Not collapsed, not behind a link.
- **Status** — Pass / Fail / Blocked. Three text-labelled options; per DESIGN.md §5.4 colour never
  carries the state alone.
- **Actual Result** — required always.
- **Expected Result** — required always, **prefilled from the builder's `step_expected`** and
  editable. Prefilling makes the common case one click, and a tester who *disagrees* about what
  should have happened is exactly the signal the builder wants.
- **Summary of Issue** and **Steps to Reproduce** — revealed when status is Fail, required then.

Then once for the whole submission: screenshots (unchanged — multi-upload, compression, 10 max, 5 MB
each, at least one required) and the optional free-text comment.

`COMMENT_MIN = 100` no longer applies. The minimum moves to the per-entry fields, and the comment
becomes an optional "Anything else?" — a tester always has something that does not fit the structure,
and losing that is a real cost.

**Draft persistence.** A ten-step audit log is a long form and losing it to a closed tab loses the
tester. `localStorage`, keyed by mission id, cleared on successful submit. No server-side drafts.
`useUnsavedChangesWarning` already exists in `lib/hooks/` and is used here too.

**Existing missions have no steps.** Thirteen of sixteen. The form must handle `test_steps = []` —
it falls back to comment-plus-screenshots, the legacy shape, rather than rendering an empty audit log.
Without that, every mission written before PR 3 becomes untestable.

## The AI pipeline

`ANALYSIS_PROMPT(comment, imageCount)` takes a single string and must be rewritten to consume the
structured log — entries with their step context, status, actual and expected.

The output contract is unchanged: `ai_summary` plus `ai_sentiment` of POSITIVE / NEUTRAL /
FRUSTRATED, and `parseSentiment` behaves exactly as now (`SUB-05`).

The summary should get **better**, not merely different. It now knows which steps failed and how, so
it can lead with that rather than paraphrasing a comment. Sentiment weighs the pass/fail distribution
rather than tone alone.

**Legacy submissions still analyse.** The prompt takes entries *or* a bare comment, because the 24
existing rows have only a comment and any re-analysis of them must still work.

## Builder-side rendering

Every surface that renders a submission has to handle **both shapes**: legacy (a `tester_comment`,
zero entries) and new (entries, optional comment). A builder scrolling their feedback list sees both
interleaved by date, and that has to look deliberate rather than broken.

**One shared renderer, not eight conditionals.** `components/submissions/SubmissionBody.tsx` branches
on whether entries exist. The eight surfaces call it:

| Surface | Change |
|---|---|
| `components/MissionResultRow.tsx` | body → shared renderer |
| `components/SubmissionReview.tsx` | body → shared renderer; review controls untouched |
| `components/FeedbackListPaged.tsx` | body → shared renderer |
| `app/(developer)/dashboard/feedback/page.tsx` | select entries, pass through |
| `app/(developer)/dashboard/[projectId]/mission/[missionId]/page.tsx` | select entries, pass through |
| `app/(admin)/admin/submissions/page.tsx` | select entries, pass through |
| `app/(admin)/admin/ai-reports/page.tsx` | select entries, pass through |
| `components/tester/SubmissionsFeed.tsx` | tester's own history |

**A pass/fail count at the top of every new-style submission** — `"3 of 5 steps passed"`. That is the
single most useful thing the structure buys the builder, and it must not require expanding the log.

## Tests

| ID | Case | Expected |
|---|---|---|
| AUD-01 | Unauthenticated | `{ success: false }`, nothing written |
| AUD-02 | Builder submitting on their own project (`SUB-02`) | rejected, nothing written |
| AUD-03 | Active account is not tester | rejected |
| AUD-04 | Happy path | one `test_results` row, N entries, ids returned |
| AUD-05 | **Atomicity** — an entry insert fails | **no `test_results` row survives**; tested against the RPC directly |
| AUD-06 | `status='fail'` without `issue_summary` | rejected |
| AUD-07 | `status='fail'` without `steps_to_reproduce` | rejected |
| AUD-08 | `status='pass'` without either | accepted |
| AUD-09 | Entry referencing a `step_id` not on the mission | rejected |
| AUD-10 | Entry count ≠ mission step count | rejected |
| AUD-11 | **Snapshot integrity** — edit the mission's steps after submitting | entry still reads the original text |
| AUD-12 | Screenshot upload fails | short-circuits before the RPC (`SUB-03`) |
| AUD-13 | AI failure | row and entries survive, `ai_summary` empty (`SUB-04`) |
| AUD-14 | `parseSentiment` mapping | unchanged (`SUB-05`) |
| AUD-15 | Malformed `entries` JSON | field error, not a 500 |
| AUD-16 | Legacy submission (comment, no entries) renders | every surface, no crash |
| AUD-17 | Mission with `test_steps = []` | form falls back to comment + screenshots |

**AUD-05 is the one that justifies the RPC.** It has to run against the real function, not a mock —
a mocked transaction proves nothing about whether the database rolls back.

**Gates:** `tsc`, `lint` (at zero — this PR holds it there), `build`, `test`.

## Rollout

**Order: apply the migration → deploy.** The table is new and the `tester_comment` change only
relaxes a constraint, so both are safe ahead of the code.

**The 24 existing submissions are untouched** and keep rendering through the legacy branch. There is
no moment where a builder loses access to feedback they already have.

**Tightening `test_results` RLS belongs in this PR.** `chore/tighten-rls` deliberately left the anon
insert policy alone because it was the only write path. Once the RPC lands it is not, and the policy
should be dropped in the same migration — otherwise the atomicity guarantee has a hole beside it,
which is the exact shape of problem that branch existed to close.

**Rollback:** revert the code, then `drop function submit_audit_log` and `drop table
test_result_entries`. Entries filed after the deploy are lost — the `test_results` rows survive but
their audit logs do not, and those rows will have a null `tester_comment` if the tester left it
blank, so they will render as an empty submission. Re-add `not null` only after checking for nulls.

## Acceptance criteria

1. Migration creates the table, index, RLS-on-no-policy, and drops the `tester_comment` not-null.
2. `submit_audit_log` exists, is `security definer` with a pinned `search_path`, and returns the id.
3. An entry insert failure leaves no `test_results` row, proven against the real function.
4. Entries are rejected unless every `step_id` is on the mission and the count matches.
5. Fail requires issue summary and reproduction steps; pass requires neither.
6. Step text is snapshotted — editing the mission afterwards does not change historical entries.
7. Screenshots upload before the RPC; AI runs after and is non-fatal.
8. The form shows the builder's step verbatim, uncollapsed, above each step's inputs.
9. Expected Result is prefilled from the step and editable.
10. Draft persists in `localStorage` per mission and clears on submit.
11. A mission with no steps falls back to comment plus screenshots.
12. All eight surfaces render both shapes through one shared renderer.
13. New-style submissions show a pass/fail count without expanding.
14. `ai_summary` / `ai_sentiment` contract unchanged; `parseSentiment` unchanged.
15. `test_results` anon insert policy dropped in the same migration.
16. All four gates pass, lint still at zero.

## Manual test plan

**New-style submission:** take a mission with steps as a verified tester. Confirm each step shows the
builder's instruction verbatim, Expected Result is prefilled, Fail reveals the two extra fields and
requires them, Pass does not. Submit, then check the row and entries in the database.

**Snapshot:** edit that mission's step text as the builder. Reload the submission. Confirm the entry
still shows the original wording.

**Legacy:** open one of the 24 existing submissions on all eight surfaces. Confirm it renders as a
comment with no empty audit-log scaffolding.

**Empty mission:** open one of the 13 with no steps. Confirm the comment-and-screenshots fallback.

**Draft:** fill half an audit log, close the tab, reopen. Confirm it restores; submit and confirm it
clears.

**Atomicity:** call the RPC directly with an entry that violates a not-null. Confirm no
`test_results` row is left behind.

## Reference

- Codebase patterns: `CLAUDE.md` — Atomicity, Data Mutations, Validation
- Buttons, inputs, cards, badges, empty states: `DESIGN.md` §5.1–5.4, §8
- Existing submission cases `SUB-01`–`SUB-06`: `TEST.md` §1.5
- Prior specs: `SPEC-mission-test-cases.md`, `SPEC-project-category.md`,
  `SPEC-onboarding-polish.md`, `SPEC-verification-gate.md`
