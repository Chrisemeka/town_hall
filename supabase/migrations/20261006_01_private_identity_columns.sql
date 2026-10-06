-- Identity columns stop being readable through the public API. Spec:
-- docs/specs/SPEC-tester-anonymity.md §0.
--
-- RLS limits rows, never columns. Before this, anyone holding the public anon
-- key — every visitor's browser has it — could read every column of every
-- project, including owner_id, flag_reason and flagged_by, logged out. A
-- builder with their own session could read tester_id off every report on
-- their projects through the project-ownership read policy. No page change
-- reaches either; this does.
--
--   test_results  no read grant for anon or authenticated at all. The app
--                 reads it only through service role, scoped in code — the
--                 same shape as test_result_entries. The read policies are
--                 left in place, inert; their definitions are not in this
--                 repo, and dropping them is a separate decision.
--   projects      readable as id, name, description, app_url, category,
--                 created_at, flagged_at — what Explore and the mission page
--                 render, and flagged_at, which the public feed filters on.
--                 owner_id, flag_reason and flagged_by are service role only.
--
-- APPLY AFTER the code that reads these through service role has deployed
-- (feat/tester-anonymity). Before it, the dashboard, the tester home and the
-- submission action read owner_id as the signed-in user and would break.
--
-- mission_feedback_counts (not in this repo) keeps working: it returns counts
-- to anon, who cannot read test_results rows, so it runs with its owner's
-- rights rather than the caller's. The self-check below proves it.

revoke select on public.test_results from anon, authenticated;

revoke select on public.projects from anon, authenticated;
grant select (id, name, description, app_url, category, created_at, flagged_at)
  on public.projects to anon, authenticated;

-- Self-check, as each API role. Any failure raises, and the migration rolls
-- back whole — nothing half-applied.
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    execute format('set local role %I', r);

    -- What must still work: the public feed, missions, the counts view.
    perform id, name, description, app_url, category, created_at, flagged_at
      from public.projects where flagged_at is null limit 1;
    perform 1 from public.missions m join public.projects p on p.id = m.project_id limit 1;
    perform 1 from public.mission_feedback_counts limit 1;

    -- What must not.
    begin
      perform owner_id from public.projects limit 1;
      raise exception '% can still read projects.owner_id', r;
    exception when insufficient_privilege then null;
    end;
    begin
      perform flagged_by from public.projects limit 1;
      raise exception '% can still read projects.flagged_by', r;
    exception when insufficient_privilege then null;
    end;
    begin
      perform tester_id from public.test_results limit 1;
      raise exception '% can still read test_results.tester_id', r;
    exception when insufficient_privilege then null;
    end;

    reset role;
  end loop;
end
$$;

-- Rollback:
--   grant select on public.test_results to anon, authenticated;
--   grant select on public.projects to anon, authenticated;
