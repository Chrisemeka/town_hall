# SPEC: One Report Per Mission

**Status:** Implemented on `fix/one-report-per-mission` — migration not yet applied
**Branch:** `fix/one-report-per-mission`
**Base:** `main` (at `2aaf99b`)
**Depends on:** Nothing.
**Blocks:** `feat/cohort-payouts` — it pays per report, and would pay twice.
**Source:** finding 4 in `SPEC-report-allowance.md`, approved as a separate fix
**Migration:** `20260930_02_one_report_per_mission.sql` — `submit_audit_log` replaced
**Risk:** low. It adds one refusal to the submission path, for a case that was never intended.

## Summary

Nothing stopped a tester submitting twice on the same mission — no unique
constraint on `(mission_id, tester_id)`, no check in `submitTestResult`, and
the mission page kept offering the form. With the allowance a second report is
a farmed credit; with cohort payouts it is a second payment. This refuses it.

This is **not** the allowance refusing a submission. The allowance rule — a
report on a live mission is never refused for want of balance — is untouched.
This is a per-tester rule about the same person reporting twice.

## §1 — The database

`submit_audit_log` is replaced (same signature, 20260908_01's body) with an
existence check at the top, under `pg_advisory_xact_lock` on the pair, raising
`23505`. Grants restated.

**Not a unique index.** The live table may already hold duplicates; an index
would fail to build over them, or force deleting a tester's writing so it
could. Existing rows stay; the rule holds for every write from here. The
migration carries the query to list what exists.

The lock is per (mission, tester), so a double tap serialises and nothing else
waits.

## §2 — The action

`submitTestResult` reads for an earlier report after the ownership check and
**before the upload**, so a refused second report costs no storage. A `23505`
from the RPC — the same rule, lost to a race — returns the same message:
*"You've already submitted a report for this mission."*

## §3 — The page

`/mission/[id]` shows *"You've tested this mission"* in place of the form when
the tester already has a report there, read through their own RLS. A form that
can only be refused should not be offered.

## §4 — Tests

`actions/__tests__/submissions.test.ts`: a second report is refused before any
upload or RPC; a `23505` from the RPC gives the same message. Every existing
submission test still passes.

## Files

```
supabase/migrations/20260930_02_one_report_per_mission.sql   new
actions/submissions.ts
actions/__tests__/submissions.test.ts
app/(tester)/mission/[id]/page.tsx
CLAUDE.md
TownHall_Checklist (1).xlsx
docs/specs/SPEC-one-report-per-mission.md                    new
```

## Manual test plan

- Before applying: run the duplicate query in the migration header; note the count.
- Submit a report on a mission → the page now shows "You've tested this mission".
- In a second tab opened earlier, submit again → refused with the message, nothing uploaded.
- Another tester can still submit on the same mission.
