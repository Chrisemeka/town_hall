-- The AI page's counts, in SQL. Spec: docs/specs/SPEC-admin-revamp.md,
-- Phase 5 ("move every remaining in-memory count to SQL"). The page used to
-- load every test_results row, mission, project and profile to count them.
-- The lists it shows are bounded queries; only the counting lives here.

create or replace function public.admin_ai_summary(p_days int default 30)
returns table (
  total bigint, generated bigint, failed bigint,
  positive bigint, neutral bigint, frustrated bigint, unknown bigint,
  daily jsonb
)
language sql stable security definer set search_path = public
as $$
  with r as (
    select ai_sentiment, created_at, coalesce(trim(ai_summary), '') <> '' as ok from public.test_results
  )
  select
    (select count(*) from r),
    (select count(*) from r where ok),
    (select count(*) from r where not ok),
    (select count(*) from r where ok and upper(ai_sentiment) = 'POSITIVE'),
    (select count(*) from r where ok and upper(ai_sentiment) = 'NEUTRAL'),
    (select count(*) from r where ok and upper(ai_sentiment) = 'FRUSTRATED'),
    (select count(*) from r where ok and (ai_sentiment is null or upper(ai_sentiment) not in ('POSITIVE', 'NEUTRAL', 'FRUSTRATED'))),
    -- Generated reports per UTC day, the shape the page's chart already uses.
    (select coalesce(jsonb_object_agg(d, n), '{}'::jsonb) from (
       select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') d, count(*) n from r
       where ok and created_at >= now() - make_interval(days => p_days)
       group by 1) x)
$$;

revoke all on function public.admin_ai_summary(int) from public, anon, authenticated;
grant execute on function public.admin_ai_summary(int) to service_role;

-- Rollback: drop function public.admin_ai_summary(int);
