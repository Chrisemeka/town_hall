# Twnhall — A Full Test Case Stops Taking Reports: Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

The ask: once a test case has received the number of reports the builder's plan allowed it, it closes and **no new reports can be sent for it**.

Half exists already. `report_landed` sets `is_active = false` when the last reserved slot fills, and the lists hide it. **The other half is missing.** `/mission/[id]` still renders the form for a closed test case (and for a never-published draft), and `submitTestResult` never checks `is_active`. Anyone with the URL can still send a report.

**The spec is written:** `docs/specs/SPEC-closed-test-cases.md`. It has what was verified, `missions.closed_at`, the tester page's closed panel, the start-token grace for testers already mid-test, four decisions and the tests. This prompt is the order of work and the traps.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions. Pay particular attention to the report allowance rules ("a submission is never refused by the allowance … the invitation model, deferred by decision"). This change refuses on the **test case's state**, not the balance, and the spec's §3 is how it keeps that rule's reason.
2. Read the spec end to end.
3. **Check its Status line.** If decisions 1–4 are not marked decided, **stop and ask**. Do not pick for me. The recommendations are: (b) the grace for work already started; 24 hours; the same rule on a builder's pause; leave legacy test cases.
4. Read `actions/submissions.ts`, `app/(tester)/mission/[id]/page.tsx`, `components/tester/AuditLogForm.tsx`, `lib/allowanceDb.ts`, and `publish_mission`, `close_mission` and `report_landed` in `supabase/migrations/20260930_01_report_ledger.sql`.
5. **Check whether `feat/tester-notifications` has merged.** If it has, its `publish_mission` sets `first_published_at`, and yours must keep that line.
6. **Run one read-only query** and write it into spec §0: how many live test cases hold no reserved slots (live before the ledger, never self-closing). Decision 4 depends on it.
7. Read `TEST.md` §1.

All four gates before done: `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test`.

**Branch:** `fix/closed-test-cases`
**Migration:** one, with the next free date prefix. **Apply it before the code deploys.**
**New env var:** `SIGNING_SECRET` (unless decision 1 is (a)). Ask me to set it in Vercel (Production and Preview) and **redeploy** before the end-to-end check. Never `NEXT_PUBLIC_`.

---

## Commits, in this order

**1 — `feat(db): closed_at on missions`**
Spec §1: the column, and the three functions replaced with their current signatures. `report_landed` sets `closed_at` in the same `update` that closes it; `close_mission` sets it; `publish_mission` clears it. Restate every `revoke`/`grant`, and add a rollback note. **Diff each function body against its current definition** so only the `closed_at` line changes. These three hold the allowance's compare-and-append logic.

**2 — `feat(lib): the start token`**
`lib/reportStart.ts`: `startToken`, `verifyStartToken`, `CLOSED_GRACE`, HMAC-SHA256, constant-time compare, the `"report-start:"` purpose prefix. Pure apart from reading the secret. With its tests.

**3 — `fix(tester): a closed test case shows a panel, not the form`**
Spec §2. Select `is_active`, `testers_needed` and the report count through the existing service-role read (name the columns; the page still never reads `owner_id` into the client). The owner and already-tested panels keep precedence. Issue the start token **only when rendering the form for a live test case**, and pass it to `AuditLogForm`, which sends it in the `FormData`.

**4 — `fix(submit): refuse a report on a closed test case`**
Spec §3. Traps:
- **The check runs after the ownership and already-submitted checks, and before `checkRateLimit` and any upload.** A refused report costs no storage and no rate-limit attempt. Assert both in tests.
- **The grace needs all three conditions**: a valid token for this mission and tester, `issuedAt < closed_at`, and inside `CLOSED_GRACE`. `closed_at` null means no grace.
- **A never-published draft is refused.** No token is ever issued for one, so this falls out of the rule, but test it explicitly.
- **Nothing here reads the allowance or the ledger.** This is the test case's state, not the builder's balance.

**5 — `docs: closed test cases`**
Spec §6: `CLAUDE.md` (the new paragraph and the reworded allowance line), the env files, the tester guide line, and checklist section 2.28 with `QA-2.13-4` marked RETEST. Set the spec's Status to `Implemented on fix/closed-test-cases`.

---

## Before calling the PR done

Four gates, then end to end on a preview deployment with the migration applied and `SIGNING_SECRET` set and redeployed:

1. Publish a test case as a Community builder, so it's open to 3. File 3 reports from 3 testers. It leaves Browse, search and the tester home, and the builder sees it inactive.
2. Open its URL as a fourth tester: the closed panel, with no form.
3. The race: with one slot left, open the test case in two testers' browsers. A submits and it closes. B submits a minute later, and **B's report is accepted**.
4. Replay B's request with the token's `issuedAt` moved after the close, or with no token: refused, and no object uploaded.
5. The builder pauses a test case: the URL shows "The builder isn't taking reports on it right now." Reopen it and the form is back.
6. An unpublished draft's URL shows the panel, never the form.

## Out of scope

Everything in the spec's Out of scope section, in particular the claim / invitation model and showing testers slots left.
