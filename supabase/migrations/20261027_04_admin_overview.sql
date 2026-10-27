-- Traffic totals for the admin Overview. Spec: docs/specs/SPEC-admin-revamp.md,
-- Phase 3. Distinct counts belong in SQL — PostgREST cannot count distinct,
-- and loading every page view into the page to do it is the O(table) pattern
-- the spec removes. A definer function because signups live on auth.users.
--
-- Reads raw page_views only: the Overview's longest range is 90 days, the
-- same as raw retention. Older ranges are /admin/traffic's, from traffic_daily.

create or replace function public.admin_traffic_totals(p_from timestamptz, p_to timestamptz)
returns table (visitors bigint, sessions bigint, views bigint, signups bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(distinct visitor_id) from public.page_views where occurred_at >= p_from and occurred_at < p_to),
    (select count(distinct session_id) from public.page_views where occurred_at >= p_from and occurred_at < p_to),
    (select count(*) from public.page_views where occurred_at >= p_from and occurred_at < p_to),
    (select count(*) from auth.users where created_at >= p_from and created_at < p_to)
$$;

revoke all on function public.admin_traffic_totals(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_traffic_totals(timestamptz, timestamptz) to service_role;

-- Rollback: drop function public.admin_traffic_totals(timestamptz, timestamptz);
