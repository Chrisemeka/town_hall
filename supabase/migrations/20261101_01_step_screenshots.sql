-- Screenshots belong to the step that went wrong. Spec:
-- docs/specs/SPEC-step-screenshots.md.
--
-- Each entry carries its own screenshots. The report-level
-- test_results.screenshot_urls stays: reports filed before this keep theirs,
-- a mission with no steps still uses it, and a step mission where no step
-- carries a screenshot attaches one "final result" screenshot there.
--
-- DEPLOY ORDER: this migration before the code. The old function ignores the
-- new key, so new code against it would drop step screenshots without an
-- error. Old code against the new function is harmless: a missing key gives '{}'.

alter table public.test_result_entries
  add column if not exists screenshot_urls text[] not null default '{}';

-- Same six-argument signature as 20261027_01, so create or replace, not a
-- drop. The only change is reading each entry's screenshot_urls — coalesced,
-- because -> on a missing key is NULL and a column default does not fire for
-- an explicit NULL (the 20260907_01 trap). Grants restated regardless.
create or replace function public.submit_audit_log(
  p_mission_id      uuid,
  p_tester_id       uuid,
  p_screenshot_urls text[],
  p_tester_comment  text,
  p_entries         jsonb,
  p_started_at      timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result_id uuid;
  v_entry     jsonb;
  v_index     int := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_mission_id::text || ':' || p_tester_id::text, 0));

  if exists (
    select 1 from public.test_results
    where mission_id = p_mission_id and tester_id = p_tester_id
  ) then
    raise exception 'already_submitted' using errcode = '23505';
  end if;

  insert into public.test_results (
    mission_id, tester_id, screenshot_urls, screenshot_url,
    tester_comment, ai_summary, ai_sentiment, started_at
  )
  values (
    p_mission_id, p_tester_id, p_screenshot_urls, p_screenshot_urls[1],
    nullif(p_tester_comment, ''), '', 'NEUTRAL',
    -- A start in the future is a broken clock, not a measurement.
    case when p_started_at <= now() then p_started_at end
  )
  returning id into v_result_id;

  for v_entry in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb))
  loop
    insert into public.test_result_entries (
      test_result_id, step_id, step_index, step_action, step_expected, status,
      issue_summary, steps_to_reproduce, actual_result, expected_result,
      screenshot_urls
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
      coalesce(v_entry->>'expected_result', ''),
      coalesce(
        (select array_agg(u) from jsonb_array_elements_text(v_entry->'screenshot_urls') u),
        '{}'
      )
    );
    v_index := v_index + 1;
  end loop;

  return v_result_id;
end;
$$;

revoke all on function public.submit_audit_log(uuid, uuid, text[], text, jsonb, timestamptz) from public;
revoke all on function public.submit_audit_log(uuid, uuid, text[], text, jsonb, timestamptz) from anon, authenticated;
grant execute on function public.submit_audit_log(uuid, uuid, text[], text, jsonb, timestamptz) to service_role;

-- Rollback:
--   re-run submit_audit_log from 20261027_01_admin_events.sql (same signature,
--   create or replace) with its revoke/grant lines;
--   alter table public.test_result_entries drop column screenshot_urls;
