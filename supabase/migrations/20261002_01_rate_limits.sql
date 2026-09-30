-- Rate limiting: a short-window abuse guard. Spec:
-- docs/specs/SPEC-rate-limiting.md.
--
-- A rate limit is not an allowance. The allowance is report_ledger, a business
-- quota spent at publish; this is "ten of these an hour, or you are a script".
-- Nothing here reads the ledger and nothing there reads this.
--
-- Fixed window. The check-and-increment is one upsert, which takes the row
-- lock, so two concurrent calls at the boundary serialise: one sees the limit,
-- the other limit + 1. There is no read-then-write for anything to race.
-- ponytail: fixed window lets up to 2x the limit through across a boundary;
-- sliding window if that ever matters.
--
-- Manual atomicity check (two psql sessions, same key, limit 1):
--   session A: begin; select * from rate_limit_hit('probe', 1, 60);
--   session B:        select * from rate_limit_hit('probe', 1, 60);  -- waits
--   session A: commit;                                               -- B: allowed = false
--
-- Cleanup: about 1 call in 100 sweeps rows older than a day. There is no job
-- infrastructure in this project, and keys that never return (an attacker's
-- IPs) would never be cleaned by a per-key delete. The longest window is an
-- hour, so a day's margin never deletes a live row.

create table public.rate_limits (
  key          text        not null,
  window_start timestamptz not null,
  hits         int         not null,
  primary key (key, window_start)
);

create index rate_limits_window_start_idx on public.rate_limits (window_start);

-- Service role only: RLS on, no policies.
alter table public.rate_limits enable row level security;

create or replace function public.rate_limit_hit(
  p_key            text,
  p_limit          int,
  p_window_seconds int
) returns table (allowed boolean, retry_after int)
language plpgsql
security definer
-- Pinned so a caller cannot shadow `public` and redirect a definer-rights write.
set search_path = public
as $$
declare
  v_epoch bigint := floor(extract(epoch from now()))::bigint;
  v_start timestamptz := to_timestamp(v_epoch - (v_epoch % p_window_seconds));
  v_hits  int;
begin
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  allowed := v_hits <= p_limit;
  retry_after := greatest(1, (v_epoch - (v_epoch % p_window_seconds) + p_window_seconds - v_epoch)::int);
  return next;
end;
$$;

revoke all on function public.rate_limit_hit(text, int, int) from public;
revoke all on function public.rate_limit_hit(text, int, int) from anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- Rollback:
--   drop function public.rate_limit_hit(text, int, int);
--   drop table public.rate_limits;
