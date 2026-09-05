-- Give projects a category, so the Explore feed can be filtered by the kind of
-- product a tester is equipped to test.
--
-- Nullable, no default, no CHECK. All three are deliberate:
--
--   * Nullable, because the ten existing projects have no category and must keep
--     rendering. They are asked for one on their next edit; until then the card
--     reads "Uncategorised", which is true rather than guessed.
--
--   * No default, because there is no honest one. Defaulting every existing row
--     to 'Other' would put a value nobody chose into a filter people will trust,
--     and it would be indistinguishable from a builder who genuinely picked it.
--
--   * No CHECK, because the vocabulary is enforced in Zod at the write boundary,
--     the same way COUNTRIES and SKILLS are (see CLAUDE.md, "Validation"). A
--     CHECK here would also make every future edit to the list a migration.
--
-- Additive and safe to apply ahead of the deploy: code that does not know about
-- the column is unaffected by it.
--
-- Safe to run more than once.

alter table public.projects
  add column if not exists category text;

-- Rollback:
--
--   alter table public.projects drop column if exists category;
--
-- Ship the code revert first. Dropping the column destroys the categories
-- builders have set since this shipped, and there is no way to recover them.
