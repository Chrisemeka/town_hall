-- Paystack foundation. Spec: docs/specs/SPEC-paystack-foundation.md.
--
-- Money in one direction only: these tables record what builders paid and what
-- is owed back to them. subscription_payments is a record, not a balance or a
-- wallet, and nothing pays out of it.
--
-- APPLY BEFORE THE CODE DEPLOYS. The old code still works against this function
-- (every new parameter has a default); the new code reads tables only this
-- migration creates.
--
-- Rollback: re-run apply_subscription from 20261027_02, after dropping this
-- signature. The new tables and columns can stay.

-- ── subscription_payments: the record of money in ─────────────────────────
create table public.subscription_payments (
  id               uuid primary key default gen_random_uuid(),
  subscription_id  uuid references public.subscriptions(id) on delete set null,
  profile_id       uuid not null,             -- denormalised, outlives the account
  source           text not null,             -- manual | paystack
  reference        text not null unique,      -- the idempotency key
  amount_ngn       integer not null,
  kind             text not null,             -- first | renewal | upgrade | resubscribe | manual | stray | duplicate
  period_start     timestamptz not null,
  period_end       timestamptz,
  created_at       timestamptz not null default now()
);
create index subscription_payments_profile_idx on public.subscription_payments (profile_id, created_at);
alter table public.subscription_payments enable row level security;  -- no policies

-- ── subscription_refunds: one row per refund, each with its own life ──────
-- A refund is a request Paystack may accept, process, fail or park. Nothing
-- reads one as done until its status is processed (or settled_outside).
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

  -- How an upgrade refund was worked out (plan changes spec §2.1). Null on other reasons.
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
  claimed_until               timestamptz,    -- a runner's lease
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

-- ── billing_actions: work owed to Paystack that may fail and must be retried ─
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

-- ── paystack_events: what arrived, without the payload ────────────────────
-- The payload carries a customer's email and card details, so only these
-- fields are kept. Rolled off after 13 months by the daily cron, like app_events.
create table public.paystack_events (
  id                 uuid primary key default gen_random_uuid(),
  event              text not null,
  reference          text,
  subscription_code  text,
  outcome            text not null,
      -- ignored | settled | duplicate | unmatched | mismatch | duplicate_charge | stray | error
  received_at        timestamptz not null default now()
);
alter table public.paystack_events enable row level security;  -- no policies

-- ── subscriptions: what Paystack calls this row. Never an authorization code. ─
alter table public.subscriptions
  add column provider_email_token text,      -- needed to disable a subscription
  add column provider_plan_code   text,
  add column provider_status      text,      -- active | non-renewing | attention | cancelled | complete
  add column card_last4           text,
  add column card_brand           text;

-- ── apply_subscription ────────────────────────────────────────────────────
-- Still the ONE writer of accounts.plan_id. New in this version:
--   - a payment reference already recorded returns 'duplicate' and changes
--     nothing, checked under the account lock, so two simultaneous deliveries
--     of one charge serialise: the second waits, then sees the row;
--   - every paid start, extend and apply writes one subscription_payments row;
--   - 'attach' fills provider fields on the active row: no plan change, no log;
--   - p_actions are queued in this transaction, only when the result is 'ok'.
-- It never creates a refund.
--
-- p_action:
--   'start'     a new active subscription for p_plan_id (starter|pro), now.
--               Ends any active one ('cancelled') and drops a scheduled one.
--   'schedule'  a change that waits for the active period to end. p_plan_id
--               may be 'community'. Replaces any earlier scheduled row.
--   'end'       ends the active subscription now with p_end_status
--               ('cancelled' or 'expired'); plan back to Community (null).
--   'extend'    moves the active row's period_end (renewal), optionally
--               recording what was paid. Plan unchanged, so no log line.
--   'apply'     a due scheduled row becomes active (or, for community, ends
--               the active one). p_subscription_id names it. p_period_end,
--               when given, is Paystack's next_payment_date.
--   'attach'    provider fields, and period_end if given, on the active row.
--
-- Community is written to accounts.plan_id as NULL, never 'community'.
-- Returns 'ok' | 'duplicate' | 'unchanged' | 'no_account' | 'no_active' | 'not_due' | 'bad_action'.
drop function public.apply_subscription(text, uuid, text, timestamptz, integer, text, text, uuid, text, text, text, text, uuid);

create function public.apply_subscription(
  p_action                   text,
  p_user_id                  uuid,
  p_plan_id                  text default null,
  p_period_end               timestamptz default null,
  p_amount_ngn               integer default null,
  p_payment_reference        text default null,
  p_reason                   text default null,
  p_changed_by               uuid default null,
  p_source                   text default 'manual',
  p_provider_customer_id     text default null,
  p_provider_subscription_id text default null,
  p_end_status               text default 'cancelled',
  p_subscription_id          uuid default null,
  p_payment_kind             text default null,
  p_provider_email_token     text default null,
  p_provider_plan_code       text default null,
  p_provider_status          text default null,
  p_card_last4               text default null,
  p_card_brand               text default null,
  p_actions                  jsonb default '[]'::jsonb
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account   public.accounts%rowtype;
  v_active    public.subscriptions%rowtype;
  v_due       public.subscriptions%rowtype;
  v_from      text;
  v_to        text;
  v_paid_row  uuid;          -- the row a payment attaches to; null means no payment
  v_pay_start timestamptz;
  v_pay_end   timestamptz;
begin
  select * into v_account from public.accounts
  where user_id = p_user_id and type = 'builder'
  for update;
  if not found then return 'no_account'; end if;

  if p_payment_reference is not null and exists (
    select 1 from public.subscription_payments where reference = p_payment_reference
  ) then
    return 'duplicate';
  end if;

  v_from := v_account.plan_id;
  v_to := v_from;
  select * into v_active from public.subscriptions
  where account_id = v_account.id and status = 'active';

  if p_action = 'start' then
    if v_active.id is not null then
      update public.subscriptions set status = 'cancelled', ended_at = now() where id = v_active.id;
    end if;
    update public.subscriptions set status = 'cancelled', ended_at = now()
    where account_id = v_account.id and status = 'scheduled';
    insert into public.subscriptions (
      account_id, profile_id, plan_id, status, source, period_start, period_end,
      amount_ngn, payment_reference, provider_customer_id, provider_subscription_id,
      provider_email_token, provider_plan_code, provider_status, card_last4, card_brand,
      reason, created_by
    ) values (
      v_account.id, p_user_id, p_plan_id, 'active', p_source, now(), p_period_end,
      p_amount_ngn, p_payment_reference, p_provider_customer_id, p_provider_subscription_id,
      p_provider_email_token, p_provider_plan_code, p_provider_status, p_card_last4, p_card_brand,
      p_reason, p_changed_by
    ) returning id into v_paid_row;
    v_pay_start := now();
    v_pay_end := p_period_end;
    v_to := p_plan_id;

  elsif p_action = 'schedule' then
    if v_active.id is null then return 'no_active'; end if;
    update public.subscriptions set status = 'cancelled', ended_at = now()
    where account_id = v_account.id and status = 'scheduled';
    insert into public.subscriptions (
      account_id, profile_id, plan_id, status, source, period_start, period_end,
      provider_customer_id, provider_subscription_id, provider_email_token, provider_plan_code,
      reason, created_by
    ) values (
      v_account.id, p_user_id, p_plan_id, 'scheduled', p_source,
      coalesce(v_active.period_end, now()), null,
      p_provider_customer_id, p_provider_subscription_id, p_provider_email_token, p_provider_plan_code,
      p_reason, p_changed_by
    );
    -- The plan changes when the scheduled row is applied.

  elsif p_action = 'end' then
    if v_active.id is null and v_from is null then return 'unchanged'; end if;
    if v_active.id is not null then
      update public.subscriptions set status = p_end_status, ended_at = now() where id = v_active.id;
    end if;
    update public.subscriptions set status = 'cancelled', ended_at = now()
    where account_id = v_account.id and status = 'scheduled';
    v_to := null;

  elsif p_action = 'extend' then
    if v_active.id is null then return 'no_active'; end if;
    -- The row keeps the latest amount and reference for the admin dialog; the
    -- history is subscription_payments.
    update public.subscriptions set
      period_end = p_period_end,
      amount_ngn = coalesce(p_amount_ngn, amount_ngn),
      payment_reference = coalesce(p_payment_reference, payment_reference),
      provider_customer_id = coalesce(p_provider_customer_id, provider_customer_id),
      provider_subscription_id = coalesce(p_provider_subscription_id, provider_subscription_id),
      provider_email_token = coalesce(p_provider_email_token, provider_email_token),
      provider_plan_code = coalesce(p_provider_plan_code, provider_plan_code),
      provider_status = coalesce(p_provider_status, provider_status),
      card_last4 = coalesce(p_card_last4, card_last4),
      card_brand = coalesce(p_card_brand, card_brand),
      reminder_sent_at = null
    where id = v_active.id;
    v_paid_row := v_active.id;
    v_pay_start := coalesce(v_active.period_end, now());
    v_pay_end := p_period_end;

  elsif p_action = 'apply' then
    select * into v_due from public.subscriptions
    where id = p_subscription_id and account_id = v_account.id and status = 'scheduled'
    for update;
    if not found or v_due.period_start > now() then return 'not_due'; end if;
    if v_active.id is not null then
      update public.subscriptions
      set status = case when v_active.period_end <= now() then 'expired' else 'cancelled' end,
          ended_at = now()
      where id = v_active.id;
    end if;
    if v_due.plan_id = 'community' then
      update public.subscriptions set status = 'expired', ended_at = now() where id = v_due.id;
      v_to := null;
    else
      -- A paid plan runs a month unless renewed, the same default as the dialog.
      update public.subscriptions set
        status = 'active',
        period_start = now(),
        period_end = coalesce(p_period_end, v_due.period_end, now() + interval '1 month'),
        amount_ngn = coalesce(p_amount_ngn, amount_ngn),
        payment_reference = coalesce(p_payment_reference, payment_reference),
        provider_customer_id = coalesce(p_provider_customer_id, provider_customer_id),
        provider_subscription_id = coalesce(p_provider_subscription_id, provider_subscription_id),
        provider_email_token = coalesce(p_provider_email_token, provider_email_token),
        provider_plan_code = coalesce(p_provider_plan_code, provider_plan_code),
        provider_status = coalesce(p_provider_status, provider_status),
        card_last4 = coalesce(p_card_last4, card_last4),
        card_brand = coalesce(p_card_brand, card_brand)
      where id = v_due.id
      returning period_end into v_pay_end;
      v_paid_row := v_due.id;
      v_pay_start := now();
      v_to := v_due.plan_id;
    end if;

  elsif p_action = 'attach' then
    if v_active.id is null then return 'no_active'; end if;
    update public.subscriptions set
      period_end = coalesce(p_period_end, period_end),
      provider_customer_id = coalesce(p_provider_customer_id, provider_customer_id),
      provider_subscription_id = coalesce(p_provider_subscription_id, provider_subscription_id),
      provider_email_token = coalesce(p_provider_email_token, provider_email_token),
      provider_plan_code = coalesce(p_provider_plan_code, provider_plan_code),
      provider_status = coalesce(p_provider_status, provider_status),
      card_last4 = coalesce(p_card_last4, card_last4),
      card_brand = coalesce(p_card_brand, card_brand)
    where id = v_active.id;

  else
    return 'bad_action';
  end if;

  -- Every branch that reaches here answers 'ok'.
  if v_paid_row is not null and p_amount_ngn is not null then
    insert into public.subscription_payments (
      subscription_id, profile_id, source, reference, amount_ngn, kind, period_start, period_end
    ) values (
      v_paid_row, p_user_id, p_source,
      -- The dialog's reference is optional; a payment's isn't.
      coalesce(p_payment_reference, 'manual-' || gen_random_uuid()),
      p_amount_ngn, coalesce(p_payment_kind, 'manual'), v_pay_start, v_pay_end
    );
  end if;

  if v_from is distinct from v_to then
    update public.accounts set plan_id = v_to where id = v_account.id;
    insert into public.admin_account_changes (account_id, profile_id, field, from_value, to_value, changed_by)
    values (v_account.id, p_user_id, 'plan_id', v_from, v_to, p_changed_by);
  end if;

  -- Queued with the payment or not at all: a 'duplicate' never reaches this,
  -- a rollback takes it back, and a commit can't lose it.
  insert into public.billing_actions (kind, profile_id, subscription_code, email_token, payload, idempotency_key)
  select a->>'kind', p_user_id, a->>'subscription_code', a->>'email_token',
         coalesce(a->'payload', '{}'::jsonb), a->>'idempotency_key'
  from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb)) as a
  on conflict (idempotency_key) do nothing;

  return 'ok';
end;
$$;

revoke all on function public.apply_subscription(text, uuid, text, timestamptz, integer, text, text, uuid, text, text, text, text, uuid, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_subscription(text, uuid, text, timestamptz, integer, text, text, uuid, text, text, text, text, uuid, text, text, text, text, text, text, jsonb) to service_role;

-- ── Backfill ──────────────────────────────────────────────────────────────
-- One payment per existing subscription that recorded an amount. Renewals
-- `extend` already overwrote can't be recovered; see §2 of the spec for the count.
insert into public.subscription_payments (
  subscription_id, profile_id, source, reference, amount_ngn, kind, period_start, period_end, created_at
)
select id, profile_id, source, coalesce(payment_reference, 'backfill-' || id),
       amount_ngn, 'manual', period_start, period_end, created_at
from public.subscriptions
where amount_ngn is not null
on conflict (reference) do nothing;
