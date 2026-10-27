-- Reads for /admin/traffic and /admin/activity. Spec:
-- docs/specs/SPEC-admin-revamp.md, Phase 4 (and Admin Metrics §6–§8, §10).
--
-- Every one of these counts, distinct-counts or takes a median, so each is a
-- SQL function rather than a page that loads tables to count in JS. All are
-- definer functions (several read auth.users), stable, and service role only.
-- Days and months are Africa/Lagos, the same as monthOf().

-- ── Traffic by day ────────────────────────────────────────────────────────
-- Raw page_views where they still exist, traffic_daily for older days.
-- ponytail: traffic_daily keeps visitors per path, so an old day's visitor
-- total counts someone who saw two pages twice. Fine for a trend; store a
-- per-day distinct total in the rollup if anyone reads it as exact.
create or replace function public.admin_traffic_daily(p_from timestamptz, p_to timestamptz)
returns table (day date, visitors bigint, views bigint, sessions bigint, signups bigint)
language sql stable security definer set search_path = public
as $$
  with raw as (
    select (occurred_at at time zone 'Africa/Lagos')::date d,
           count(distinct visitor_id) v, count(*) pv, count(distinct session_id) s
    from public.page_views
    where occurred_at >= p_from and occurred_at < p_to
    group by 1
  ), old as (
    select t.day d, sum(t.visitors)::bigint v, sum(t.views)::bigint pv, sum(t.sessions)::bigint s
    from public.traffic_daily t
    where t.day >= (p_from at time zone 'Africa/Lagos')::date
      and t.day <= (p_to at time zone 'Africa/Lagos')::date
      and t.day not in (select d from raw)
    group by 1
  ), su as (
    select (created_at at time zone 'Africa/Lagos')::date d, count(*) n
    from auth.users where created_at >= p_from and created_at < p_to
    group by 1
  ), days as (
    select g::date d
    from generate_series((p_from at time zone 'Africa/Lagos')::date, (p_to at time zone 'Africa/Lagos')::date, interval '1 day') g
  )
  select days.d, coalesce(raw.v, old.v, 0), coalesce(raw.pv, old.pv, 0), coalesce(raw.s, old.s, 0), coalesce(su.n, 0)
  from days left join raw using (d) left join old using (d) left join su using (d)
  order by 1
$$;

-- ── Breakdowns: top pages, referrers, campaigns, countries, devices ───────
-- Raw page_views only, so at most the last 90 days.
create or replace function public.admin_traffic_breakdown(p_from timestamptz, p_to timestamptz, p_dim text, p_limit int default 10)
returns table (key text, visitors bigint, views bigint)
language sql stable security definer set search_path = public
as $$
  select k, count(distinct visitor_id), count(*)
  from (
    select visitor_id,
      case p_dim
        when 'path' then path
        when 'referrer' then coalesce(referrer_host, '(direct)')
        when 'utm' then nullif(concat_ws(' / ', utm_source, utm_medium, utm_campaign), '')
        when 'country' then coalesce(country, '(unknown)')
        when 'device' then coalesce(device, '(unknown)')
      end k
    from public.page_views
    where occurred_at >= p_from and occurred_at < p_to
  ) x
  where k is not null
  group by k
  order by 2 desc, 3 desc
  limit p_limit
$$;

-- ── Visitor → signup, by where the visitor first came from ────────────────
-- A visitor converted if any of their views in the range carries a profile
-- that signed up in the range.
create or replace function public.admin_conversion_by_source(p_from timestamptz, p_to timestamptz)
returns table (source text, visitors bigint, signups bigint)
language sql stable security definer set search_path = public
as $$
  with firsts as (
    select distinct on (visitor_id) visitor_id, coalesce(utm_source, referrer_host, '(direct)') src
    from public.page_views
    where occurred_at >= p_from and occurred_at < p_to
    order by visitor_id, occurred_at
  ), converted as (
    select distinct pv.visitor_id
    from public.page_views pv join auth.users u on u.id = pv.profile_id
    where pv.occurred_at >= p_from and pv.occurred_at < p_to
      and u.created_at >= p_from and u.created_at < p_to
  )
  select f.src, count(*), count(c.visitor_id)
  from firsts f left join converted c using (visitor_id)
  group by f.src
  order by 2 desc
  limit 15
$$;

-- ── The gate chain as a funnel (Admin Metrics §6) ─────────────────────────
-- Everyone who signed up in the range, and how far each got.
create or replace function public.admin_funnel(p_from timestamptz, p_to timestamptz)
returns table (visitors bigint, signups bigint, confirmed bigint, terms bigint, account bigint, verified bigint, first_action bigint)
language sql stable security definer set search_path = public
as $$
  with s as (
    select u.id, u.email_confirmed_at from auth.users u
    where u.created_at >= p_from and u.created_at < p_to
  )
  select
    (select count(distinct visitor_id) from public.page_views where occurred_at >= p_from and occurred_at < p_to),
    (select count(*) from s),
    (select count(*) from s where email_confirmed_at is not null),
    (select count(*) from s join public.profiles p on p.id = s.id where p.accepted_terms_at is not null),
    (select count(*) from s where exists (select 1 from public.accounts a where a.user_id = s.id)),
    (select count(*) from s where exists (select 1 from public.accounts a where a.user_id = s.id and a.verification_completed_at is not null)),
    (select count(*) from s where exists (select 1 from public.projects pr where pr.owner_id = s.id)
                               or exists (select 1 from public.test_results r where r.tester_id = s.id))
$$;

-- ── Activation and time to first value ────────────────────────────────────
-- Builder: signup → project → test case published → first report received.
-- Tester:  signup → verified → first report filed. Medians in hours.
-- "Published": live (null is_active is a legacy live mission) or ever reserved.
create or replace function public.admin_activation(p_from timestamptz, p_to timestamptz)
returns table (
  b_signups bigint, b_project bigint, b_published bigint, b_first_report bigint, b_median_hours double precision,
  t_signups bigint, t_verified bigint, t_first_report bigint, t_median_hours double precision
)
language sql stable security definer set search_path = public
as $$
  with b as (
    select u.id, u.created_at,
      exists (select 1 from public.projects pr where pr.owner_id = u.id) has_project,
      exists (
        select 1 from public.missions m join public.projects pr on pr.id = m.project_id
        where pr.owner_id = u.id
          and (m.is_active is distinct from false
               or exists (select 1 from public.report_ledger l where l.mission_id = m.id and l.kind = 'reserved'))
      ) published,
      (select min(r.created_at) from public.test_results r
         join public.missions m on m.id = r.mission_id
         join public.projects pr on pr.id = m.project_id
       where pr.owner_id = u.id) first_report
    from auth.users u join public.accounts a on a.user_id = u.id and a.type = 'builder'
    where u.created_at >= p_from and u.created_at < p_to
  ), t as (
    select u.id, u.created_at, a.verification_completed_at,
      (select min(r.created_at) from public.test_results r where r.tester_id = u.id) first_report
    from auth.users u join public.accounts a on a.user_id = u.id and a.type = 'tester'
    where u.created_at >= p_from and u.created_at < p_to
  )
  select
    (select count(*) from b), (select count(*) from b where has_project), (select count(*) from b where published),
    (select count(*) from b where first_report is not null),
    (select percentile_cont(0.5) within group (order by extract(epoch from first_report - created_at) / 3600) from b where first_report is not null),
    (select count(*) from t), (select count(*) from t where verification_completed_at is not null),
    (select count(*) from t where first_report is not null),
    (select percentile_cont(0.5) within group (order by extract(epoch from first_report - created_at) / 3600) from t where first_report is not null)
$$;

-- ── Retention (Admin Metrics §7) ──────────────────────────────────────────
-- "Active" is any sign of use: a page view, an event, a report filed, a
-- project created. page_views alone would forget everyone after 90 days.
create or replace function public.admin_retention_summary()
returns table (
  builders_with_mission bigint, builders_second_mission bigint,
  testers_with_report bigint, testers_second_report bigint,
  mau_builders bigint, mau_testers bigint,
  cohort_members bigint, cohort_active_30d bigint
)
language sql stable security definer set search_path = public
as $$
  with per_builder as (
    select pr.owner_id, count(*) n from public.missions m join public.projects pr on pr.id = m.project_id group by 1
  ), per_tester as (
    select tester_id, count(*) n from public.test_results group by 1
  ), mau as (
    select account_type, count(distinct profile_id) n from public.page_views
    where profile_id is not null and occurred_at >= now() - interval '30 days'
    group by 1
  )
  select
    (select count(*) from per_builder), (select count(*) from per_builder where n >= 2),
    (select count(*) from per_tester), (select count(*) from per_tester where n >= 2),
    coalesce((select n from mau where account_type = 'builder'), 0),
    coalesce((select n from mau where account_type = 'tester'), 0),
    (select count(*) from public.accounts where type = 'tester' and cohort_member_at is not null and cohort_left_at is null),
    (select count(*) from public.accounts a
       where a.type = 'tester' and a.cohort_member_at is not null and a.cohort_left_at is null
         and exists (select 1 from public.test_results r where r.tester_id = a.user_id and r.created_at >= now() - interval '30 days'))
$$;

create or replace function public.admin_retention_cohorts(p_months int default 6)
returns table (month date, signups bigint, m1 bigint, m2 bigint, m3 bigint)
language sql stable security definer set search_path = public
as $$
  with s as (
    select id, date_trunc('month', created_at at time zone 'Africa/Lagos')::date m from auth.users
    where created_at at time zone 'Africa/Lagos' >= date_trunc('month', now() at time zone 'Africa/Lagos') - make_interval(months => p_months - 1)
  ), act as (
    select distinct profile_id pid, date_trunc('month', occurred_at at time zone 'Africa/Lagos')::date m
      from public.page_views where profile_id is not null
    union
    select distinct profile_id, date_trunc('month', occurred_at at time zone 'Africa/Lagos')::date
      from public.app_events where profile_id is not null
    union
    select distinct tester_id, date_trunc('month', created_at at time zone 'Africa/Lagos')::date from public.test_results
    union
    select distinct owner_id, date_trunc('month', created_at at time zone 'Africa/Lagos')::date from public.projects where owner_id is not null
  )
  select s.m, count(distinct s.id),
    count(distinct a1.pid), count(distinct a2.pid), count(distinct a3.pid)
  from s
  left join act a1 on a1.pid = s.id and a1.m = (s.m + interval '1 month')::date
  left join act a2 on a2.pid = s.id and a2.m = (s.m + interval '2 months')::date
  left join act a3 on a3.pid = s.id and a3.m = (s.m + interval '3 months')::date
  group by s.m
  order by s.m
$$;

-- ── Quality (Admin Metrics §8, §10) ───────────────────────────────────────
-- Ratings and the status mix for reports filed in the range; the review
-- backlog as it stands now; time per report as a median, never a mean.
create or replace function public.admin_quality(p_from timestamptz, p_to timestamptz)
returns table (
  r1 bigint, r2 bigint, r3 bigint, r4 bigint, r5 bigint,
  filed bigint, approved bigint,
  pending bigint, pending_oldest timestamptz, pending_median_days double precision,
  pass bigint, fail bigint, blocked bigint,
  timed bigint, median_minutes double precision
)
language sql stable security definer set search_path = public
as $$
  with r as (
    select * from public.test_results where created_at >= p_from and created_at < p_to
  ), e as (
    select e.status from public.test_result_entries e join r on r.id = e.test_result_id
  ), p as (
    select created_at from public.test_results where status = 'pending'
  )
  select
    (select count(*) from r where rating = 1), (select count(*) from r where rating = 2),
    (select count(*) from r where rating = 3), (select count(*) from r where rating = 4),
    (select count(*) from r where rating = 5),
    (select count(*) from r), (select count(*) from r where status = 'approved'),
    (select count(*) from p), (select min(created_at) from p),
    (select percentile_cont(0.5) within group (order by extract(epoch from now() - created_at) / 86400) from p),
    (select count(*) from e where status = 'pass'), (select count(*) from e where status = 'fail'),
    (select count(*) from e where status = 'blocked'),
    (select count(*) from r where started_at is not null),
    (select percentile_cont(0.5) within group (order by extract(epoch from created_at - started_at) / 60) from r where started_at is not null)
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_traffic_daily(timestamptz, timestamptz)',
    'admin_traffic_breakdown(timestamptz, timestamptz, text, int)',
    'admin_conversion_by_source(timestamptz, timestamptz)',
    'admin_funnel(timestamptz, timestamptz)',
    'admin_activation(timestamptz, timestamptz)',
    'admin_retention_summary()',
    'admin_retention_cohorts(int)',
    'admin_quality(timestamptz, timestamptz)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- Rollback: drop each function above.
