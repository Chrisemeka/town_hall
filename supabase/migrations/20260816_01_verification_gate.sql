-- Per-role verification gate.
--
-- verification_completed_at lives on `accounts`, not `profiles`, because the
-- gate is per-role: completing tester verification must not open the builder
-- surfaces. Same shape as the profiles.accepted_terms_at gate — a nullable
-- timestamptz that middleware and requireAccount() refuse to let the user past
-- until it is set (see CLAUDE.md, "Gate pattern for must complete X before Y").
--
-- Every existing account row stays NULL, so all of them hit the gate on next
-- login. That is the intent, not a backfill oversight.
--
-- The index is partial on IS NULL: the only question ever asked of this column
-- is "is this account still unverified?", so indexing verified rows would grow
-- forever to answer a question nobody asks.
--
-- The five profiles columns are per-person, not per-role — a person has one
-- country and one phone number regardless of which hat they are wearing. `bio`
-- and `skills` are arguably per-role, but one person has one story about
-- themselves for MVP; split them onto `accounts` if that stops being true.
-- All nullable so a half-finished flow can still save its progress.
--
-- Safe to run more than once.

alter table public.accounts
  add column if not exists verification_completed_at timestamptz;

create index if not exists idx_accounts_verification_completed_at
  on public.accounts (verification_completed_at)
  where verification_completed_at is null;

alter table public.profiles
  add column if not exists country  text,
  add column if not exists phone    text,
  add column if not exists timezone text,
  add column if not exists bio      text,
  add column if not exists skills   text[] default '{}';

-- Rollback:
--
--   drop index if exists public.idx_accounts_verification_completed_at;
--   alter table public.accounts drop column if exists verification_completed_at;
--   alter table public.profiles
--     drop column if exists country,
--     drop column if exists phone,
--     drop column if exists timezone,
--     drop column if exists bio,
--     drop column if exists skills;
--
-- Dropping verification_completed_at is what actually disables the gate, and it
-- destroys the record of who verified. Ship the code revert first, then this.
