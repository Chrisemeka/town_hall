-- What every AI analysis cost. One row per Gemini call made for a submission,
-- succeeded or failed.
--
-- THIS IS A COST RECORD, NOT A QUOTA LEDGER. Nothing in the app reads it to
-- block, limit, count down or charge anything, and that is deliberate rather
-- than unfinished. It exists so that when AI allowances are discussed there is
-- real usage behind the number instead of the monetisation plan's modelled
-- $0.0017–$0.0103. If you are about to read it in order to block something,
-- that is tier enforcement — separate work, with its own sequencing. The same
-- warning is on lib/plans.ts and accounts.plan_id.
--
-- NOT backfilled. Submissions analysed before this shipped have an unknowable
-- cost, so the first weeks of data are partial by construction: a low early
-- total is the ship date, not a trend.
--
-- Shape decisions (docs/specs/SPEC-ai-shadow-metering.md §1):
--   * test_result_id is ON DELETE SET NULL, not cascade. A deleted submission's
--     money was still spent; a cascade would quietly erase spending history.
--   * project_id / profile_id are denormalised with NO foreign key, for the
--     same reason: they must outlive what they came from. profile_id is the
--     project owner — who the analysis was for.
--   * model on every row, so history stays attributable when the model changes.
--   * estimated_cost_usd is numeric and computed at WRITE time (lib/aiUsage.ts).
--     Recomputing at read time from a live rate map would let a price change
--     rewrite what past analyses cost.
--   * status has no CHECK: vocabularies live in code, and the one writer
--     (recordAiUsage) writes a literal union type.
--
-- RLS on with NO policies: service role only. Nothing in a browser reads this.

create table if not exists public.ai_usage_events (
  id                 uuid primary key default gen_random_uuid(),
  test_result_id     uuid references public.test_results(id) on delete set null,
  project_id         uuid,
  profile_id         uuid,
  model              text not null,
  input_tokens       int,
  output_tokens      int,
  image_count        int not null default 0,
  estimated_cost_usd numeric(12,8),
  status             text not null,  -- 'succeeded' | 'failed'
  error              text,
  created_at         timestamptz not null default now()
);

alter table public.ai_usage_events enable row level security;

comment on table public.ai_usage_events is
  'Cost record for AI analyses. NOT a quota ledger: nothing reads this to limit or charge anyone. Service role only. Not backfilled before 2026-09-29.';

-- The admin panel reads "this month". Nothing else filters yet.
create index if not exists ai_usage_events_created_at_idx
  on public.ai_usage_events (created_at);

-- Rollback:
--   drop table public.ai_usage_events;
