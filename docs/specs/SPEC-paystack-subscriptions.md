# SPEC: Paystack Subscriptions — Subscribe, Renew, Cancel

**Status:** Ready — S1 decided 4 Nov 2026 (card only); S2–S4 confirmed by the owner on 4 Nov 2026 as recommended.
**Branch:** `feat/paystack-subscriptions`
**Base:** `main`, after `feat/paystack-foundation` (PR 1) merges
**Source:** `docs/TWNHALL_PAYSTACK_SUBSCRIPTIONS_PROMPT.md`, PR 2
**Migration:** `20261104_02_paystack_subscriptions.sql`. It adds `paystack_checkouts` and two alert rules. `billing_actions` comes from PR 1.
**New dependency / env var:** none beyond PR 1
**Risk:** high. Real money, on a recurring schedule, on a page builders sign
up from. Every flow here is a promise `/refunds` makes, and Paystack's MSA
(Section B) requires that a cardholder on a recurring charge "must be informed
about how to stop" it. **This PR ships the subscription and its off switch
together** — CLAUDE.md, Payments: "Recurring billing ships with its off
switch."

## Summary

Starter (₦15,000) and Pro (₦30,000) become **monthly Paystack subscriptions**
that renew until the builder cancels. A builder subscribes from **Settings →
Plan**, pays on Paystack's hosted page by card, and is charged again on the
same day each month. They can **cancel from Settings**; the plan stays until
the paid period ends, and they are never charged again. A renewal that fails
gives them **3 days** to pay before the plan lapses, and a lapsed subscription
is switched off at Paystack so it cannot charge them a month later.

Upgrading, downgrading, updating a card and admin refunds are PR 3. Until PR 3
merges, **Production stays on manual billing** — this PR is built and tested
in Paystack test mode, and the switch to live keys happens after PR 3 (the
prompt's go-live checklist).

## §0 — Verified before writing this

- PR 1's foundation: `lib/paystack/` client, signature check, the webhook
  route, `subscription_payments` (reference unique, written by
  `apply_subscription`), `attach`, provider fields on `subscriptions`.
- **Paystack subscriptions** (paystack.com/docs/payments/subscriptions):
  `POST /transaction/initialize` with a `plan` code subscribes the customer
  once they pay, the plan's amount overriding the transaction's; events
  `charge.success` (the first charge and every renewal), `subscription.create`,
  `invoice.create` (3 days before a charge), `invoice.payment_failed`,
  `invoice.update`, `subscription.not_renew`, `subscription.disable`,
  `subscription.expiring_cards`. **A failed renewal is not retried within the
  cycle** — the subscription goes to `attention` and Paystack tries again on
  the *next* payment date, a month later. Monthly plans created on the 29th–31st
  bill on the 28th. `POST /subscription/disable` takes `code` and `token` (the
  subscription's `email_token`).
- **Recurring needs a reusable card authorization**; transfers and USSD don't
  produce one. Hence `channels: ["card"]` (S1).
- **The live pages say the opposite of this PR**: `/refunds` §Renewal ("Your
  plan doesn't renew by itself"), §Cancel, §Prices and Payment ("a Paystack
  payment link"); the pricing FAQ ("There is no checkout", "Your plan doesn't
  renew by itself"); `PlanSection`; the 3-day reminder email in
  `app/api/cron/daily` ("get in touch and we'll renew it"); and
  `refunds.test.ts`, which pins "doesn't renew by itself" and bans
  /subscribe|upgrade/. **All of it changes in this PR.**
- **The daily cron** (`app/api/cron/daily/route.ts`): `scheduled` applies due
  scheduled rows; `expired` ends an `active` row past `period_end`; `reminded`
  emails builder and admins 3 days ahead, once (`reminder_sent_at`). It runs
  at 06:00 UTC (`vercel.json`). A Paystack renewal charged on the payment date
  can land after it — the grace in §8 exists for that.
- **Settings:** `/settings?tab=plan` deep-links the Plan tab (builder only,
  `lib/settingsTabs.ts`); a signed-out visitor is sent to `/explore`.
- **CLAUDE.md "Do Not Touch"** — the pricing page's honesty and the plan
  section's honesty forbid a Subscribe or Upgrade control, a renewal date and
  account state. **The owner's decisions of 4 Nov supersede the parts that
  forbid controls and the renewal date**; the rest stands (no usage meter, no
  "best value", no prices written by hand). §13 rewrites both rules.
- Allowances are per **calendar month** (`lib/allowance.ts`) while billing
  periods run from the subscription day. A builder who subscribes on the 25th
  gets that month's full allowance (the existing "an upgrade gives the new
  plan's full month at once" rule). Unchanged here; `/refunds` §What You're
  Buying already says "each calendar month".

**Checked against Paystack test mode, 4 Nov 2026:** `verify` returns `plan` as a code and `plan_object`, and `abandoned` for an unpaid page; disabling an unknown subscription is a 404, "Subscription with code not found or already inactive"; `GET /customer/:code` returns the numeric id. **The list's customer filter is the numeric id**, so `listSubscriptions()` resolves it from the code. It narrows a non-empty list: with three subscriptions across two customers, each id returned only its own. Both codes are still checked on what comes back.

**Seen on real test-mode subscriptions, 4–7 Nov 2026:**

- **A renewal's `charge.success` carries no subscription code**, and its metadata holds only `invoice_action`. Matching on customer and plan is what works.
- **A renewal runs late:** 11 minutes in one case. The new period starts from the old `period_end`, so the billing date doesn't drift.
- **Cancelling goes `non-renewing`, still listing a next date, then `cancelled` with none** after the period ends. No charge followed. `subscription.disable` arrived about 24 minutes after the period ended.
- **`invoice.payment_failed` carries a nested `subscription.subscription_code`.** A real failure came from deactivating the card's authorization; the subscription went to `attention` with its next date a cycle later. Whether Paystack retries on that date wasn't seen, because "Pay now" switched it off first.
- **`subscription.create` beats its charge**, every time so far.

**Decided while building, where this spec's wording would have misfired:**

- **The confirmation is the native `<dialog>`, not `components/ui/Sheet.tsx`,** which is the navigation drawer and renders below 840px only.
- **`billing_mismatch` doesn't count a `subscription.create` marked `unmatched`.** It routinely beats its charge, and the alert means money arrived that granted nothing.
- **Any second paid checkout on an account with an active Paystack row is `duplicate_charge`,** not only one for the same plan. A stale Starter page paid on Pro would otherwise be an unasked-for downgrade.
- **A renewal charge on a plan with a scheduled change is `unmatched`** until PR 3, rather than extending a cancelled plan.
- **`subscription_lapsing` and "Expiring · 7 days" count manual rows only.** A Paystack plan renews itself.
- **An admin moving or ending a Paystack plan queues its disable,** which §8 didn't cover and acceptance criterion 2 requires.
- **The 3-day reminder for a manual plan keeps "get in touch" until Paystack is configured,** so it never points at a control that isn't there.

**Found in review on 8 Nov 2026, to settle before live keys (PR 3 or the go-live checklist).** None of these can happen while production has no Paystack keys.

- **A lost renewal webhook lapses a paying builder.** After the grace, the cron ends the row as "Payment failed" without asking Paystack. Fix: `fetchSubscription` first, and skip if Paystack shows it renewed.
- **A renewal from a subscription that should be off extends the plan silently.** The different-code guard needs `tx.subscriptionCode`, and real renewals carry none. Fix: compare the charge's subscription, through `fetchSubscription` or the invoice, with the row's code.
- **`findSubscription` can attach an older subscription that is still live** when its disable is failing; the alert covers it, but the new code is then lost.
- **The return page says "started" after a `duplicate_charge`** that the webhook settled first.
- **Cancelling in `attention` promises "You keep {Plan} until" a date already past.**
- **A signed-out visitor from /pricing lands on the dashboard after login,** not Settings → Plan: login takes no return target.
- **Cancel's own write racing its webhook can send two emails,** and Cancel doesn't check `apply_subscription`'s answer.
- Smaller: reconcile reads 50 rows unordered; the subscription lookup and `site()` are written more than once.

## §1 — Decisions

**Decided by the owner, 4 Nov 2026 — not reopened:**

| | Decision |
|---|---|
| Cancel | A **Cancel button in Settings** that disables the subscription on Paystack's side. |
| After cancelling | **Access stays until the paid period ends**, then Community. Never charged again. |
| Starter → Pro | **Immediate** (PR 3). |
| Pro → Starter | **From the next billing period** (PR 3). |
| Builders on a manual (payment-link) plan | **Stay manual until their period ends**, then subscribe themselves. Nobody is ever charged automatically without entering a card at Paystack's checkout. |
| Grace | **3 days** after a failed renewal before the plan lapses. |
| **S1**, checkout channels | **Card only** (`channels: ["card"]`). A renewing subscription needs a reusable authorization, and bank transfer and USSD don't give one. |

**Confirmed 4 Nov 2026, as recommended:**

| # | Decision | Recommendation |
|---|---|---|
| **S2** | Show "card ending 4081" in Settings and the reminder email | **Yes.** It's the first thing a builder checks when a charge surprises them. Last four and brand only, from Paystack's charge payload. |
| **S3** | The wording at checkout (§3) | **As written in §3.** It names the amount, that it repeats monthly on the same date, that it continues until cancelled, and where to cancel — the card-scheme disclosure for a recurring charge. |
| **S4** | Who is emailed (§10) | **As listed in §10.** Every charge and every change to a subscription is confirmed by email. |

## §2 — Who can subscribe

From `startSubscription(planId)` (`actions/billing.ts`, new):

- `requireAccount("builder")` — verified builders only (the profile gate is the
  KYC the MSA asks for).
- `paystackConfigured()` — otherwise Settings shows no subscribe controls at
  all, and the action refuses.
- **No active subscription**, or one that is `paystack` with
  `provider_status = 'attention'` (that's §9's "Pay now"). An active **manual**
  row is refused: *"Your plan was arranged directly and ends on {date}. You can
  subscribe here from then."* (owner decision). An active **paystack** row is
  PR 3's upgrade/downgrade, not this action.
- Rate limit: a new rule `"checkout:account"` — 5 an hour, `mode: "closed"`.

## §3 — Checkout

**In Settings → Plan,** each paid plan the builder can take shows **"Subscribe
— {priceLine}"**. It opens a confirmation sheet (`components/ui/Sheet.tsx`),
then posts the action. The sheet says, with the date computed in Lagos time:

> **{Plan}, {₦amount} a month.**
> You pay {₦amount} today, then {₦amount} on the {Nth} of every month until you
> cancel. Cancel any time in Settings → Plan — you keep {Plan} until the end of
> the month you've paid for, and you won't be charged again.
> Payment is by card, through Paystack. [Billing and Refund Policy](/refunds)
> **[Continue to payment]**

(If the 29th–31st: "on the 28th of every month" — Paystack's rule. Read the
date from Paystack's `next_payment_date` once known; the sheet's date is a
statement of the rule, not a computation the system relies on.)

**`startSubscription(planId, kind = "new")`:**

1. Checks in §2.
2. **Reuse an open checkout.** If this builder has a `paystack_checkouts` row
   for the same plan and kind that's less than 30 minutes old, not completed,
   and has an `authorization_url`, redirect to that URL and stop. A
   double-click, a refresh, a second tab or a retried request all land on the
   **same** Paystack page with the **same** reference, so they can only ever
   be paid once.
   - A partial unique index enforces it: one open checkout per profile, plan
     and kind (`where completed_at is null and superseded_at is null`).
   - Two concurrent starts both trying to insert: the loser reads the winner's
     row and redirects to it.
3. Otherwise `reference = "twnhall-sub-" + randomUUID().replace(/-/g, "")`.
   Hyphens, not underscores (Paystack's reference alphabet; the tag learned
   this).
4. Insert `paystack_checkouts`:
   `(reference pk, profile_id, plan_id, kind, replaces_subscription_id, authorization_url null, access_code null, created_at, completed_at null, superseded_at null)`.
   Any older open checkout for this profile that is past 30 minutes gets
   `superseded_at = now()`.
5. `initializeTransaction({ email: <the auth user's email>, amountNgn: plan.amountNgn, planCode, reference, callbackUrl: "{site}/settings/billing/return", metadata: { profile_id, plan_id, kind, reference } })`.
   Store its `authorization_url` and `access_code` on the row.
6. Redirect to `authorization_url`. On a client error, back to
   `/settings?tab=plan&billing=failed` with a sentence, never a stack.

**Nothing is granted here.** The redirect proves only that the builder reached
Paystack.

**A superseded or abandoned page can still be paid.** Paystack doesn't let us
withdraw an authorization URL. That's why §5 also catches a **duplicate
charge** when the reuse above didn't prevent one.

## §4 — The return page

`app/(developer)/settings/billing/return/page.tsx`. Paystack appends
`?trxref=…&reference=…`.

- `requireAccount("builder")`; load the checkout by `reference`; **its
  `profile_id` must be the caller's** — otherwise 404.
- `verifyTransaction(reference)` and hand the result to `settleCharge()` (§5) —
  the same function the webhook calls. Whichever lands first settles; the
  other is a `duplicate`.
- Then redirect to `/settings?tab=plan&billing=started` (success),
  `…=pending` (Paystack still processing: "We're confirming your payment — it
  shows here within a minute"), or `…=not_completed` (abandoned or failed: "No
  payment was taken").

## §5 — `settleCharge()`: one place a charge becomes a plan

`lib/paystack/charges.ts`, called by the return page and by `charge.success`.

**Validate — any failure grants nothing**, records the event outcome, and opens
the **`billing_mismatch`** alert (critical, §11):

- `status === "success"`, `currency === "NGN"`.
- `planIdForCode(planCode)` is `starter` or `pro`, and
  `amountNgn === PLANS[planId].amountNgn`. ("Underpayment is the attack;
  overpayment is a pricing change mid-checkout. Neither is automatic.")

**Classify:**

| Case | How it's recognised | Action |
|---|---|---|
| **Duplicate charge** | `reference` is a checkout row, but the account **already** has an active `paystack` row for this plan, created by a **different** checkout. Two tabs were both paid, or a superseded page was paid. | **Never a plan change, and never a second upgrade refund.** Outcome `duplicate_charge`; alert `billing_mismatch` (critical). Until PR 3, an admin refunds it in the Paystack dashboard. PR 3 makes it automatic (`record_unwanted_charge`): a full refund and its subscription switched off. |
| **First charge** | `reference` is a `paystack_checkouts` row, not completed; `metadata.profile_id` equals its `profile_id` | `apply_subscription('start', …, p_payment_kind = checkout.kind)`; mark the checkout completed |
| **Renewal** | no checkout row; `subscriptionCode` (or `customerCode` + `planCode`) matches the account's **active** `paystack` row | `apply_subscription('extend', …, p_payment_kind 'renewal')` |
| **Scheduled change** | matches a **scheduled** `paystack` row | PR 3 (downgrade). Until then: `unmatched` |
| **Anything else** | | outcome `unmatched`, alert `billing_mismatch`, grant nothing |

**Period end** is Paystack's `next_payment_date`, never computed:
`fetchSubscription(code)` when the code is known; for a first charge,
`listSubscriptions({ customer, plan })` and take the newest active. If Paystack
hasn't created it yet, the first charge sets a provisional
`period_end = paid_at + 1 month` and `subscription.create` (§6) corrects it via
`attach`.

Everything passes to `apply_subscription` in **one** call: payment reference,
amount, kind, `provider_customer_id`, `provider_subscription_id`, email token,
plan code, `provider_status`, `card_last4`, `card_brand`. A `'duplicate'`
result is success — the other path got there first.

**On a first charge of kind `resubscribe`** (§9), pass a `disable_subscription`
action for `replaces_subscription_id`'s old Paystack subscription in the **same**
`apply_subscription` call (`p_actions`, PR 1). It's queued with the payment or
not at all, so the failed subscription can't be retried a month later. Its
idempotency key is `disable:<old subscription code>`.

## §6 — Webhook events

`handlePaystackEvent()` (PR 1's stub) now handles:

| Event | Handling | Outcome |
|---|---|---|
| `charge.success` | `settleCharge()` with the payload (its own data, not a re-fetch, then the subscription fetch for the period end) | `settled` / `duplicate` / `unmatched` / `mismatch` |
| `subscription.create` | `apply_subscription('attach', …)` on the account whose active `paystack` row has that `customer_code` and plan: codes, email token, status, `period_end = next_payment_date`. No active row yet → `unmatched` (the charge path's own fetch or the reconcile in §8 fills it) | `settled` / `unmatched` |
| `invoice.payment_failed` | `provider_status = 'attention'` on the matching row (via `attach`); email the builder (§10); no plan change | `settled` |
| `subscription.not_renew`, `subscription.disable` | The subscription was cancelled at Paystack — by our Cancel (§7, already scheduled: no-op), on Paystack's hosted page, or by Paystack. If the matching active row has no scheduled change: `apply_subscription('schedule', community)` and email "won't renew" | `settled` / `duplicate` |
| `invoice.create`, `invoice.update`, `subscription.expiring_cards`, everything else | acknowledged | `ignored` |

Every handler is idempotent: a second delivery finds the payment reference
(`duplicate`), the codes already attached, or the change already scheduled.

## §7 — Cancel (owner decision)

**Settings → Plan, on a renewing `paystack` plan: "Cancel plan".** The
confirmation sheet:

> **Cancel {Plan}?**
> You won't be charged again. You keep {Plan} until {period_end, Lagos}, then
> your account moves to Community. Test cases already live keep their testers,
> and reports you've earned stay yours.
> **[Cancel plan]** [Keep {Plan}]

**`cancelSubscription()`:**

1. `requireAccount("builder")`. **No rate limit** (changed in review, 8 Nov 2026): `"checkout:account"` is `closed`, so a limiter outage or five checkout tries would have refused the off switch.
2. The active `paystack` row. None, or one already cancelled → *"There's
   nothing to cancel"* and no call to Paystack.
3. Email token missing → `fetchSubscription(code)` for it.
4. **`disableSubscription({ code, token })` first.** If Paystack refuses or is
   down → *"We couldn't cancel just now — nothing has changed. Try again in a
   minute."* **Never schedule the end while Paystack can still charge.**
5. `apply_subscription('schedule', community, reason "Cancelled by the
   builder")`. **"Cancelled" is this scheduled `community` row** — the state
   Settings, the cron and the emails read — not `provider_status`, which only
   mirrors Paystack. If this write fails after
   Paystack accepted, the `subscription.disable`/`not_renew` webhook schedules
   it (§6) — and the error is logged loudly.
6. Email the confirmation (§10).

**No in-app undo** (decided 4 Nov 2026, PR 3's P2). The sheet's wording is
the guard. After the period ends, the builder can subscribe again.

On a **manual** plan there is no Cancel button: it doesn't renew. The section
says when it ends.

## §8 — Grace, lapse and the cron

`lib/subscriptions.ts`: `export const GRACE_DAYS = 3`.

**`expired` step** (rewrite):

- `manual` row past `period_end` → ends, as today.
- `paystack` row past **`period_end + GRACE_DAYS`** with no renewal (a renewal
  moves `period_end`) → `apply_subscription('end', expired)`, **queue
  `disable_subscription`** for its Paystack code (it's in `attention`, and
  Paystack would charge it again next month — a charge after the plan ended is
  exactly the dispute the MSA warns about), and email "ended because the
  payment didn't go through".
- A `paystack` row with a scheduled `community` row (cancelled) ends at
  `period_end` through the existing `scheduled` step — no grace, because no
  charge is expected.

**`reconcile` step** (new, after `expired`): for each active `paystack` row
missing its subscription code or email token, `listSubscriptions({ customer,
plan })` and `attach`. Bounded to 50 rows a run.

**`billing_actions`** (the table is PR 1's) is work that must happen at
Paystack but may fail. A lapse queues its `disable_subscription` through
`apply_subscription('end', …, p_actions)`, in the same transaction, with key
`disable:<subscription code>`.

**`runBillingActions()`** (`lib/paystack/actions.ts`):

- **Claims before it calls.** One `update … set claimed_until = now() + 5 min`
  `where done_at is null and (claimed_until is null or claimed_until < now())`
  `returning *`. The `after()` run and the cron sweep can't both work the same
  row.
- `disable_subscription` → `disableSubscription`. A permanent "already
  cancelled" or "not found" answer counts as done, because disabling is
  idempotent at Paystack.
- Records `attempts` and `last_error` every time.
- Runs through `after()` right after an action is queued, and again in the
  daily cron (`billing_actions` step).

## §9 — A failed renewal

`invoice.payment_failed` (§6) sets `attention` and emails the builder. Because
Paystack won't retry until next month, **updating the card does not save this
month's plan** — paying again does:

- Settings → Plan shows a banner on an `attention` row: *"Your {Plan} payment on
  {date} didn't go through. Pay by {period_end + 3 days} to keep {Plan}."* and
  **"Pay now"**.
- "Pay now" is `startSubscription(samePlan, kind "resubscribe")` with
  `replaces_subscription_id` set — §2 allows it for `attention`. On success,
  §5 starts a fresh period (`start` ends the old row) and queues the disable of
  the old Paystack subscription. The billing date moves to the day they paid.
- If they don't, §8 lapses it after 3 days and switches it off at Paystack.

## §10 — Emails

Through `sendNotice()`; copy in `lib/subscriptions.ts` beside `planNotice()`,
tested. Every one names the amount and links Settings → Plan and `/refunds`.

| When | Subject |
|---|---|
| First charge | "You're on {Plan}" — what it includes, ₦amount, next charge date, card ending, how to cancel |
| Renewal | "Payment received for {Plan}" — ₦amount, the period it covers, next charge date |
| 3 days before a renewal (cron `reminded`, renewing rows) | "Your {Plan} plan renews on {date}" — "We'll charge ₦amount to the card ending {last4} on {date}. To stop it, cancel in Settings before then." |
| 3 days before a cancelled plan ends | "Your {Plan} plan ends on {date}" — "You won't be charged again." |
| 3 days before a **manual** plan ends | "Your {Plan} plan ends on {date}" — "To keep it, subscribe in Settings → Plan. It renews monthly until you cancel." |
| Cancelled | "{Plan} cancelled" — keeps until {date}, won't be charged again |
| Payment failed | "Your {Plan} payment didn't go through" — pay by {date} or it ends; "Pay now" |
| Lapsed after a failed payment | "Your {Plan} plan has ended" — no further charges |

The admin copies of the reminder say which kind it is. Paystack also emails its
own receipts; ours are the ones that name the plan and the policy.

## §11 — Alerts (seeded, `on conflict (key) do nothing`)

| Key | Severity | Fires when |
|---|---|---|
| `billing_mismatch` | critical | any `paystack_events` row with outcome `mismatch` or `unmatched` in the window — money arrived that granted nothing, or a payload didn't match a price |
| `billing_actions_failing` | critical | a `billing_actions` row not done after 3 attempts or 24 hours — a subscription that should be off may still charge |

Measured in `lib/alerts/run.ts`, keys in `ALERT_RULE_KEYS`, as PR 4 of the MSA
work did for `paid_slots_waiting`.

## §12 — Settings → Plan

`PlanSection` takes the account's subscription state (read in
`app/(developer)/settings/page.tsx` through the service role, as today):

| State | Shows | Controls |
|---|---|---|
| Community (or lapsed) | the three plans, as today | **Subscribe** on Starter and Pro |
| Manual, active | "{Plan} — arranged directly, ends on {date}." | none (owner decision 3) |
| Paystack, renewing | "{Plan} — renews on {date} · ₦amount · card ending {last4}" | **Cancel plan** (PR 3 adds change plan and update card) |
| Paystack, cancelled | "{Plan} until {date}. You won't be charged again." | none |
| Paystack, attention | the §9 banner | **Pay now** |
| Checkout pending (`?billing=pending`) | "We're confirming your payment…" | none |

**Still no usage meter** — the balance stays beside the publish button. Still
no "best value". The policy link stays.

**Test mode is visible.** When the secret key starts `sk_test_`, the section
shows a small "Test mode — no real money moves" tag, so nobody on a preview
mistakes it.

## §13 — Pages and rules that change in this PR

- **`/refunds`**:
  - §Prices and Payment — "You subscribe in Settings → Plan and pay by card
    through Paystack. Your card is charged when you subscribe and then on the
    same date every month (the 28th if you subscribe on the 29th–31st)."
  - §Billing Periods and Renewal — "**Your plan renews every month until you
    cancel.** Three days before each renewal we email you the amount, the date
    and the card. If a renewal payment fails, your plan stays for 3 more days
    so you can pay; after that it ends and nothing more is charged." Manual
    plans: one sentence that plans arranged directly don't renew and end on
    their end date.
  - §Cancelling — "Cancel any time in Settings → Plan. You keep your plan until
    the end of the period you've paid for, and you won't be charged again." The
    email route stays for manual plans.
  - §Refunds — "charged after you cancelled" stays (B4).
  - Last updated: the merge date.
- **Terms § Paid Plans** — add: "Paid plans are subscriptions that renew
  monthly and charge the card you subscribed with until you cancel. By
  subscribing you authorise those charges. You can cancel at any time in
  Settings; cancelling stops future charges and you keep the plan until the
  end of the period you've paid for."
- **Privacy § collect, Billing Information** — add the Paystack customer and
  subscription references and the card's last four digits and brand; still
  "we never see or store your card number or security code".
- **`/pricing`**:
  - Paid cards' call to action: **"Get Starter" / "Get Pro"** →
    `/settings?tab=plan`. A signed-out visitor: Settings today sends them to
    `/explore`; for `tab=plan` send them to `/login` instead. If the sign-in
    paths already carry a return path (the OAuth callback honours `next`),
    pass `next=/settings?tab=plan`; don't build a new mechanism here.
  - Remove the META line "There is no checkout. Starter and Pro start as a
    conversation."
  - FAQ "How do I pay for Starter or Pro?" → "Subscribe from Settings → Plan
    and pay by card through Paystack. It renews every month until you cancel.
    Prices include any tax we're required to charge, and no card fee is added."
  - FAQ "Can I cancel, or get a refund?" → "Yes — cancel any time in Settings →
    Plan. You keep the plan until the end of the month you've paid for, and
    you won't be charged again. Refunds are in our Billing and Refund Policy."
  - The page still describes the offer, never an account's state; prices still
    come from `lib/plans.ts`.
- **CLAUDE.md**:
  - "The pricing page's honesty" — keep: describes the offer, never an
    account's state; nothing unshipped; no "best value". Replace "the Pro call
    to action opens a conversation … never a Subscribe or Upgrade button" with
    "the paid calls to action go to Settings → Plan".
  - "The plan section's honesty" — keep: no usage meter. Replace "no renewal
    date, no Subscribe or Upgrade control" with: "its controls are exactly the
    ones the subscription state allows (`SPEC-paystack-subscriptions.md` §12);
    the renewal date, amount and card are shown because a builder on a
    recurring charge must know when and how to stop it (Paystack MSA Section
    B)."
  - Payments — "Until a checkout ships…" becomes the subscription rule: every
    paid period starts from the builder's own action at Paystack's checkout;
    renewals only from a subscription they created; the off switch is in
    Settings; `settleCharge()` is the one place a charge becomes a plan.
  - The `payments-wip` line from PR 1 stays.

## §14 — Tests

- **`lib/__tests__/paystackCharges.test.ts`** — `settleCharge` with fixtures:
  first charge starts the plan with every provider field; a second delivery is
  `duplicate`; renewal extends to `next_payment_date` and adds a payment row;
  wrong amount / currency / unknown plan code / foreign profile in metadata →
  `mismatch`, nothing granted; a renewal for no known subscription →
  `unmatched`; `resubscribe` queues the old subscription's disable; a second
  paid checkout for a plan the account already has from another checkout →
  `duplicate_charge`, no plan change, alert.
- **`lib/__tests__/paystackEvents.test.ts`** — each §6 event; `not_renew` on an
  already-cancelled row is a no-op; `attach` fills a missing code.
- **`actions/__tests__/billing.test.ts`** — `startSubscription`: unverified
  builder redirected; a manual active plan refused with the date; an active
  paystack plan refused; rate limit; unconfigured refused; the checkout row and
  `initializeTransaction` arguments (`channels`, plan code, kobo never leaking
  out of the client); **a second start within 30 minutes redirects to the
  first checkout's URL without calling Paystack; two concurrent starts make one
  checkout row; after 30 minutes the old row is superseded**.
  `cancelSubscription`: Paystack refusing changes nothing;
  success schedules community; twice is a no-op.
- **Return page** — another builder's reference is 404; a verified success
  settles; abandoned grants nothing.
- **Cron** (`app/api/cron/daily/__tests__/route.test.ts`) — a paystack row
  1 day past `period_end` is kept; 4 days past is ended and a disable is
  queued; a manual row ends on the day; a cancelled row ends on the day without
  a disable; the three reminder copies; `reconcile` attaches.
- **`lib/__tests__/billingActions.test.ts`** — a permanent "not found" counts as
  done; a transient error increments attempts; two runners claiming at once
  get the row once; a lapse and a resubscribe each queue exactly one disable,
  and a retried webhook queues none.
- **`refunds.test.ts`, `pricing.test.ts`, `PlanSection`** — replace "doesn't
  renew by itself" with "renews every month until you cancel" and the cancel
  sentence; `/refunds` may now say "subscribe"; every state in §12 renders its
  controls and no others; Community shows no renewal date; no tier is "best
  value"; no price in source.

## §15 — End to end, in Paystack test mode

Test keys and **daily** test plans (`interval: daily`) in Preview or local
behind ngrok, with the test webhook URL set in the Paystack dashboard.
Paystack's documented test cards.

1. Subscribe to Starter from Settings. The sheet shows the wording; Paystack's
   page takes the test card; the return page shows Starter; one payment row;
   the confirmation email names the next charge date and the card.
2. Deliver the same `charge.success` twice (Paystack dashboard → resend):
   one payment row. Click Subscribe twice, and in a second tab: both land on
   the same Paystack page.
3. Wait a day: the renewal charges, `period_end` moves, a second payment row, a
   receipt email.
4. Cancel: Paystack shows the subscription non-renewing/disabled; Settings says
   "until {date}"; the next day the plan is Community and **no charge**.
5. Subscribe with Paystack's failing test card on the renewal (or disable the
   card in test mode): `attention`, the email, the banner; "Pay now" starts a
   new period and the old subscription is disabled; or wait 3 days and the plan
   lapses, the old subscription disabled.
6. A forged webhook: 401, nothing written.
7. A manual Starter row: Settings shows it ending, no Subscribe until it ends,
   the manual reminder copy.

## Acceptance criteria

1. Every flow in §15 passes in test mode.
2. No path grants a plan without a verified, amount-checked Paystack charge,
   and no path leaves a Paystack subscription able to charge a builder whose
   plan has ended or been cancelled.
3. `/refunds`, the Terms, Privacy, `/pricing`, Settings and every email say the
   same thing about renewal and cancelling.
4. The four gates.

## Commit sequence

1. `docs(spec): paystack subscriptions`
2. `feat(db): checkouts and two billing alerts`
3. `feat(billing): settleCharge, one place a charge becomes a plan`
4. `feat(billing): start a subscription and the return page`
5. `feat(webhook): charges, subscription and invoice events`
6. `feat(billing): cancel from Settings, disabled at Paystack first`
7. `feat(cron): grace, lapse with disable, reconcile, the billing actions sweep`
8. `feat(mail): the subscription emails`
9. `feat(settings): the plan section reads the subscription`
10. `feat(legal): renewal and cancelling, as they now are`
11. `test: charges, events, cancel, cron, copy`
12. `docs: the payments and honesty rules for subscriptions`

## Out of scope

- Upgrade, downgrade, update card, admin refunds, the Starter Business cap —
  PR 3.
- USD / Stripe. Annual plans. Coupons. Proration.
- Changing a plan's price (a new Paystack plan and 30 days' notice, B10 — its
  own piece of work).
