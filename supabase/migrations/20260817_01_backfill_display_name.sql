-- Backfill profiles.full_name from auth.users.raw_user_meta_data->>'display_name'
-- for users whose custom display name differs from their current full_name.
-- Precedes the profile-editor UI switch from reading user_metadata to reading profiles.
--
-- Settings used to save the display name to auth user metadata while verification
-- saved the same person's name to profiles.full_name, so the two surfaces could
-- disagree. The profile editor makes profiles.full_name the only home for it; this
-- moves the values that only ever lived in metadata across, so nobody's chosen
-- name is dropped when the read switches over.
--
-- Idempotent: after a successful run the two values match, so the `!=` predicate
-- excludes every row it already touched.
--
-- Note on the predicate: a profile whose full_name IS NULL is *not* backfilled,
-- because `'x' != NULL` is NULL rather than true. That is deliberate here — it
-- keeps the affected-row count identical to the count this migration was reviewed
-- against. profiles.full_name is nullable (see the upsert in
-- app/api/auth/callback/route.ts, which writes NULL when Google returns no name),
-- so if such a row ever needs the value, do it as its own migration with an
-- explicit `p.full_name is null or ...` and a freshly reviewed count.

update public.profiles p
set full_name = u.raw_user_meta_data->>'display_name'
from auth.users u
where u.id = p.id
  and u.raw_user_meta_data->>'display_name' is not null
  and u.raw_user_meta_data->>'display_name' != p.full_name;

-- Rollback: not straightforwardly reversible. The pre-migration profiles.full_name
-- values are lost after this update runs. Recovery would require restoring from a
-- database backup taken before this migration. The user_metadata display_name
-- values remain intact and untouched by this migration.
