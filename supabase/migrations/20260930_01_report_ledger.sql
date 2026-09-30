-- The report allowance, as an append-only ledger.
--
-- Spec: docs/specs/SPEC-report-allowance.md. The arithmetic lives in
-- lib/allowance.ts, not here: these functions only refuse a computation that
-- was made against rows which have since changed ("compare and append"), so
-- there is one definition of spend order, not two that drift.
--
-- THIS TABLE IS WHAT THE COHORT IS PAID AGAINST. Rows are never updated or
-- deleted. A reserved row is a slot a builder paid for (or was granted); a
-- released row is one that came back unused.
--
-- The allowance is spent at PUBLISH and never at submission. A submission is
-- never refused by anything here — the mission was published, the work is owed.

create table if not exists public.report_ledger (
  id          uuid primary key default gen_random_uuid(),
  -- The balance's owner. Per profile, not per account: credits are earned on
  -- the tester account and spent on the builder one. Cascade because a deleted
  -- person is the fresh-email case, which is not preventable anyway.
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  -- Which role wrote the row. Set null, never cascade: deleting an account must
  -- not delete the grant row (it would re-trigger) or a reservation (PR 3 pays
  -- against it).
  account_id  uuid references public.accounts(id) on delete set null,
  -- A deleted mission does not un-spend the allowance.
  mission_id  uuid references public.missions(id) on delete set null,
  kind        text not null,   -- 'grant' | 'earned' | 'reserved' | 'released'
  bucket      text not null,   -- 'monthly' | 'grant' | 'earned'
  -- Monthly bucket only: the month (Africa/Lagos) the slots belong to. A
  -- release returns to this month, and expires with it.
  period      date,
  slots       int  not null,   -- negative for 'reserved', positive otherwise
  created_at  timestamptz not null default now()
);

-- No CHECK on kind or bucket: vocabularies live in code (lib/allowance.ts).
alter table public.report_ledger enable row level security;
-- No policies: service role only.

comment on table public.report_ledger is
  'Report allowance ledger. Append-only: never update or delete. Reserved rows are what the tester cohort may be paid against. Arithmetic lives in lib/allowance.ts.';

-- Once per profile, enforced here rather than by care. A re-created account
-- finds the row still there.
create unique index if not exists report_ledger_one_grant
  on public.report_ledger (profile_id) where kind = 'grant';

-- One earned credit per tester per mission. Nothing stops a second submission
-- on the same mission; this stops it being a credit farm.
create unique index if not exists report_ledger_one_credit_per_mission
  on public.report_ledger (profile_id, mission_id) where kind = 'earned';

create index if not exists report_ledger_profile_idx on public.report_ledger (profile_id);
create index if not exists report_ledger_mission_idx on public.report_ledger (mission_id);

-- ── publish_mission ────────────────────────────────────────────────────────
-- Reserves p_rows and puts the mission live, if and only if the profile's
-- ledger still has p_seen_rows rows (the caller computed against exactly that
-- state). Rows are only appended, so the count is a version number.
--
-- Returns 'ok' | 'stale' | 'already' | 'active_limit' | 'not_found'.
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

  update public.missions set is_active = true, testers_needed = p_testers where id = p_mission_id;
  return 'ok';
end;
$$;

-- ── close_mission ──────────────────────────────────────────────────────────
-- Releases p_rows and takes the mission down, if the ledger and the mission's
-- report count are both what the caller computed against. Closing twice is
-- idempotent by arithmetic: the second computation sees the first's releases.
--
-- Returns 'ok' | 'stale' | 'not_found'.
create or replace function public.close_mission(
  p_mission_id    uuid,
  p_profile_id    uuid,
  p_account_id    uuid,
  p_seen_rows     int,
  p_seen_received int,
  p_rows          jsonb
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  perform 1 from public.profiles where id = p_profile_id for update;

  if not exists (
    select 1 from public.missions m join public.projects p on p.id = m.project_id
    where m.id = p_mission_id and p.owner_id = p_profile_id
  ) then
    return 'not_found';
  end if;

  if (select count(*) from public.report_ledger where profile_id = p_profile_id) <> p_seen_rows
     or (select count(*) from public.test_results where mission_id = p_mission_id) <> p_seen_received then
    return 'stale';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    insert into public.report_ledger (profile_id, account_id, mission_id, kind, bucket, period, slots)
    values (
      p_profile_id, p_account_id, p_mission_id, 'released',
      v_row->>'bucket', (v_row->>'period')::date, (v_row->>'slots')::int
    );
  end loop;

  update public.missions set is_active = false where id = p_mission_id;
  return 'ok';
end;
$$;

-- ── report_landed ──────────────────────────────────────────────────────────
-- Runs after submit_audit_log has committed, never inside it: the tester's
-- credit, and the mission closing itself once it has every report it reserved.
-- Its failure must not — and cannot — cost the submission.
create or replace function public.report_landed(p_result_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tester   uuid;
  v_mission  uuid;
  v_held     int;
  v_received int;
begin
  select tester_id, mission_id into v_tester, v_mission
  from public.test_results where id = p_result_id;
  if v_mission is null then return; end if;

  insert into public.report_ledger (profile_id, account_id, mission_id, kind, bucket, slots)
  values (
    v_tester,
    (select id from public.accounts where user_id = v_tester and type = 'tester'),
    v_mission, 'earned', 'earned', 1
  )
  on conflict do nothing;

  -- Slots the mission still holds: reserved (negative) net of released. A
  -- mission live before the ledger holds none and never self-closes.
  select coalesce(-sum(slots), 0) into v_held
  from public.report_ledger
  where mission_id = v_mission and kind in ('reserved', 'released');

  select count(*) into v_received from public.test_results where mission_id = v_mission;

  if v_held > 0 and v_received >= v_held then
    update public.missions set is_active = false where id = v_mission and is_active is distinct from false;
  end if;
end;
$$;

-- ── reports_without_credit ─────────────────────────────────────────────────
-- The alert for a missed credit, read by /admin. Zero is healthy.
create or replace function public.reports_without_credit()
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from (
    select distinct r.tester_id, r.mission_id
    from public.test_results r
    where not exists (
      select 1 from public.report_ledger l
      where l.kind = 'earned' and l.profile_id = r.tester_id and l.mission_id = r.mission_id
    )
  ) missing;
$$;

-- security definer: whoever may execute these may write the ledger. Service
-- role only, restated per function, never assumed.
revoke all on function public.publish_mission(uuid, uuid, uuid, int, int, int, jsonb) from public, anon, authenticated;
grant execute on function public.publish_mission(uuid, uuid, uuid, int, int, int, jsonb) to service_role;
revoke all on function public.close_mission(uuid, uuid, uuid, int, int, jsonb) from public, anon, authenticated;
grant execute on function public.close_mission(uuid, uuid, uuid, int, int, jsonb) to service_role;
revoke all on function public.report_landed(uuid) from public, anon, authenticated;
grant execute on function public.report_landed(uuid) to service_role;
revoke all on function public.reports_without_credit() from public, anon, authenticated;
grant execute on function public.reports_without_credit() to service_role;

-- ── Backfill ───────────────────────────────────────────────────────────────
-- Every existing account passed createAccount before the grant existed; without
-- this, every existing builder starts at zero. Attached to their earliest account.
insert into public.report_ledger (profile_id, account_id, kind, bucket, slots)
select distinct on (a.user_id) a.user_id, a.id, 'grant', 'grant', 3
from public.accounts a
join public.profiles p on p.id = a.user_id
order by a.user_id, a.created_at
on conflict do nothing;

-- The old pricing page promised +1 for every report written. Kept: one credit
-- per distinct (tester, mission), dated today, so the duplicate-submission
-- farm is not grandfathered in.
insert into public.report_ledger (profile_id, account_id, mission_id, kind, bucket, slots)
select distinct on (r.tester_id, r.mission_id)
  r.tester_id,
  (select id from public.accounts a where a.user_id = r.tester_id and a.type = 'tester'),
  r.mission_id, 'earned', 'earned', 1
from public.test_results r
join public.profiles p on p.id = r.tester_id
where r.mission_id is not null
order by r.tester_id, r.mission_id
on conflict do nothing;

-- Rollback:
--   drop function public.reports_without_credit();
--   drop function public.report_landed(uuid);
--   drop function public.close_mission(uuid, uuid, uuid, int, int, jsonb);
--   drop function public.publish_mission(uuid, uuid, uuid, int, int, int, jsonb);
--   drop table public.report_ledger;
