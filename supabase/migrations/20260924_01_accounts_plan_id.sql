-- Which plan an account is on. Display and admin override only.
--
-- NOTHING IS ENFORCED BY THIS COLUMN, and that is deliberate rather than
-- unfinished. There is no report counter, no per-mission tester ceiling and no
-- active-mission limit anywhere in the app; tier enforcement is Phase 2 in the
-- monetisation plan and is gated on the tester cohort launching. This column
-- exists so a sale can be recorded and shown. If you are about to read it in
-- order to block something, that is a different piece of work with its own
-- sequencing.
--
-- Nullable, and NOT backfilled. Null means Community. "Has not been assigned a
-- plan" and "is on the free plan" are the same fact today, so writing
-- 'community' into every existing row would invent a distinction the product
-- does not have — and would have to be undone the moment a third tier appears.
--
-- No CHECK constraint. Fixed vocabularies in this codebase live in
-- lib/vocabulary.ts and are enforced in Zod, never in the database — see
-- SKILLS, COUNTRIES, TEST_CATEGORIES and the rest. A CHECK here would be a
-- second definition of the same list, in a place a migration is needed to
-- change.
--
-- On `accounts` rather than `profiles` because a plan is per-role: one person
-- can hold a Pro builder account and an ordinary tester one, and CLAUDE.md's
-- rule is that anything scoped to a role lives on accounts.

alter table public.accounts
  add column plan_id text;

-- No index. The column is read one account at a time, on a page that has
-- already fetched that account — there is no query that filters by it yet.
-- Add one when something aggregates over it.

-- Rollback:
--   alter table public.accounts drop column plan_id;
