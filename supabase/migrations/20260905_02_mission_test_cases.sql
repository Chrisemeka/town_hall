-- Turn a mission from "a title and a paragraph" into a structured test case:
-- a test category, an ordered list of action/expected-result steps, and a
-- device target. task_description survives as the overall brief.
--
-- Run order matters. The two UPDATEs below run while `category` still holds its
-- old free-text meaning; the ALTER that changes what the column means comes
-- after. Reversing them would leave the mapping reading new values.

-- ── 1. Repurpose `category` into the test-category enum ──────────────────
--
-- Audited before writing this, per the rule about not running a destructive
-- UPDATE blind. Of 16 live missions:
--
--     13  (null)                    untouched
--      1  'Auth flow'               mapped to process_flow, below
--      1  'Commerce'                nulled
--      1  'CLI / Developer Tools'   nulled
--
-- 'Auth flow' is genuinely a process flow — a sign-up/sign-in walkthrough — so
-- it is preserved rather than destroyed. The other two describe what the
-- *product* is rather than what kind of test it is; that question now belongs
-- to projects.category, so nothing the new column could have held is lost.
--
-- Those two values are recorded here and in docs/specs/SPEC-mission-test-cases.md
-- because this UPDATE is not reversible.

update public.missions
   set category = 'process_flow'
 where category = 'Auth flow';

update public.missions
   set category = null
 where category is not null
   and category not in ('process_flow', 'component', 'ui_design');

-- ── 2. The structured test case ──────────────────────────────────────────
--
-- test_steps is jsonb rather than a child table on purpose. Steps are read and
-- written whole with their mission, never queried across missions and never
-- joined to, so a child table would buy a join on every mission read and
-- nothing else. PR 4's audit entries *are* a child table, because those are
-- aggregated independently of the mission they belong to — the asymmetry is
-- deliberate.
--
-- Defaulted to '[]' rather than left nullable so every consumer can iterate
-- without a null check first.
--
-- device_target is one column with three values, not an array: "mobile or
-- desktop or both" is three states, not a set. Existing missions default to
-- 'both' because nobody specified one, so nothing should be excluded.
--
-- template_id records provenance only. A template is copied onto a mission, not
-- referenced by it, so editing a template later must not change missions that
-- were built from it.
--
-- No CHECK on category or device_target. The vocabularies are enforced in Zod at
-- the write boundary, consistent with COUNTRIES, SKILLS and PROJECT_CATEGORIES
-- (see CLAUDE.md, "Validation"), and a constraint would make every future edit
-- to either list a migration.

alter table public.missions
  add column if not exists test_steps    jsonb not null default '[]'::jsonb,
  add column if not exists device_target text  not null default 'both',
  add column if not exists template_id   text;

-- Rollback:
--
--   alter table public.missions
--     drop column if exists test_steps,
--     drop column if exists device_target,
--     drop column if exists template_id;
--
-- Ship the code revert first. The category UPDATEs above are NOT reversible —
-- 'Commerce' and 'CLI / Developer Tools' are gone, and 'Auth flow' now reads
-- 'process_flow'. Restore them by hand from the audit table in this comment if
-- it matters.
