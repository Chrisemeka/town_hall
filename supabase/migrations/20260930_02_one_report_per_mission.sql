-- One report per tester per mission.
--
-- Nothing stopped a tester submitting twice on the same mission: no unique
-- constraint on (mission_id, tester_id), no check in submitTestResult. Once
-- reports earn allowance and the cohort is paid per report, a second report on
-- the same mission is either a credit farmed or a payment made twice. Spec:
-- docs/specs/SPEC-one-report-per-mission.md.
--
-- NOT a unique index. Duplicates may already exist in the live table, and an
-- index would fail to build over them — or force deleting a tester's real
-- writing to make it build. Existing rows are left alone; the rule applies to
-- every write from here on, inside the function that is the only way in.
--
-- To see what exists before this migration:
--   select mission_id, tester_id, count(*) from public.test_results
--   group by 1, 2 having count(*) > 1;
--
-- The check runs under a transaction-scoped advisory lock on the pair, so two
-- concurrent submissions from the same tester (a double tap) cannot both pass
-- it. Different testers, or different missions, never wait on each other.
--
-- Same signature, so create or replace. Body is 20260908_01's, plus the check.
-- The grants are restated rather than trusted to have survived it.

create or replace function public.submit_audit_log(
  p_mission_id      uuid,
  p_tester_id       uuid,
  p_screenshot_urls text[],
  p_tester_comment  text,
  p_entries         jsonb
) returns uuid
language plpgsql
security definer
-- Pinned so a caller cannot shadow `public` with their own schema and have this
-- definer-rights function write somewhere else.
set search_path = public
as $$
declare
  v_result_id uuid;
  v_entry     jsonb;
  v_index     int := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_mission_id::text || ':' || p_tester_id::text, 0));

  -- 23505 so the caller can tell "already submitted" from a failed write.
  if exists (
    select 1 from public.test_results
    where mission_id = p_mission_id and tester_id = p_tester_id
  ) then
    raise exception 'already_submitted' using errcode = '23505';
  end if;

  insert into public.test_results (
    mission_id,
    tester_id,
    screenshot_urls,
    -- The legacy single-URL column, kept populated with the first image so
    -- anything still reading it keeps working.
    screenshot_url,
    tester_comment,
    ai_summary,
    ai_sentiment
  )
  values (
    p_mission_id,
    p_tester_id,
    p_screenshot_urls,
    p_screenshot_urls[1],
    nullif(p_tester_comment, ''),
    '',
    'NEUTRAL'
  )
  returning id into v_result_id;

  for v_entry in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb))
  loop
    insert into public.test_result_entries (
      test_result_id,
      step_id,
      step_index,
      step_action,
      step_expected,
      status,
      issue_summary,
      steps_to_reproduce,
      actual_result,
      expected_result
    )
    values (
      v_result_id,
      v_entry->>'step_id',
      v_index,
      v_entry->>'step_action',
      v_entry->>'step_expected',
      v_entry->>'status',
      nullif(v_entry->>'issue_summary', ''),
      nullif(v_entry->>'steps_to_reproduce', ''),
      coalesce(v_entry->>'actual_result', ''),
      coalesce(v_entry->>'expected_result', '')
    );
    v_index := v_index + 1;
  end loop;

  return v_result_id;
end;
$$;

revoke all on function public.submit_audit_log(uuid, uuid, text[], text, jsonb) from public;
revoke all on function public.submit_audit_log(uuid, uuid, text[], text, jsonb) from anon, authenticated;
grant execute on function public.submit_audit_log(uuid, uuid, text[], text, jsonb) to service_role;

-- Rollback: re-run the function from 20260908_01_default_expected_result.sql.
