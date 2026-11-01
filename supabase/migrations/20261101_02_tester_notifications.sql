-- Telling testers about new test cases: a counter on Available Test Cases and
-- a daily digest email. Spec: docs/specs/SPEC-tester-notifications.md.
--
-- APPLY BEFORE THE CODE DEPLOYS: the dashboard layout reads
-- accounts.missions_seen_at on every tester page.

-- When a test case first went live. Set by publish_mission, never cleared, so
-- closing and reopening a test case does not make it new again (decision 1).
alter table public.missions add column if not exists first_published_at timestamptz;
-- Missions live before this have no publish time; created_at is the closest
-- we have. Only the live ones: a draft has never been published.
update public.missions set first_published_at = created_at
  where is_active is distinct from false and first_published_at is null;
create index if not exists missions_first_published_at_idx
  on public.missions (first_published_at) where is_active;

-- Per tester account — role-scoped state lives on accounts. Both timestamps
-- default to now() on purpose: on the day this ships every existing tester's
-- counter starts at 0 and their first digest covers only what is published
-- from then on. Do not backfill them to anything earlier.
alter table public.accounts
  add column if not exists missions_seen_at    timestamptz not null default now(),
  add column if not exists digest_through      timestamptz not null default now(),
  add column if not exists digest_opted_out_at timestamptz;

comment on column public.accounts.missions_seen_at is
  'Tester accounts only: when the tester last opened Available Test Cases. The counter counts test cases first published after it.';
comment on column public.accounts.digest_through is
  'Tester accounts only: the end of the last daily digest window. Claimed compare-and-set by the daily cron.';
comment on column public.accounts.digest_opted_out_at is
  'Tester accounts only: null while the daily digest is on.';

create index if not exists accounts_digest_recipients_idx
  on public.accounts (type) where digest_opted_out_at is null;

-- publish_mission: unchanged from 20260930_01 except first_published_at,
-- written once. Same signature, so create or replace; grants restated anyway.
create or replace function public.publish_mission(
  p_mission_id   uuid,
  p_profile_id   uuid,
  p_account_id   uuid,
  p_seen_rows    int,
  p_testers      int,
  p_active_limit int,
  p_rows         jsonb
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  -- One lock per person: serialises every ledger write for this profile.
  perform 1 from public.profiles where id = p_profile_id for update;

  if not exists (
    select 1 from public.missions m join public.projects p on p.id = m.project_id
    where m.id = p_mission_id and p.owner_id = p_profile_id
  ) then
    return 'not_found';
  end if;

  -- A double-click must not reserve twice.
  if exists (select 1 from public.missions where id = p_mission_id and is_active is distinct from false) then
    return 'already';
  end if;

  if (select count(*) from public.report_ledger where profile_id = p_profile_id) <> p_seen_rows then
    return 'stale';
  end if;

  -- Null is_active counts as live, the same as every reader in the app.
  if (
    select count(*) from public.missions m join public.projects p on p.id = m.project_id
    where p.owner_id = p_profile_id and m.is_active is distinct from false
  ) >= p_active_limit then
    return 'active_limit';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    insert into public.report_ledger (profile_id, account_id, mission_id, kind, bucket, period, slots)
    values (
      p_profile_id, p_account_id, p_mission_id, 'reserved',
      v_row->>'bucket', (v_row->>'period')::date, (v_row->>'slots')::int
    );
  end loop;

  update public.missions
    set is_active = true,
        testers_needed = p_testers,
        first_published_at = coalesce(first_published_at, now())
    where id = p_mission_id;
  return 'ok';
end;
$$;

revoke all on function public.publish_mission(uuid, uuid, uuid, int, int, int, jsonb) from public, anon, authenticated;
grant execute on function public.publish_mission(uuid, uuid, uuid, int, int, int, jsonb) to service_role;

-- Rollback:
--   re-run publish_mission from 20260930_01_report_ledger.sql (same signature)
--   with its revoke/grant lines;
--   drop index public.accounts_digest_recipients_idx;
--   drop index public.missions_first_published_at_idx;
--   alter table public.accounts drop column digest_opted_out_at,
--     drop column digest_through, drop column missions_seen_at;
--   alter table public.missions drop column first_published_at;
