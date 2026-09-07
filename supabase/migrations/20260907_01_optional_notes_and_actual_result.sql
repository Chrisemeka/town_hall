-- Two fields stop being required, and the function that writes one of them
-- learns to survive its absence.
--
-- Why now:
--
--   missions.task_description was the mission brief. Since 20260905_02 the real
--   brief is missions.test_steps — ordered action / expected-result pairs — and
--   the description is supplementary. It was still mandatory at 20 characters
--   and still the largest control on the form, so the form asked for the brief
--   twice and refused to save without the redundant copy.
--
--   test_result_entries.actual_result was asked of every step including a pass.
--   A passing step's actual result has already been stated in expected_result,
--   which is how a column fills up with "as expected", "fine", "worked".
--
-- Both keep NOT NULL and gain a '' default rather than becoming nullable. Every
-- read site in the app types these as string; making them nullable means
-- auditing all of them for a distinction — "no notes" versus "notes cleared" —
-- that nothing in the product needs.
--
-- Probed before writing, through the PostgREST OpenAPI definition, which lists
-- NOT NULL columns in `required` and emits `default` where one exists:
--
--   missions.task_description            NOT NULL, no default
--   test_result_entries.actual_result    NOT NULL, no default
--
-- (Control: missions.id reports gen_random_uuid(), created_at reports now(),
-- device_target reports 'both'. So the absence is a reading, not a gap.)
--
-- Nothing here is destructive. No column is dropped, no constraint narrowed, no
-- row rewritten — every existing row already carries a value for both. Both
-- defaults reverse with `alter column ... drop default`, and the function below
-- is restorable verbatim from 20260906_02.

-- ── 1. Defaults ──────────────────────────────────────────────────────────

alter table public.missions
  alter column task_description set default '';

alter table public.test_result_entries
  alter column actual_result set default '';

-- ── 2. The function has to tolerate an absent key ────────────────────────
--
-- 20260906_02 writes v_entry->>'actual_result' straight into a NOT NULL column.
-- `->>` on a missing key returns NULL, not '' — and a column default does not
-- fire for an explicit NULL. Once actual_result is optional in Zod, a passing
-- entry parses to an object with the key absent, and actions/submissions.ts
-- hands that parsed object to this function verbatim. Without the coalesce the
-- first passing step fails the insert.
--
-- Same signature, so this is a replacement rather than a new function. The
-- grants below are restated rather than assumed: a spec that trusts a grant to
-- have survived is how a security definer function ends up callable by anon.
--
-- Everything else is unchanged from 20260906_02. issue_summary and
-- steps_to_reproduce already go through nullif and are nullable.

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
      -- The change. A passing step sends no actual_result at all.
      coalesce(v_entry->>'actual_result', ''),
      v_entry->>'expected_result'
    );
    v_index := v_index + 1;
  end loop;

  return v_result_id;
end;
$$;

-- Restated from 20260906_02, not assumed. security definer means whoever may
-- execute this writes with the owner's rights, bypassing RLS; left callable by
-- anon it is a hole wider than any it closes.
revoke all on function public.submit_audit_log(uuid, uuid, text[], text, jsonb) from public;
revoke all on function public.submit_audit_log(uuid, uuid, text[], text, jsonb) from anon, authenticated;
grant execute on function public.submit_audit_log(uuid, uuid, text[], text, jsonb) to service_role;
