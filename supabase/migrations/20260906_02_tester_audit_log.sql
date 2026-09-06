-- Tester feedback becomes a structured audit log filed against the builder's
-- test-case steps: one entry per step, instead of one free-text comment.

-- ── 1. The entries ───────────────────────────────────────────────────────
--
-- A child table, unlike missions.test_steps which is jsonb. The asymmetry is
-- deliberate: steps are read and written whole with their mission and never
-- queried across missions, while entries are aggregated independently — "how
-- many steps failed across this project", "which step fails most often" — and
-- that is what a child table is for.
--
-- step_action and step_expected are SNAPSHOTS of the builder's wording, not
-- lookups. If the builder edits the mission after submissions exist — which PR
-- 3 makes easy — a join to the live mission would silently rewrite what the
-- tester appears to have been asked. The audit log has to keep reading
-- correctly against the instruction that was actually on screen. step_id is
-- kept for correlation, but the snapshot is the record.
--
-- issue_summary and steps_to_reproduce are nullable; actual_result and
-- expected_result are not. A passing step has an actual and an expected result
-- but no issue and nothing to reproduce, and making a tester type "N/A" four
-- times per passing step is exactly the friction that produces garbage data.
-- The conditional rule — fail requires both — is enforced in Zod, not here: a
-- CHECK would have to encode the status vocabulary, and CLAUDE.md keeps
-- vocabularies in Zod.
--
-- No CHECK on status for the same reason.

create table if not exists public.test_result_entries (
  id                 uuid primary key default gen_random_uuid(),
  test_result_id     uuid not null references public.test_results(id) on delete cascade,
  step_id            text not null,
  step_index         int  not null,
  step_action        text not null,
  step_expected      text not null,
  status             text not null,
  issue_summary      text,
  steps_to_reproduce text,
  actual_result      text not null,
  expected_result    text not null,
  created_at         timestamptz not null default now()
);

create index if not exists idx_test_result_entries_result
  on public.test_result_entries (test_result_id);

-- RLS on with no policy. Every read and write goes through the service-role
-- client, matching what 20260906_01 established for projects and missions.
-- Nothing reaches this table from the browser.
alter table public.test_result_entries enable row level security;

-- ── 2. tester_comment stops being required ───────────────────────────────
--
-- It is now the optional "anything else?" at the end of the form. Retained, not
-- dropped: all 24 existing submissions have one and no entries, and it is the
-- only thing they carry.

alter table public.test_results alter column tester_comment drop not null;

-- ── 3. Atomicity ─────────────────────────────────────────────────────────
--
-- A submission writes one test_results row plus N entries, and that has to be
-- all or nothing. A partial write leaves a submission with three of five steps
-- logged, which is worse than a failed submission because it looks complete —
-- the builder reads it as a finished audit.
--
-- There is no ORM and no $transaction here, so per CLAUDE.md this is a plpgsql
-- function invoked with .rpc(). A function body is one transaction: any raise
-- inside the loop rolls back the parent row with it.
--
-- An empty p_entries is legitimate and inserts the parent alone. That is the
-- fallback path for the thirteen missions that predate test cases and have no
-- steps to file against.

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
      v_entry->>'actual_result',
      v_entry->>'expected_result'
    );
    v_index := v_index + 1;
  end loop;

  return v_result_id;
end;
$$;

-- security definer means whoever may execute this writes with the function
-- owner's rights, bypassing RLS. Left callable by anon it would be a hole
-- wider than the one the RLS tightening just closed, so execution is revoked
-- from everyone and granted back only to service_role, which is the only thing
-- the server action uses.
revoke all on function public.submit_audit_log(uuid, uuid, text[], text, jsonb) from public;
revoke all on function public.submit_audit_log(uuid, uuid, text[], text, jsonb) from anon, authenticated;
grant execute on function public.submit_audit_log(uuid, uuid, text[], text, jsonb) to service_role;

-- ── 4. Close the last anon write path ────────────────────────────────────
--
-- 20260906_01 deliberately left test_results writable by the tester, because
-- the submission action was then the only way in and went through the anon
-- client. It no longer does. Leaving the policy would let a tester insert a
-- test_results row with no entries straight through PostgREST — a submission
-- that looks complete and has no audit log, which is precisely the state the
-- function above exists to make impossible.
--
-- SELECT policies are deliberately untouched. Unlike projects and missions,
-- reads here are not uniform and this repo does not hold their definitions:
-- probing the live database showed a builder seeing exactly the submissions on
-- their own missions while being the tester on none of them, so there is a
-- project-ownership read policy in place that the builder feedback pages depend
-- on through the anon client. Dropping it and guessing at a replacement would
-- blank every builder's feedback view to save writing one WHERE clause.
--
-- So this drops write policies by command, not everything-but-a-list. If a
-- permissive ALL policy exists it is reported rather than dropped, because
-- dropping it would take reads with it — see the notice below.

alter table public.test_results enable row level security;

do $$
declare
  policy_row record;
  all_policies int := 0;
begin
  for policy_row in
    select policyname, cmd
      from pg_policies
     where schemaname = 'public'
       and tablename = 'test_results'
       and cmd in ('INSERT', 'UPDATE', 'DELETE')
  loop
    raise notice 'dropping % policy % on test_results', policy_row.cmd, policy_row.policyname;
    execute format('drop policy %I on public.test_results', policy_row.policyname);
  end loop;

  select count(*) into all_policies
    from pg_policies
   where schemaname = 'public'
     and tablename = 'test_results'
     and cmd = 'ALL';

  if all_policies > 0 then
    raise warning
      'test_results still has % ALL-command policy(ies). Those cover writes as well as reads, so the anon insert path is NOT fully closed. Left in place because dropping them would also remove read access. Review them by hand.',
      all_policies;
  end if;
end
$$;

-- Rollback:
--
--   drop function if exists public.submit_audit_log(uuid, uuid, text[], text, jsonb);
--   drop table if exists public.test_result_entries;
--   -- and, only after checking for nulls:
--   -- alter table public.test_results alter column tester_comment set not null;
--
-- Revert the code first. Entries filed after this deploys are lost on rollback:
-- their test_results rows survive but their audit logs do not, and a row whose
-- tester left the optional comment blank will then render as an empty
-- submission. Check for null tester_comment before restoring the constraint.
--
-- The dropped test_results write policies cannot be faithfully recreated — they
-- were created outside this repo. Restoring anon writes means writing a new
-- policy deliberately. Read policies were never touched, so nothing needs
-- restoring on that side.
