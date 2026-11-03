-- Paid reports that weren't delivered carry over (docs/specs/SPEC-paid-report-carryover.md).
--
-- A close used to write only 'released' rows, and a monthly release into a
-- month that had ended expired with it: a builder paid for 5 reports, got 3,
-- and lost 2. lib/allowance.ts carryOver() now sends those slots back as a
-- 'carried' row (bucket 'carried', null period), which never expires.
--
-- close_mission is replaced whole, copied from 20261101_03 so its closed_at
-- line survives. The only change is the kind: read from the row, and limited
-- to 'released' and 'carried' — a close may give back or carry what was held,
-- never mint a grant or an earned credit.
--
-- Unchanged, confirmed by diff: publish_mission (inserts any bucket it is
-- given) and report_landed (already filters kind in ('reserved','released')).
-- No backfill (C2): the §0 query found no expired paid slots on 3 Nov 2026.
--
-- Rollback: re-run close_mission from 20261101_03_closed_test_cases.sql.

-- ── close_mission: a close may write released or carried ──────────────────
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
  v_row  jsonb;
  v_kind text;
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
    v_kind := coalesce(v_row->>'kind', 'released');
    -- A close may give back what was held, or carry it. It may never mint a
    -- grant or an earned credit.
    if v_kind not in ('released', 'carried') then
      raise exception 'close_mission: % is not a kind a close may write', v_kind;
    end if;
    insert into public.report_ledger (profile_id, account_id, mission_id, kind, bucket, period, slots)
    values (
      p_profile_id, p_account_id, p_mission_id, v_kind,
      v_row->>'bucket', (v_row->>'period')::date, (v_row->>'slots')::int
    );
  end loop;

  update public.missions set is_active = false, closed_at = now() where id = p_mission_id;
  return 'ok';
end;
$$;

revoke all on function public.close_mission(uuid, uuid, uuid, int, int, jsonb) from public, anon, authenticated;
grant execute on function public.close_mission(uuid, uuid, uuid, int, int, jsonb) to service_role;
