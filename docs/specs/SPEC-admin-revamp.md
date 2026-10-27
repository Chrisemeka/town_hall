# SPEC: Admin Console Revamp

**Status:** Built, Phases 0–5 (27 October 2026). Open questions below still stand.
**Date:** 27 October 2026
**Branch plan:** one branch per phase, each off `main` after the previous merges (see *Phases*)
**Source:** `docs/Twnhall_Admin_Metrics.md` (what to measure and why) + the admin audit of 27 Oct 2026 (below)
**Migrations:** five, one per phase that needs one — listed in each phase
**Risk:** medium. Phase 3 touches `accounts.plan_id`, which the allowance reads at publish. Everything else is additive.

## Summary

Turns `/admin` from a set of lifetime counters into an operating console that:

1. **records** traffic and in-app activity in first-party tables,
2. **shows** the numbers that change a decision, over a date range,
3. **alerts** by email and an in-app bell when something goes wrong, and
4. **manages tiers** through a subscription record that a manual admin change drives today and a checkout can drive later.

## Decisions taken at review (27 Oct)

| Question | Decision |
|---|---|
| Tracking | **First-party tables in Supabase.** No PostHog, no Vercel Analytics. |
| Alert channels | **Email (Resend) + in-app bell.** No Slack/Telegram/WhatsApp for now. |
| Plan changes | **Prepare for checkout.** Build the subscription model a Paystack/Flutterwave webhook can drive later; today only an admin writes to it. |
| Delivery | This spec, then build phase by phase. |

---

## Audit — what exists today

**Nav:** Dashboard · Users · Projects · Test Cases · Submissions · AI Reports · Payouts · Email (8 pages, 13 components in `components/admin/`, 4 action files in `actions/admin/`, `/api/admin/payouts`).

| Page | Today | Verdict |
|---|---|---|
| `/admin` | Welcome + `LiveClock`; 7 KPI tiles (Users, Projects, Test Cases, Submissions, AI Reports, Flagged, Uncredited); 6 `NavCard`s duplicating the top nav; recent activity (last 5 signups + 5 reports + 5 flags, merged) | Rebuild. 5 of 7 tiles are lifetime counts; no time window anywhere. |
| `/admin/users` | Every auth user loaded (up to 50 × 200 pages), all `projects` and `test_results` rows loaded to count in JS; signups chart; role chart; suspend/ban; **`UserPlanControl`**; `CohortControl`; last 20 plan/cohort changes | Rebuild as Accounts. Controls are right, page is wrong. |
| `/admin/projects`, `/missions`, `/missions/[id]`, `/submissions` | Three overlapping lists, each with lifetime KPIs, each loading whole tables | Merge into Content; move counting into SQL. |
| `/admin/ai-reports` | Spend this month, median/p95 cost, failure rate, coverage, sentiment | **Keep.** Already the right shape. |
| `/admin/payouts` | Monthly cohort sheet + CSV | **Keep.** Fold under Money. |
| `/admin/email` | Broadcast to one or all | **Keep.** |

### Against the three goals

- **Traffic + activity — absent.** No analytics library, no page-view record, no event table. Logins, exports, PDF downloads, capped/refused publishes, rate-limit hits are recorded nowhere. The funnel in Admin Metrics §6 is buildable only from timestamps that already exist; everything else is unrecorded.
- **Alerts — absent.** Two passive tiles (Flagged, Uncredited) only seen if someone opens `/admin`. `[allowance] missed credit` and `[rate-limit] store unavailable` go to `console.error` only. No `instrumentation.ts`, no `app/error.tsx`, no `app/global-error.tsx` — server errors are invisible outside Vercel logs.
- **Tier changes — half built.** `UserPlanControl` → `setUserPlan` → `set_account_field` RPC works and is logged in `admin_account_changes`. Missing: search, confirmation, reason, payment reference, end date / lapse, user notification, a per-tier count, MRR.

### Smaller findings

- `/admin/users` KPI "Test Cases Done" counts `test_results` rows — it is **reports filed**.
- `Twnhall_Admin_Metrics.md` prices Pro at **$19** and break-even at **6.8 customers**; `lib/plans.ts` now has Starter ₦15,000 / Pro ₦30,000 (~$22), per compensation doc §7. Any money tile reads `lib/plans.ts`, and the metrics doc needs its §3.5/§5 numbers refreshed.
- Every list page is O(table size) in memory. Fine today; slow at a few thousand rows.

---

## Non-goals

- **No checkout, no payment capture.** Phase 3 prepares the data model and a provider-agnostic entry point. Taking money is a later, explicit piece of work — and reverses the "product moves no money" line in `CLAUDE.md`, which must be rewritten when it ships (builder billing only; the cohort stays paid outside the product).
- No third-party analytics, no session replay, no heatmaps.
- No change to the allowance rules: still spent at publish, never at submission; `lib/allowance.ts` stays the one place the arithmetic lives.
- No anonymity change: admin keeps real names and emails.
- No automatic rating cut-off.

## House rules this follows

Service-role reads through `createAdminClient()`; `requireAdmin()` re-checked inside every page, action and route (`app/api` has no middleware); explicit column lists; new tables RLS-on with no policies; Zod at every boundary; months on Africa/Lagos via `monthOf()`; writers that must never break the user path swallow their own failures (the `recordAiUsage()` pattern) and run in `after()`.

---

## Information architecture

**Nav (9):** Overview · Traffic · Activity · Accounts · Content · AI · Money · Email · 🔔 Alerts

Nine items no longer fit a top bar. **Desktop moves to a left sidebar**; mobile keeps the sheet. The bell sits in the header with an unread count on every admin page.

| Remove | Why |
|---|---|
| Welcome header + `LiveClock` | Takes the most valuable screen space and answers nothing |
| 6 `NavCard`s | Duplicate the nav |
| Users / Projects / Test Cases / Submissions / AI Reports tiles | Lifetime counts (Admin Metrics §12) |
| Sentiment tiles on Submissions | Duplicated on AI |
| `RoleDistributionChart` | Replaced by active builders / testers, which can go down |

| Keep | Where it goes |
|---|---|
| Flagged, Uncredited reports | Become alert rules + the Overview alarm row |
| Signups chart | Traffic → visitor-to-signup |
| Suspend / ban / reactivate, `CohortControl` | Account detail page |
| `UserPlanControl` | Replaced by the plan dialog (Phase 3) |
| AI page, Payouts, Email | As they are; Payouts under Money |

---

## Phase 0 — Instrumentation (`feat/admin-instrumentation`)

**Goal:** start the clock. Every later page is only as good as the days of data behind it, so this ships first and alone.

### Migration `2026xxxx_01_admin_events.sql`

```sql
create table public.page_views (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  visitor_id    uuid not null,          -- first-party cookie th_vid, 1 year, random
  session_id    uuid not null,          -- th_sid, rolling 30 minutes
  profile_id    uuid,                   -- no FK: survives profile deletion as anonymous
  account_type  text,                   -- builder | tester | null
  path          text not null,          -- normalised: ids -> [id], query dropped
  referrer_host text,
  utm_source    text, utm_medium text, utm_campaign text,
  country       text,                   -- x-vercel-ip-country, 2 letters
  device        text                    -- mobile | tablet | desktop
);
create index on public.page_views (occurred_at);
create index on public.page_views (visitor_id, occurred_at);

create table public.app_events (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  name          text not null,          -- from EVENT_NAMES in lib/events.ts
  profile_id    uuid,
  account_type  text,
  subject_type  text,                   -- project | mission | test_result | account ...
  subject_id    uuid,
  props         jsonb not null default '{}'::jsonb
);
create index on public.app_events (name, occurred_at);
create index on public.app_events (profile_id, occurred_at);

alter table public.page_views enable row level security;
alter table public.app_events enable row level security;
-- no policies: service role only
```

**No raw IP is stored.** Country comes from the platform header; nothing else identifies a logged-out visitor.

### Collection

- **Page views — `components/Tracker.tsx`** (client, in the root layout): on each route change, `navigator.sendBeacon("/api/track", …)` with path, referrer, UTM. JS-only collection filters most bots for free.
- **`app/api/track/route.ts`**: sets/reads `th_vid` and `th_sid`, derives device from UA, country from header, `profile_id` from the session if any; drops known bot UAs, `/admin/**`, and admin profiles; rate-limited with a new `track` rule in `lib/rateLimit.ts`; inserts and returns 204. Never errors to the client.
- **Events — `lib/events.ts`**: `EVENT_NAMES` (closed list, Zod-checked) and `recordEvent()` that swallows failures, called inside `after()`.

### Event catalogue — only what no row records already

Funnel gates, project creation, publishes, reports and reviews already have timestamps on their rows; they are **read**, not duplicated.

| Event | Fired in |
|---|---|
| `auth.login`, `auth.logout`, `auth.password_reset_requested` | `actions/auth.ts` |
| `account.switched` | account picker |
| `allowance.capped`, `allowance.refused` | `lib/allowanceDb.ts` publish path |
| `allowance.missed_credit` | beside the existing `console.error` |
| `export.csv`, `export.pdf` | `app/api/export/**` |
| `rate_limit.hit`, `rate_limit.store_degraded` | `lib/rateLimitDb.ts` |
| `email.sent`, `email.failed` | `lib/mail.ts` (props: template, no body) |
| `error.server` | `instrumentation.ts` → `onRequestError` (path, digest, message ≤ 500 chars) |
| `plan.changed` | Phase 3 RPC (also logged in `admin_account_changes`) |

### Also in Phase 0

- `app/error.tsx` and `app/global-error.tsx` — there are none today.
- **Time per report** (Admin Metrics §10): `AuditLogForm` records `startedAt` on first interaction, submits it, stored as `test_results.started_at`. Read the median, never the mean.
- **Retention:** raw `page_views` 90 days, then rolled into `traffic_daily` (date, path, visitors, views, sessions, signups); `app_events` 13 months. Swept by the Phase 2 cron.
- **Privacy page** gains a short first-party analytics section (see *Open questions*).

**Acceptance:** a logged-out visit, a login, an export and a forced server error each produce one row; `/admin` paths and admin users produce none; a dead database never breaks a page load.

---

## Phase 1 — Accounts and subscriptions (`feat/admin-subscriptions`)

**Goal:** upgrade and downgrade properly, with a record a checkout can drive later.

### Model

`accounts.plan_id` **stays** the field the allowance reads at publish — so `lib/allowance.ts`, `allowanceDb.ts` and their tests do not change. A new `subscriptions` table is the history and the source of truth for *why* `plan_id` holds what it holds.

### Migration `2026xxxx_01_subscriptions.sql`

```sql
create table public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  account_id                uuid references public.accounts(id) on delete set null,
  profile_id                uuid not null,             -- denormalised, no FK
  plan_id                   text not null,             -- starter | pro
  status                    text not null,             -- scheduled | active | cancelled | expired
  source                    text not null default 'manual',  -- manual | paystack | flutterwave
  period_start              timestamptz not null,
  period_end                timestamptz,               -- null = open-ended (comped)
  amount_ngn                integer,                   -- what was actually paid; null if comped
  payment_reference         text,
  provider_customer_id      text,
  provider_subscription_id  text,
  reason                    text not null,
  created_by                uuid,                      -- admin; null = system or provider
  created_at                timestamptz not null default now(),
  ended_at                  timestamptz
);
-- one active subscription per account
create unique index on public.subscriptions (account_id) where status = 'active';
```

**One writer: RPC `apply_subscription(...)`** — in one transaction: writes/updates the subscription row, sets `accounts.plan_id` (Community still written as **null**), logs to `admin_account_changes` (`changed_by` null for system/provider). `set_account_field` keeps the cohort path; its `plan_id` branch is retired so there is one way to change a plan.

### Actions (`actions/admin/subscriptions.ts`)

- `upgradeOrChangePlan({ userId, planId, periodEnd, amountNgn?, paymentReference?, reason, notify })` — takes effect now.
- `downgrade({ userId, when: "now" | "period_end", reason, notify })` — `period_end` writes a `scheduled` row the cron applies.
- `extend({ subscriptionId, newPeriodEnd, paymentReference?, amountNgn? })` — renewal.
- All Zod-parsed, `requireAdmin()`, revalidate `/admin/accounts`, `/settings`.
- **Provider entry point (not wired):** `lib/billing.ts` exports `applyProviderEvent(event)` calling the same RPC with `source` and provider ids. The future webhook route is a thin verifier around it.

### Lapse and reminders — `app/api/cron/daily/route.ts`

Runs daily (Vercel Cron, `CRON_SECRET` header). Expires `active` rows whose `period_end` has passed → plan back to Community; applies due `scheduled` downgrades; emails builder **and** admin 3 days before `period_end`; sweeps old `page_views`/`rate_limits`.

**Allowance effect, stated plainly:** monthly allowance is derived from the plan at publish. A mid-month downgrade drops the remaining monthly pool to the new plan's; slots already reserved stay reserved. A mid-month upgrade gives the new plan's full month. (Proration: *Open questions*.)

### UI

- **`/admin/accounts`** — server-paginated (50), search by name/email, filters: role, plan, cohort, moderation, signed up, last active. Counting moves into SQL (`admin_account_list` RPC or view).
- **Tier summary strip:** Community / Starter / Pro counts · **MRR from `subscriptions.amount_ngn`** (what was paid, not list price) · expiring in the next 7 days.
- **`/admin/accounts/[id]`** — identity, both accounts, gate timestamps, plan + subscription history, ledger balance by pool, cohort membership, moderation actions, and an **activity timeline** merging `app_events`, projects, missions, reports and reviews.
- **Plan dialog** replaces the dropdown: plan, period end (default +1 month), amount, payment reference, **reason (required)**, notify user (default on), and a confirmation line spelling out the allowance effect. New email: `emails/PlanChangedEmail.tsx`.
- Fix the "Test Cases Done" label → "Reports filed".

**Acceptance:** an upgrade, a scheduled downgrade and a lapse each leave one subscription row, one `admin_account_changes` row and the correct `plan_id`; `allowance.test.ts` passes untouched; the user is emailed when `notify` is on.

---

## Phase 2 — Alerts (`feat/admin-alerts`)

### Migration `2026xxxx_01_alerts.sql`

```sql
create table public.alert_rules (
  key               text primary key,
  name              text not null,
  description       text not null,       -- the action it demands, one line
  severity          text not null,       -- info | warning | critical
  threshold         numeric,
  window_minutes    integer,
  cooldown_minutes  integer not null default 360,
  email             boolean not null default true,
  enabled           boolean not null default true
);

create table public.alerts (
  id               uuid primary key default gen_random_uuid(),
  rule_key         text not null references public.alert_rules(key),
  status           text not null default 'open',   -- open | acknowledged | resolved
  value            numeric,
  detail           jsonb not null default '{}'::jsonb,  -- ids to click through to
  first_seen_at    timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  notified_at      timestamptz,
  acknowledged_by  uuid, acknowledged_at timestamptz,
  resolved_at      timestamptz
);
create unique index on public.alerts (rule_key) where status <> 'resolved';  -- one live alert per rule
```

### Evaluation

- `lib/alerts/rules.ts` — one pure function per rule: input numbers in, `{ firing, value, detail }` out. Unit-tested.
- `lib/alerts/run.ts` — queries the inputs, upserts `alerts` (open, or bump `last_seen_at`), **auto-resolves** when a rule stops firing, emails when an alert opens or when `cooldown_minutes` has passed and it is still open.
- `app/api/cron/alerts/route.ts` — every 10 minutes. **Vercel Hobby only runs cron once a day** (*Open questions*); fallback is Supabase `pg_cron` + `pg_net` calling the same route.
- **Critical alerts don't wait for the cron:** `error.server` bursts and `allowance.missed_credit` call `run.ts` for their own rule inside `after()`.

### Starting rules — thresholds are first guesses, editable on the page

| Rule | Fires when | Severity |
|---|---|---|
| Uncredited reports | > 0 | critical |
| Server errors | ≥ 5 `error.server` in 15 min | critical |
| Rate-limit store degraded | any `rate_limit.store_degraded` in 15 min | critical |
| Mission closed unfilled | > 0 in last 7 days | warning |
| Reports pending review | any older than 14 days | warning |
| Unfilled slots ageing | any live mission slot unfilled > 7 days | warning |
| AI failure rate | > 10% over 24 h, ≥ 5 analyses | warning |
| Email failures | ≥ 1 `email.failed` in 1 h | warning |
| Rate-limit spike | ≥ 50 `rate_limit.hit` in 1 h | warning |
| Signups stalled | 0 signups in 48 h while traffic > 0 | warning |
| Cohort cost over budget | month-to-date > budget | info |
| AI spend over budget | month-to-date > budget | info |
| Subscription lapsing | `period_end` within 3 days | info |
| Flagged projects | > 0 unresolved | info |

### UI

- **Bell** in the admin header: count of open alerts, critical in red; dropdown of the latest five.
- **`/admin/alerts`** — Open · Acknowledged · History tabs; each alert links to what it is about; Acknowledge / Resolve; a Rules tab to enable/disable, set threshold, cooldown and email.
- Alert email (`emails/AdminAlertEmail.tsx`) to every admin profile: rule, value, one-line action, link.

**Acceptance:** forcing each critical rule opens one alert, sends one email, shows on the bell; clearing the condition resolves it; a still-firing alert does not re-email inside its cooldown.

---

## Phase 3 — Overview (`feat/admin-overview`)

Rebuilt from Admin Metrics §3 and §9. **Date range control** (7 / 30 / 90 days / month, Lagos time) applies to everything below the alarm row.

1. **Alarm row** — open alerts by severity, each clickable. Reads zero when healthy.
2. **Five health numbers**, each with a one-line *decision it informs* and a 6-month sparkline:
   time to fill (median + p95) · reports delivered vs capacity · cohort cost · cohort-served share · paying builders vs break-even.
3. **Traffic snapshot** — visitors, signups, visitor→signup rate, vs previous period.
4. **Money snapshot** — MRR, AI spend, cohort cost, gross margin.
5. **Live activity** — last 20 from `app_events` + row timestamps, filterable.

Break-even and MRR read `lib/plans.ts` and `subscriptions`; FX rate and its date shown beside any converted figure.

---

## Phase 4 — Traffic and Activity (`feat/admin-traffic-activity`)

Ships after Phase 0 has 3+ weeks of data.

- **Traffic:** visitors, sessions, views (trend); top pages; referrers; UTM campaigns; countries; devices; visitor → signup conversion by source. Reads `traffic_daily` beyond 90 days.
- **Activity:**
  - **Signup funnel** (Admin Metrics §6) from existing timestamps: visit → signup → `email_confirmed_at` → `accepted_terms_at` → account created → `verification_completed_at` → first action, with drop-off per step.
  - **Activation:** builder (signup → project → mission published → first report received) and tester (signup → verified → first report), with **time to first value**.
  - **Retention:** monthly cohorts; second mission / second report rates; MAU builders and testers.
  - **Quality:** rating distribution, review backlog and age, pass/fail/blocked mix, time per report (median).
  - **Event explorer:** filter `app_events` by name, user, date.

---

## Phase 5 — Consolidation (`chore/admin-consolidate`)

- **Content** = Projects + Test Cases + Reports as tabs, one server-paginated table each; moderation actions kept; mission detail kept.
- **Money** = Payouts (unchanged) + MRR, infra cost (constant in `lib/costs.ts`, dated), AI spend, cohort cost, cost per report delivered, gross margin per paying builder, runway.
- Move every remaining in-memory count to SQL.
- Delete the retired components (`NavCard`, `KpiTile` duplicates, `LiveClock`, `RoleDistributionChart`, `UserPlanControl`).
- Update `CLAUDE.md` (new tables, writers, the subscription rule) and `docs/Twnhall_Admin_Metrics.md` (prices).

---

## Phase order and why

| # | Branch | Why here |
|---|---|---|
| 0 | `feat/admin-instrumentation` | Data needs time to accumulate; everything reads it |
| 1 | `feat/admin-subscriptions` | Your explicit ask; independent of traffic data |
| 2 | `feat/admin-alerts` | Uses Phase 0 events and existing rows; stops silent failures |
| 3 | `feat/admin-overview` | Needs alerts and subscriptions to show |
| 4 | `feat/admin-traffic-activity` | Needs weeks of Phase 0 data to be worth reading |
| 5 | `chore/admin-consolidate` | Clean-up once the new pages exist |

Each phase: migration → lib (pure, tested) → actions/routes → UI → tests → `CLAUDE.md` note.

## Open questions

1. **Vercel plan.** Hobby runs cron once a day — enough for lapses, not for 10-minute alerts. Pro, or `pg_cron` + `pg_net` on Supabase?
2. **Analytics notice.** The privacy page needs a first-party analytics paragraph, and Nigeria's NDPA may expect a consent banner for non-essential cookies. Banner, or notice only? (Worth a check with whoever advises you on compliance.)
3. **Proration.** Mid-month upgrade: full new allowance immediately (proposed), or pro-rated?
4. **Alert recipients.** Every admin profile (proposed), or a fixed list / a separate ops address?
5. **Budgets** for the cohort-cost and AI-spend alerts — what monthly figures?
6. **Exclude your own traffic** beyond admin profiles — e.g. a cookie set on your devices?
7. **Prices.** Confirm `lib/plans.ts` (Starter ₦15k, Pro ₦30k) is current, so the metrics doc can be corrected to match.
