-- First-party traffic and activity records. Spec: docs/specs/SPEC-admin-revamp.md,
-- Phase 0. No third-party analytics: page views and app events land here, and
-- only the admin console reads them.
--
-- No raw IP is stored anywhere below. A logged-out visitor is a random cookie
-- id (th_vid) and a country from the platform header, nothing more.
--
-- Service role only, the same as ai_usage_events and rate_limits: RLS on, no
-- policies. app/api/track is the one writer of page_views; recordEvent() in
-- lib/events.ts is the one writer of app_events.

create table public.page_views (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  visitor_id    uuid not null,          -- th_vid, 1 year, random
  session_id    uuid not null,          -- th_sid, rolling 30 minutes
  profile_id    uuid,                   -- no FK: survives profile deletion as anonymous
  account_type  text,                   -- builder | tester | null
  path          text not null,          -- normalised: ids -> [id], query dropped
  referrer_host text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  country       text,                   -- x-vercel-ip-country, 2 letters
  device        text                    -- mobile | tablet | desktop
);
create index page_views_occurred_at_idx on public.page_views (occurred_at);
create index page_views_visitor_idx on public.page_views (visitor_id, occurred_at);

create table public.app_events (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  name          text not null,          -- EVENT_NAMES in lib/events.ts; Zod, not a CHECK
  profile_id    uuid,
  account_type  text,
  subject_type  text,                   -- project | mission | test_result | account ...
  subject_id    uuid,
  props         jsonb not null default '{}'::jsonb
);
create index app_events_name_idx on public.app_events (name, occurred_at);
create index app_events_profile_idx on public.app_events (profile_id, occurred_at);

-- Raw page views are kept 90 days, then rolled up here by day (Africa/Lagos)
-- and path. Signups are not rolled up: they live on auth.users forever.
create table public.traffic_daily (
  day      date not null,
  path     text not null,
  visitors int  not null,
  views    int  not null,
  sessions int  not null,
  primary key (day, path)
);

alter table public.page_views enable row level security;
alter table public.app_events enable row level security;
alter table public.traffic_daily enable row level security;
-- No policies: service role only.

-- ── roll_up_page_views ────────────────────────────────────────────────────
-- Moves whole Lagos days older than p_keep_days from page_views into
-- traffic_daily, and deletes them, in one transaction — a crash between the
-- two would double-count or lose a day. Run by the daily cron. Returns the
-- number of raw rows removed.
create or replace function public.roll_up_page_views(p_keep_days int default 90)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz :=
    ((now() at time zone 'Africa/Lagos')::date - p_keep_days)::timestamp at time zone 'Africa/Lagos';
  v_deleted int;
begin
  insert into public.traffic_daily as t (day, path, visitors, views, sessions)
  select (occurred_at at time zone 'Africa/Lagos')::date, path,
         count(distinct visitor_id), count(*), count(distinct session_id)
  from public.page_views
  where occurred_at < v_cutoff
  group by 1, 2
  on conflict (day, path) do update set
    visitors = t.visitors + excluded.visitors,
    views    = t.views + excluded.views,
    sessions = t.sessions + excluded.sessions;

  delete from public.page_views where occurred_at < v_cutoff;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.roll_up_page_views(int) from public, anon, authenticated;
grant execute on function public.roll_up_page_views(int) to service_role;

-- ── Time per report ───────────────────────────────────────────────────────
-- When the tester first touched the form, as their browser reported it. Raw
-- and imperfect (a tab left open overnight is a twelve-hour report), so it is
-- read as a median, never a mean. Admin Metrics §10.
alter table public.test_results add column if not exists started_at timestamptz;

-- submit_audit_log gains p_started_at. A new argument is a new signature, so
-- the old one is dropped rather than left as an overload. Body otherwise
-- unchanged from 20260930_02; grants restated — they do not survive a drop.
drop function if exists public.submit_audit_log(uuid, uuid, text[], text, jsonb);

create or replace function public.submit_audit_log(
  p_mission_id      uuid,
  p_tester_id       uuid,
  p_screenshot_urls text[],
  p_tester_comment  text,
  p_entries         jsonb,
  p_started_at      timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result_id uuid;
  v_entry     jsonb;
  v_index     int := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_mission_id::text || ':' || p_tester_id::text, 0));

  if exists (
    select 1 from public.test_results
    where mission_id = p_mission_id and tester_id = p_tester_id
  ) then
    raise exception 'already_submitted' using errcode = '23505';
  end if;

  insert into public.test_results (
    mission_id, tester_id, screenshot_urls, screenshot_url,
    tester_comment, ai_summary, ai_sentiment, started_at
  )
  values (
    p_mission_id, p_tester_id, p_screenshot_urls, p_screenshot_urls[1],
    nullif(p_tester_comment, ''), '', 'NEUTRAL',
    -- A start in the future is a broken clock, not a measurement.
    case when p_started_at <= now() then p_started_at end
  )
  returning id into v_result_id;

  for v_entry in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb))
  loop
    insert into public.test_result_entries (
      test_result_id, step_id, step_index, step_action, step_expected, status,
      issue_summary, steps_to_reproduce, actual_result, expected_result
    )
    values (
      v_result_id,
      v_entry->>'step_id',
      v_index,
      v_entry->>'step_action',
      v_entry->>'step_expected',
      v_entry->>'status',
      nullif(v_entry->>'issue_summary', ''),
      nullif(v_entry->>'steps_to_reproduce', ''),
      coalesce(v_entry->>'actual_result', ''),
      coalesce(v_entry->>'expected_result', '')
    );
    v_index := v_index + 1;
  end loop;

  return v_result_id;
end;
$$;

revoke all on function public.submit_audit_log(uuid, uuid, text[], text, jsonb, timestamptz) from public;
revoke all on function public.submit_audit_log(uuid, uuid, text[], text, jsonb, timestamptz) from anon, authenticated;
grant execute on function public.submit_audit_log(uuid, uuid, text[], text, jsonb, timestamptz) to service_role;

-- Rollback:
--   drop function public.submit_audit_log(uuid, uuid, text[], text, jsonb, timestamptz);
--   re-run submit_audit_log from 20260930_02_one_report_per_mission.sql;
--   alter table public.test_results drop column started_at;
--   drop function public.roll_up_page_views(int);
--   drop table public.traffic_daily, public.app_events, public.page_views;
