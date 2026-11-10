-- Paystack plan changes, refunds and unwanted charges.
-- Spec: docs/specs/SPEC-paystack-plan-changes.md.
--
-- A refund is created in exactly three places, each under the payment's lock
-- and each clamped to what is still refundable on it:
--   settle_upgrade          the Starter refund, in the transaction that records
--                           the verified Pro payment, and only when that answers 'ok';
--   queue_refund            an admin refund, a retry, or one paid back outside Paystack;
--   record_unwanted_charge  a stray or duplicate charge, refunded in full.
-- apply_subscription still never creates one.
--
-- APPLY BEFORE THE CODE DEPLOYS. Nothing old calls these.
-- Rollback: drop the three functions and delete the three alert rules.

-- ── settle_upgrade ────────────────────────────────────────────────────────
-- Starter → Pro, after Paystack verified the Pro charge. One transaction:
-- Pro starts (ending Starter and dropping any scheduled change), the Pro
-- payment is recorded, Starter's disable is queued, and the unused Starter
-- days are queued as a refund (rule proration-v1, spec §2.1). A redelivery or
-- the return page racing the webhook meets the Pro reference under the account
-- lock: apply_subscription answers 'duplicate' and nothing else happens.
-- Returns { result, refund_ngn }.
create function public.settle_upgrade(
  p_user_id                  uuid,
  p_pro_reference            text,
  p_amount_ngn               integer,
  p_paid_at                  timestamptz,
  p_period_end               timestamptz,
  p_starter_subscription_id  uuid,
  p_provider_customer_id     text default null,
  p_provider_subscription_id text default null,
  p_provider_email_token     text default null,
  p_provider_plan_code       text default null,
  p_provider_status          text default null,
  p_card_last4               text default null,
  p_card_brand               text default null,
  p_actions                  jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result      text;
  v_pro_payment uuid;
  v_starter     public.subscription_payments%rowtype;
  v_upgrade_on  date;
  v_start_on    date;
  v_end_on      date;
  v_days        integer;
  v_refundable  integer;
  v_base        integer;
  v_amount      integer;
begin
  -- 1. The account lock first: a second delivery waits here.
  perform 1 from public.accounts where user_id = p_user_id and type = 'builder' for update;

  -- 2. Pro starts and its payment is recorded, or nothing happens.
  v_result := public.apply_subscription(
    'start', p_user_id, 'pro', p_period_end, p_amount_ngn, p_pro_reference,
    'Paystack subscription', null, 'paystack', p_provider_customer_id, p_provider_subscription_id,
    'cancelled', null, 'upgrade', p_provider_email_token, p_provider_plan_code, p_provider_status,
    p_card_last4, p_card_brand, p_actions
  );
  if v_result <> 'ok' then
    return jsonb_build_object('result', v_result, 'refund_ngn', 0);
  end if;
  select id into v_pro_payment from public.subscription_payments where reference = p_pro_reference;

  -- 3. The Starter payment whose period contains the upgrade day, Lagos dates,
  --    the end excluded. Locked before anything is read from it.
  v_upgrade_on := (p_paid_at at time zone 'Africa/Lagos')::date;
  select * into v_starter from public.subscription_payments pay
  where pay.subscription_id = p_starter_subscription_id
    and pay.profile_id = p_user_id
    and pay.source = 'paystack'
    and pay.kind in ('first', 'renewal', 'resubscribe')
    and pay.period_end is not null
    and (pay.period_start at time zone 'Africa/Lagos')::date <= v_upgrade_on
    and v_upgrade_on < (pay.period_end at time zone 'Africa/Lagos')::date
  order by pay.period_start desc
  limit 1
  for update;
  if not found then
    return jsonb_build_object('result', 'ok', 'refund_ngn', 0);
  end if;

  -- 4. proration-v1. The upgrade day counts as used; whole naira, rounded down.
  v_start_on := (v_starter.period_start at time zone 'Africa/Lagos')::date;
  v_end_on := (v_starter.period_end at time zone 'Africa/Lagos')::date;
  v_days := v_end_on - v_start_on;
  v_refundable := v_end_on - v_upgrade_on - 1;
  -- base_ngn under the lock: an in-flight refund reserves its amount.
  select v_starter.amount_ngn - coalesce(sum(r.amount_ngn), 0) into v_base
  from public.subscription_refunds r
  where r.payment_id = v_starter.id and r.status <> 'failed';
  if v_base <= 0 or v_refundable <= 0 or v_days <= 0 then
    return jsonb_build_object('result', 'ok', 'refund_ngn', 0);
  end if;
  v_amount := (v_base * v_refundable) / v_days;
  if v_amount <= 0 then
    return jsonb_build_object('result', 'ok', 'refund_ngn', 0);
  end if;

  -- 5. One refund, whatever arrives twice: the key and both indexes refuse a second.
  insert into public.subscription_refunds (
    profile_id, reason, payment_id, original_payment_reference,
    causing_payment_id, causing_payment_reference,
    rule_version, upgrade_at, upgrade_on, period_start_on, period_end_on,
    days_in_period, refundable_days, base_ngn, amount_ngn, idempotency_key
  ) values (
    p_user_id, 'upgrade', v_starter.id, v_starter.reference,
    v_pro_payment, p_pro_reference,
    'proration-v1', p_paid_at, v_upgrade_on, v_start_on, v_end_on,
    v_days, v_refundable, v_base, v_amount, 'upgrade:' || p_pro_reference
  )
  on conflict do nothing;

  return jsonb_build_object('result', 'ok', 'refund_ngn', v_amount);
end;
$$;

revoke all on function public.settle_upgrade(uuid, text, integer, timestamptz, timestamptz, uuid, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.settle_upgrade(uuid, text, integer, timestamptz, timestamptz, uuid, text, text, text, text, text, text, text, jsonb) to service_role;

-- ── queue_refund ──────────────────────────────────────────────────────────
-- Every refund outside settle_upgrade and record_unwanted_charge: an admin's,
-- "Try again" on a failed one, and one paid back by bank transfer
-- (p_status 'settled_outside'). Locks the payment and clamps to what's left, so
-- two concurrent calls for more than remains give one refund. The same key twice
-- answers the first row. p_copy_from carries a failed refund's cause and, for
-- an upgrade, its stored calculation; only base_ngn is read again.
-- Returns { result: ok | nothing_refundable | no_payment | conflict, id, amount_ngn }.
create function public.queue_refund(
  p_payment_id  uuid,
  p_amount_ngn  integer,
  p_reason      text,
  p_key         text,
  p_note        text default null,
  p_status      text default 'queued',
  p_copy_from   uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay    public.subscription_payments%rowtype;
  v_from   public.subscription_refunds%rowtype;
  v_found  public.subscription_refunds%rowtype;
  v_left   integer;
  v_amount integer;
  v_id     uuid;
begin
  if p_status not in ('queued', 'settled_outside') then
    raise exception 'queue_refund: % is not a status a refund starts in', p_status;
  end if;

  select * into v_pay from public.subscription_payments where id = p_payment_id for update;
  if not found then return jsonb_build_object('result', 'no_payment'); end if;

  select * into v_found from public.subscription_refunds where idempotency_key = p_key;
  if found then
    return jsonb_build_object('result', 'ok', 'id', v_found.id, 'amount_ngn', v_found.amount_ngn);
  end if;

  select v_pay.amount_ngn - coalesce(sum(amount_ngn), 0) into v_left
  from public.subscription_refunds
  where payment_id = v_pay.id and status <> 'failed';

  if p_copy_from is not null then
    select * into v_from from public.subscription_refunds where id = p_copy_from and payment_id = v_pay.id;
    if not found then return jsonb_build_object('result', 'no_payment'); end if;
  end if;

  if v_from.reason = 'upgrade' then
    v_amount := (greatest(v_left, 0) * v_from.refundable_days) / v_from.days_in_period;
  else
    v_amount := least(coalesce(p_amount_ngn, v_from.amount_ngn), v_left);
  end if;
  if v_amount is null or v_amount <= 0 then
    return jsonb_build_object('result', 'nothing_refundable');
  end if;

  insert into public.subscription_refunds (
    profile_id, reason, payment_id, original_payment_reference,
    causing_payment_id, causing_payment_reference,
    rule_version, upgrade_at, upgrade_on, period_start_on, period_end_on,
    days_in_period, refundable_days, base_ngn,
    amount_ngn, idempotency_key, status, note, finished_at
  ) values (
    v_pay.profile_id, coalesce(v_from.reason, p_reason), v_pay.id, v_pay.reference,
    v_from.causing_payment_id, v_from.causing_payment_reference,
    v_from.rule_version, v_from.upgrade_at, v_from.upgrade_on, v_from.period_start_on, v_from.period_end_on,
    v_from.days_in_period, v_from.refundable_days, case when v_from.reason = 'upgrade' then v_left end,
    v_amount, p_key, p_status, p_note, case when p_status = 'settled_outside' then now() end
  )
  on conflict do nothing
  returning id into v_id;
  if v_id is null then return jsonb_build_object('result', 'conflict'); end if;

  return jsonb_build_object('result', 'ok', 'id', v_id, 'amount_ngn', v_amount);
end;
$$;

revoke all on function public.queue_refund(uuid, integer, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.queue_refund(uuid, integer, text, text, text, text, uuid) to service_role;

-- ── record_unwanted_charge ────────────────────────────────────────────────
-- A charge the builder didn't intend (spec §7): 'stray_charge', from a
-- subscription Twnhall had already ended or that was cancelled, or
-- 'duplicate_charge', a second paid checkout. One transaction: the payment is
-- recorded (a redelivery meets its reference and stops), a full refund is
-- queued, and the subscription that charged is switched off again. No plan changes.
-- Returns 'ok' | 'duplicate' | 'no_account'.
create function public.record_unwanted_charge(
  p_reason             text,
  p_reference          text,
  p_profile_id         uuid,
  p_amount_ngn         integer,
  p_subscription_code  text default null,
  p_email_token        text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment uuid;
  v_sub     uuid;
  v_key     text;
begin
  if p_reason not in ('stray_charge', 'duplicate_charge') then
    raise exception 'record_unwanted_charge: % is not an unwanted charge', p_reason;
  end if;

  -- The same lock apply_subscription takes, so a charge can't be both.
  perform 1 from public.accounts where user_id = p_profile_id and type = 'builder' for update;
  if not found then return 'no_account'; end if;
  if exists (select 1 from public.subscription_payments where reference = p_reference) then
    return 'duplicate';
  end if;

  if p_subscription_code is not null then
    select id into v_sub from public.subscriptions
    where profile_id = p_profile_id and provider_subscription_id = p_subscription_code
    order by created_at desc limit 1;
  end if;

  -- No period: it bought nothing, so it never counts toward MRR.
  insert into public.subscription_payments (subscription_id, profile_id, source, reference, amount_ngn, kind, period_start, period_end)
  values (v_sub, p_profile_id, 'paystack', p_reference, p_amount_ngn,
          case p_reason when 'stray_charge' then 'stray' else 'duplicate' end, now(), null)
  returning id into v_payment;

  insert into public.subscription_refunds (
    profile_id, reason, payment_id, original_payment_reference,
    causing_payment_id, causing_payment_reference, amount_ngn, idempotency_key
  ) values (
    p_profile_id, p_reason, v_payment, p_reference, v_payment, p_reference, p_amount_ngn,
    case p_reason when 'stray_charge' then 'stray:' else 'duplicate:' end || p_reference
  )
  on conflict do nothing;

  if p_subscription_code is not null then
    v_key := 'disable:' || p_subscription_code;
    -- A disable done before didn't hold, so this one needs its own key.
    if exists (select 1 from public.billing_actions where idempotency_key = v_key) then
      v_key := v_key || ':' || p_reason || '-' || p_reference;
    end if;
    insert into public.billing_actions (kind, profile_id, subscription_code, email_token, idempotency_key)
    values ('disable_subscription', p_profile_id, p_subscription_code, p_email_token, v_key)
    on conflict (idempotency_key) do nothing;
  end if;

  return 'ok';
end;
$$;

revoke all on function public.record_unwanted_charge(text, text, uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.record_unwanted_charge(text, text, uuid, integer, text, text) to service_role;

-- ── Alerts ────────────────────────────────────────────────────────────────
insert into public.alert_rules (key, name, description, severity, threshold, window_minutes, cooldown_minutes) values
  ('paystack_cap_near', 'Near the Starter Business limit',
   'Gross Paystack collections passed this. Register with CAC and upgrade the Paystack account before ₦8,000,000, when Paystack stops taking payments and every renewal fails.',
   'warning', 6000000, null, 1440),
  ('refund_failed', 'Refund failed',
   'A refund didn''t reach the builder. Try again or pay it back outside Paystack, and record it, from the builder''s account page.',
   'critical', 0, null, 360),
  ('refund_stuck', 'Refund not moving',
   'A refund has sat unsent or unconfirmed for over an hour, or pending at Paystack for 14 days. Look it up in the Paystack dashboard.',
   'critical', 0, null, 360)
on conflict (key) do nothing;
