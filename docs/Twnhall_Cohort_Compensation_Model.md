# Twnhall — Tester Cohort Compensation Model

**Status:** Decided, not yet implemented
**Date:** 28 September 2026 · **Revised** 28 September 2026 (Pro priced at $19/10; free tier changed to a one-time grant)
**Supersedes:** the tester-supply and Pro-pricing assumptions in `Twnhall_Monetisation_Plan_v4` §2, §3 and §7
**FX basis:** ₦1,400 = $1. Every naira/dollar pair below is date-stamped to this rate — re-check before quoting the dollar figures.

> **This file is a mirror.** The same document lives in the Claude project as `claude/Twnhall_Cohort_Compensation_Model.md`. It is kept here so the implementation prompts in `docs/` can cite it and Claude Code can read it directly. Update both copies together, or the one you are not looking at becomes wrong.

---

## 1 — The decision

The 20-person trained cohort is paid **per report delivered**, not on a monthly retainer or salary.

| Component | Amount | Trigger |
|---|---|---|
| **Base rate** | **₦1,000 per accepted report** | On submission |
| **Activity bonus** | **₦3,000 per month** | 10 or more reports completed in that calendar month |
| Retainer / standing payment | **₦0** | — |

A tester who completes 10 reports in a month earns **₦13,000**. A tester who completes none earns nothing and costs nothing.

Payment is made **directly from the startup account** — bank transfers against a spreadsheet. No payment rails are built into the product. Twenty transfers a month is administration, not engineering.

### What was rejected, and why

| Rejected | Reason |
|---|---|
| ₦5,000 retainer + ₦1,000/mission | Creates a ₦100,000/month standing obligation for 20 testers regardless of demand. At launch-level demand (2 builders) it costs $4.29 per report against $1.90 of revenue — heavily loss-making — and pays each tester ₦6,000, which guarantees churn. |
| ₦700/report flat | Correct structure, wrong number. See §3. |
| Cutting the cohort to 10 people | Fixed infrastructure ($66/mo) does not halve when the cohort does, so a smaller cohort needs *higher* utilisation to break even. Under the retainer model: 8 testers → 104% utilisation required (impossible); 10 → 95%; 20 → 77%. Under piece rate the question disappears entirely (§5). |
| Paying for the training itself | The credential is the compensation. Established earlier and unchanged. |

---

## 2 — Why piece rate rather than retainer

The retainer model's flaw was not its cost per report — it was that the cost was **fixed while revenue was not**. Piece rate converts Twnhall's largest expense into a variable one.

At the decided price of **$19 with 10 reports included**:

| Model | Standing monthly obligation | Break-even paying builders |
|---|---|---|
| ₦5,000 retainer + ₦1,000/report, 20 testers, fully loaded | ₦100,000 ($71) | **16.6** |
| ₦1,000/report + ₦3,000 bonus, any cohort size | **₦0** | **6.8** |

Break-even falls from nearly seventeen customers to under seven. Against a capacity ceiling of roughly 20 customers, that is the difference between a business that must be near-full to survive and one that survives at a third of capacity.

Only the $66/month infrastructure floor (Vercel Pro $20 + Supabase Pro $25 + Resend $20 + domain ≈ $1.25) remains fixed. Everything else now scales with revenue.

---

## 3 — Why ₦1,000 and not ₦700

Cost is no longer the binding constraint. **Supply is.** The rate should therefore be set as high as margin comfortably allows, not as low as testers will accept.

Margin at the decided price, **Pro $19 with a 10-report allowance**:

| Rate | Cost per report | Allowance cost | Gross margin | Break-even customers |
|---|---|---|---|---|
| ₦500 | $0.36 | $3.57 | 81% | 4.3 |
| ₦700 | $0.50 | $5.00 | 74% | 4.7 |
| **₦1,000** | **$0.71** | **$7.14** | **62%** | **5.6** |
| **₦1,000 + ₦3,000 bonus** | **$0.93** | **$9.29** | **51%** | **6.8** |
| ₦1,500 | $1.07 | $10.71 | 44% | 8.0 |

Moving from ₦700 to ₦1,000 costs twelve points of gross margin and shifts break-even by under one customer. It buys a materially better offer to the people the entire supply side depends on.

Note the margin is tighter at $19 than it was at the $29 originally modelled — 51% rather than 68% once the bonus is included. That is the cost of the price decision and it is accepted. ₦1,500/report would take it to 44%, which is the floor; the rate does not go higher than ₦1,000 without revisiting the price.

### The earnings reality — the real reason

| Reports/month | ₦700 | ₦1,000 | ₦1,000 + bonus |
|---|---|---|---|
| 5 | ₦3,500 | ₦5,000 | ₦5,000 |
| 10 | ₦7,000 | ₦10,000 | **₦13,000** |
| 20 | ₦14,000 | ₦20,000 | ₦23,000 |
| 30 | ₦21,000 | ₦30,000 | ₦33,000 |

At realistic early volume — 5 to 10 reports a month — ₦700 pays a trained tester ₦3,500–7,000. Against Nigeria's ₦70,000 national minimum wage that reads as insulting even though the *hourly* rate is defensible (₦700 for roughly 40 minutes of work ≈ ₦1,050/hour, against a statutory floor of about ₦420/hour).

None of these figures is a living wage, and the model does not pretend to offer one. This is part-time piece work attached to a credential. But ₦13,000 is an offer someone repeats to a friend; ₦7,000 is one they quietly stop answering.

---

## 4 — What piece rate does not buy

**Availability.** Under pure piece rate nobody owes Twnhall anything. The launch-stage problem is not what a report costs — it is *whether five testers show up for a builder's mission inside 48 hours*. The retainer was buying commitment, expensively and badly. It must not be replaced with nothing.

Two mechanisms replace it:

**The activity bonus.** ₦3,000 at ≥10 reports/month rewards consistent presence rather than existence. It costs nothing when a tester is inactive, so it carries none of the retainer's downside.

**A written response expectation**, agreed at training:

- Accept or decline a mission invitation within **24 hours**.
- Deliver an accepted mission within **48 hours**.
- Declining is entirely acceptable. **Silence is what loses a builder.**

### This is enforced by people, not by software — for now

The response expectation above is a service-level agreement: a promise about speed, with a consequence attached. **The product cannot currently measure it.** Testers browse `/explore` and self-select missions, so no tester is ever *invited* — and with no invitation there is no clock to start.

Enforcing it in software requires an invitation model: invited / accepted / declined / expired, with timestamps. That is the largest single piece of new architecture on the build list, and it is also what Pro's "priority in the tester queue" would need.

**Decision: not built at launch.** With 20 testers trained in person, the SLA is enforced by knowing who answers. Build the invitation model when that stops being possible to hold in one head — not before.

---

## 5 — Cohort sizing under this model

**The sizing question dissolves.** With no standing obligation, an inactive trained tester costs ₦0. Train as many people as the training capacity allows and hold them as a bench.

This reverses the earlier conclusion (train 20, activate 8, add one per paying builder), which existed only to cap retainer exposure. Under piece rate:

- Train the full 20, and more later if training capacity permits.
- Invite testers to missions as missions exist.
- No activation waves, no waitlist, no retainer tiers.

Two supply floors still apply. **Both are about how many trained testers the cohort needs — neither is a rule about what a builder may publish:**

- **Five testers per mission** is the panel size that surfaces ~85% of usability problems (NN/g). Cohort-served missions are staffed to five.
- **Eight trained testers** is the practical minimum to staff one mission with redundancy for declines and no-shows.

A builder publishing against their own balance may open a mission to fewer. A Community builder with three reports available publishes a three-tester mission — and must be able to, because **a five-tester floor would make the three-report signup grant in §8 unspendable**, which is the opposite of what the grant exists for.

Say what they are trading rather than refusing them: three testers find most of the obvious problems, five is where the curve flattens.

Capacity remains the constraint on how many customers can exist — roughly 200 reports/month from 20 testers at 10 reports each, which supports about 20 Pro customers at a 10-report allowance. That ceiling is unchanged by the pay model.

---

## 6 — Quality control becomes mandatory

Piece rate pays for volume, so the cheapest way for a tester to earn more is to file more, thinner reports. This is the model's principal operational risk and it must be closed at launch, not later.

**Use the existing `test_results.rating` column.**

- **Pay on submission, never on approval.** Withholding payment retroactively for quality destroys trust faster than any rate dispute.
- A tester whose **rolling average rating** falls below threshold stops receiving mission invitations.
- The rule is stated **at training**, before anyone files a first report.

The threshold value is not yet set — see §10.

---

## 7 — Pro pricing — DECIDED

**Pro is $19/month with 10 tester reports included.**

| Pro price / allowance | Cost per report | Gross margin | Break-even customers |
|---|---|---|---|
| **$19 / 10 reports — decided** | **$0.93** | **51%** | **6.8** |
| $29 / 10 reports — considered | $0.93 | 68% | 3.3 |
| $19 / 20 reports — the v4 shape | $0.93 | 2% | 154 — not viable |

$29 carried the better margin and was the modelled recommendation. **$19 was chosen** on market grounds: ₦40,000/month is real money to a Nigerian pre-seed startup and was judged likely to kill early sales conversations. 6.8 customers to break even against a ~20-customer ceiling is comfortable, so the price is affordable — it simply leaves less room.

**The 20-report allowance does not return at any price.** Ten reports is also the better product story: five testers find ~85% of problems, so ten reports is **two complete test rounds a month** — test, fix, retest.

### Consequent changes to the tier definitions

These follow directly from the price and must land together in `lib/plans.ts`, which the pricing page also reads:

- **Pro's per-mission tester ceiling drops from 8 to 5.** Eight testers on one mission would spend 80% of the monthly allowance in a single round. Five testers × two rounds = the 10-report allowance exactly.
- **Pro's differentiator becomes active missions (2 → 5), not panel size**, alongside unlimited AI insights, the shareable formatted report, and tester-queue priority.
- **"Priority in the tester queue" describes a queue that does not exist.** Either remove the line or accept that it is a promise pending the invitation model in §4.

### Validate before it ships

Ask the first five builders what they would pay for two test rounds a month. Do not lead with a number.

---

## 8 — The free tier — DECIDED

**Community gets a one-time grant of 3 reports at signup, then earns further reports only through reciprocity.**

The v4 shape — "5 tester reports a month" as a standing monthly entitlement — is withdrawn. Under a paid cohort it would cost ₦5,000 per free user per month with zero revenue against it; ten free users would be ₦50,000/month of pure burn, recurring forever.

The one-time grant costs **₦3,000 (~$2.14) once per new profile** and does not compound. It buys the thing the monthly allowance was actually for: a first experience good enough to convert.

Copy becomes: *"3 reports to get you started, then 1 for every report you write as a tester."*

Two implementation rules, both load-bearing:

- **Grant per profile, not per account.** Someone holding both a builder and a tester account must not collect two grants.
- **Record that the grant was made**, so deleting and recreating an account under the same profile does not re-trigger it. A fresh email is not preventable; the cheap version is.

**Beyond the grant, the free tier draws on reciprocity only.** A Community user must never be served a paid cohort report. This rule does not bend.

---

## 9 — The subsidy still needs an end condition

Piece rate makes the cohort cheap, which makes it easy to never end. Cheap and permanent is still permanent.

A paid human report costs $0.71–0.93. An AI insight costs $0.0017–$0.0103. **A paid report is roughly 100–200× Twnhall's other marginal cost.** It is a sound way to buy initial supply and not a cost structure to scale into.

Write the end condition down now:

> Cohort payments continue until the **reciprocity ratio** (reports given ÷ reports received) holds above [X] for two consecutive months, or until [date], whichever comes first.

The reciprocity ratio is now directly a margin number: every report a builder earns by testing is one the cohort does not have to be paid for. That is the strongest argument yet for surfacing the ratio prominently to builders.

---

## 10 — Open, not decided

| Question | Owner |
|---|---|
| Rating threshold below which a tester stops receiving invitations | Nemerem + partner |
| The specific reciprocity ratio [X] and calendar date in §9 | Nemerem + partner |
| Overage pricing above the 10-report allowance — ~$3/report was indicated (above cost, self-limiting). At a $19 price this matters more, not less. | Nemerem |
| Whether the AI-insight allowance is worth enforcing at all — deferred until shadow metering has real cost data | Nemerem |
| Contractor vs employment framing of the piece-rate arrangement, in writing | **Nigerian employment lawyer** — not a question for Claude |

Pure piece work with no standing payment is a cleaner contractor posture than a monthly retainer, which begins to resemble employment. That is a real secondary benefit of this model — but it needs professional confirmation, not inference.

---

## 11 — Assumptions behind the figures

Recorded so a later reader can tell which numbers are measured and which are modelled.

| Assumption | Value | Source |
|---|---|---|
| Reports per tester per month, target | 10 | Working assumption; unmeasured |
| Time per report | ~40 minutes | Estimate; unmeasured |
| Cohort size | 20 trained | Plan |
| Reports per mission (panel size) | 5 | NN/g 5-user finding |
| Fixed infrastructure | $66/month | Priced: Vercel Pro $20, Supabase Pro $25, Resend $20, domain ~$1.25 |
| Cost per AI insight | $0.0017–$0.0103 | **Modelled** from Gemini published rates, not measured — this is what the shadow-metering work exists to replace with real data |
| Nigerian minimum wage | ₦70,000/month national, ₦85,000 Lagos | Verified Sept 2026 |
| FX | ₦1,400 = $1 | Sept 2026 |

The two figures most likely to be wrong are **reports per tester per month** and **time per report**. Both are guesses. If actual volume comes in at 3 reports/tester/month rather than 10, the activity bonus almost never triggers and the effective rate reverts to ₦1,000 — which the model tolerates without breaking. That is deliberate: the bonus is upside for testers, not a load-bearing part of the cost structure.

At $19 the margin has less absorbency than it did at $29. If the FX rate moves against the naira, or reports take materially longer than 40 minutes and the rate has to rise, the price is what gives first. Revisit §7 rather than squeezing §1.
