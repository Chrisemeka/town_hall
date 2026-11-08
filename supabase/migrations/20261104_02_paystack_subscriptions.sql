-- Paystack subscriptions: checkouts and two billing alerts.
-- Spec: docs/specs/SPEC-paystack-subscriptions.md. billing_actions is 20261104_01's.
--
-- APPLY BEFORE THE CODE DEPLOYS. Safe to re-run the seed.
-- Rollback: drop the table and delete the two rows.

-- One row per trip to Paystack's hosted page. Nothing is granted here: the row
-- only proves the builder reached Paystack, and ties the reference to them.
create table public.paystack_checkouts (
  reference                 text primary key,
  profile_id                uuid not null,
  plan_id                   text not null,       -- starter | pro
  kind                      text not null,       -- new | resubscribe
  replaces_subscription_id  uuid references public.subscriptions(id) on delete set null,
  authorization_url         text,
  access_code               text,
  created_at                timestamptz not null default now(),
  completed_at              timestamptz,
  superseded_at             timestamptz
);

-- A double-click, a refresh or a second tab all land on the same page with the
-- same reference, so they can only ever be paid once. Two concurrent starts:
-- one wins this index and the other reads its row.
create unique index paystack_checkouts_one_open
  on public.paystack_checkouts (profile_id, plan_id, kind)
  where completed_at is null and superseded_at is null;

alter table public.paystack_checkouts enable row level security;  -- no policies

insert into public.alert_rules (key, name, description, severity, threshold, window_minutes, cooldown_minutes) values
  ('billing_mismatch', 'Payment that granted nothing',
   'Money arrived that did not become a plan: a payload that did not match a price, a charge nothing recognised, or a builder who paid twice. Look it up in the Paystack dashboard, and refund it if it should not stand.',
   'critical', 0, 10080, 360),
  ('billing_actions_failing', 'Paystack action failing',
   'Something owed to Paystack has not happened after 3 attempts or 24 hours. A subscription that should be off may still charge. Disable it in the Paystack dashboard.',
   'critical', 0, null, 360)
on conflict (key) do nothing;
