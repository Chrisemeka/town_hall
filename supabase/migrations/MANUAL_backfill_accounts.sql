-- ┌──────────────────────────────────────────────────────────────────────┐
-- │  NOT A MIGRATION. DO NOT RUN THIS AS PART OF THE NUMBERED SEQUENCE.  │
-- │  Deliberately unnumbered so it is never picked up by a migration     │
-- │  runner. Run it by hand, once, after reviewing the dry-run below.    │
-- └──────────────────────────────────────────────────────────────────────┘
--
-- Gives every existing account a Builder and/or Tester record, derived from
-- what each person has actually done.
--
-- Why derived rather than "everyone becomes a Builder": against the live data
-- that would be wrong. Of 32 profiles, only 4 own a project while 7 have
-- submitted a test. Blanket-Builder would strip real testers of access to
-- their own submission history on day one.
--
--   owns >= 1 project      -> builder
--   has  >= 1 submission   -> tester
--   both                   -> both rows
--   neither                -> builder (the safe default: it is where the
--                             existing product pointed them, and they can add
--                             a Tester account from /choose-account)
--   role = 'admin'         -> builder, so /dashboard is not stranded
--
-- Strictly additive. INSERT only. No UPDATE or DELETE touches profiles,
-- projects, or test_results. ON CONFLICT DO NOTHING makes it re-runnable.

/* ── STEP 1 — DRY RUN. Run this alone first and eyeball the output. ────────
   Expected against the data as of 2026-08-04: 32 rows, of which
   builder-only ~28, tester-only ~3, both ~1.

with derived as (
  select p.id as user_id,
         exists (select 1 from public.projects     x where x.owner_id  = p.id) as owns_project,
         exists (select 1 from public.test_results x where x.tester_id = p.id) as has_submitted,
         p.role
  from public.profiles p
)
select user_id,
       role,
       owns_project,
       has_submitted,
       (owns_project or not has_submitted or role = 'admin') as gets_builder,
       has_submitted                                          as gets_tester
from derived
order by owns_project desc, has_submitted desc;

*/

/* ── STEP 2 — THE INSERT. Only after step 1 looks right. ──────────────────
   Uncomment the block below to run it.

begin;

insert into public.accounts (user_id, type)
select p.id, 'builder'
from public.profiles p
where exists (select 1 from public.projects x where x.owner_id = p.id)
   or p.role = 'admin'
   or not exists (select 1 from public.test_results x where x.tester_id = p.id)
on conflict (user_id, type) do nothing;

insert into public.accounts (user_id, type)
select p.id, 'tester'
from public.profiles p
where exists (select 1 from public.test_results x where x.tester_id = p.id)
on conflict (user_id, type) do nothing;

-- Verify before committing: every profile should have at least one account.
select count(*) as profiles_without_account
from public.profiles p
where not exists (select 1 from public.accounts a where a.user_id = p.id);
-- Expect 0. If it is not 0, ROLLBACK.

commit;

*/

-- Rollback, if the split needs to be undone. Removes only the account records;
-- profiles, projects, and submissions are untouched throughout.
--   delete from public.accounts;
