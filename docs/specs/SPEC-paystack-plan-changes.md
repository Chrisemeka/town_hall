# SPEC: Paystack Plan Changes, Refunds, Card Updates and the Starter Business Cap

**Status:** Ready. Decided by the owner on 4 Nov 2026:

- P1, P2 and P4;
- the proration rule (§2.1), with the owner's additions: Africa/Lagos time,
  the end date excluded, the calculation stored on every refund, and duplicate
  refunds refused by idempotency;
- P3, as part of that rule;
- P5, P6 and P7, confirmed as recommended.

**Branch:** `feat/paystack-plan-changes`
**Base:** `main`, after `feat/paystack-subscriptions` (PR 2) merged on 8 Nov 2026
**Source:** `docs/TWNHALL_PAYSTACK_SUBSCRIPTIONS_PROMPT.md`, PR 3
**Migration:** `20261104_03_paystack_plan_changes.sql`. It adds three RPCs (`settle_upgrade`, `queue_refund`, `record_unwanted_charge`) and seeds three alert rules. The tables, their checks and their unique indexes are PR 1's.
**New dependency / env var:** none
**Risk:** high. An upgrade moves money both ways (a charge, then a refund),
and a downgrade switches one subscription off and another on. Every step is
ordered so that a failure part-way through leaves the builder **no worse off
than before they clicked**. That means:

- a failed upgrade keeps Starter, and refunds nothing;
- a failed downgrade ends Pro rather than charging twice;
- no refund is ever sent twice or counted before it's real.

## Summary

The owner's decisions of 4 Nov 2026:

- **Starter → Pro: immediately.** The builder pays the full Pro price through
  the normal Paystack checkout, and the unused days of Starter are refunded
  automatically (P1 b).
- **The Starter refund waits for the Pro payment.** Nothing is refunded until
  the Pro payment has succeeded and been verified. A builder whose upgrade
  fails keeps their Starter plan and their Starter payment.
- **A refund is never assumed to be done.** It's a request with its own status:
  - its status is tracked until Paystack says `processed`;
  - one that is pending or failed is shown and handled;
  - one that fails reaches a person.
- **No duplicate refunds,** whether a webhook is redelivered, the return page
  and the webhook race, a request times out, or two runners overlap.
- **Pro → Starter: from the next billing period.**
- **No in-app undo** of a cancellation or a scheduled downgrade (P2).
- **A warning at ₦6,000,000** of the ₦8,000,000 Starter Business cap (P4).

This PR also adds:

- **Update card**, through Paystack's hosted page;
- **admin refunds**;
- **automatic full refunds of unwanted charges**:
  - a *stray charge*, meaning a renewal on a subscription Twnhall has already
    ended;
  - a *duplicate charge*, meaning a second paid checkout for a plan the
    builder already has.

When it merges, the prompt's go-live checklist moves Production to live keys.

## §0 — Verified before writing this

- **PR 1:**
  - `subscription_payments` (unique reference);
  - **`subscription_refunds`**, which has:
    - one row per refund with its own status;
    - a unique `idempotency_key`;
    - the stored calculation columns, with the
      `upgrade_refund_explains_itself` check;
    - partial unique indexes allowing at most one live refund per cause and
      reason, and one live upgrade refund per original payment;
  - the clamp rule every refund creator follows: refundable = amount less
    every refund that isn't `failed`, under a lock on the payment;
  - `billing_actions`, with a unique `idempotency_key`;
  - `apply_subscription` with `p_actions`, inserted **in the same transaction**
    as the payment and only on `'ok'`, never on `'duplicate'`. It never
    creates a refund itself.
  - PR 2's checkouts reuse an open one, so a double-click or a second tab
    lands on the same Paystack page.
- **PR 2:**
  - `startSubscription(planId, kind)` and its `replaces_subscription_id`;
  - `settleCharge()` (the only place a charge becomes a plan, and it validates
    status, currency, plan and amount);
  - `cancelSubscription()`;
  - `runBillingActions()`, which claims a lease before calling Paystack;
  - the cron's `scheduled`, `expired` and `reconcile` steps;
  - `GRACE_DAYS = 3`;
  - the Settings → Plan states;
  - the `billing_mismatch` and `billing_actions_failing` alerts.
- **Paystack has no plan switch and no proration.** You switch one
  subscription off and create another. This PR uses:

  | Call | Notes |
  |---|---|
  | `POST /subscription` | `customer`, `plan`, `authorization`, `start_date` |
  | `GET /subscription/:code` | Its `authorization`, `email_token`, `next_payment_date` and `customer` |
  | `GET /subscription/:code/manage/link` | Paystack's hosted page, where the customer can update a card or cancel |
  | `POST /refund` | `transaction`, plus an optional `amount` for a partial refund. It can't exceed the transaction. |
  | List refunds, fetch refund | To look up what Paystack already has |

  **Refund statuses:** `pending`, `processing`, `needs-attention`, `failed`
  and `processed`, each with a webhook (`refund.*`). A processed refund can
  take up to 10 business days to reach the customer. A failed one is credited
  back to the merchant's Paystack balance.

  **Confirmed in test mode, 8 Nov 2026** (one ₦100 refund on a test charge):
  - **Create Refund keeps `merchant_note`.** It comes back on create, on
    `GET /refund/:id` and in the list. §3.3 matches on it.
  - **List Refunds filters on the transaction's numeric id**, as
    `?transaction=<id>`. A reference answers 200 with an empty list: the same
    trap as the subscription list. So `listRefunds()` resolves the id through
    `verify` first. Create Refund accepts the reference.
  - **A charge names no subscription,** in the webhook or in `verify`. But
    `GET /subscription/:code` lists the subscription's `invoices`, each with
    its transaction `reference`. That is how a charge is matched to the
    subscription that made it: renewal, a scheduled Starter's first charge
    (§4), or a stray (§7). PR 2's review found that the code-based guard never
    ran, because renewals carry no code.

  **Confirmed in test mode, 8–10 Nov 2026** (§11 runs):
  - **Webhooks can be very late, or never arrive.** One day's events landed
    about 35 minutes after the charges, and one stray charge's
    `charge.success` was never delivered and had to be replayed. A stray is
    noticed only through its webhook or the reconcile.
  - **A second paid checkout on the same plan makes no second subscription.**
    Paystack charged it, but the customer kept the one subscription whose
    invoices list only the first reference. So the duplicate's refund is the
    whole fix; `switchOffUnwanted()` stays for the case where Paystack does
    create one.
  - **Disabling a subscription sends `subscription.not_renew` at once**, often
    before the caller's next write. That is why Switch to Starter marks Pro
    `switching` first.
- **Allowance** (`lib/allowance.ts`, unchanged):
  - the monthly pool is per **calendar month**;
  - `monthly = plan.monthlyReports + this month's reservations`;
  - so an upgrade raises **this month's** total to Pro's 10, counting reports
    already used this month;
  - a downgrade lowers it to Starter's 5;
  - reserved slots stay reserved either way.
- A manual (payment-link) plan has no change controls (owner decision 3,
  PR 2).

**Decided while building, 8 Nov 2026:**

- **`lagosDay()` lives in `lib/proration.ts`,** beside the rule it serves,
  not in `lib/subscriptions.ts`.
- **Renewals are told apart by the charging subscription's own invoices**
  (§0). A charge on the active plan while a cancellation or downgrade waits is
  a stray too: the plan had stopped renewing, so it's refunded (B4).
- **PR 2's review findings fixed here:** the cron asks Paystack for lost
  charges before it lapses a Paystack plan (`recoverLostCharges()`); the
  stray guard works without a code on the charge; a first charge, Cancel and
  the reconcile attach only the subscription whose invoices name the payment,
  never "the newest live one"; and the return page says a duplicate is being
  refunded rather than "started". **Still open, not blocking live keys:** Cancel
  in `attention` names a date already past; a signed-out visitor from /pricing
  lands on the dashboard after login; Cancel racing its own webhook can send two
  emails.
- **A late `subscription.create` for a duplicate charge's own subscription**
  is switched off when its invoices name a payment recorded as duplicate or
  stray, because the code may not have been known when the charge was recorded.
- **Cancelling before a downgrade's Starter was created** marks the queued
  `create_subscription` done, and the runner checks the scheduled row still
  exists before creating anything. A creation whose answer was lost is adopted,
  not made twice.
- **`subscription.expiring_cards` may email twice on a redelivery.** Paystack
  sends it monthly; a second copy is the worst case.
- **`/refunds` says "Last updated: November 8, 2026".** Change it to the merge
  date if it merges later.

## §1 — Decisions

| # | Decision | Status |
|---|---|---|
| **P1** | What an immediate upgrade costs | **Decided 4 Nov: (b).** Full Pro price now through the normal checkout; the billing date moves to the day of the upgrade; unused Starter days refunded automatically, **only after the Pro payment succeeds**. |
| **P2** | In-app undo of a cancellation or scheduled downgrade | **Decided 4 Nov: no.** |
| **Rule** | The proration rule (§2.1) | **Decided 4 Nov**, with the owner's additions: Africa/Lagos time; the end date excluded; the calculation stored on every upgrade refund; duplicates refused by idempotency. |
| **P3** | Refund rounding | **Decided 4 Nov, as part of the rule:** whole naira, rounded down. Nothing is sent at ₦0. |
| **P4** | Starter Business cap warning | **Decided 4 Nov: ₦6,000,000.** |
| **P5** | An admin refund can also end the plan now | **Confirmed: yes**, as a checkbox, off by default. Ending it switches renewal off at Paystack. |
| **P6** | What the builder is told about a refund | **Confirmed: §3.5.** An email when it starts, when it's processed, and if it fails. Never "refunded" before it is. |
| **P7** | A charge on a subscription Twnhall already ended | **Confirmed: §7.** Refund it in full automatically, switch the subscription off again, and alert. That's B4's "charged after you cancelled", without waiting for a person. |

## §2 — Starter → Pro, immediately

### 2.1 — The proration rule

> **We refund Starter for the whole days left in your billing period after the
> day you upgrade, at the daily rate you paid.** Days are counted in Lagos
> time. Your billing period starts on the day you paid and ends the day before
> your next billing date. The day you upgrade counts as a Starter day. Reports
> you used on Starter don't change the refund.

**Rule version `proration-v1`.** Every term is defined here and stored on the
refund row (PR 1's columns).

**1. Timezone: `Africa/Lagos`, exactly.**

- Every date in this rule is the calendar date of a stored timestamp in the
  IANA zone `Africa/Lagos`.
  - In SQL: `(ts at time zone 'Africa/Lagos')::date`.
  - In TypeScript: `Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" })`.
    That's one helper, `lagosDay(instant)`, next to `lagosDate()` in
    `lib/subscriptions.ts`.
- **Never the server's local time.** Vercel runs on UTC. A Pro payment at
  00:30 Lagos on 14 Nov is 23:30 UTC on 13 Nov, so a UTC date would refund
  ₦10,000 instead of ₦9,500.
- **Never a fixed +1 hour shift either.** Lagos has no daylight saving today,
  but the named zone is what the rule says. `monthOf()`'s fixed shift stays as
  it is for the allowance, with its comment.

**2. The period: start included, end excluded.**

- The billing period is `[period_start_on, period_end_on)`.
- `period_end_on` is the Lagos date of the next billing date, which belongs to
  the **next** period because that's the day Paystack charges again.
- A period paid on 4 Nov with the next charge on 4 Dec covers **4 Nov to 3 Dec
  inclusive: 30 days**.

  `days_in_period = period_end_on − period_start_on`

  (30 for 4 Nov → 4 Dec; 28 for a February period.)

**3. The upgrade moment: the Pro charge's `paid_at`.**

- It's Paystack's timestamp, not the time our code runs. The return page and
  the webhook therefore get the same answer, however late either arrives.
- `upgrade_on` is its Lagos date.
- **The Starter payment refunded** is the one whose period contains
  `upgrade_on`: `period_start_on ≤ upgrade_on < period_end_on`. If none does,
  the refund is ₦0. That covers a renewal that failed (`attention`) and a
  period already over.

**4. Refundable days.**

- The upgrade day counts as used, so the refundable days run from the day
  after `upgrade_on` up to, but excluding, `period_end_on`:

  `refundable_days = period_end_on − upgrade_on − 1`

- For an upgrade on 14 Nov, that's 15 Nov to 3 Dec: 19 days.

**5. Base.**

- `base_ngn` = what's still refundable on that Starter payment: `amount_ngn` −
  Σ its refunds that aren't `failed`.
- It's read **under a lock on the payment row**. Normally it's the full
  ₦15,000, and it's less only if part has already been refunded.

**6. Amount.**

- `amount_ngn = ⌊ base_ngn × refundable_days ÷ days_in_period ⌋`, in whole
  naira, rounded down (P3).
- At ₦0, no refund row is created.

**The database is the authority.** `settle_upgrade` (§2.2) computes steps 1–6
in SQL inside the transaction that records the Pro payment, and stores every
term. The `upgrade_refund_explains_itself` check (PR 1) refuses a row whose
numbers don't agree with each other. `lib/proration.ts` mirrors the same rule
in TypeScript, but only for the upgrade sheet's estimate; nothing it computes
is ever sent to Paystack. Both are tested against the table below. If the two
ever disagree, the stored row wins, because that's what was refunded.

**Worked examples** (Starter, ₦15,000, paid 4 Nov, next charge 4 Dec, so the
period is 4 Nov – 3 Dec, 30 days). These become the tests:

| Pro paid at (Lagos) | `upgrade_on` | Refundable days | Refund |
|---|---|---|---|
| 4 Nov, 15:00 (same day as paying) | 4 Nov | 29 (5 Nov – 3 Dec) | ₦14,500 |
| 14 Nov, 10:00 | 14 Nov | 19 (15 Nov – 3 Dec) | ₦9,500 |
| **14 Nov, 00:30** (13 Nov, 23:30 UTC) | **14 Nov** | **19** | **₦9,500**, not ₦10,000 |
| 13 Nov, 23:59 | 13 Nov | 20 | ₦10,000 |
| 3 Dec, 20:00 (last day of the period) | 3 Dec | 0 | ₦0, no refund |
| 4 Dec, 08:00, before Paystack's renewal that morning | 4 Dec | — (4 Dec is outside `[4 Nov, 4 Dec)`) | ₦0 |
| 5 Dec, after the 4 Dec renewal failed | 5 Dec | — (no paid period contains it) | ₦0 |
| 14 Nov, Starter already cancelled | 14 Nov | 19 | ₦9,500. Those days were paid for. |
| 14 Nov, after an admin refunded ₦3,000 | 14 Nov | 19 | ⌊12,000 × 19 ÷ 30⌋ = ₦7,600 |
| A February period, 1 Feb → 1 Mar, upgrade 10 Feb | 10 Feb | 18 (of 28) | ⌊15,000 × 18 ÷ 28⌋ = ₦9,642 |

**What's stored on the refund row** (PR 1's columns), so it explains itself
without any recalculation:

| Column | Holds |
|---|---|
| `original_payment_reference` | The Starter payment refunded, i.e. the `transaction` sent to Paystack |
| `causing_payment_reference` | The Pro payment's reference |
| `upgrade_at` | The exact moment of the Pro payment, with `upgrade_on` its Lagos date |
| `period_start_on`, `period_end_on` | Lagos dates; the end is excluded |
| `days_in_period`, `refundable_days` | |
| `base_ngn`, `amount_ngn` | |
| `rule_version` | `proration-v1` |
| `status` | The life cycle in §3 |

**Why days and not reports:** a builder can see days on a calendar, and the
rule fits in one sentence on `/refunds`. Reports are already bounded by the
calendar-month pool. After an upgrade, this month's total is Pro's 10,
**including** reports already used. So a builder can't take five Starter
reports and then ten more Pro reports in the same month.

### 2.2 — The flow, and its guarantees

**Who sees "Upgrade to Pro":** a `paystack` Starter row that is renewing,
cancelled or in `attention`. A **manual** row doesn't (owner decision 3).

**The sheet** gives the estimate from `lib/proration.ts` at today's Lagos date.
It says "about" because the final figure uses the moment Paystack takes the Pro
payment, and is computed by the database.

> **Upgrade to Pro — ₦30,000 a month.**
> You pay ₦30,000 now and Pro starts as soon as the payment goes through. Your
> reports for this month go up to Pro's 10, counting any you've already used.
> **Once your Pro payment has gone through,** we refund about ₦{refund}, for
> the {N} days of Starter you won't use, to the card you paid with. We'll email
> you when the refund starts and when it's done; your bank may take up to 10
> business days to show it. Pro renews on the {Nth} of every month until you
> cancel.
> If the payment doesn't go through, nothing changes: you stay on Starter.
> **[Continue to payment]**

- **In `attention`:** the refund line becomes "There's no refund, because your
  last Starter payment didn't go through."
- **At ₦0:** the line becomes "There are no unused Starter days to refund."

**`startSubscription("pro", "upgrade")`:**

- `replaces_subscription_id` is the Starter row.
- PR 2's §2 refuses an active `paystack` row. Allow it here for exactly this
  case: `kind === "upgrade"`, from Starter, to Pro.
- **Nothing about Starter changes here.** It isn't disabled, and nothing is
  refunded or queued. An abandoned or declined checkout leaves Starter exactly
  as it was, still renewing.

**In `settleCharge()`, a first charge of kind `upgrade`**, after PR 2's
validation (success, NGN, ₦30,000, the Pro plan code, the checkout's own
profile):

1. Call **`settle_upgrade`**, a new RPC and **one transaction**. It runs these
   steps in order:
   1. `perform … for update` on the account. A concurrent second delivery
      waits here.
   2. `v := apply_subscription('start', pro, <the Pro payment and provider fields>, p_actions => [disable_subscription for the Starter Paystack subscription, key 'disable:<starter code>'])`.
      - If `v` isn't `'ok'` (in particular `'duplicate'`), **return `v`
        and do nothing else**. No refund is computed or inserted.
      - Otherwise Starter has ended (`cancelled`), any scheduled
        cancellation has been dropped, Pro has started, the Pro payment is
        recorded, and the disable is queued.
   3. Find the Starter payment whose period contains `upgrade_on` (§2.1.3),
      and `select … for update` it.
   4. Compute §2.1 steps 1–6 in SQL, and read `base_ngn` under that lock.
   5. If the amount is above ₦0, insert the refund with every stored term:
      `reason 'upgrade'`, `idempotency_key 'upgrade:<pro reference>'`,
      `causing_payment_id`, both references, `rule_version 'proration-v1'`.
      The insert is `on conflict do nothing`.
   6. Return `'ok'`, plus the refund amount (0 when none).
2. After it commits, run the queue (`after()`): the Starter disable, and the
   refund (§3).
3. Email "You're on Pro": the charge, the refund amount with "we'll email you
   when it starts", and the next renewal date.

`settle_upgrade` is the only code path that creates an upgrade refund.

**What this guarantees:**

| Requirement | How |
|---|---|
| **No refund before Pro succeeds** | The refund row exists only inside the transaction that records a **verified** Pro payment. Nothing earlier in the flow (the sheet, the checkout, the return page before verification) can create one. |
| **The customer can't lose the Starter payment without upgrading** | Until that transaction commits, Starter is untouched and renewing. If the transaction fails, it rolls back whole, and the webhook's redelivery tries again. |
| **Repeated requests can't issue a second refund** | Four layers, each enough alone: **(1)** a redelivered webhook or a return page racing it meets the Pro payment reference under the account lock, so `apply_subscription` returns `'duplicate'` and `settle_upgrade` stops before the refund; **(2)** the unique `idempotency_key` `upgrade:<pro reference>`; **(3)** the unique index on `(causing_payment_id, reason)`, one live upgrade refund per Pro payment; **(4)** the unique index on `payment_id` for upgrades, one live upgrade refund per Starter payment, so even a second, different Pro payment can't refund the same Starter twice. |
| **Repeated requests can't charge twice** | PR 2 reuses an open checkout. A second paid checkout that still gets through is a *duplicate charge* (§7): refunded in full, its subscription switched off, and it never reaches `settle_upgrade`. |
| **Never more than was paid** | `base_ngn` is read under the payment's lock as amount − every refund that isn't `failed`, so an in-flight refund reserves its amount. |
| **The amount doesn't drift, and explains itself** | It's computed once, by the database, from `paid_at`, and stored with every term of the calculation (§2.1). A retry sends the stored amount and never recomputes it. The check constraint refuses a row whose numbers disagree. |

## §3 — Refunds: life cycle, duplicates, failures

This is one mechanism for every refund: upgrade, admin (§6), and stray or
duplicate charge (§7). It's `runRefunds()` in `lib/paystack/refunds.ts`, run
through `after()` when a refund is queued and in the daily cron's `refunds`
step.

**The idempotency strategy, end to end.** A refund can be asked for many times
and is sent once.

| Layer | Stops |
|---|---|
| **Creation, under locks:** the payment reference checked under the account lock; `base_ngn` read under the payment lock | A redelivered webhook, or the return page racing it, creating anything twice |
| **The unique `idempotency_key`:** `upgrade:<pro ref>`, `admin:<dialog uuid>`, `stray:<ref>`, `duplicate:<ref>`, `<key>:retry-<n>` | The same request arriving twice: a double-click, a resubmitted form, a retried job |
| **Partial unique indexes** (PR 1): one live refund per cause and reason; one live upgrade refund per Starter payment | A second refund for the same thing under a *different* key, e.g. a bug, or a second Pro payment |
| **The lease** (§3.2) | Two runners (`after()` and the cron) sending the same row |
| **Look up before resending** (§3.3) | A request Paystack received but whose answer we lost being sent again |
| **The stored amount** | A retry sending a recomputed, different figure |

Paystack's refund call doesn't take an idempotency key we could confirm, so
the last two layers are what protect the call itself.

### 3.1 — States

| Status | Meaning | Counts toward |
|---|---|---|
| `queued` | Recorded; not yet sent to Paystack | Reserved (clamp) |
| `sending` | A runner holds the lease and is calling Paystack | Reserved |
| `unknown` | Sent, but the answer never came (timeout, 5xx, a refusal that might mean "already done") | Reserved |
| `pending`, `processing` | Paystack accepted it | Reserved; "on its way" |
| `needs_attention` | Paystack needs something (e.g. bank details) | Reserved; alert |
| `processed` | Paystack says the money has gone back | **Refunded.** MRR, billing record, emails. |
| `failed` | Paystack couldn't return it; the money is back in Twnhall's Paystack balance | Released; alert |
| `settled_outside` | An admin paid it back by bank transfer and recorded it | Refunded (paid back outside Paystack) |

**Only `processed` and `settled_outside` ever read as "refunded",** anywhere:
MRR, the billing record, `/admin/money`, emails and Settings. A status never
moves out of `processed`, `failed` or `settled_outside`. Webhooks and lookups
only move a refund **forward**, in this order: queued → sending → unknown →
pending → processing → needs_attention → processed or failed.
`needs_attention` may still go on to `processing` or `processed`.

### 3.2 — Sending, exactly once

**Claim.** `update subscription_refunds set status = 'sending', claimed_until = now() + interval '5 minutes', attempts = attempts + 1 where id = $1 and status = 'queued' and (claimed_until is null or claimed_until < now()) returning *`.

- No row back means another runner has it. Stop.
- The `after()` run and the cron can't both send.

**Send.** `createRefund({ transaction: <payment reference>, amountNgn: <stored amount>, merchantNote: <idempotency_key> })`.

- If `merchant_note` isn't accepted (§0), send without it.

| Paystack answers | Do |
|---|---|
| 2xx | Store `paystack_refund_id`; status from the response (`pending`, `processing` or `processed`). |
| Timeout, network error, 5xx, 429 | → **`unknown`**. **Never conclude anything about money from a request whose answer we didn't see.** |
| 4xx | → **`unknown`** too, then look up at once (§3.3). A refusal like "already refunded" or "exceeds amount" can mean an earlier attempt succeeded. Only when the lookup finds nothing does it become **`failed`**, with Paystack's message in `last_error`. |

### 3.3 — Look up before resending

For a row in `unknown`, every run looks it up before doing anything else:

- List the transaction's refunds at Paystack.
- **Match** on `merchant_note == idempotency_key` when Paystack keeps it.
  Otherwise match on the same amount, created after the row's `created_at`,
  and not already linked to another of our rows by `paystack_refund_id`.
- **Match found:** adopt its id and status. This is the case the lookup exists
  for.
- **No match, and the last attempt was over 10 minutes ago:** back to `queued`
  for one more send. **After 3 attempts with no match,** stop and alert
  (§8). A person decides.

### 3.4 — Webhooks and reconciliation

- `refund.pending`, `refund.processing`, `refund.needs-attention`,
  `refund.processed` and `refund.failed` find the row by
  `paystack_refund_id`.
- If the id isn't known yet, they find it through the transaction plus the
  §3.3 match, then adopt the id.
- They then move it **forward only** (§3.1). A redelivered or out-of-order
  event changes nothing. A refund event that matches none of our rows is
  recorded as `unmatched` (PR 2's `billing_mismatch`).
- The daily cron's **`refunds`** step:
  - fetches every refund in `pending`, `processing` or `needs_attention` not
    updated for 24 hours, so a lost webhook can't strand one;
  - re-runs `unknown` lookups.

### 3.5 — What the builder is told (P6)

One email per status the builder can see, sent once.
`subscription_refunds.notified_status` (PR 1) records the last status emailed,
so a redelivered webhook sends nothing.

| Status reached | Email |
|---|---|
| `pending` or `processing` (first time) | "**Your refund of ₦X has started.** It's for {reason in words}. Your bank may take up to 10 business days to show it after it's processed. We'll email you again then." |
| `processed` | "**Your refund of ₦X has been processed.** It's on its way to the card you paid with." |
| `failed` | "**We couldn't send your refund of ₦X automatically.** We'll pay it back another way within two business days and email you when it's done." (B11) |
| `settled_outside` | "**We've paid back ₦X by bank transfer.**" |

`queued`, `sending`, `unknown` and `needs_attention` send nothing to the
builder. They're our problem, not theirs. `needs_attention` alerts an admin.

**Settings → Plan** shows any refund that isn't finished: "Refund of ₦9,500
for Starter: on its way (started 14 Nov)" or "…: we're sorting this out". It
disappears 30 days after it's done.

### 3.6 — When a refund fails

- **Alert** `refund_failed` (critical, §8) and the builder email (§3.5).
- On `/admin/accounts/[id]`, the refund shows **"Try again"** and **"Mark paid
  outside Paystack"**:
  - **Try again** creates a **new** row, key `<original key>:retry-<n>`,
    through `queue_refund` (§6), so the clamp applies again. The failed row is
    released (the unique indexes exclude `failed`), so it doesn't block.
    - For an **upgrade** refund, the new row copies the stored calculation:
      references, `upgrade_at`, dates, days and `rule_version`. Only
      `base_ngn` is re-read under the lock, so the check constraint holds and
      the amount is the same unless something else was refunded meanwhile.
    - A failed refund is **never** retried automatically.
  - **Mark paid outside Paystack** records `settled_outside` with the amount,
    the transfer reference and a note. The payment is then refunded in our
    books.

## §4 — Pro → Starter, at the next billing period

**Who sees "Switch to Starter":** a renewing `paystack` Pro row with no
scheduled change.

**The sheet:**

> **Switch to Starter?**
> You keep Pro until {period_end}. From {period_end}, Starter is ₦15,000 a month
> on the card ending {last4}, renewing on the {Nth} until you cancel. There's no
> refund for the rest of this Pro month: you keep Pro until it ends.
> **[Switch to Starter]** [Keep Pro]

**`scheduleDowngrade()`** (`actions/billing.ts`):

1. Run `requireAccount("builder")`, apply the rate limit, and check the state
   above.
2. `fetchSubscription(proCode)` gives the `authorization`,
   `next_payment_date`, `email_token` and customer.
   - If `authorization.reusable` is false, refuse: *"Your card can't be charged
     automatically. Cancel Pro, then subscribe to Starter when it ends."*
3. **Switch Pro off first:** `disableSubscription(pro)`.
   - If this fails, show an error and change nothing.
   - With Pro off, any later failure leaves a plan that **ends**, never one
     that charges twice.
4. **Create Starter:**
   `createSubscription({ customer, plan: starterCode, authorization, startDate: next_payment_date })`.
   - **On success:** `apply_subscription('schedule', starter, <the new subscription's provider fields>)`,
     then email.
   - **On failure:** `apply_subscription('schedule', starter, p_actions: [create_subscription])`,
     with key `create:<pro code>`. The payload holds the **Pro** code, and the
     retry fetches the authorization again, so no authorization code is ever
     stored. The builder sees the downgrade as scheduled.
     `billing_actions_failing` fires if it isn't done within 24 hours.

**At the billing date,** Starter's first charge arrives as `charge.success`.
`settleCharge()`'s "scheduled change" case applies it:

- The subscription code matches the scheduled `paystack` row.
- It calls `apply_subscription('apply', p_subscription_id, payment, p_period_end = next_payment_date)`.

Pro ends in the same transaction.

**Cron:**

- The **`scheduled`** step skips scheduled `paystack` rows for a paid plan.
  Their charge applies them, not the clock.
- The **`expired`** step keeps a Pro row past `period_end` while its scheduled
  Starter is within `GRACE_DAYS`. After that, with no Starter charge, it calls
  `apply_subscription('end', expired, p_actions: [disable_subscription for Starter])`,
  cancels the scheduled row, and emails *"Starter didn't start because the
  payment didn't go through. Subscribe again from Settings."*

**Cancel while a downgrade is scheduled** (extends `cancelSubscription()`):

- **Disable the scheduled Starter subscription first.** If that fails, change
  nothing.
- Then `schedule community`, which replaces the Starter row. Pro is already off
  at Paystack.
- The sheet says: *"You won't be charged again. You keep Pro until {date}."*

## §5 — Update card

- **Settings → Plan:** an **"Update card"** button on renewing and `attention`
  `paystack` rows. It points at
  `app/(developer)/settings/billing/card/route.ts`, which runs
  `requireAccount("builder")`, calls `manageLink(code)` and returns a 303 to
  Paystack's page.
- **A fresh link on every click.** Paystack's links expire, so they're never
  stored or emailed.
- **Paystack's page can also cancel.** PR 2's `not_renew` and `disable`
  handling keeps Settings and the emails right.
- **`subscription.expiring_cards`:** for each matching renewing row, email "The
  card ending {last4} expires this month. Update it so {Plan} keeps renewing,"
  linking `/settings/billing/card`.
- **It doesn't save a payment that has already failed.** Paystack doesn't
  retry within the cycle, so in `attention` the main button stays **"Pay now"**
  (PR 2, §9).

## §6 — Admin refunds

**`/admin/accounts/[id]`** gets a **Payments** panel. Each payment shows its
date, kind, source and amount, and under it its refunds, each with amount,
status in words, reason and dates. Each payment has a **"Refund"** button.

**The dialog:**

- **Amount:** defaults to what's still refundable; whole naira.
- **Reason:** required. It's internal and never emailed.
- **"Also end the plan now and switch off renewal"** (P5): a checkbox, off by
  default.
- **A hidden `refund_key`**, a UUID generated when the dialog opens. A
  double-click or a resubmitted form carries the same key, so it makes **one**
  refund.

**`queue_refund(p_payment_id, p_amount_ngn, p_reason, p_key, p_note, p_status default 'queued')`**
is a new RPC:

- It locks the payment row (`for update`) and clamps to what's refundable,
  using the same rule as PR 1.
- It inserts with `on conflict (idempotency_key) do nothing`.
- It returns the row, or `'nothing_refundable'`.

It's the one way to create a refund outside `apply_subscription`.

**`refundPayment()`** (`actions/admin/billing.ts`, `requireAdmin()`):

- **`paystack` payment:** `queue_refund(…, key 'admin:<refund_key>')`, then
  `runRefunds()` at once. From there, §3 handles it.
- **`manual` payment:** the money goes back by bank transfer, outside the app.
  `queue_refund(…, p_status 'settled_outside')` records it, with the transfer
  reference in the note.
- **With the checkbox:**
  `apply_subscription('end', cancelled, p_actions: [disable for the active and any scheduled subscription])`.
- It records `billing.refunded` (add the name to `EVENT_NAMES`) with the
  admin's id.
- The builder hears through §3.5. A refund isn't announced as done until it
  is.

## §7 — Unwanted charges: stray and duplicate (P7)

There are two charges the builder didn't intend, and both are refunded in full
automatically.

| Kind | Recognised by | Means |
|---|---|---|
| **Stray** | A `charge.success` whose subscription code belongs to one of **our** rows that is `cancelled` or `expired` | A disable didn't land. It's a charge after the plan ended: B4 in `/refunds`. |
| **Duplicate** | PR 2's `duplicate_charge`: a paid checkout for a plan the account already has from a **different** checkout | Two tabs or a superseded page were both paid. This includes a second Pro payment during an upgrade. **It never reaches `settle_upgrade`, so it can't trigger a second Starter refund.** |

**`record_unwanted_charge(p_reason, p_reference, p_profile_id, p_amount_ngn, p_subscription_code)`**,
where `p_reason` is `'stray_charge'` or `'duplicate_charge'`. One transaction:

- Inserts the payment (`kind 'stray'` or `'duplicate'`). The reference is
  unique, so a redelivery returns `'duplicate'` and stops here.
- Queues a **full** refund:
  - `reason` = `p_reason`;
  - `payment_id` and `causing_payment_id` both = this payment;
  - key `stray:<reference>` or `duplicate:<reference>`.

  The unique index on `(causing_payment_id, reason)` also allows only one.
- Queues `disable_subscription` for that subscription. The key is
  `disable:<code>`, or `disable:<code>:<reason>-<reference>` if the plain key
  already exists. For a duplicate, the code comes from the charge, or from
  `listSubscriptions` when Paystack hasn't sent it yet.
- Changes no plan.

The event's outcome is `stray` or `duplicate_charge`, and `billing_mismatch`
fires. It's critical: either a disable failed or a builder paid twice.

The builder hears through §3.5. The "started" email says why: "Your refund of
₦X for a payment you didn't need to make has started."

**A code that matches none of our rows is not refunded automatically.** It
stays `unmatched` for a person. Twnhall can't be sure that money is its own to
return.

## §8 — The Starter Business cap, and the alerts

**`lib/paystack/config.ts`:** `STARTER_BUSINESS_CAP_NGN = 8_000_000`, with a
comment naming Paystack's support article and the date it was checked.

**`/admin/money`:**

- Collections to date = Σ `amount_ngn` of `paystack` payments, **gross**.
  Whether refunds give room back under Paystack's limit isn't documented, so
  count conservatively.
- Show "₦X of ₦8,000,000 (Paystack Starter Business limit)" while
  `MERCHANT.registration` is null.
- Also show refunds in flight (PR 1).

**Alerts** (in the migration, `on conflict (key) do nothing`):

| Key | Severity | Threshold | Fires when |
|---|---|---|---|
| `paystack_cap_near` | warning | **6,000,000** (P4) | Gross Paystack collections pass it. "Register with CAC and upgrade the Paystack account before ₦8,000,000, when Paystack stops taking payments and every renewal fails." |
| `refund_failed` | critical | — | Any refund `failed` or `needs_attention`. "A refund didn't reach the builder. Try again or pay it back outside Paystack, and record it." |
| `refund_stuck` | critical | — | Any refund in `queued`, `sending` or `unknown` for more than 1 hour, or in `pending` or `processing` for more than 14 days. "A refund hasn't moved. Look it up in the Paystack dashboard." |

## §9 — Copy and rules

- **`/refunds` §Refunds** gains a bullet, in the policy's voice:
  > If you move from Starter to Pro, we refund Starter for the whole days left
  > in your billing period after the day you upgrade, at the daily rate you
  > paid, rounded down to the naira. Days are counted in Lagos time. A billing
  > period runs from the day you paid up to the day before your next billing
  > date. For example, a period paid on 4 November covers 4 November to 3
  > December, so upgrading on 14 November refunds 19 of its 30 days. It's
  > automatic and goes back to the card you paid with. It only starts once
  > your Pro payment has gone through. We email you when it starts and when
  > it's done.

  And one sentence for every refund: "**We only tell you a refund is done when
  Paystack confirms it.** If one can't be sent automatically, we pay it back
  another way within two business days."
- **`/refunds` §Cancelling** gains:
  > To move to a smaller plan, use Switch to Starter in Settings. It takes
  > effect when your current period ends, and the new price starts then.

  Last updated: the merge date.
- **`/pricing` FAQ, "Can I switch plans?":**
  > Move up to Pro any time. It starts as soon as your payment goes through,
  > your reports for the month go up to Pro's 10, and we refund the unused days
  > of Starter. Moving down to Starter takes effect at your next billing date.
- **Settings → Plan** (PR 2's §12 table gains):

  | State | Added |
  |---|---|
  | Starter, renewing or cancelled | **Upgrade to Pro** |
  | Starter, `attention` | **Upgrade to Pro**, beside "Pay now" |
  | Pro, renewing | **Switch to Starter** |
  | Pro with Starter scheduled | "Pro until {date}, then Starter at ₦15,000 a month." Cancel only. |
  | Any renewing or `attention` row | **Update card** |
  | Any unfinished refund | Its line from §3.5 |

- **CLAUDE.md, Payments, gains:**
  - a plan change switches a Paystack subscription off **before** it creates
    another;
  - **a refund is created only by `settle_upgrade`, `queue_refund` or
    `record_unwanted_charge`**, in the transaction of the payment that causes
    it, or under the payment's lock;
  - proration is `proration-v1`: Africa/Lagos dates, the period
    `[start, end)`, the upgrade day counted as used, whole naira rounded down.
    The database computes it and stores every term;
  - it is sent only by a runner holding its lease, looked up before it's ever
    resent, and called "refunded" only at `processed` or `settled_outside`;
  - no authorization code is stored;
  - the Starter Business cap is watched.

## §10 — Tests

**`lib/__tests__/proration.test.ts`:**

- every row of §2.1's examples, including the 00:30 Lagos case;
- `lagosDay()` with the **process timezone set to UTC and to
  America/Los_Angeles** (`process.env.TZ`): the same Lagos dates;
- the end is excluded: an upgrade on the next billing date's Lagos date gives
  ₦0;
- base reduced by a prior refund;
- ₦0 creates nothing.

**`lib/__tests__/paystackPlanChangesMigration.test.ts`**, in the shape of
`closedMigration.test.ts`. It pins in `settle_upgrade`:

- the account lock comes first;
- `apply_subscription` is called, and the function returns before the refund
  insert on anything but `'ok'`;
- the Starter payment is locked `for update` before `base_ngn` is read;
- `at time zone 'Africa/Lagos'` is used for all three dates;
- `period_end_on - upgrade_on - 1` and the integer formula;
- `rule_version 'proration-v1'`;
- `on conflict do nothing`.

It also pins `queue_refund` and `record_unwanted_charge` locking the payment,
and grants to `service_role` only.

**`lib/__tests__/paystackCharges.test.ts`:**

- An abandoned or declined upgrade checkout changes nothing: no refund row, no
  disable, Starter still active.
- A verified upgrade charge in one call:
  - starts Pro and ends Starter;
  - records the Pro payment;
  - queues `disable:<starter>`;
  - queues a refund with the §2.1 amount from `paid_at`.
- **The same charge delivered twice, and the return page racing the webhook:**
  one payment, one refund row, one disable.
- The stored row carries both references, `upgrade_at`, the Lagos dates, the
  days, `base_ngn`, `rule_version` and status, and satisfies the check.
- **A second, different Pro payment** (a second tab) is a duplicate charge:
  - it gets a full refund of itself and a disable;
  - no second Starter refund;
  - inserting a second live upgrade refund for the same Starter payment
    directly is refused by the unique index.
- In `attention`, no refund row.
- A scheduled Starter's first charge applies with `next_payment_date`.
- A stray charge records once, queues a full refund and a disable, and alerts.

**`lib/__tests__/refunds.test.ts`:**

- The lease: two runners claiming at once send once.
- A timeout leads to `unknown` and no second send. The next run looks up first:
  - a match adopts it;
  - no match after 10 minutes leads to one resend;
  - after 3 attempts, it alerts.
- A 4xx with a match at Paystack is adopted, not failed.
- A 4xx with no match is `failed`.
- The stored amount is resent, never recomputed.
- Webhooks:
  - each status moves forward;
  - a redelivered event does nothing;
  - an out-of-order `processing` after `processed` does nothing;
  - an unknown id is matched through the transaction.
- Emails:
  - one per status;
  - none for `queued`, `sending` or `unknown`;
  - none twice.
- The clamp: two concurrent `queue_refund` calls for more than what's left —
  one succeeds and the other gets `nothing_refundable`.
- MRR and the billing record count `processed` and `settled_outside` only.

**`actions/__tests__/billing.test.ts`:**

- An upgrade is allowed only from a `paystack` Starter row; manual is refused.
- `scheduleDowngrade`:
  - a non-reusable authorization is refused;
  - a failure to disable Pro changes nothing;
  - a failure to create Starter schedules the downgrade and queues
    `create:<pro>`;
  - success schedules with the provider fields.
- Cancel with a downgrade scheduled disables the Starter subscription first.

**Admin:**

- A non-admin is rejected.
- A double-submitted dialog makes one refund.
- A manual refund is recorded as `settled_outside`.
- The end-plan checkbox ends the plan and queues the disables.
- "Try again" on a failed refund creates a new row through the clamp.

**Cron:**

- A scheduled `paystack` Starter isn't applied by the clock.
- No Starter charge after 3 days ends Pro and disables Starter.
- The `refunds` step fetches stale pending refunds.

**Copy:** the `/refunds` bullets and the pricing FAQ; each Settings state
renders exactly its controls; the upgrade sheet's three refund lines (normal,
`attention`, ₦0).

**`/admin/money`:** the cap panel uses gross collections, shows while the
business is unregistered, and shows refunds in flight.

## §11 — End to end, in Paystack test mode (daily test plans)

1. **Upgrade, abandoned:** start an upgrade from Starter and close Paystack's
   page.
   - No refund row; Starter still renewing; nothing changes the next day except
     Starter's own renewal.
2. **Upgrade, declined:** use Paystack's declining test card.
   - Same as 1.
3. **Upgrade, mid-period:**
   - a Pro charge;
   - Starter is disabled at Paystack;
   - one refund for the §2.1 amount, "started" then "processed" emails;
   - Settings shows the refund line, then drops it;
   - the billing record shows the charge, then the refund as "processing" and
     then "processed";
   - **the refund row's stored terms** match §2.1 by hand:
     - both references;
     - `upgrade_at` and its Lagos date;
     - `[period_start_on, period_end_on)`;
     - the days, `base_ngn` and `proration-v1`.
4. **Redeliver the Pro `charge.success`** from the Paystack dashboard, and
   reload the return page.
   - Still one refund at Paystack and one row.
5. **Upgrade from two tabs.** Both land on the same Paystack page. Then force a
   second payment: wait past 30 minutes so a new checkout is made, and pay
   both pages.
   - The second is a duplicate charge: refunded in full, its subscription
     switched off.
   - Still **one** Starter refund.
6. **Force a timeout on `createRefund`** (a test-only switch in the client):
   - the row goes `unknown`;
   - the next run finds the refund at Paystack and adopts it;
   - one refund in total.
7. **A failed refund:** send a correctly signed `refund.failed` for the row
   through the test webhook.
   - `refund_failed` fires, and the builder gets the "couldn't send" email;
   - "Mark paid outside Paystack" records it, with the email;
   - MRR and the billing record now count it.
8. **Pro → Starter:**
   - Pro is disabled at once, and a Starter subscription starts on the next
     date;
   - on the date, one Starter charge and no Pro charge;
   - with a failing card instead: after 3 days the plan is Community and
     Starter is disabled.
9. **Cancel with a downgrade scheduled:** neither subscription charges again.
10. **Stray charge:** re-enable a disabled test subscription in the dashboard
   and let it charge.
   - An automatic full refund, a disable, and the alert.
11. **Admin refund, double-clicked, with "end the plan":**
    - one refund;
    - the plan is Community;
    - the subscription is off.
12. **Set `paystack_cap_near` to ₦1:** it fires.

## Acceptance criteria

1. Every §11 flow passes in test mode.
2. **No path refunds before a verified payment that causes the refund, sends a
   refund twice, or calls a refund done before Paystack confirms it.**
3. At no step can a failure leave two Paystack subscriptions able to charge one
   builder, or one able to charge a builder whose plan has ended.
4. All four gates pass.

## Commit sequence

1. `docs(spec): paystack plan changes`
2. `feat(db): settle_upgrade, queue_refund, record_unwanted_charge, three alerts`
3. `feat(lib): the proration rule`
4. `feat(lib): subscription create, manage link and refunds in the client`
5. `feat(billing): refunds, sent once, looked up before resent, never assumed`
6. `feat(billing): upgrade now, refund only after Pro is paid`
7. `feat(billing): downgrade at the next period, off before on`
8. `feat(billing): stray charges refunded and switched off`
9. `feat(billing): update card, and the expiring-cards email`
10. `feat(admin): payments panel, refunds, try again, paid outside`
11. `feat(admin): the starter business cap`
12. `feat(legal): switching plans, the upgrade refund, refunds we confirm`
13. `test: proration, refunds, upgrade, downgrade, cron, admin`
14. `docs: plan changes and refunds in CLAUDE.md`

## Out of scope

- Undo in the app (P2).
- Paystack's Retry Refund with bank details (for `needs_attention`). An admin
  does it in the Paystack dashboard; the status follows by webhook.
- A Pro payment later charged back. That's a dispute, answered with the
  billing record (MSA PR 4).
- Annual plans, coupons, and USD/Stripe.
- Changing a plan's price: a new Paystack plan, moving subscribers across, and
  30 days' notice (B10).
- Registering the business and upgrading the Paystack account (owner tasks).
