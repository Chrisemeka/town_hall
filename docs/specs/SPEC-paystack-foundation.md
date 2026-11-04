# SPEC: Paystack Foundation

**Status:** Ready — no open decisions. Nothing a builder sees changes in this PR.
**Branch:** `feat/paystack-foundation`
**Base:** `main`
**Source:** `docs/TWNHALL_PAYSTACK_SUBSCRIPTIONS_PROMPT.md`, PR 1
**Migration:** `20261104_01_paystack_foundation.sql` (next free prefix if taken)
**New dependency:** none — plain `fetch`, as the `payments-wip` tag did
**New env vars:** `PAYSTACK_SECRET_KEY`, `PAYSTACK_PLAN_STARTER`, `PAYSTACK_PLAN_PRO` (all server-only)
**Risk:** medium. It replaces `apply_subscription`, the one writer of
`accounts.plan_id`. Everything else is additive.

## Summary

Builders will pay for Starter and Pro with a Paystack subscription that renews
monthly (decided 4 Nov 2026; PRs 2 and 3). This PR lays the ground those two
stand on, and it fixes two bugs that recurring billing would make worse every
month.

**It adds:**

1. A Paystack client and webhook signature check, **ported by hand** from the
   unmerged `payments-wip` tag (13 Aug 2026).
2. **`subscription_payments`: one row per payment**, with the Paystack reference
   unique. It's the record of money in and the idempotency key for every
   charge. `apply_subscription` writes it in the same transaction as the plan
   change.
3. **`subscription_refunds`: one row per refund**, each with its own status.
   A refund is never assumed to have happened: the row moves from `queued` to
   `processed` or `failed` only on Paystack's word.
   - **Each row carries its own explanation.** An upgrade refund stores both
     payment references, the upgrade moment, the Lagos dates, the days, the
     base amount and the rule version. The amount can be recomputed from the
     row alone, and a database check makes sure it always is.
   - **Duplicates are refused by the schema itself:** a unique idempotency key,
     plus unique indexes that allow at most one live upgrade refund per Pro
     payment and per Starter payment.
4. **`billing_actions`: work owed to Paystack.** For example, switching off a
   replaced subscription. PR 2 and PR 3 run it.
5. **Follow-up work is queued in the same transaction as the payment that
   causes it.** `apply_subscription` takes `p_actions` and inserts them only
   when it returns `'ok'`. A retried webhook records the payment as
   `duplicate`, so nothing is queued twice. PR 3's `settle_upgrade` does the
   same for the upgrade refund: it calls `apply_subscription`, and only on
   `'ok'` computes and inserts the refund, in that same transaction.
6. `apply_subscription` changes:
   - it refuses a duplicate payment reference;
   - it stores provider codes on a scheduled change;
   - a new `attach` action fills in Paystack codes on the active row;
   - it queues `p_actions` atomically (point 5).
7. `/api/webhooks/paystack`. It verifies the signature, records the event,
   acknowledges it, and handles nothing yet (PR 2 adds the handlers).

**It fixes:**

8. **Renewals overwrite the previous payment** (bug 8). `extend` updates
   `amount_ngn` and `payment_reference` on the one subscription row, so
   earlier payments vanish from the billing record a dispute is answered
   with.
9. **MRR halves after one renewal** (bug 9). `monthlyAmount()` divides the latest
   amount by the whole period from `period_start` to the moved `period_end`.
   ₦15,000 over two months reads as ₦7,500. This is live today for manual
   renewals.

## §0 — Verified before writing this

**The `payments-wip` tag** (`git show payments-wip:<path>`) is 9 commits, 9–13
Aug, branched from `ddaf460` and never merged. It was built for the old model:
credit packs in, tester transfers out, and Stripe.

| File on the tag | Verdict |
|---|---|
| `lib/webhooks.ts` → `safeEqual`, `verifyPaystackSignature` | **Port.** HMAC-SHA512 of the raw body, keyed on the secret key, with a constant-time compare that tolerates unequal lengths. |
| `scripts/processors.test.mts`, the Paystack part | **Port to Vitest.** The repo's tests now live in `lib/__tests__`. |
| `lib/processors.server.ts` → `call()`, `paystackInit`, `paystackInitializeTransaction` | **Port and extend.** The 15-second timeout, the permanent/transient split and "returns, never throws" are the right shape. |
| `app/api/webhooks/paystack/route.ts`: the structure | **Port.** `runtime = "nodejs"`, raw body, 401 on a bad signature, acknowledge unknown events. Not its handlers. |
| `lib/webhooks.server.ts` → the amount and currency checks in `creditFromMetadata` | **Port the rule, not the code.** "Underpayment is the attack; overpayment is a pricing change mid-checkout. Neither is automatic." |
| Transfers, recipients, withdrawals, payout methods, the transfer batch, `paystackTransferOutcome` | **Never.** CLAUDE.md forbids paying out through the product, and a Starter Business account can't use Transfers. |
| Stripe, `formEncode`, credit packs, `credit_ledger`, the NGN/USD currency model, migrations `20260811_01` and `20260812_01` | **Never.** |

**Never merge or cherry-pick the tag.** It drags back dropped tables and the
payout rules. Copy the functions above by reading them.

**On `main`:**

- `subscriptions` has `source`, `provider_customer_id` and
  `provider_subscription_id`.
- `apply_subscription` (`20261027_02`) is the only writer of `plan_id`. It's
  defined only in that migration.
- `applyProviderEvent()` (`lib/billing.ts`) isn't wired to anything.
- No Paystack env var, route or client exists. `app/api` has no middleware (the
  matcher excludes `api`), so a route there is public and gates itself.
- The `webhook:ip` rate-limit rule exists (`lib/rateLimit.ts`), used by
  `app/api/webhooks/submission`.
- **Bug 8:** in `apply_subscription`, `extend` sets
  `amount_ngn = coalesce(p_amount_ngn, amount_ngn)` and the same for
  `payment_reference`, on the active row. `lib/billingRecord.ts` makes one
  Payment row per *subscription*.
- **Bug 9:** `monthlyAmount()` (`lib/subscriptions.ts:106`) is
  `amount_ngn / round((period_end − period_start) / 30.44 days)`. Used by
  `/admin`, `/admin/accounts` and `/admin/money`.

## §1 — `lib/paystack/`

**`lib/paystack/signature.ts`** (pure; imports only `node:crypto`): `safeEqual()`
and `verifyPaystackSignature(rawBody, header, secretKey)`, copied from the tag.

**`lib/paystack/client.ts`** (`server-only`):

- `call()` from the tag: `fetch` with `AbortSignal.timeout(15_000)`, and a
  result of `{ ok: true, data } | { ok: false, message, permanent }`. A 4xx
  other than 429 is permanent; a 5xx, 429, timeout or network error is
  transient.
- **Amounts cross this boundary in kobo.** Every function takes and returns
  naira. The ×100 happens here and nowhere else, so nothing outside
  `lib/paystack/` ever sees kobo.
- The calls PR 2 needs:

| Function | Paystack call |
|---|---|
| `initializeTransaction({ email, amountNgn, planCode, reference, callbackUrl, metadata })` | `POST /transaction/initialize` with `plan`, `channels: ["card"]` |
| `verifyTransaction(reference)` | `GET /transaction/verify/:reference` |
| `fetchSubscription(code)` | `GET /subscription/:code` |
| `listSubscriptions({ customer, plan })` | `GET /subscription?customer=&plan=` |
| `disableSubscription({ code, token })` | `POST /subscription/disable` |

  PR 3 adds `createSubscription`, `manageLink`, `createRefund`, `fetchRefund`
  and `listRefunds`. Don't add them here.
- Each function maps Paystack's payload into a narrow typed shape, e.g.
  `{ reference, status, amountNgn, currency, planCode, customerCode,
  subscriptionCode, nextPaymentDate, card: { last4, brand, reusable },
  metadata, paidAt }`. Nothing above `lib/paystack/` touches a raw Paystack
  object.

**`lib/paystack/config.ts`** (`server-only`):

- `paystackConfigured()`: true when the secret key and both plan codes are set.
- `planCodeFor(planId)` and `planIdForCode(code)`, reading the env vars.
- **Plan codes differ between test and live mode.** Preview and local use test
  plans, Production uses live ones. That's why they're env vars and not
  constants.

**`lib/plans.ts`:** add `amountNgn: 15_000` / `30_000`, **written by hand**
beside `price.naira`. Prices are written, never computed. A test asserts
`formatNgn(plan.amountNgn) === plan.price.naira`, so the two can't drift. The
webhook (PR 2) compares the amount paid against this number.

## §2 — Migration `20261104_01_paystack_foundation.sql`

**`subscription_payments`: the record of money in.** It isn't a balance or a
wallet, and nothing pays out of it. CLAUDE.md's Payments rule gains one line
saying so.

```sql
create table public.subscription_payments (
  id               uuid primary key default gen_random_uuid(),
  subscription_id  uuid references public.subscriptions(id) on delete set null,
  profile_id       uuid not null,             -- denormalised, outlives the account
  source           text not null,             -- manual | paystack
  reference        text not null unique,      -- the idempotency key
  amount_ngn       integer not null,
  kind             text not null,             -- first | renewal | upgrade | resubscribe | manual | stray
  period_start     timestamptz not null,
  period_end       timestamptz,
  created_at       timestamptz not null default now()
);
create index subscription_payments_profile_idx on public.subscription_payments (profile_id, created_at);
alter table public.subscription_payments enable row level security;  -- no policies
```

**`subscription_refunds`: one row per refund, each with its own life.**

A payment can have more than one refund: an upgrade's, then an admin's. A
refund isn't a number on the payment; it's a request that Paystack may accept,
process, fail or park. **Nothing reads a refund as done until its status is
`processed`.** PR 3 owns the life cycle (`SPEC-paystack-plan-changes.md` §3).
This PR creates the table and the readers.

```sql
create table public.subscription_refunds (
  id                          uuid primary key default gen_random_uuid(),
  profile_id                  uuid not null,
  reason                      text not null,
      -- upgrade | admin | stray_charge | duplicate_charge

  -- What is refunded: the original payment, and its Paystack reference as a
  -- snapshot (it's the `transaction` Paystack's refund call takes).
  payment_id                  uuid not null references public.subscription_payments(id),
  original_payment_reference  text not null,

  -- What caused it: the Pro payment for an upgrade; the unwanted payment
  -- itself for a stray or duplicate charge; null for an admin refund.
  causing_payment_id          uuid references public.subscription_payments(id),
  causing_payment_reference   text,

  -- How an upgrade refund was worked out (PR 3 §2.1). Null on other reasons.
  rule_version                text,           -- 'proration-v1'
  upgrade_at                  timestamptz,    -- the exact moment Paystack took the Pro payment
  upgrade_on                  date,           -- that moment's date in Africa/Lagos
  period_start_on             date,           -- Africa/Lagos, included
  period_end_on               date,           -- Africa/Lagos, EXCLUDED: the next billing date
  days_in_period              integer,
  refundable_days             integer,
  base_ngn                    integer,        -- what was still refundable on the payment

  amount_ngn                  integer not null check (amount_ngn > 0),
  idempotency_key             text not null unique,   -- e.g. 'upgrade:<pro reference>'
  status                      text not null default 'queued',
      -- queued | sending | unknown | pending | processing | needs_attention
      -- | processed | failed | settled_outside
  paystack_refund_id          text unique,
  attempts                    integer not null default 0,
  last_error                  text,
  claimed_until               timestamptz,    -- a runner's lease; see PR 3 §3
  notified_status             text,           -- the last status the builder was emailed about
  note                        text,           -- admin only, never emailed
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  finished_at                 timestamptz,

  -- An upgrade refund must carry its whole calculation, and the stored numbers
  -- must agree with each other. Pure date and integer arithmetic only.
  constraint upgrade_refund_explains_itself check (
    reason <> 'upgrade' or (
      causing_payment_id is not null and causing_payment_reference is not null
      and rule_version is not null and upgrade_at is not null and upgrade_on is not null
      and period_start_on is not null and period_end_on is not null
      and base_ngn is not null and base_ngn > 0
      and days_in_period = period_end_on - period_start_on and days_in_period > 0
      and upgrade_on >= period_start_on and upgrade_on < period_end_on
      and refundable_days = period_end_on - upgrade_on - 1
      and amount_ngn = (base_ngn * refundable_days) / days_in_period
    )
  )
);
create index subscription_refunds_open_idx on public.subscription_refunds (status, updated_at);

-- Duplicate refunds are refused by the schema, not only by the key string. A
-- failed refund doesn't count, so an admin's "Try again" can replace it.
create unique index subscription_refunds_one_per_cause
  on public.subscription_refunds (causing_payment_id, reason)
  where causing_payment_id is not null and status <> 'failed';
create unique index subscription_refunds_one_upgrade_per_payment
  on public.subscription_refunds (payment_id)
  where reason = 'upgrade' and status <> 'failed';

alter table public.subscription_refunds enable row level security;  -- no policies
```

**Every way of creating a refund follows two rules,** and PR 3's three RPCs
are the only ones that do it: `settle_upgrade`, `queue_refund` and
`record_unwanted_charge`.

- **The clamp, under a lock on the payment row:** refundable = the payment's
  `amount_ngn` − Σ its refunds whose status isn't `failed`. A refund still in
  flight reserves its amount, so two refunds can't add up past what was paid.
- **Insert `on conflict do nothing`.** A second attempt meets the key or one
  of the unique indexes and creates nothing.

The table enforces both through the indexes and the check, whatever code calls
it.

**`billing_actions`: work owed to Paystack that may fail and must be retried.**
For example, switching off a subscription that a newer one replaced.

```sql
create table public.billing_actions (
  id                 uuid primary key default gen_random_uuid(),
  kind               text not null,          -- disable_subscription | create_subscription
  profile_id         uuid not null,
  subscription_code  text,
  email_token        text,
  payload            jsonb not null default '{}'::jsonb,   -- never an authorization code
  idempotency_key    text not null unique,
  attempts           integer not null default 0,
  last_error         text,
  claimed_until      timestamptz,
  created_at         timestamptz not null default now(),
  done_at            timestamptz
);
alter table public.billing_actions enable row level security;  -- no policies
```

PR 2 adds the runner.

**`subscriptions`: new columns**

| Column | Holds |
|---|---|
| `provider_email_token` | Paystack's `email_token`, needed to disable a subscription |
| `provider_plan_code` | |
| `provider_status` | Paystack's own status: active, non-renewing, attention, cancelled or complete |
| `card_last4`, `card_brand` | For "card ending 4081" (PR 2) |

**Never store an authorization code.** PR 3 fetches one from Paystack when it
needs it.

**`paystack_events`: what arrived, without the payload.** The payload carries
a customer's email and card details, so only the fields below are kept.

```sql
create table public.paystack_events (
  id                 uuid primary key default gen_random_uuid(),
  event              text not null,
  reference          text,
  subscription_code  text,
  outcome            text not null,
      -- ignored | settled | duplicate | unmatched | mismatch | duplicate_charge | stray | error
  received_at        timestamptz not null default now()
);
-- RLS on, no policies. Rolled off after 13 months by the daily cron, like app_events.
```

**`apply_subscription`: replaced.** The signature changes, so drop the old one,
create the new one, and restate the grants.

- **New parameters:**
  - `p_payment_kind text default null`;
  - `p_provider_email_token`, `p_provider_plan_code`, `p_provider_status`;
  - `p_card_last4`, `p_card_brand`;
  - `p_actions jsonb default '[]'`: billing actions to queue.
- **Queued with the payment, or not at all.** `p_actions` is inserted **in the
  same transaction** as the payment and the plan change, and only when the
  result is `'ok'`:
  - a `'duplicate'` queues nothing;
  - a rolled-back transaction queues nothing;
  - a committed one can't lose them.

  Each insert is `on conflict (idempotency_key) do nothing`, as a second guard.
  `apply_subscription` never creates a refund. PR 3's `settle_upgrade` wraps
  it: it calls `apply_subscription('start', …)` and, only on `'ok'`, computes
  and inserts the upgrade refund in the same transaction. That's how a Starter
  refund exists only if the Pro payment succeeded, and exists exactly once.
- **Duplicate first:** right after `select … for update` on the account, if
  `p_payment_reference` is set and already exists in `subscription_payments`,
  return `'duplicate'` and change nothing. The account lock serialises two
  deliveries of the same charge: the second waits, then sees the row.
- **Every paid write records the payment.** On `start`, `extend` and `apply`
  with `p_amount_ngn` not null, insert one `subscription_payments` row, linked
  to the row just started, extended or applied. The covered period is:

  | Action | `period_start` | `period_end` |
  |---|---|---|
  | `start` | `now()` | `p_period_end` |
  | `extend` | the old `period_end` | the new `period_end` |
  | `apply` | the activation time | the applied `period_end` |

  `p_payment_kind` defaults to `'manual'`.
- **`extend` keeps the subscription row's latest amount and reference** (the
  admin dialog shows them), but the history now lives in
  `subscription_payments`.
- **`schedule` stores provider fields** on the scheduled row:
  `provider_subscription_id`, `provider_customer_id`, the email token and the
  plan code. PR 3's downgrade needs them.
- **`apply` takes `p_period_end`** when given: Paystack's `next_payment_date`.
  Without it, the existing `now() + 1 month` default stands.
- **New action `attach`:** set the provider fields (and `period_end` if given)
  on the **active** row, changing no plan and writing no log line. Returns
  `'no_active'` when there isn't one. This is how a `subscription.create` that
  arrives after the charge fills in the codes.
- **Returns** gain `'duplicate'`.
- Rollback note: re-run `20261027_02`'s function. The new tables and columns
  can stay.

**Backfill:** one `subscription_payments` row per existing subscription with
`amount_ngn` not null:

- `kind 'manual'` and the row's period;
- `reference = coalesce(payment_reference, 'backfill-' || id)`;
- guarded with `on conflict (reference) do nothing`.

**Renewals already made by `extend` are not recoverable.** Only their latest
amount survived. Record the count of affected rows in §0 when you run it.

## §3 — MRR and the billing record read payments

- **`lib/subscriptions.ts`:**
  - `monthlyAmount(payment, refunds)` divides a payment's **own** amount, less
    its refunds that are `processed` or `settled_outside`, by its **own**
    period in months. A refund still in flight hasn't left the account yet, so
    it doesn't reduce MRR;
  - `mrr(payments, refunds, now)` sums the payments whose period covers `now`;
  - a comped period has no payment and adds nothing, as today.
- **`/admin`, `/admin/accounts`, `/admin/money`:** read `subscription_payments`
  and `subscription_refunds` through one shared query helper, instead of the
  active subscriptions.
  - `/admin/money` also shows **refunds in flight**: the sum and count of
    refunds not yet `processed`, `failed` or `settled_outside`. Money that's
    promised back but hasn't gone is shown, never hidden.
- **`lib/billingRecord.ts` / `lib/billingRecordDb.ts`:**
  - **Payment** rows come from `subscription_payments`, one per charge.
  - Each `subscription_refunds` row adds a **Refund** row with its status in
    words: "requested", "processing", "processed", "failed" or "paid back
    outside Paystack". The amount appears under its status, never as
    "refunded" unless it is.
  - An **upgrade** refund's detail is its stored calculation, in words. For
    example: "Upgrade to Pro (ref twnhall-sub-…) on 14 Nov. Starter paid 4 Nov
    (ref …), ₦15,000 for 4 Nov – 3 Dec. 19 of 30 days unused, Lagos time:
    ₦9,500." It's read from the row and never recomputed.
  - Everything else in the record is unchanged, and so is the anonymity rule.

## §4 — `app/api/webhooks/paystack/route.ts`

```text
POST
  rate limit: webhook:ip (429 makes Paystack retry later; nothing is lost)
  no PAYSTACK_SECRET_KEY            → 503, logged (Paystack retries)
  raw = await req.text()
  bad x-paystack-signature          → 401, nothing recorded
  JSON.parse fails                  → 400
  outcome = await handlePaystackEvent(parsed)   // lib/paystack/events.ts
  insert paystack_events (event, reference, subscription_code, outcome)
  → 200 { ok: true, outcome }
```

- `export const runtime = "nodejs"` and `dynamic = "force-dynamic"`.
- **Verify before anything else.** The raw body is verified; re-serialised JSON
  is different bytes. Port the tag's test that asserts this.
- `handlePaystackEvent()` returns `'ignored'` for every event in this PR. PR 2
  fills it in.
- **A handler that throws still records `outcome 'error'` and returns 500**, so
  Paystack redelivers it. Every handler must be safe to run twice, and §2's
  duplicate check is what makes that true for charges.
- No middleware runs here. That's correct, and the route never reads a session.

## §5 — Env

`.env.example` documents all three, server-only and never `NEXT_PUBLIC_`:

```bash
# Paystack (lib/paystack/). TEST keys and TEST plan codes in Preview and
# local; LIVE in Production only. The secret key also signs webhooks.
# Plans are created in the Paystack dashboard: monthly, NGN, amounts equal to
# lib/plans.ts amountNgn. For test mode, create them with a DAILY interval so
# renewals can be watched in a day (docs/specs/SPEC-paystack-subscriptions.md §15).
PAYSTACK_SECRET_KEY
PAYSTACK_PLAN_STARTER
PAYSTACK_PLAN_PRO
```

No public key is needed: the checkout redirects to Paystack's hosted page.

## §6 — Tests

- **`lib/__tests__/paystackSignature.test.ts`** (ported):
  - a valid signature passes;
  - a missing header, an empty secret or one changed character fails;
  - re-serialised JSON fails;
  - unequal lengths don't throw.
- **`lib/__tests__/paystackClient.test.ts`** (mocked `fetch`):
  - naira ↔ kobo at the boundary;
  - 4xx is permanent, 429 and 5xx are transient, a timeout is transient;
  - non-JSON gives transient;
  - `initializeTransaction` sends `plan` and `channels: ["card"]`.
- **`lib/__tests__/plans.test.ts`:** `formatNgn(amountNgn) === price.naira` for
  each paid plan.
- **`lib/__tests__/paystackFoundationMigration.test.ts`**, in the shape of
  `closedMigration.test.ts`:
  - the duplicate check comes after the account lock and before any write;
  - a payment insert exists on `start`, `extend` and `apply`;
  - `p_actions` is inserted only on the `'ok'` path, after the duplicate check;
  - `subscription_refunds` has the `upgrade_refund_explains_itself` check, with
    `period_end_on - period_start_on` (end excluded),
    `period_end_on - upgrade_on - 1`, and integer
    `(base_ngn * refundable_days) / days_in_period`;
  - both partial unique indexes exist and exclude `failed`;
  - `attach` writes no `admin_account_changes` line;
  - grants are restated to `service_role` only.
- **`lib/__tests__/subscriptions.test.ts`:**
  - **the MRR regression**: a ₦15,000 period renewed once gives MRR ₦15,000,
    not ₦7,500;
  - a **processed** refund reduces MRR; a pending one doesn't.
- **`lib/__tests__/billingRecord.test.ts`:**
  - two payments give two Payment rows;
  - a pending refund reads "requested", not "refunded";
  - a failed refund reads "failed";
  - an upgrade refund's detail names both references, the dates and the days,
    from the stored columns.
- **`app/api/webhooks/paystack/__tests__/route.test.ts`:**
  - a bad signature gives 401 and no event row;
  - no key gives 503;
  - a valid unknown event gives 200 `ignored` and one event row;
  - a handler that throws gives 500 with outcome `error`.

## §7 — Docs

**CLAUDE.md:**

- A new paragraph: "**Paystack is reached through `lib/paystack/` only.**" It
  should cover:
  - kobo at the boundary;
  - plan codes from env;
  - the webhook verifies the raw body first;
  - `subscription_payments` is the record of money in, written by
    `apply_subscription` in the same transaction as the plan, with the
    reference unique;
  - a refund is a `subscription_refunds` row with its own status, queued in
    the same transaction as the payment that causes it, and never counted as
    returned until `processed`.
- The Payments rule: "`subscription_payments` records money in. It is not a
  balance."
- The reference to the `payments-wip` tag: never merge it.

**`.env.example`:** as §5.

## Acceptance criteria

1. With the test secret key set, a Paystack test-mode webhook delivered through
   ngrok (`scripts/ngrok.mjs`) to a local server returns 200 and writes one
   `paystack_events` row. A forged one returns 401 and writes nothing.
2. On the backfilled data, `/admin/money` MRR equals what was actually paid for
   the current periods.
3. A manual renewal through the admin plan dialog adds a second
   `subscription_payments` row and leaves the first.
4. All four gates pass.

## Commit sequence

1. `docs(spec): paystack foundation`
2. `feat(lib): the paystack client and signature check, from payments-wip`
3. `feat(db): payments, refunds and billing actions; apply_subscription records and queues atomically`
4. `fix(billing): MRR and the billing record read payments`
5. `feat(api): the paystack webhook verifies and records`
6. `test: signature, client, the MRR regression, the migration`
7. `docs: paystack in CLAUDE.md and .env.example`

## Out of scope

- Any checkout, any handler, any copy change. These are PR 2 and PR 3.
- Creating the Paystack plans. That's the owner's task in the prompt; it needs
  the dashboard.
