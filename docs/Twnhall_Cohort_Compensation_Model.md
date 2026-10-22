# Twnhall — Tester Cohort Compensation & Pricing Model

**Status:** Decided, not yet implemented
**Date:** 28 September 2026 · **Revised** 22 October 2026 (three tiers; Pro repriced; FX and infrastructure updated)
**Supersedes:** the tester-supply and Pro-pricing assumptions in `Twnhall_Monetisation_Plan_v4` §2, §3 and §7
**FX basis:** **₦1,350 = $1** — checked 22 October 2026 (official ≈ ₦1,333, parallel ≈ ₦1,357, 7 Oct). Re-check before quoting any dollar figure below.

> **This file is a mirror.** The same document lives in the Claude project as `claude/Twnhall_Cohort_Compensation_Model.md`. It is kept here so the implementation prompts in `docs/` can cite it. Update both copies together.

> **Open item from this revision:** Pro is written below at **₦30,000**, up from ₦25,000, to remove the volume discount (§7.3). If that is not wanted, the change is one line here and one in `lib/plans.ts` — but read §7.3 first, because it is the reason the tier structure works.

---

## 1 — The decision

The 20-person trained cohort is paid **per report delivered**, not on a monthly retainer or salary.

| Component | Amount | Trigger |
|---|---|---|
| **Base rate** | **₦1,000 per accepted report** | On submission |
| **Activity bonus** | **₦3,000 per month** | 10 or more reports completed in that calendar month |
| Retainer / standing payment | **₦0** | — |

A tester who completes 10 reports in a month earns **₦13,000**. A tester who completes none earns nothing and costs nothing.

**Blended cost of goods: ₦1,300 per report** — the base rate plus the bonus amortised over ten. Every price below is measured against it.

Payment is made **directly from the startup account** — bank transfers against a spreadsheet. No payment rails are built into the product. Twenty transfers a month is administration, not engineering.

### What was rejected, and why

| Rejected | Reason |
|---|---|
| ₦5,000 retainer + ₦1,000/mission | A ₦100,000/month standing obligation regardless of demand. At launch-level demand it costs more per report than any price could carry, and pays each tester ₦6,000 — which guarantees churn. |
| ₦700/report flat | Correct structure, wrong number. See §3. |
| Cutting the cohort to 10 people | Fixed infrastructure does not halve when the cohort does, so a smaller cohort needs *higher* utilisation to break even. Under piece rate the question disappears (§5). |
| Paying for the training itself | The credential is the compensation. |
| **A separate, cheaper naira price for Nigerian builders** | **See §7.4.** It cannot work here, and the reason is structural. |

---

## 2 — Why piece rate rather than retainer

The retainer's flaw was not its cost per report — it was that the cost was **fixed while revenue was not**. Piece rate converts Twnhall's largest expense into a variable one, and leaves only the infrastructure floor fixed.

**Fixed costs: $76/month** — Vercel Pro $20, Supabase Pro $25, Supabase custom domain $10, Resend $20, domain ≈ $1.25. (Up from $66: the custom domain add-on was added to stop the Google consent screen showing a `supabase.co` address.)

Everything else scales with revenue.

---

## 3 — Why ₦1,000 per report and not ₦700

Cost is not the binding constraint. **Supply is.** The rate is set as high as margin allows, not as low as testers will accept.

### The earnings reality — the real reason

| Reports/month | ₦700 | ₦1,000 | ₦1,000 + bonus |
|---|---|---|---|
| 5 | ₦3,500 | ₦5,000 | ₦5,000 |
| 10 | ₦7,000 | ₦10,000 | **₦13,000** |
| 20 | ₦14,000 | ₦20,000 | ₦23,000 |
| 30 | ₦21,000 | ₦30,000 | ₦33,000 |

At realistic early volume — 5 to 10 reports a month — ₦700 pays a trained tester ₦3,500–7,000. Against Nigeria's ₦70,000 national minimum wage that reads as insulting, even though the *hourly* rate is defensible (₦700 for roughly 40 minutes ≈ ₦1,050/hour, against a statutory floor near ₦420).

None of these is a living wage, and the model does not pretend otherwise. This is part-time piece work attached to a credential. But ₦13,000 is an offer someone repeats to a friend; ₦7,000 is one they quietly stop answering.

**₦1,000 is the ceiling, not a midpoint.** At the prices in §7 it already consumes 43% of revenue. Raising it means raising prices.

---

## 4 — What piece rate does not buy

**Availability.** Under pure piece rate nobody owes Twnhall anything. The launch-stage problem is not what a report costs — it is *whether five testers show up for a builder's mission inside 48 hours*.

Two mechanisms replace the retainer:

**The activity bonus.** ₦3,000 at ≥10 reports/month rewards consistent presence rather than existence, and costs nothing when a tester is inactive.

**A written response expectation**, agreed at training:

- Accept or decline a mission invitation within **24 hours**
- Deliver an accepted mission within **48 hours**
- Declining is fine. **Silence is what loses a builder.**

### Enforced by people, not software — for now

That expectation is a service-level agreement, and **the product cannot measure it.** Testers browse `/explore` and self-select, so no tester is ever *invited* — and with no invitation there is no clock to start.

Enforcing it needs an invitation model: invited / accepted / declined / expired, with timestamps. **Decision: not built at launch.** With 20 testers trained in person, the SLA is enforced by knowing who answers. Build it when that stops fitting in one head.

---

## 5 — Cohort sizing

**The sizing question dissolves.** With no standing obligation, an inactive trained tester costs ₦0. Train as many as training capacity allows and hold them as a bench.

Two supply floors still apply. **Both are about how many trained testers the cohort needs — neither is a rule about what a builder may publish:**

- **Five testers per mission** is the panel size that surfaces ~85% of usability problems (NN/g). Cohort-served missions are staffed to five.
- **Eight trained testers** is the practical minimum to staff one mission with redundancy for declines and no-shows.

A builder publishing against their own balance may open a mission to fewer. A Community builder with three reports publishes a three-tester mission — and must be able to, because **a five-tester floor would make the signup grant in §8 unspendable.** Say what they are trading rather than refusing: three testers find most of the obvious problems, five is where the curve flattens.

**Capacity: 200 reports/month** from 20 testers at 10 reports each. This is the ceiling on the whole business and it is what §7 is designed around.

---

## 6 — Quality control is mandatory

Piece rate pays for volume, so the cheapest way for a tester to earn more is to file more, thinner reports.

**Use the existing `test_results.rating` column.**

- **Pay on submission, never on approval.** Withholding retroactively for quality destroys trust faster than any rate dispute.
- A tester whose **rolling average rating** falls below threshold stops receiving mission invitations.
- The rule is stated **at training**, before anyone files a first report.

Threshold not yet set — see §10.

---

## 7 — Pricing — THREE TIERS

### 7.1 — The structure

| Tier | Price | Reports/month | COGS | Contribution | GM |
|---|---|---|---|---|---|
| **Community** | Free | 0 — grant + earned only (§8) | — | — | — |
| **Starter** | **₦15,000 · ~$11** | **5** | $4.81 | **$6.30** | **57%** |
| **Pro** | **₦30,000 · ~$22** | **10** | $9.63 | **$12.59** | **57%** |

Five reports is **one complete test round** — the five-tester panel. Ten is two rounds: test, fix, retest. Both are real product stories rather than arbitrary numbers.

### 7.2 — Break-even is 60 reports a month, whatever the mix

Because both tiers carry the **same contribution per report ($1.26)**, break-even does not depend on which plans people buy:

**$76 ÷ $1.26 = 60 reports a month. That is 30% of capacity.**

Expressed in customers:

| | Customers to break even | Reports used |
|---|---|---|
| All Starter | 12 | 60 |
| All Pro | 6 | 60 |
| Any mix | — | **60** |

And at full capacity the mix does not matter either: 40 Starter customers and 20 Pro customers both yield **$176/month profit** on 200 reports.

**Plan for 60 reports a month.** It is the only break-even number that does not move.

### 7.3 — Why Pro is ₦30,000 and not ₦25,000

₦25,000 for 10 reports is ₦2,500 each; ₦15,000 for 5 is ₦3,000 each. That is a volume discount, and **it has no basis here.**

Volume discounts exist when marginal cost falls with volume. Twnhall's does not — the tenth report costs ₦1,300, exactly like the first. Discounting a flat-cost product while supply-constrained means giving away margin on the input you cannot make more of.

The effect of the discount, before removing it:

| | Contribution per report | Break-even | Profit at capacity |
|---|---|---|---|
| Pro at ₦25,000 | $0.89 | 8.5 customers | $102 |
| **Pro at ₦30,000** | **$1.26** | **6.0 customers** | **$176** |

At ₦25,000, Pro was the *worse* plan for Twnhall despite the larger cheque — it consumed twice the scarce supply for less than twice the contribution. **Forty Starter customers made 73% more money than twenty Pro customers on identical capacity.**

Flattening the discount removes that distortion entirely. Both plans earn the same per report, so it stops mattering which one anyone buys.

₦30,000 (~$22) also remains below the $29 the model originally recommended, so it stays inside the affordability reasoning that moved Pro off $29 in the first place.

### 7.4 — Why there is no separate Nigerian price

The instinct — ₦10–15k locally, $19 abroad — does not survive contact with the cost of goods.

| Offer | Revenue | COGS | Contribution |
|---|---|---|---|
| ₦10,000 / 10 reports | $7.41 | $9.63 | **−$2.22** |
| ₦12,000 / 10 reports | $8.89 | $9.63 | **−$0.74** |
| ₦15,000 / 10 reports | $11.11 | $9.63 | $1.48 — 13% GM, break-even 51 customers against a 20-customer ceiling |

**Supplying 10 reports costs ₦13,000.** A ₦12,000 price is below cost; ₦15,000 needs more customers than the supply can serve.

The structural reason matters more than the arithmetic: **purchasing-power pricing works for software because marginal cost is near zero.** A US customer and a Nigerian customer cost a SaaS the same nothing to serve, so each can be charged what they will bear.

**Twnhall is not that.** It resells human labour at ₦1,300 a unit, identically regardless of who buys. For pricing purposes it is a services business, and you cannot discount below cost.

**Differentiate by size, not by region.** A bootstrapping Lagos founder takes Starter; an agency takes Pro. Same price per report everywhere, no VPN arbitrage, nothing sold below cost — and Starter doubles the customer ceiling because each one uses half the supply.

### 7.5 — Display the naira price, and keep it right

`lib/plans.ts` has been showing **"$19/month · ₦10–12k"**, which is wrong by more than half: $19 at ₦1,350 is ₦25,650. Nigerian builders have been quoted a price that was never honourable.

**Naira is the primary figure** — the first market is Nigeria — with the dollar beside it. Set both explicitly rather than computing one from the other at render time, and **date-stamp the rate in a comment**, so the next person knows when it was last true.

### 7.6 — FX now moves the margin

Costs are naira; prices are set in both. A weaker naira improves margin, a stronger one squeezes it. The move from ₦1,400 to ₦1,350 since September already cost about two points of gross margin.

**Revisit §7 if the rate moves more than 10% in either direction.** Do not squeeze §1 to absorb it.

---

## 8 — The free tier

**Community gets a one-time grant of 3 reports at signup, then earns further reports only through reciprocity.**

A standing monthly entitlement is withdrawn: under a paid cohort it would cost ₦3,900 per free user per month, recurring forever. The one-time grant costs **₦3,900 (~$2.89) once per profile** and does not compound.

Copy: *"3 reports to get you started, then 1 for every report you write as a tester."*

Two implementation rules, both load-bearing:

- **Grant per profile, not per account.** Holding both roles must not collect two grants.
- **Record the grant**, so deleting and recreating an account does not re-trigger it.

**Beyond the grant, the free tier draws on reciprocity only.** A Community user must never be served a paid cohort report.

---

## 9 — The subsidy needs an end condition

A paid human report costs $0.96. An AI insight costs $0.0017–$0.0103. **A paid report is roughly 100–500× Twnhall's other marginal cost.** It is a sound way to buy initial supply and not a cost structure to scale into.

> Cohort payments continue until the **reciprocity ratio** holds above [X] for two consecutive months, or until [date], whichever comes first.

The reciprocity ratio is directly a margin number: every report a builder earns by testing is one the cohort is not paid for.

---

## 10 — Open, not decided

| Question | Owner |
|---|---|
| Whether Pro is ₦30,000 (§7.3) or stays ₦25,000 | Nemerem — **this revision assumes ₦30,000** |
| Rating threshold below which a tester stops receiving invitations | Nemerem + partner |
| The reciprocity ratio [X] and calendar date in §9 | Nemerem + partner |
| Overage pricing above an allowance — must be **at or above ₦3,000 per report** to avoid undercutting Starter | Nemerem |
| Whether the AI-insight allowance is worth enforcing — deferred until shadow metering has data | Nemerem |
| Contractor vs employment framing of the piece-rate arrangement, in writing | **Nigerian employment lawyer** — not a question for Claude |

---

## 11 — Assumptions behind the figures

| Assumption | Value | Source |
|---|---|---|
| Reports per tester per month, target | 10 | Working assumption; unmeasured |
| Time per report | ~40 minutes | **Estimate; unmeasured.** A `startedAt` on the audit-log draft would measure it for one field and no migration. |
| Cohort size | 20 trained | Plan |
| Reports per mission (panel size) | 5 | NN/g 5-user finding |
| Blended cost per report | ₦1,300 | ₦1,000 + ₦3,000 bonus over 10 |
| Fixed infrastructure | **$76/month** | Vercel Pro 20, Supabase Pro 25, custom domain 10, Resend 20, domain 1.25 |
| Capacity | 200 reports/month | 20 × 10 |
| Cost per AI insight | $0.0017–$0.0103 | **Modelled**, not measured — shadow metering replaces this |
| Nigerian minimum wage | ₦70,000 national, ₦85,000 Lagos | Verified Sept 2026 |
| FX | **₦1,350 = $1** | 22 Oct 2026 |

The two figures most likely to be wrong remain **reports per tester per month** and **time per report**. Both are guesses, and the hourly-rate justification in §3 rests on the second.

At 57% gross margin there is more absorbency than the earlier $19/10 structure gave (49%), but the margin is still thinner than a software business and the cost of goods is in naira. If the rate has to rise, **the price moves — not §1.**
