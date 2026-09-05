-- Remove write access to `projects` and `missions` from the anon key.
--
-- WHY
--
-- Both tables carried owner-scoped RLS policies that correctly stopped one
-- builder writing another's rows, but carried no column restriction. Because
-- the anon key and the user's session both ship to the browser, a builder could
-- call PostgREST directly and write any column on their own row:
--
--     projects.flagged_at    -> un-flag themselves after an admin moderates them
--     projects.owner_id      -> reassign ownership
--     missions.payout_cents  -> the column CLAUDE.md says not to wire anything to
--     missions.test_steps    -> arbitrary JSON, bypassing every Zod rule
--
-- All four were verified against this database before writing this migration.
-- The last one is why it matters now: PR 4's audit entries reference
-- missions.test_steps[].id, so a builder able to rewrite those ids by hand can
-- silently detach a tester's history from the step they answered.
--
-- The server actions already restrict the column set in code. This closes the
-- second, unvalidated path to the same rows, which is what makes that code the
-- only way in.
--
-- WHAT MUST NOT CHANGE
--
-- Read access. Measured before writing this: the anon key, logged out, sees all
-- 10 projects and all 16 missions, so reads are effectively `using (true)`. The
-- Explore feed, Browse Missions and every public mission page depend on that.
-- Step 1 below pins that behaviour explicitly *before* step 2 removes anything,
-- so even dropping a permissive ALL policy cannot take read access with it.
--
-- SAFE TO RUN because every write to these two tables now goes through
-- createAdminClient(), which uses the service-role key and bypasses RLS:
--
--     actions/project.ts   createProject, updateProject
--     actions/missions.ts  createMission, updateMission, deleteMission,
--                          toggleMissionStatus
--     actions/admin/*      already service-role via requireAdmin()
--
-- Ownership is enforced in code by requireProjectOwner() in lib/auth.ts, which
-- replaced what the dropped policies were doing.
--
-- NOT IN SCOPE: test_results still accepts an anon insert from the tester
-- submission flow. PR 4 replaces that path with a plpgsql function, and its
-- policies should be tightened then, in the same change — not now, while the
-- only write path still needs them.

-- ── 1. Pin the current read behaviour, explicitly and first ──────────────

alter table public.projects enable row level security;
alter table public.missions enable row level security;

drop policy if exists "public read projects" on public.projects;
create policy "public read projects"
  on public.projects
  for select
  using (true);

drop policy if exists "public read missions" on public.missions;
create policy "public read missions"
  on public.missions
  for select
  using (true);

-- ── 2. Remove every other policy on these two tables ─────────────────────
--
-- By name lookup rather than a hard-coded list: the policies were created
-- outside this repo's migrations, so their names are not knowable from here.
-- The two created above are excluded, so this cannot remove read access.
--
-- With RLS enabled and no INSERT/UPDATE/DELETE policy, a write from the anon
-- key silently affects zero rows (or is refused outright on insert). That is
-- the desired end state: the service-role server actions remain the only way
-- to change these tables.

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname, tablename
      from pg_policies
     where schemaname = 'public'
       and tablename in ('projects', 'missions')
       and policyname not in ('public read projects', 'public read missions')
  loop
    raise notice 'dropping policy % on %', policy_row.policyname, policy_row.tablename;
    execute format('drop policy %I on public.%I', policy_row.policyname, policy_row.tablename);
  end loop;
end
$$;

-- Rollback:
--
-- There is no faithful rollback. The dropped policies were created outside this
-- repo and their definitions are not recorded anywhere, so they cannot be
-- recreated from here. If builders need direct write access again, the honest
-- repair is a new policy written deliberately and column-scoped — not a guess
-- at what was here before.
--
-- What a revert would actually need: revert the code first (project and mission
-- actions back to the anon client), then recreate owner-scoped write policies,
-- something like:
--
--   create policy "owners write projects" on public.projects
--     for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
--
-- which reintroduces the column hole described at the top of this file.
