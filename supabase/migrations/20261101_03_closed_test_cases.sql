-- A full test case stops taking reports. Spec: docs/specs/SPEC-closed-test-cases.md.
--
-- APPLY BEFORE THE CODE DEPLOYS: submitTestResult and /mission/[id] read
-- missions.closed_at.
--
-- closed_at is when a test case stopped taking reports — filled
-- (report_landed) or paused by its builder (close_mission) — and is cleared
-- when it goes live again (publish_mission). submitTestResult reads it for the
-- grace a tester mid-test gets (lib/reportStart.ts). No backfill: a test case
-- closed before this has closed_at null, "closed, time unknown", and no grace.

alter table public.missions add column if not exists closed_at timestamptz;

-- The three functions below are their current definitions — publish_mission
-- from 20261101_02 (first_published_at kept), close_mission and report_landed
-- from 20260930_01 — with the closed_at line the only change. Same signatures,
-- so create or replace; grants restated, never assumed to survive.

-- ── publish_mission: clears closed_at ────────────────────────────────────
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
        first_published_at = coalesce(first_published_at, now()),
        closed_at = null
    where id = p_mission_id;
  return 'ok';
end;
$$;

revoke all on function public.publish_mission(uuid, uuid, uuid, int, int, int, jsonb) from public, anon, authenticated;
grant execute on function public.publish_mission(uuid, uuid, uuid, int, int, int, jsonb) to service_role;

-- ── close_mission: a builder's pause sets closed_at ──────────────────────
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

  update public.missions set is_active = false, closed_at = now() where id = p_mission_id;
  return 'ok';
end;
$$;

revoke all on function public.close_mission(uuid, uuid, uuid, int, int, jsonb) from public, anon, authenticated;
grant execute on function public.close_mission(uuid, uuid, uuid, int, int, jsonb) to service_role;

-- ── report_landed: filling sets closed_at, in the same update ────────────
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
    update public.missions set is_active = false, closed_at = now() where id = v_mission and is_active is distinct from false;
  end if;
end;
$$;

revoke all on function public.report_landed(uuid) from public, anon, authenticated;
grant execute on function public.report_landed(uuid) to service_role;

-- Rollback:
--   re-run publish_mission from 20261101_02_tester_notifications.sql, and
--   close_mission and report_landed from 20260930_01_report_ledger.sql (same
--   signatures), each with its revoke/grant lines;
--   alter table public.missions drop column closed_at;
