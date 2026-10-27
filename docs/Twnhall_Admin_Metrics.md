# Twnhall — Admin Metrics: What to Measure and Why

**Status:** Built — see docs/specs/SPEC-admin-revamp.md
**Date:** 6 October 2026 · **Revised:** 27 October 2026 — prices and break-even moved to the three-tier model (Starter ₦15,000 · ~$11, Pro ₦30,000 · ~$22) in `lib/plans.ts` and compensation doc §7. Build plan: `docs/specs/SPEC-admin-revamp.md`.
**Purpose:** Defines the metrics the admin dashboard should carry, and why each one earns its place. This is the input to the admin revamp — build from this, not from a list of available columns.

---

## 1 — What is wrong with the dashboard today

The `/admin` overview carries seven tiles:

> Users · Projects · Missions · Submissions · AI Reports · Flagged · Uncredited reports

**Six of the seven are lifetime cumulative counts.** They only ever go up. A platform with 400 submissions filed over eighteen months and one filed last week shows the same number as a thriving one, and neither reading answers a question anyone has.

The two useful ones are **Flagged** and **Uncredited reports** — and they are useful for the same reason: they are *alarms*, expected to read zero, and a non-zero value demands action.

That is the shape every number here should have. **A metric earns its place by changing a decision.** If there is no number at which you would do something differently, it is decoration.

---

## 2 — The organising principle

The admin dashboard has one job: **answer the questions the business cannot currently answer.**

Four of those are written down as open in `Twnhall_Cohort_Compensation_Model.md` §10, and each is blocked on a number the system does not show:

| Open question | The number it needs |
|---|---|
| Rating threshold for cutting a tester | The distribution of ratings |
| Reciprocity ratio [X] that ends cohort payments | The ratio, trended, plus cohort-served share |
| Overage pricing above a plan's allowance (5 on Starter, 10 on Pro; at or above ₦3,000 per report) | How often builders hit the ceiling |
| Whether to enforce the AI allowance | Real cost per insight — now collecting |

Two more are flagged in §11 as the assumptions **most likely to be wrong**: reports per tester per month, and time per report. Both are currently guesses that load-bear the entire cost model.

Everything below serves one of those, or tells you whether the product works at all.

---

## 3 — The top row: five numbers that say whether this is working

If the dashboard showed only these, it would be a better dashboard than the one that exists.

### 3.1 — Time to fill *(median and p95, last 30 days)*

**Mission published → its last slot filled.** Derived from `missions.created_at` and the `created_at` of its reports.

**This is the product promise, expressed as a number.** A builder paying ₦30,000 (~$22) for two test rounds a month on Pro, or ₦15,000 (~$11) for one on Starter, needs a round to take days, not weeks. If the median is ten days, nothing else on this dashboard matters — the product does not work, whatever the other numbers say.

Show p95 as well as median. The median hides the builder whose mission sat for three weeks, and that builder is the one who churns and tells people why.

### 3.2 — Reports delivered this month, against capacity

Capacity is 20 testers × 10 reports = **200/month** (compensation doc §5). Show delivered over capacity as a fraction.

Low utilisation means you are paying to train supply nobody is buying. High utilisation means you are about to start failing builders and should stop selling. Both are actions.

### 3.3 — Cohort cost this month

`reports × ₦1,000 + ₦3,000 per tester at ≥10 reports`, from the payouts work.

It is your largest variable cost and the thing you actually pay out of a bank account. It belongs on the front page, not one click in.

### 3.4 — Cohort-served share of reports

**Of reports delivered this month, what fraction came from a paid cohort tester rather than from reciprocity?**

This is the subsidy-exit number and **nothing currently computes it.** The compensation doc §9 says cohort payments end when the reciprocity ratio holds above some threshold — this is the measurement of that. When it trends toward zero, the business has become self-supplying and the cohort can wind down. Until then you are buying supply.

The `report_ledger` `bucket` field is what makes it computable.

### 3.5 — Paying builders, against break-even

Break-even is **60 paid reports a month** ($76 fixed ÷ $1.26 contribution per report, compensation doc §7.2): **12 customers if all Starter, 6 if all Pro**, anything in between for a mix. Both tiers earn the same per report, so the line is drawn in reports, not customers. Show paid monthly allowance sold (Starter × 5 + Pro × 10) against 60, with the paying-builder count by tier beside it.

The most important fact about the business, and the dashboard currently cannot tell you it.

---

## 4 — Supply and demand

The product's first failure mode is a builder waiting.

| Metric | Source | Why |
|---|---|---|
| **Unfilled slots right now** | `missions.testers_needed` minus reports received, where `is_active` | Demand waiting. If this is persistently high, stop selling. |
| **Missions closed unfilled** | `is_active` false with fewer reports than slots | A builder who paid and did not get what they paid for. Should be near zero and is worth an alarm. |
| **Active testers this month** | distinct `tester_id` in `test_results` this month | Trained-but-inactive testers are a supply illusion |
| **Reports per active tester** | distribution, not an average | §11's "most likely wrong" assumption, measured at last. An average hides one tester doing 40 and nine doing one. |
| **Testers with nothing to pick up** | missions visible to a cohort tester | Idle paid supply |

---

## 5 — Money

| Metric | Source | Why |
|---|---|---|
| **MRR** | Starter × ₦15,000 + Pro × ₦30,000 at list price; once `subscriptions` exists, the sum of `amount_ngn` actually paid | Read prices from `lib/plans.ts`, never hardcode them here |
| **Infra cost** | fixed, currently $76 (compensation doc §11) | Known; show it so the gap is visible |
| **AI spend this month** | `ai_usage_events` | Now real rather than modelled |
| **Cost per report delivered, blended** | cohort cost ÷ reports delivered | Includes reciprocity-supplied reports, so it is lower than the ₦1,000 rate and is the number that actually matters |
| **Gross margin per paying builder** | measured, not modelled, split by tier | The compensation doc predicts 57% on both Starter and Pro. Check it. |
| **Months of runway at current burn** | — | The number that decides whether to keep going |

Show the naira/dollar rate used and the date it was set, beside anything converted. The compensation doc date-stamps ₦1,350 = $1 (22 October 2026) for exactly this reason, and §7.6 says to revisit pricing if it moves more than 10%.

---

## 6 — Funnel and activation

**Nothing measures the gate chain, and it is the most instrumented thing in the codebase.** Every gate is already a timestamp:

```
signup → email_confirmed_at → accepted_terms_at → account created → verification_completed_at → first action
```

Show it as a funnel with drop-off at each step. Each gate was built to protect something; each is also a place people quit. One of these steps is losing you more people than the rest, and right now that is unknowable.

Then two activation paths:

- **Builder:** signup → project created → mission published → **first report received**
- **Tester:** signup → verified → **first report filed**

**Time to first value** matters more than the count. A builder who waits nine days for their first report has already decided about Twnhall.

---

## 7 — Retention

The hardest thing to fake and the easiest to ignore.

| Metric | Why |
|---|---|
| **Builders who published a second mission** | The single best signal in the product. One mission is curiosity; two is a habit. |
| **Testers who filed a second report** | Same logic on the supply side |
| **Monthly active builders / testers** | Not cumulative users — the number that can go down |
| **Cohort retention** | Of testers trained, how many filed anything in the last 30 days |

Under piece-rate pay, a tester who stops filing costs nothing and is still a loss — you paid in training time and the credential.

---

## 8 — Quality

| Metric | Why |
|---|---|
| **Rating distribution** | Needed to set the threshold in compensation doc §10. You cannot pick a cut-off without seeing the shape. |
| **Pending review backlog, and its age** | **The quiet killer.** A builder who never reviews leaves the tester unrated and unacknowledged, and starves the rating gate of data. If reports sit pending for two weeks, the quality mechanism does not exist. |
| **Approved share** | — |
| **Pass / fail / blocked mix** | An all-pass platform means the test cases are too easy to be worth anything |
| **AI failure rate** | From `ai_usage_events` — a failure rate nobody could see before |

---

## 9 — Alarms

Expected to read zero. Non-zero demands action. Keep these as their own row, visually distinct from the measurements.

- **Uncredited reports** — already exists, and is exactly right
- **Missions closed unfilled**
- **Reports pending review older than 14 days**
- **Flagged projects** — already exists
- **Rate-limit hits** — abuse signal, now that `rate_limits` exists
- **AI failures this month**

---

## 10 — The one thing that is still not measurable, and what it would cost

**Time per report.** The compensation doc assumes ~40 minutes and flags it as one of the two assumptions most likely to be wrong. The whole hourly-rate justification — ₦1,000 for 40 minutes ≈ ₦1,500/hour against a ₦420 statutory floor — rests on it.

Nothing records it. There is no draft row, no claim, no start event; `submitTestResult` is a one-shot post.

**But there is a cheap proxy.** `components/tester/AuditLogForm.tsx` already writes a draft to `localStorage` on every change. Recording a `startedAt` on first interaction and submitting it with the form would give time-on-task for one extra field and no migration.

It is imperfect — a tab left open overnight produces a twelve-hour report — so store it raw and read the **median**, never the mean. Imperfect and measured beats clean and assumed.

This is worth doing before the rate is ever renegotiated.

---

## 11 — Rules for building it

**Time windows, not lifetime totals.** Almost nothing here is a cumulative count. The dashboard needs a date range, and that is the structural change — the current one has no concept of time at all.

**Trends where the direction is the point.** Cohort-served share, reciprocity ratio and time-to-fill are useless as single numbers. Show the last six months.

**Distributions, not averages**, for ratings, reports per tester, and cost per analysis. An average hides every case worth acting on.

**Every tile states the decision it informs**, in one line beneath it. A tile nobody can act on gets deleted at the next revision — and should be.

**Admin keeps real names.** The anonymity work is builder-facing only. You pay these people.

**Service-role reads, explicit column lists, no new RLS policies.** Standard house rules.

---

## 12 — What to delete

| Tile | Verdict |
|---|---|
| Users | Replace with monthly active, split by role |
| Projects | Replace with projects with a live mission |
| Missions | Replace with live missions and unfilled slots |
| Submissions | Replace with reports this month against capacity |
| AI Reports | Move into the AI panel; it is not a front-page number |
| Flagged | **Keep** — it is an alarm |
| Uncredited reports | **Keep** — it is an alarm, and a good one |

Deleting six tiles is most of the value here. A dashboard of numbers that cannot be acted on trains you to stop reading it, and then the two that matter get missed too.
