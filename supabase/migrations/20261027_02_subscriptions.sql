-- Builder subscriptions: the record behind accounts.plan_id. Spec:
-- docs/specs/SPEC-admin-revamp.md, Phase 1.
--
-- accounts.plan_id STAYS the field the allowance reads at publish; nothing in
-- lib/allowance.ts changes. This table is the history, and the answer to "why
-- does plan_id hold what it holds". An admin writes it today; a Paystack or
-- Flutterwave webhook will write it later through the same function.
--
-- Money in one direction only: what a builder paid for a plan. Nothing here
-- pays anyone out.

create table public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  account_id                uuid references public.accounts(id) on delete set null,
  profile_id                uuid not null,             -- denormalised, no FK
  -- starter | pro, or community on a scheduled downgrade to free.
  -- PLAN_IDS in lib/vocabulary.ts, enforced in Zod — no CHECK, house rule.
  plan_id                   text not null,
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
  ended_at                  timestamptz,
  reminder_sent_at          timestamptz                -- the 3-day notice, once per period
);

-- One active and one scheduled subscription per account, at most.
create unique index subscriptions_one_active on public.subscriptions (account_id) where status = 'active';
create unique index subscriptions_one_scheduled on public.subscriptions (account_id) where status = 'scheduled';
create index subscriptions_profile_idx on public.subscriptions (profile_id, created_at);
create index subscriptions_due_idx on public.subscriptions (status, period_end);

alter table public.subscriptions enable row level security;
-- No policies: service role only.

-- A system or provider change has no admin behind it.
alter table public.admin_account_changes alter column changed_by drop not null;

-- ── apply_subscription ────────────────────────────────────────────────────
-- The ONE writer of accounts.plan_id. In one transaction: the subscription
-- row(s), the plan, and the admin_account_changes log line.
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
--   'apply'     the cron: a due scheduled row becomes active (or, for
--               community, ends the active one). p_subscription_id names it.
--
-- Community is written to accounts.plan_id as NULL, never 'community'.
-- Returns 'ok' | 'unchanged' | 'no_account' | 'no_active' | 'not_due' | 'bad_action'.
create or replace function public.apply_subscription(
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
  p_subscription_id          uuid default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.accounts%rowtype;
  v_active  public.subscriptions%rowtype;
  v_due     public.subscriptions%rowtype;
  v_from    text;
  v_to      text;
begin
  select * into v_account from public.accounts
  where user_id = p_user_id and type = 'builder'
  for update;
  if not found then return 'no_account'; end if;

  v_from := v_account.plan_id;
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
      reason, created_by
    ) values (
      v_account.id, p_user_id, p_plan_id, 'active', p_source, now(), p_period_end,
      p_amount_ngn, p_payment_reference, p_provider_customer_id, p_provider_subscription_id,
      p_reason, p_changed_by
    );
    v_to := p_plan_id;

  elsif p_action = 'schedule' then
    if v_active.id is null then return 'no_active'; end if;
    update public.subscriptions set status = 'cancelled', ended_at = now()
    where account_id = v_account.id and status = 'scheduled';
    insert into public.subscriptions (
      account_id, profile_id, plan_id, status, source, period_start, period_end,
      reason, created_by
    ) values (
      v_account.id, p_user_id, p_plan_id, 'scheduled', p_source,
      coalesce(v_active.period_end, now()), null, p_reason, p_changed_by
    );
    return 'ok';  -- the plan changes when the cron applies it

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
    update public.subscriptions set
      period_end = p_period_end,
      amount_ngn = coalesce(p_amount_ngn, amount_ngn),
      payment_reference = coalesce(p_payment_reference, payment_reference),
      reminder_sent_at = null
    where id = v_active.id;
    return 'ok';

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
      update public.subscriptions set status = 'active', period_start = now(),
        period_end = coalesce(v_due.period_end, now() + interval '1 month')
      where id = v_due.id;
      v_to := v_due.plan_id;
    end if;

  else
    return 'bad_action';
  end if;

  if v_from is distinct from v_to then
    update public.accounts set plan_id = v_to where id = v_account.id;
    insert into public.admin_account_changes (account_id, profile_id, field, from_value, to_value, changed_by)
    values (v_account.id, p_user_id, 'plan_id', v_from, v_to, p_changed_by);
  end if;
  return 'ok';
end;
$$;

revoke all on function public.apply_subscription(text, uuid, text, timestamptz, integer, text, text, uuid, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.apply_subscription(text, uuid, text, timestamptz, integer, text, text, uuid, text, text, text, text, uuid) to service_role;

-- ── set_account_field: the cohort path only ───────────────────────────────
-- Its plan_id branch is retired so there is one way to change a plan. Body
-- otherwise unchanged from 20261001_01; grants restated.
create or replace function public.set_account_field(
  p_user_id  uuid,
  p_type     text,
  p_field    text,
  p_value    text,
  p_admin_id uuid
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.accounts%rowtype;
  v_from    text;
begin
  if p_field <> 'cohort' then return 'bad_field'; end if;

  select * into v_account from public.accounts
  where user_id = p_user_id and type = p_type
  for update;
  if not found then return 'no_account'; end if;

  v_from := case
    when v_account.cohort_member_at is not null and v_account.cohort_left_at is null
    then 'member' else 'not_member' end;
  if v_from = p_value then return 'unchanged'; end if;
  if p_value = 'member' then
    update public.accounts set cohort_member_at = now(), cohort_left_at = null where id = v_account.id;
  elsif p_value = 'not_member' then
    update public.accounts set cohort_left_at = now() where id = v_account.id;
  else
    return 'bad_field';
  end if;

  insert into public.admin_account_changes (account_id, profile_id, field, from_value, to_value, changed_by)
  values (v_account.id, p_user_id, p_field, v_from, p_value, p_admin_id);
  return 'ok';
end;
$$;

revoke all on function public.set_account_field(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.set_account_field(uuid, text, text, text, uuid) to service_role;

-- ── admin_account_list ────────────────────────────────────────────────────
-- /admin/accounts, one page at a time, counted in SQL rather than by loading
-- every table into the page. Reads auth.users for sign-up, last sign-in and
-- bans, which is why it is a definer function. `total` is the filtered count,
-- repeated on every row.
create or replace function public.admin_account_list(
  p_q            text default null,
  p_role         text default null,   -- builder | tester | admin
  p_plan         text default null,   -- community | starter | pro
  p_cohort       boolean default null,
  p_moderation   text default null,   -- active | suspended | banned
  p_signed_up_days int default null,
  p_active_days  int default null,
  p_limit        int default 50,
  p_offset       int default 0
) returns table (
  id uuid, full_name text, email text, avatar_url text, role text,
  moderation_status text, ban_reason text, banned_until timestamptz,
  created_at timestamptz, last_sign_in_at timestamptz,
  has_builder boolean, has_tester boolean, plan_id text, cohort_member boolean,
  projects int, reports_filed int, total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select p.id, p.full_name, coalesce(p.email, u.email)::text as email, p.avatar_url, p.role,
           coalesce(p.moderation_status, 'active') as moderation_status, p.ban_reason, u.banned_until,
           u.created_at, u.last_sign_in_at,
           b.id is not null as has_builder, t.id is not null as has_tester,
           b.plan_id,
           (t.cohort_member_at is not null and t.cohort_left_at is null) as cohort_member
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.accounts b on b.user_id = p.id and b.type = 'builder'
    left join public.accounts t on t.user_id = p.id and t.type = 'tester'
    where (p_q is null or p.full_name ilike '%' || p_q || '%' or coalesce(p.email, u.email) ilike '%' || p_q || '%')
      and (p_role is null
           or (p_role = 'builder' and b.id is not null)
           or (p_role = 'tester' and t.id is not null)
           or (p_role = 'admin' and p.role = 'admin'))
      and (p_plan is null
           or (p_plan = 'community' and b.id is not null and b.plan_id is null)
           or b.plan_id = p_plan)
      and (p_cohort is null or (t.cohort_member_at is not null and t.cohort_left_at is null) = p_cohort)
      and (p_moderation is null or coalesce(p.moderation_status, 'active') = p_moderation)
      and (p_signed_up_days is null or u.created_at >= now() - make_interval(days => p_signed_up_days))
      and (p_active_days is null or u.last_sign_in_at >= now() - make_interval(days => p_active_days))
  )
  select base.*,
         (select count(*)::int from public.projects pr where pr.owner_id = base.id),
         (select count(*)::int from public.test_results r where r.tester_id = base.id),
         count(*) over ()
  from base
  order by base.created_at desc
  limit p_limit offset p_offset
$$;

revoke all on function public.admin_account_list(text, text, text, boolean, text, int, int, int, int) from public, anon, authenticated;
grant execute on function public.admin_account_list(text, text, text, boolean, text, int, int, int, int) to service_role;

-- Rollback:
--   drop function public.admin_account_list(text, text, text, boolean, text, int, int, int, int);
--   re-run set_account_field from 20261001_01_cohort_payouts.sql;
--   drop function public.apply_subscription(text, uuid, text, timestamptz, integer, text, text, uuid, text, text, text, text, uuid);
--   alter table public.admin_account_changes alter column changed_by set not null;  -- fails once a system row exists
--   drop table public.subscriptions;
