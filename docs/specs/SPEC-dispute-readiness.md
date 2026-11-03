# SPEC: Dispute Readiness

**Status:** Ready — built 3 Nov 2026 at the owner's go-ahead. D1 (§5) changes no code; its answer goes in the PR description before merge.
**Branch:** `feat/dispute-readiness`
**Base:** `main`, after `feat/paid-report-carryover` (PR 2) merges. The alert reads the `carried` pool.
**Source:** `docs/TWNHALL_PAYSTACK_MSA_PROMPT.md`, PR 4; `docs/Twnhall_Paystack_MSA_Review.md` §2.2
**Migration:** one, next free date prefix. It seeds one `alert_rules` row.
**New dependency:** none
**New env var:** none
**Risk:** low. One admin-only download and one alert. Nothing a builder or
tester sees changes.

## Summary

Paystack's MSA, Section B (Card payments):

> "You agree to resolve chargeback Disputes via Paystack's portal and be liable
> for the transaction where you fail to respond within the stipulated period for
> resolving the Chargeback (16 hours or such other period as we may prescribe)
> or provide inaccurate or insufficient information for resolving Chargebacks."

High dispute rates, "typically those exceeding 1% of the total payment volume",
can end card acceptance.

That gives two jobs:

1. **Answer a dispute inside 16 hours, with evidence.** The evidence exists:
   `subscriptions` holds what was paid, and `report_ledger` and `test_results`
   hold what was published and delivered, to the second. But it's spread across
   an admin page and three tables. Nobody can assemble it at 2 a.m. inside the
   window. This PR adds **one download per builder** that is the evidence.
2. **Stop the dispute before it happens.** The likeliest reason is "value not
   given": a paying builder whose test case sits waiting for testers. The
   existing `unfilled_slots_ageing` alert treats every test case alike, after 7
   days. This PR adds **`paid_slots_waiting`**, which watches only paid slots,
   after 3 days.

## §0 — Verified before writing this

- `/admin/accounts/[id]` already shows a builder's subscription history, ledger
  balance by pool and an activity timeline (SPEC-admin-revamp, Phase 1). It's a
  page, not a file, and a page can't be uploaded to Paystack's portal.
- `app/api/admin/payouts/route.ts` is the pattern for an admin CSV:
  `requireAdmin()` itself (no middleware on `app/api`), `CSV_BOM + toCsv()`
  from `lib/csv.ts`, and a 403 with no body for a non-admin.
- Tester anonymity (CLAUDE.md): any file that leaves Twnhall identifies a tester
  only as "Tester N" (`testerNumbers()` in `lib/testerNumbers.ts`), never a
  name, email or id. This file is meant to go to a third party, Paystack and the
  card issuer, so the builder-export rule applies **even though an admin
  downloads it.**
- Alerts: rule keys live in `ALERT_RULE_KEYS` (`lib/alerts/rules.ts`), firing
  tests in `FIRES`, measurements in `lib/alerts/run.ts`, and the seed rows in
  `alert_rules` (`20261027_03_alerts.sql`: `key, name, description, severity,
  threshold, window_minutes, cooldown_minutes`).
- `unfilled_slots_ageing` (`run.ts:78`) counts any live test case short of
  `testers_needed` older than *t* days, measured from `missions.created_at`,
  not from when it was published.

## §1 — The billing record

### Pure: `lib/billingRecord.ts`

```ts
export type BillingEvent = {
  at: string          // ISO
  event: "Payment" | "Plan change" | "Test case published" | "Reports returned"
       | "Reports carried" | "Report delivered"
  testCase: string | null   // the builder's own title
  detail: string
  slots: number | null
  amountNgn: number | null
  reference: string | null
}

export function billingRecord(input: {
  subscriptions: …; planChanges: …; ledger: …; reports: …; missions: …
}): BillingEvent[]   // chronological, oldest first
```

| Event | From | Detail |
|---|---|---|
| Payment | `subscriptions` with `amount_ngn` not null | "{Plan}, {period_start} – {period_end}" (Lagos dates, `lagosDate()`), plus status and source |
| Plan change | `admin_account_changes`, field `plan_id` | "{from} → {to}". Never the admin's name, and never the reason: it's internal. |
| Test case published | `report_ledger` kind `reserved` | slots, and pool in words (paid this month / carried / signup grant / earned) |
| Reports returned | kind `released` | slots, and "unused when the test case closed" |
| Reports carried | kind `carried` | slots, and "came back after their month ended; do not expire" |
| Report delivered | `test_results` on the builder's test cases | `Tester {n}` from `testerNumbers()`, and the report's status |

Pure and import-light like `lib/payouts.ts`, so it's tested with fixtures.

### Read: `lib/billingRecordDb.ts`

Service-role reads for **one profile**:

- `subscriptions` by `profile_id`;
- `admin_account_changes` by `profile_id` where `field = 'plan_id'`;
- `report_ledger` by `profile_id`;
- the builder's missions (`id, title`, through `projects.owner_id`);
- `test_results` on those missions (`id, mission_id, created_at, status`).

**Never select `tester_id`**, the same rule as `loadFeedback()`.

### Route: `app/api/admin/accounts/[id]/billing-record/route.ts`

- `requireAdmin()` first; otherwise a 403 with no body.
- `id` must be a UUID, otherwise 404.
- Returns `CSV_BOM + toCsv(HEADERS, rows)`. Headers: Date (Lagos), Event, Test
  case, Detail, Reports, Amount (NGN), Reference.
- File name: `twnhall-billing-{first-name}-{yyyy-mm-dd}.csv`, sanitised.
- Test case titles are builder-written, so they go through `toCsv()`, which
  neutralises them.
- After the events: one empty row, then a final row with only the first column
  set: "Prepared by {MERCHANT.legalName} on {date}. Testers are identified by
  number only." CSV has no comment syntax, and a line above the headers would
  break the header row in a spreadsheet.

### Button

`/admin/accounts/[id]`, Plan panel: **"Download billing record"**, a plain link
to the route, next to the plan dialog. Builders only.

## §2 — The alert: `paid_slots_waiting`

- **Measurement** (`run.ts`), for every live test case (`is_active` null or
  true):
  - its ledger rows give `held()`, filtered to the paid pools `monthly` and
    `carried`;
  - its report count comes from `test_results`;
  - its **waiting since** is the `created_at` of its latest `reserved` row,
    i.e. when it was last published, not when the row was created.

  It fires for a test case whose paid held slots are more than its reports, and
  whose waiting-since is older than *threshold* days. The value is how many
  test cases match. The detail lists up to 20 `mission_ids`, for click-through.
  - **Grant is excluded on purpose.** The signup grant is free, and a free
    builder can't dispute a charge.
- **Rule:** `ALERT_RULE_KEYS` gets `paid_slots_waiting`, and `FIRES` uses
  `any`, because the threshold is already applied in the measurement, as for
  `unfilled_slots_ageing`.
- **Seed row:**
  ```sql
  insert into public.alert_rules (key, name, description, severity, threshold, window_minutes, cooldown_minutes) values
    ('paid_slots_waiting', 'Paid test case waiting',
     'A paying builder has waited this many days for testers. Find supply before it becomes a dispute.',
     'warning', 3, null, 1440)
  on conflict (key) do nothing;
  ```
- `unfilled_slots_ageing` stays as it is. One watches supply in general; this
  one watches money.

## §3 — The runbook (not code; goes in the PR description)

When Paystack emails about a dispute:

1. **Inside the 16 hours, reply in Paystack's portal.** Missing the window loses
   the dispute by default.
2. Find the builder by the customer email on the dispute, in `/admin/accounts`.
3. Download the billing record. Check the disputed payment's row, and the
   reports delivered in that period.
4. Answer with three things:
   - what was bought (link `/pricing`, and `/refunds` as it stood on the date);
   - what was delivered (the record);
   - the confirmation email the builder got for that period.
5. If reports weren't delivered, **refund instead of contesting.** It costs less
   than a lost dispute and the fee on it, and it protects the dispute rate.
6. Note the outcome against the builder in the admin, so the next person knows.

**Who watches** the inbox the Paystack account is registered to is an owner
decision (D1). It isn't a spec decision.

## §4 — Tests

**`lib/__tests__/billingRecord.test.ts`**

- Events come out in order.
- A comped subscription (amount null) isn't a Payment row.
- A delivered report shows as "Tester N", and nothing in the output contains a
  tester id, name or email (fixtures with a hostile tester name).
- A carried row reads as "Reports carried".
- The admin's reason never appears.

**`app/api/admin/accounts/[id]/billing-record/__tests__/route.test.ts`**

- A non-admin gets 403 with no body.
- A non-UUID gets 404.
- A builder-written title starting `=` comes out neutralised.

**`lib/__tests__/alertRules.test.ts` and `alertRun.test.ts`**

`paid_slots_waiting`:

- a paid slot waiting 4 days fires;
- 2 days doesn't;
- a grant-only test case doesn't;
- a full one doesn't;
- a closed one doesn't;
- a reopened test case measures from its latest reservation.

## §5 — Decisions

**D1 — Decided 3 Nov 2026: by email, from the inbox.** Paystack's dispute
emails go to the inbox the Paystack account is registered to, and that inbox
is how disputes are noticed. The answer itself, with the billing record
attached, is submitted in Paystack's dashboard (MSA Section B: "resolve
chargeback Disputes via Paystack's portal"), inside 16 hours. Still to name:
the address and who checks it, with a backup.

**D1 — Who answers Paystack disputes, and from which inbox?** It's an owner
decision, and the PR records the answer in its description. Recommend: the
inbox the Paystack account is registered to forwards to a phone someone
actually checks, with a second person as backup.

## Acceptance criteria

1. An admin downloads a builder's billing record. It opens in a spreadsheet,
   shows payments, publishes, returns, carries and deliveries in date order,
   and identifies testers only by number.
2. On a preview deployment, a Starter test case left 3+ days with paid slots
   unfilled opens the alert; filling or closing it resolves the alert at the
   next run.
3. All four gates pass.

## Commit sequence

1. `docs(spec): dispute readiness`
2. `feat(lib): the billing record, as pure arithmetic`
3. `feat(admin): download a builder's billing record`
4. `feat(db): seed the paid-slots-waiting rule`
5. `feat(alerts): watch paid test cases waiting for testers`
6. `test: billing record anonymity and the paid-slots alert`
7. `docs: dispute readiness in CLAUDE.md`

For the last commit, add one paragraph to CLAUDE.md beside the alerts and
export rules: "A billing record is evidence that leaves Twnhall: Tester N only".

## Out of scope

- Receiving Paystack dispute webhooks (`charge.dispute.*`). That needs the
  checkout. When it lands, the webhook should open an alert, and this PR's
  record is what answers it.
- A money ledger for refunds. Refunds happen in Paystack or by transfer, and
  are noted on the subscription row's `reason` through the existing admin
  dialog.
