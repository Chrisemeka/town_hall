-- Alerts: rules that are expected to read zero, and the alerts they open.
-- Spec: docs/specs/SPEC-admin-revamp.md, Phase 2.
--
-- The arithmetic of each rule is lib/alerts/rules.ts (pure); the inputs and
-- the open / bump / resolve / email cycle are lib/alerts/run.ts. These tables
-- only hold what a rule is set to and what it last saw. Service role only.

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
  acknowledged_by  uuid,
  acknowledged_at  timestamptz,
  resolved_at      timestamptz
);
-- One live alert per rule: a rule still firing bumps it, never opens a second.
create unique index alerts_one_live on public.alerts (rule_key) where status <> 'resolved';
create index alerts_status_idx on public.alerts (status, last_seen_at);

alter table public.alert_rules enable row level security;
alter table public.alerts enable row level security;
-- No policies: service role only.

-- Starting rules. Thresholds are first guesses, editable on /admin/alerts.
-- Budgets (cohort ₦, AI $) are placeholders until set — see the spec's open
-- question 5.
insert into public.alert_rules (key, name, description, severity, threshold, window_minutes, cooldown_minutes) values
  ('uncredited_reports',      'Uncredited reports',        'A tester wrote a report and got no credit. Make them whole.',                     'critical', 0,      null,  360),
  ('server_errors',           'Server errors',             'Pages or actions are failing. Check the errors and the last deploy.',              'critical', 5,      15,    60),
  ('rate_limit_degraded',     'Rate-limit store degraded', 'The limiter fell back to memory. Check the database.',                             'critical', 1,      15,    60),
  ('mission_closed_unfilled', 'Test case closed unfilled', 'A builder paid for reports they did not get. Find out why.',                       'warning',  0,      10080, 1440),
  ('reports_pending_review',  'Reports waiting on review', 'Reports older than this many days are unreviewed. Nudge the builders.',            'warning',  14,     null,  1440),
  ('unfilled_slots_ageing',   'Unfilled slots ageing',     'Live test cases have waited this many days for testers. Find supply.',             'warning',  7,      null,  1440),
  ('ai_failure_rate',         'AI failure rate',           'More than this % of analyses failed in 24 hours. Check Gemini.',                   'warning',  10,     1440,  360),
  ('email_failures',          'Email failures',            'Email is failing to send. Check Resend.',                                          'warning',  1,      60,    360),
  ('rate_limit_spike',        'Rate-limit spike',          'Someone is hammering a limited route. Look at which rule.',                        'warning',  50,     60,    360),
  ('signups_stalled',         'Signups stalled',           'People are visiting and nobody is signing up. Check the signup path.',             'warning',  0,      2880,  1440),
  ('cohort_over_budget',      'Cohort cost over budget',   'This month''s cohort cost is over budget (₦). Slow cohort-eligible work.',         'info',     230000, null,  1440),
  ('ai_over_budget',          'AI spend over budget',      'This month''s AI spend is over budget ($).',                                       'info',     25,     null,  1440),
  ('subscription_lapsing',    'Subscription lapsing',      'A paid plan ends within this many days. Renew it or let it lapse.',                'info',     3,      null,  1440),
  ('flagged_projects',        'Flagged projects',          'Flagged projects are waiting on a decision.',                                     'info',     0,      null,  1440);

-- ── Every 10 minutes, without Vercel Pro ──────────────────────────────────
-- Vercel Hobby runs cron once a day, so vercel.json only schedules the daily
-- job (which evaluates alerts too). For 10-minute evaluation, either move to
-- Vercel Pro and add {"path": "/api/cron/alerts", "schedule": "*/10 * * * *"},
-- or enable pg_cron + pg_net in Supabase and run, once, with the real values:
--
--   select cron.schedule('twnhall-alerts', '*/10 * * * *', $$
--     select net.http_get(
--       url := 'https://twnhall.com/api/cron/alerts',
--       headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
--     ) $$);

-- Rollback:
--   drop table public.alerts;
--   drop table public.alert_rules;
