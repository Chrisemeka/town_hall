-- The tester's "What you expected" is removed from the form, so nothing sends
-- expected_result any more.
--
-- Why, from the live data at the time of writing — eleven entries, the whole
-- population, small enough to be evidence rather than proof:
--
--   10 of 11 (91%) left the field exactly as it was prefilled from the
--   builder's own step_expected. One tester edited it, on a failure, and wrote
--   something their issue_summary was already the place for. On a pass it has
--   never been edited once.
--
-- So the field asked a tester to retype a sentence the row already carried, and
-- since 20260907_01 it was the only thing a passing step collected. A pass now
-- collects nothing but its status, which is the honest shape: a pass means "it
-- did what the builder said", and what the builder said is on the row already.
--
-- The column is NOT dropped. 20260906_03 dropped payout_cents because a dormant
-- payment path was the thing being eliminated; this column holds eleven rows of
-- real tester writing, one of which says something step_expected does not.
-- Defaulting it keeps all of that and reverses with `drop default`.

-- ── 1. Default ───────────────────────────────────────────────────────────

alter table public.test_result_entries
  alter column expected_result set default '';

-- ── 2. The function, again ───────────────────────────────────────────────
--
-- Exactly the reason 20260907_01 gives for actual_result: `->>` on a missing
-- key returns NULL, a column default does not fire for an explicit NULL, and
-- the parsed entry no longer carries the key at all. Without the coalesce the
-- first submission after deploy fails the insert.
--
-- Same signature, so create or replace. The grants are restated rather than
-- trusted to have survived it.

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
      -- The change. No entry sends expected_result any more.
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
