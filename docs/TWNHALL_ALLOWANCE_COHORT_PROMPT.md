# Twnhall — Allowance, Cohort & Payout: Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

This is the work `lib/plans.ts` and the `plan_id` migration have both been warning about. Their headers say, in almost the same words: *"If you are about to read a number here in order to block something, that is tier enforcement — separate work, with its own sequencing."*

This is that work. Those two comments come down at the end of it.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions.
2. Read `TEST.md` §1.
3. Read `lib/plans.ts`, `lib/reciprocity.ts`, `supabase/migrations/20260924_01_accounts_plan_id.sql`, `actions/missions.ts`, `actions/submissions.ts`.
4. Read `docs/specs/` and match that spec format.
5. Read `docs/Twnhall_Cohort_Compensation_Model.md` — it is the source for every number in this prompt.

**Three PRs, in order.** Write each spec into `docs/specs/SPEC-<name>.md` first and **stop for approval before implementing.** All four gates before done: `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test`.

**Base:** `main`, after `fix/account-switch-choose-account-phone` merges.

---

## The finding that shapes PR 2 — read this before designing anything

The intended rule was: **a builder who hits their monthly ceiling stops being able to start new testing, but work already under way lands and is paid for.**

`submitTestResult` in `actions/submissions.ts` is a **one-shot post.** A tester opens the mission page, fills the form, and submits. There is no draft row, no claim, no assignment, no "started at" timestamp. **Nothing in the schema represents a report in progress.**

So that rule cannot be enforced at submission time. Blocking a submission because the builder's balance ran out while the tester was writing would destroy exactly the work it was meant to protect — and under the cohort model, that is a person who spent forty minutes and does not get paid.

**Therefore the allowance is spent when a mission is published, not when reports arrive.**

- `missions.testers_needed` already exists and is unused. It becomes the number of slots a mission reserves.
- `missions.is_active` already exists. Turning it false is the release event.
- A mission that went live had budget. Every report on a live mission is accepted and payable, always.
- The ceiling is enforced at publish, where the builder is present, can read the message, and nobody else's work is at stake.

**Do not add a draft or claim state to make submission-time enforcement work.** That is the invitation model, it is explicitly deferred (see the compensation doc §4), and it is not in scope here.

---

# PR 1 — The tiers as content

**Branch:** `feat/tier-definitions`
**Migration:** none
**Risk:** none — copy only

`lib/plans.ts` still describes the v4 offer. Every number in it is superseded. Nothing is enforced yet and nothing becomes enforced in this PR; this is the copy the pricing page and the settings Plan tab both read, and it should stop being wrong while PR 2 is in review.

## 1.1 — Pro

| Field | From | To |
|---|---|---|
| Price | `$19/month · ₦10–12k` | unchanged — $19 is the decided price |
| Tester reports | 20 a month | **10 a month** |
| Testers per mission | Up to 8 | **Up to 5** |
| Active missions | 5 | unchanged |

**Why 5 testers and not 8:** eight testers on one mission would consume 80% of a 10-report allowance in a single round. Five is also the panel size that surfaces ~85% of usability problems (NN/g), so eight buys very little. Ten reports ÷ five testers = **two complete test rounds a month**, which is the line the pricing page should be making.

**"Priority in the tester queue" describes a queue that does not exist.** There is no invitation or assignment model. Remove the line rather than shipping a promise nothing can keep.

## 1.2 — Community

| Field | From | To |
|---|---|---|
| Tester reports | 5 a month | **3 reports to get you started, then 1 for every report you write as a tester** |
| Testers per mission | Up to 5 | unchanged |
| Active missions | 2 | unchanged |

The monthly free entitlement is withdrawn. Under a paid tester cohort, five free reports a month costs ₦5,000 per free user per month with no revenue against it — recurring, forever. A one-time grant of three costs ₦3,000 once and buys the same thing: a first experience good enough to convert.

## 1.3 — Keep the header warning, update its terms

`lib/plans.ts`'s header currently says nothing is enforced. That stays true until PR 2 lands. **Update it to name PR 2's branch rather than deleting it**, and delete it only in PR 2 when it stops being true.

## 1.4 — Tests

The pricing page and the settings Plan tab render the new numbers and disagree with each other nowhere. They read the same source, so this is a snapshot check, not new logic.

---

# PR 2 — The allowance ledger

**Branch:** `feat/report-allowance`
**Migration:** yes
**Risk:** high — this is the first thing in the app that can tell a builder "no"

## 2.1 — A ledger, not counters

Do not add `reports_used_this_month` columns to `accounts`. Counters need a monthly reset job, and a reset destroys the record of what was spent — which, under the cohort model, is the record of **what you owe people money for.**

Use an append-only events table. It matches how `test_result_entries` already works and how `ai_usage_events` was specced.

```
report_ledger
  id            uuid primary key default gen_random_uuid()
  account_id    uuid not null references accounts(id) on delete cascade
  mission_id    uuid references missions(id) on delete set null
  kind          text not null   -- 'grant' | 'earned' | 'reserved' | 'released'
  bucket        text            -- which pool this drew from; see §2.4
  slots         int not null    -- positive credit, negative for 'reserved'
  created_at    timestamptz not null default now()
```

`on delete set null` on `mission_id` for the same reason `ai_usage_events` uses it: a deleted mission does not un-spend the allowance.

**RLS on, no policies.** Service role only, per `CLAUDE.md`.

## 2.2 — Balance is a pure function

Put the arithmetic in `lib/allowance.ts`, pure and import-free, in the shape of `lib/reciprocity.ts` and `lib/access.ts`. It takes the plan, the ledger rows and a date; it returns the balance. It touches no database and no request.

That file is where the tests live, because the arithmetic is the part that can be wrong in a way that costs money.

## 2.3 — What the balance is made of

Three pools, and they behave differently:

| Pool | Size | Expires |
|---|---|---|
| **Monthly entitlement** | 10 for Pro, 0 for Community | Yes — resets each calendar month |
| **Signup grant** | 3, once per profile | No |
| **Earned** | +1 per report written as a tester | No |

The monthly entitlement is **derived from the plan, not stored.** Do not write twelve rows a year per account for something `plans.ts` already knows.

**Spend order: monthly entitlement first, then grant, then earned.** A Pro builder who spends earned credits while their monthly allowance sits unused has been robbed by the software. Get this order right and test it directly.

## 2.4 — Why reservations record their bucket

This is not bookkeeping neatness. It decides who serves the mission.

**Cohort testers are paid ₦1,000 a report. That money may only be spent where it is paid for or where it is deliberate acquisition spend:**

| Bucket | Cohort may serve it | Why |
|---|---|---|
| Pro monthly entitlement | **Yes** | The builder is paying $19 |
| Signup grant | **Yes** | ₦3,000 once per profile, budgeted as acquisition cost |
| Earned (reciprocity) | **No** | The builder earned it by supplying a report; the pool balances itself |

A Community user's earned reports are served by other builders doing reciprocity — that is the entire mechanism, and paying the cohort to do it would mean buying supply the user already supplied.

So a reservation has to know which pool it came from, and a mission's visibility to cohort testers follows from that. Record `bucket` on every `reserved` row. Where a reservation spans two pools, split it into two rows rather than picking one and being wrong about half of it.

## 2.5 — Reserve at publish, atomically

The check-and-reserve must be **one atomic operation.** Two missions published in the same second must not both pass a balance check that only one of them can afford. Money depends on this.

House pattern: a plpgsql function in the migration, invoked with `.rpc()`, the way `submit_audit_log` works — SECURITY DEFINER, pinned `search_path`, execute revoked from `anon` and `authenticated`.

**Cap rather than refuse where you can.** A Community builder with 3 reports available who asks for 5 testers should get a 3-tester mission and a clear sentence, not an error. Turn the limit into the reciprocity prompt:

> "You have 3 reports available, so this mission opens to 3 testers. Write a report for someone else to earn more."

That is the highest-leverage sentence in the product. It is the free tier's entire growth mechanism, said at the exact moment it is relevant.

Refuse only at zero, and say what to do about it — write a report, or get in touch about Pro. `lib/contact.ts` has the mailto helper; there is no checkout and there is not going to be one.

## 2.6 — Release at close

When `is_active` goes false, return the unreserved remainder: slots reserved minus reports actually received, as a `released` row.

Three cases to get right, and each is a test:

- Mission closed with fewer reports than slots → the difference comes back.
- Mission closed having received every report → nothing comes back.
- Mission closed twice (double-click, retry, admin action) → **releases once.** Make this idempotent; a double release mints free allowance.

Consider whether a month boundary crossing mid-mission returns slots to a month that has already reset. State the answer in the spec rather than discovering it in production. The simplest correct rule is that released slots return to the pool they were drawn from and expire with it.

## 2.7 — The signup grant

**Per profile, not per account.** Someone holding both a builder and a tester account collects one grant, not two.

**Recorded, so it cannot be re-triggered** by deleting and recreating an account under the same profile. A fresh email address is not preventable; the cheap version is.

Grant at the point the first account is created — `createAccount` in `actions/accounts.ts` — not at signup, since an account is what the ledger hangs off.

## 2.8 — Earned credits

+1 per report written as a tester. The natural hook is the same place the report lands, and `lib/reciprocity.ts` already counts `given` from `test_results` for display.

**Do not derive the balance from a live count of `test_results`.** Write a ledger row. A count is a number that changes when history changes; a ledger row is a fact about what was granted at a point in time. When a submission is later deleted, you want the credit to have existed.

Same non-fatal discipline as the AI analysis in `actions/submissions.ts`: a ledger write failing must not lose the submission. Log and move on — but unlike the AI path, **alert on it**, because a silently missing credit is a user who was cheated.

## 2.9 — What must never happen

- **A submission is never blocked by the allowance.** Not at any balance, not in any state. The mission was published; the tester's work is owed.
- **The allowance never blocks a tester from anything.** It is a builder-side limit only. A tester has no allowance.
- **Never a hard error where a cap will do.**

## 2.10 — Tests

- Spend order: Pro with unused monthly plus earned credits spends monthly first.
- Grant is once per profile across two accounts.
- Grant does not re-trigger after account deletion and recreation.
- Reservation is capped, not refused, at partial balance.
- Reservation at zero refuses with the contact route.
- Two concurrent publishes cannot both reserve the last slots.
- Release returns the correct remainder; double close releases once.
- Cohort-eligible buckets resolve correctly for Pro, grant and earned.
- A submission succeeds with the builder at zero balance.
- `scripts/access.test.mts` still passes.

---

# PR 3 — Cohort, payouts and the admin plan control

**Branch:** `feat/cohort-payouts`
**Migration:** yes
**Risk:** medium

## 3.1 — The cohort flag

`accounts.cohort_member_at timestamptz` — nullable, null meaning not a cohort member. Same nullable-timestamp pattern as `accepted_terms_at` and `verification_completed_at`: it records *when*, which you will want when reconciling a month's payments.

On `accounts`, not `profiles`, per `CLAUDE.md` — cohort membership is a property of the tester role.

## 3.2 — Mission visibility for cohort testers

A cohort tester must not see missions whose slots came from the earned bucket (§2.4).

**Enforce it in the query, server-side.** A UI filter is not an enforcement boundary, and the thing on the other side of it is your money.

## 3.3 — The payout ledger

This replaces a payment system. There is no wallet, no transfer, no rails — bank transfers against a spreadsheet, per the compensation doc.

An admin view, per calendar month:

- Every cohort tester, with reports submitted that month.
- Each report's rating, and the tester's rolling average.
- The ≥10-report activity bonus flag.
- Per-tester total: `reports × ₦1,000 + (bonus ? ₦3,000 : 0)`.
- A month total.
- **CSV export**, since paying from it is the point.

**Put the rates in one named constant with a comment**, not inline in a sum. They are a business decision that will change, and a rate compiled into three call sites is a rate that gets changed in two of them.

**Derive the month from `created_at`, in one explicit timezone, named in the spec.** A report filed at 23:50 on the 31st must land in exactly one month's payout, and "whichever timezone the server felt like" is how someone gets paid twice or not at all.

The CSV goes through the existing escaping in `lib/csv.ts` — tester names are user-controlled input and the CSV-injection path is already known.

## 3.4 — The rating gate

`averageRating()` in `lib/reciprocity.ts` already computes the number. Nothing acts on it.

Surface the rolling average in the payout view, and flag testers below threshold. **Make the threshold a named constant, and do not wire it to anything automatic in this PR** — the value is still undecided (compensation doc §10), and an automatic cut-off with a guessed number will remove someone's income by accident.

**Pay on submission, never on approval.** The payout view lists what was submitted. It does not withhold on rating. Withholding retroactively destroys trust faster than any rate dispute — this is in the compensation doc and it is not an implementation detail.

## 3.5 — The admin plan control

`accounts.plan_id` has existed since 24 September and there is no way to set it. Upgrades happen by email, so an admin has to be able to action one.

A control in the existing admin area: find an account, set or clear `plan_id`. Service role, explicit column list, and **log who changed what and when** — this is the field that decides what someone is entitled to.

Clearing it back to null means Community, per the migration's comment. Do not backfill `'community'` into existing rows; the migration explains at length why that distinction does not exist.

## 3.6 — Tests

- Cohort testers cannot see earned-bucket missions — tested at the query, not the component.
- Payout arithmetic: rate, bonus threshold at exactly 9, 10 and 11 reports.
- Month boundaries assign a report to exactly one month.
- CSV escapes a tester name containing a leading `=`.
- Plan changes are written and logged; clearing returns the account to Community behaviour.

---

## Documentation — across all three PRs

- **`CLAUDE.md`** — the ledger and its pure-function boundary; that the allowance is enforced at publish and never at submission, with the reason; cohort supply rules; the payout view as service-role-only.
- **`lib/plans.ts`** — the header warning comes down in PR 2, replaced by a pointer to `lib/allowance.ts` as the thing that actually enforces.
- **The `plan_id` migration comment** is now historical. Leave the migration untouched — it is applied — and note the change in `CLAUDE.md` instead.
- **`TownHall_Checklist (1).xlsx`** — QA rows for publish at zero balance, capped publish, close-and-release, the signup grant, and a payout month total.

## Out of scope

Rate limiting — its own prompt. Shadow metering — its own prompt, still unimplemented. The invitation/assignment model and anything resembling an SLA clock. Overage billing. Any form of checkout.
