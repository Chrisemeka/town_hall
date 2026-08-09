-- Builder / Tester account split.
--
-- One auth identity (profiles.id) can hold up to two account records, one per
-- type. This is NOT a role flag on profiles: `profiles.role` keeps its existing
-- meaning ('user' | 'admin') and is untouched here.
--
-- Google is the only auth provider, and Supabase enforces a unique email in
-- auth.users, so two auth identities for one email is not achievable. Two rows
-- here is the closest real separation available.
--
-- projects.owner_id and test_results.tester_id keep pointing at profiles.id —
-- no existing row is rewritten by this migration.
--
-- Safe to run more than once.

create table if not exists public.accounts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (type in ('builder', 'tester')),
  created_at timestamptz not null default now(),
  unique (user_id, type)
);

create index if not exists accounts_user_id_idx on public.accounts(user_id);

alter table public.accounts enable row level security;

-- No policies by design. Every read of this table happens through
-- createAdminClient() in middleware / layouts / server actions, matching how
-- the terms gate already reads `profiles` (middleware.ts). RLS on with no
-- policy means anon and authenticated clients get nothing; service-role
-- bypasses. If a client component ever needs to read its own accounts, add a
-- `using (user_id = auth.uid())` select policy then — not before.
