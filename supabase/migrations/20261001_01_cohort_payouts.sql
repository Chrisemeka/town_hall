-- Cohort membership, and a log of every account change an admin makes.
--
-- Spec: docs/specs/SPEC-cohort-payouts.md. Nothing here moves money: the
-- payout sheet (/admin/payouts) is computed from test_results, report_ledger
-- and the membership history below, and an admin pays from its CSV by bank
-- transfer.

-- On accounts, not profiles: cohort membership is a property of the tester
-- role, per CLAUDE.md. Same nullable-timestamp shape as accepted_terms_at.
-- Two columns, not one, so removing someone does not erase that they were a
-- member — the payout for a month they were paid in must not change. The full
-- history (a re-join included) is in admin_account_changes; these two are the
-- current state, for cheap "is this tester in the cohort now" reads.
alter table public.accounts
  add column if not exists cohort_member_at timestamptz,
  add column if not exists cohort_left_at   timestamptz;

create table if not exists public.admin_account_changes (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid references public.accounts(id) on delete set null,
  -- Denormalised, no FK: the record must outlive the account and the profile.
  profile_id  uuid not null,
  field       text not null,   -- 'plan_id' | 'cohort'
  from_value  text,
  to_value    text,
  changed_by  uuid not null,   -- the admin's profile id
  created_at  timestamptz not null default now()
);

alter table public.admin_account_changes enable row level security;
-- No policies: service role only.

comment on table public.admin_account_changes is
  'Every plan and cohort change an admin makes, written in the same transaction as the change. Append-only. The cohort rows are the membership history the payout sheet reads.';

create index if not exists admin_account_changes_profile_idx
  on public.admin_account_changes (profile_id, created_at);

-- ── set_account_field ─────────────────────────────────────────────────────
-- The change and its log row, in one transaction: a plan or membership never
-- changes without a record of who changed it. Validation of p_value is the
-- caller's (Zod, per CLAUDE.md); this only refuses what it cannot apply.
--
-- p_field 'plan_id': p_value is the plan, null for Community.
-- p_field 'cohort':  p_value is 'member' or 'not_member'.
--
-- Returns 'ok' | 'unchanged' | 'no_account' | 'bad_field'.
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
  select * into v_account from public.accounts
  where user_id = p_user_id and type = p_type
  for update;
  if not found then return 'no_account'; end if;

  if p_field = 'plan_id' then
    v_from := v_account.plan_id;
    if v_from is not distinct from p_value then return 'unchanged'; end if;
    update public.accounts set plan_id = p_value where id = v_account.id;

  elsif p_field = 'cohort' then
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

-- Rollback:
--   drop function public.set_account_field(uuid, text, text, text, uuid);
--   drop table public.admin_account_changes;
--   alter table public.accounts drop column cohort_left_at, drop column cohort_member_at;
