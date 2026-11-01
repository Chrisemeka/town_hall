# SPEC: A Full Test Case Stops Taking Reports

**Status:** Implemented on `fix/closed-test-cases` — decisions 1–4 decided 1 Nov 2026, all as recommended (§4). `UNSUBSCRIBE_SECRET` folded into `SIGNING_SECRET` (§6).
**Branch:** `fix/closed-test-cases`
**Source:** `docs/TWNHALL_CLOSED_TEST_CASES_PROMPT.md`
**Migration:** one — `missions.closed_at`; `publish_mission`, `close_mission` and `report_landed` replaced (same signatures)
**New dependency:** none
**New env var:** `SIGNING_SECRET` (server-only), unless decision 1 is (a)
**Risk:** low–medium. It adds a refusal to the submission path, which until
now has refused only for identity, ownership, a repeat report and the rate
limit.

## Summary

The ask: once a test case has received the number of reports the builder's
plan allowed it, it closes, and **no new reports can be sent for it**.

**Half of that already exists.** Publishing reserves the test case's slots from
the plan, and `report_landed` sets `is_active = false` when the last reserved
report lands. The lists stop showing it. **The other half doesn't exist.**
Nothing stops a report from being *sent* to a closed test case. The tester page
still renders the form, and `submitTestResult` never checks whether the test
case is open. A closed test case keeps taking reports from anyone who reaches
its URL. Builders get more reports than their plan paid for, and testers spend
40 minutes on reports nobody asked for.

This closes that half, without throwing away the work of a tester who was
already mid-test when the last slot filled.

## §0 — Verified before writing this

**How many reports a test case takes is already plan-driven.** On publish,
`publishMission()` (`lib/allowanceDb.ts`) asks for `testersPerMission` (5 on
every plan, `lib/plans.ts`) and `reserve()` (`lib/allowance.ts`) grants up to
that many from the builder's balance:

- **Community:** the 3-report signup grant, then earned credit
- **Starter:** 5 a month
- **Pro:** 10 a month

The grant becomes `missions.testers_needed`. A partial balance opens a smaller
test case. That's "capped, not refused" (CLAUDE.md).

**The auto-close exists** — `report_landed` (`20260930_01:170`), run after every
submission commits:

```sql
if v_held > 0 and v_received >= v_held then
  update public.missions set is_active = false where id = v_mission and is_active is distinct from false;
end if;
```

The lists respect it. Browse Test Cases, the tester home strip and global
search filter `is_active = true`; a project's page filters `is_active !== false`.

**What doesn't respect it:**

- **`/mission/[id]`** reads the mission without `is_active` and renders
  `AuditLogForm` for anyone who isn't the owner and hasn't tested it. That
  includes a **draft that was never published**, because missions are publicly
  readable (`using (true)`). Ways in: a tab opened before the close, a
  bookmarked or shared link, "Open the mission" in the tester's feed dialog, the
  back button, and soon the daily digest's links.
- **`submitTestResult`** (`actions/submissions.ts`) selects `project_id,
  test_steps, category, projects(owner_id)` and never `is_active`.

**Why it was left open:** CLAUDE.md says *"A submission is never refused by the
allowance, at any balance … refusing a submission for want of balance would
destroy work a tester has already done. … Do not add a draft or claim state to
change that; it is the invitation model, deferred by decision."* That rule is
about the builder's **balance**. This spec refuses on the **test case's state**,
a different rule, but the reason behind the old one still applies, and decision
1 is how it's honoured.

**Test cases that never close:** a test case live before the ledger existed
holds no slots (`v_held = 0`) and never self-closes. **Counted 1 Nov 2026: 17
of the 25 live test cases hold no reserved slots** (8 do).

**`QA-2.13-4`** ("A mission open to 3 testers leaves Explore after its third
report") has no Done status on the checklist. The auto-close has not been
confirmed by QA.

## §1 — Record when a test case closed

```sql
alter table public.missions add column if not exists closed_at timestamptz;
```

- **`report_landed`** sets `closed_at = now()` in the same `update` that closes
  it when full.
- **`close_mission`** (a builder pausing it) sets `closed_at = now()`.
- **`publish_mission`** (first publish, or reopen) sets `closed_at = null`.

All three are replaced with their current signatures, with `revoke`/`grant`
restated and a rollback note. No backfill: a test case closed before this ships
has `closed_at` null, which reads as "closed, time unknown", so it gets no grace
period (§3).

**If `feat/tester-notifications` has merged first**, its `publish_mission`
already sets `first_published_at`. This migration's `publish_mission` must keep
that line. Whichever branch lands second carries both changes. Check before
writing it.

## §2 — The tester page says it's closed

In `/mission/[id]`, select `is_active`, `testers_needed` and the report count,
then branch **after** the existing owner and already-tested panels, which keep
precedence:

- **Live** (`is_active` true, or null on a legacy row): the form, as today.
- **Not live:** a panel in the existing style (the dashed card, an icon, a Syne
  heading). It reads **"This test case isn't taking reports"**, with one line
  under it:
  - full (`received >= testers_needed > 0`): *"It got all the reports it
    needed."*
  - otherwise (paused, or a draft): *"The builder isn't taking reports on it
    right now."*

  Then a **Find another test case** link to `/explore/missions`. The brief and
  steps above the panel stay visible, the same as for the owner and
  already-tested panels. The page never says which builder or why.

## §3 — The submission refuses, except for work already started (decision 1)

**Recommended: (b).**

**(b) Refuse a new start, keep work in progress.** When the page renders the
form for a **live** test case, it also renders a **start token**:
HMAC-SHA256 over `"report-start:" + missionId + ":" + testerId + ":" + issuedAt`,
keyed by `SIGNING_SECRET`, in `lib/reportStart.ts` (`startToken`,
`verifyStartToken`, constant-time compare). `AuditLogForm` sends it with the
report.

In `submitTestResult`, after the ownership and already-submitted checks and
**before the rate limit and any upload** (a refusal must cost no storage),
select `is_active` and `closed_at`:

- **Live:** accepted, as today.
- **Closed:** accepted **only if** all of these hold:
  - the start token verifies for this mission and this tester
  - `issuedAt < closed_at`
  - the submission arrives within `CLOSED_GRACE` (decision 2) of `closed_at`
- **Anything else:** refused with *"This test case closed before you started —
  it isn't taking reports any more."* This includes a closed test case with
  `closed_at` null (closed before this shipped) and a draft that was never live.

A tester who opened the page while the test case was live, and was halfway
through when the last slot filled, still gets their report in. Someone opening
it afterwards sees the panel and never starts. The cost is a small, bounded
overflow: one extra report per tester who was mid-test at the moment it filled.
For a paid cohort tester, that extra report is outside the payable slots
(`payableReports()`), so it's an ordinary unpaid report that earns +1, the rule
that already exists.

**Known limit, stated so nobody believes otherwise:** a tester who **reloads**
after the close gets the panel, not their form. The page can't know they had
started without a server-side record of starting, which is the claim state
CLAUDE.md defers. Their draft is still in `localStorage` if the test case
reopens.

**(a) Refuse every report on a closed test case.** Simplest: no token and no
secret. But a tester mid-form when it fills loses everything at Submit. With
5 slots and several testers working at once, that's a regular event, and it's
the exact harm CLAUDE.md's rule exists to prevent.

**(c) Claim a spot when starting.** Opening a test case takes a slot, and
nobody can start once they're taken. No overflow and no lost work. But it's
the invitation model: claim expiry, abandoned claims, slots held by people who
never submit. It was deferred by decision and is much larger than this fix.

## §4 — Decisions

**Decision 1 — What happens to a tester mid-test when the test case fills?**
**Recommended: (b), the grace for work already started.** Above.

**Decision 2 — How long is the grace?**
**Recommended: `CLOSED_GRACE = 24 hours`** after `closed_at`, in
`lib/reportStart.ts`. That's long enough for someone who started in the evening
to finish the next morning, and short enough that an old tab can't land a
report a week later.

**Decision 3 — When a builder closes a test case themselves (a pause), does the
grace apply?**
**Recommended: yes, the same rule.** One rule is easier to reason about than
two, and a tester mid-test shouldn't lose work to a pause either. The cost is
that `close_mission` has already released the unused slots, so a grace report
after a pause is one the builder didn't pay for. It's rare, bounded and free to
the builder, so worth accepting. The alternative is no grace on a pause, which
needs `closed_by` recorded as `full` or `builder`.

**Decision 4 — Legacy test cases that never self-close.**
**Recommended: leave them**, and put the count in §0. They predate plans, hold
no slots and cost nobody anything. Closing them is a one-line data change if
§0's count says it's worth doing. It wouldn't be a code change.

## §5 — Tests

- **`lib/__tests__/reportStart.test.ts`:**
  - round-trips
  - fails for another mission, another tester, a tampered `issuedAt` or a
    tampered signature
  - the compare is constant-time
  - a token from another purpose prefix fails
- **`actions/__tests__/submissions.test.ts`** (TEST.md §1):
  - live → accepted, as today
  - closed, with a valid token issued before `closed_at` and inside the grace →
    accepted
  - closed, token issued **after** `closed_at` → refused
  - closed, outside the grace → refused
  - closed, `closed_at` null → refused
  - closed, no token or a bad token → refused
  - never-published draft → refused
  - **every refusal happens before upload and before the rate-limit hit**
    (assert `uploadToStorage` and `checkRateLimit` not called)
- **The tester page:**
  - a live test case renders the form and a token
  - closed and full → "It got all the reports it needed."
  - paused or draft → the other line
  - owner and already-tested panels still take precedence
- **Migration:**
  - `report_landed` sets `closed_at` when it closes, and only then
  - `close_mission` sets it
  - `publish_mission` clears it on reopen
- **Anonymity:** `scripts/anonymity.test.mts` stays green, and the page still
  never reads `owner_id` into the client.

## §6 — Documentation

- **`CLAUDE.md`:**
  - next to the allowance rules, a paragraph: *"A closed test case refuses new
    reports. The allowance never refuses; the test case's state does."* Then
    the start token, the grace, the known reload limit, and that the claim
    model is still deferred.
  - reword the line "a submission is never refused by the allowance" so it
    can't be read as "never refused at all".
  - `missions.closed_at` added to the table.
  - `SIGNING_SECRET` noted. If `UNSUBSCRIBE_SECRET` from the notifications spec
    exists by then, fold both into `SIGNING_SECRET` with their purpose
    prefixes, and note it.
- **`.env.example`, `README.md`:** `SIGNING_SECRET`, server-only, set in Vercel
  Production and Preview, **redeploy after setting it**.
- **Tester guide:** one line saying a test case closes when it has all the
  reports it needs, and a report you'd already started still goes through for a
  day.
- **`TownHall_Checklist (1).xlsx`:** mark `QA-2.13-4` **RETEST**, and add
  section **2.28 Closed test cases**:
  - QA-2.28-1: A test case open to 3 gets its 3rd report and leaves Browse,
    search and the tester home. The builder sees it inactive.
  - QA-2.28-2: Open its URL as a new tester. "This test case isn't taking
    reports · It got all the reports it needed", with no form.
  - QA-2.28-3: Two testers open it while one slot is left. A submits first and
    it closes; B submits a minute later and **B's report is accepted**.
  - QA-2.28-4: A tester who opens the URL after it closed can't submit, even
    from a crafted request.
  - QA-2.28-5: The builder pauses a test case; the URL shows "The builder isn't
    taking reports on it right now."
  - QA-2.28-6: Reopen it; the form is back and new reports go through.
  - QA-2.28-7: An unpublished draft's URL shows the panel, never the form.
  - QA-2.28-8: Both themes, 360px and desktop: the panel matches the Project
    Owner panel's layout.

## Out of scope

- The claim / invitation model.
- Showing testers how many slots are left. That's worth doing, but it changes
  what the lists say.
- Changing `testersPerMission` or any plan number.
- Closing legacy test cases (decision 4).
- Warning a tester whose page is open at the moment the test case closes, which
  would need realtime.
