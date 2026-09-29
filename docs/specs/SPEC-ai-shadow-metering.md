# SPEC: AI Shadow Metering

**Status:** Implemented on `feat/ai-shadow-metering` — migration not yet applied
**Branch:** `feat/ai-shadow-metering`
**Base:** `main` (at `2aaf99b`)
**Depends on:** Nothing.
**Blocks:** Nothing. Tier enforcement will *read* this table one day; it does not wait on it.
**Source:** `docs/TWNHALL_SHADOW_METERING_PROMPT.md`
**Migration:** `20260929_01_ai_usage_events.sql` — additive, one new table
**Risk:** low. The one way this could hurt is by adding a failure mode to the
submission path, and §4 is written to make that structurally impossible.

## Summary

Every tester submission already fires one Gemini call from the `after()` block
in `actions/submissions.ts`. The SDK returns token counts with every call and
`lib/ai.ts` throws them away. This PR keeps them: one row per analysis in a new
service-role-only table, `ai_usage_events`, with the cost computed at write
time — and a small cost panel on `/admin/ai-reports` so somebody looks at it.

**It records cost. It does not charge, limit, or display anything to a user.**
No quota, no counter, no balance, no plan interaction, no change to when or
whether analysis runs.

## Why now

The monetisation plan's cost-per-insight figure (§2, ~$0.0017–$0.0103) is a
model computed from published rates and assumed screenshot counts, not a
measurement — and §10 says a real figure 100× higher flips the "don't meter the
AI" conclusion. Data takes calendar time; this code takes a day. Shipping it
alongside enforcement would mean setting the first limit against an empty table.

## Non-goals

- No quota, counter, balance or limit. Nothing reads this table to block anything.
- No user-facing change. Only `/admin/ai-reports` gains a panel.
- No change to when analysis runs — still automatic, still in the same `after()`.
- No billing, no money, no plan interaction. `accounts.plan_id` is not read.
- **No backfill.** See §1.

## §1 — The table

`supabase/migrations/20260929_01_ai_usage_events.sql`

```sql
create table if not exists public.ai_usage_events (
  id                 uuid primary key default gen_random_uuid(),
  test_result_id     uuid references public.test_results(id) on delete set null,
  project_id         uuid,
  profile_id         uuid,           -- the project owner: who the analysis was for
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
-- no policies: service role only
create index if not exists ai_usage_events_created_at_idx on public.ai_usage_events (created_at);
```

| Decision | Reason |
|---|---|
| `on delete set null`, not cascade | A cost record. A deleted submission's money was still spent; a cascade would quietly erase spending history. |
| `project_id`, `profile_id` denormalised, **no FK** | They must outlive the submission, and are how cost aggregates per builder. An FK would either cascade (erasing history) or block deleting a project. |
| `model` on every row | When the model changes, old rows stay attributable to what actually ran. |
| `numeric(12,8)`, not float | Values are ~0.005 summed over thousands of rows; `numeric` is exact. |
| `status` has no CHECK | House rule — vocabularies live in code. Only one writer exists and it writes a literal union type. |
| RLS on, no policies | Per `CLAUDE.md`. Nothing in a browser should ever read this. |
| One index, on `created_at` | The admin panel reads "this month". Nothing else filters yet. |

The migration and the table carry the same warning `lib/plans.ts` does: **this
is a cost record, not a quota ledger.** If you are about to read it to block
something, that is tier enforcement — separate work, own sequencing. It goes in
the migration's header comment *and* as `comment on table`, so it shows up in
the Supabase dashboard where a future session is most likely to meet it.

**No backfill.** Submissions analysed before this ships have an unknowable
cost; no rows are invented for them. **The first weeks of data are partial by
construction** — a low early monthly total is the ship date, not a trend.

## §2 — Cost calculation

**New file `lib/aiUsage.ts`**, not `lib/ai.ts`. Reasons: `lib/ai.ts` builds the
Google provider at import time and every existing test mocks it wholesale, so a
pure cost function there cannot be tested directly without un-mocking the
provider. The recorder (§4) also lives here, next to the rates it uses.

```ts
// Checked 2026-09-29 against Google's published Gemini API pricing.
// Published rates go stale — re-check when this date is old.
export const AI_RATES_USD_PER_MTOK = {
  "gemini-3-flash-preview": { input: 0.5, output: 3.0 },
}
export function estimateCostUsd(model, inputTokens, outputTokens): number | null
```

- Returns `null` when either count is missing, or the model has no rate — an
  unknown model must not be recorded as free.
- **Computed at write time and stored.** Computing at read time from a live
  rate map would let a price change retroactively rewrite what past analyses
  cost, which destroys the only thing the table is for.
- **No text/image split** of `input_tokens`. The SDK total already includes
  image tokens; `image_count` sits next to it and the correlation emerges from
  the data. A guessed split would be invented precision.

## §3 — Capturing usage

AI SDK 6 (`ai@6.0.x`, checked in `node_modules/ai/dist/index.d.ts`):
`generateText` returns `usage: LanguageModelUsage` with
`inputTokens: number | undefined` and `outputTokens: number | undefined` — the
v4 `promptTokens`/`completionTokens` names are gone. The fields are typed
optional per provider, so the read is `usage?.inputTokens ?? null`: an absent
object or absent field produces a row with null tokens and null cost, never a
throw and never a skipped row.

`generateAnalysis` returns `{ text, usage, model }` — `model` from
`townhallModel.modelId`, so the recorded name is what was actually called
rather than a second copy of the string.

**One known gap, stated:** `generateText` retries twice by default. `usage`
describes the attempt that succeeded; a failed attempt that was retried leaves
no trace. Failed attempts are generally not billed, so cost is unaffected, but
the failure rate in §6 counts *analyses* that failed after retries, not API
errors.

## §4 — The insert

`recordAiUsage(event)` in `lib/aiUsage.ts`: one service-role insert with an
explicit column list, and — the same contract as `sendWelcomeEmail` — **it
swallows every failure and returns `void`**, so no caller has to remember to
wrap it. Non-fatal by construction, not by care.

In the `after()` block:

```ts
after(async () => {
  try {
    const { text, usage, model } = await generateAnalysis(...)
    // ponytail: metering follows the Gemini call. When analysis moves from
    // automatic to builder-triggered, this moves with it.
    await recordAiUsage({ status: "succeeded", usage, model, ... })
    ... ai_summary update, unchanged ...
  } catch (err) {
    console.error(...)                                   // unchanged
    await recordAiUsage({ status: "failed", error: ..., ... })
  }
})
```

- **A failed metering insert** is caught and logged inside `recordAiUsage`; the
  submission already exists and the `ai_summary` update still runs.
- **A failed Gemini call** now leaves a row: `status = 'failed'`, null tokens,
  the error message (truncated to 1,000 chars). Today it leaves only a log line.
- **A failed `ai_summary` update** is still `succeeded` — `status` describes
  the Gemini call, which ran and was paid for.
- `profile_id` is `projectOwnerId` and `project_id` is `mission.project_id`,
  both already in scope; `image_count` is `images.length`.

The `failed` branch cannot double-record: `recordAiUsage` never throws, so the
catch is only reached by errors from `generateAnalysis` or `parseSentiment`,
which precede the success record.

## §5 — Somewhere to look

`app/(admin)/admin/ai-reports/page.tsx` gains one row of four KPI cards,
reusing the page's existing `KpiCard`, above the existing ones:

| Card | Source |
|---|---|
| Spend this month | sum of `estimated_cost_usd`, `created_at >= start of month (UTC)` |
| Median / p95 per analysis | nearest-rank over this month's succeeded rows with a cost |
| Analyses this month | row count |
| Failure rate this month | `failed / all`, as a percentage |

One extra select (`status, estimated_cost_usd` for this month) in the existing
`Promise.all`. Percentiles are computed in JS on the page — at this volume that
is simpler than an RPC. Theme tokens only; no new hex. A line under the row
says the data starts on the ship date, per §1.

## §6 — The queries this exists to answer

```sql
-- Cost distribution per analysis
select
  count(*)                                                as analyses,
  round(avg(estimated_cost_usd)::numeric, 6)              as mean,
  round((percentile_cont(0.5) within group (order by estimated_cost_usd))::numeric, 6) as median,
  round((percentile_cont(0.95) within group (order by estimated_cost_usd))::numeric, 6) as p95,
  round(max(estimated_cost_usd)::numeric, 6)              as worst
from ai_usage_events
where status = 'succeeded';

-- Monthly cost per builder
select profile_id,
       count(*)                       as analyses,
       round(sum(estimated_cost_usd)::numeric, 4) as spend
from ai_usage_events
where status = 'succeeded'
  and created_at >= date_trunc('month', now())
group by profile_id
order by spend desc;

-- Does cost scale with screenshots?
select image_count,
       count(*) as analyses,
       round(avg(estimated_cost_usd)::numeric, 6) as mean_cost
from ai_usage_events
where status = 'succeeded'
group by image_count
order by image_count;

-- Failure rate
select status, count(*) from ai_usage_events group by status;
```

Together they answer the only question the table exists for: **is the AI
allowance worth enforcing at all, and if so at what number.**

## §7 — Tests

**`lib/__tests__/aiUsage.test.ts`** (new)

| Assertion | Why |
|---|---|
| 1M in / 1M out on the flash model → exactly 3.5 | the rate map, directly |
| a realistic call (e.g. 2,400 in / 350 out) → 0.00225 | the arithmetic at the scale it runs |
| missing input or output count → `null` | absent usage is unknown, not free |
| unknown model → `null` | same |
| `recordAiUsage` resolves when the insert returns an error, and when it throws | non-fatal by construction |

**`actions/__tests__/submissions.test.ts`** (extended; `@/lib/aiUsage` mocked for `recordAiUsage` only)

| Assertion | Why |
|---|---|
| a successful analysis records exactly one `succeeded` event with tokens, model, owner, project, image count | the base case |
| a failed analysis records exactly one `failed` event with the error | failures become visible |
| **a failing metering insert leaves the submission successful and the `ai_summary` update made** | the important one |
| absent `usage` records null tokens rather than throwing | §3 |
| SUB-04 still passes unchanged | AI failure stays non-fatal |

## §8 — Files

**New**
```
supabase/migrations/20260929_01_ai_usage_events.sql
lib/aiUsage.ts
lib/__tests__/aiUsage.test.ts
docs/specs/SPEC-ai-shadow-metering.md
```

**Edited**
```
lib/ai.ts                               return usage + model alongside text
lib/types/db.ts                         AiUsageEventRow
actions/submissions.ts                  the two recordAiUsage calls
actions/__tests__/submissions.test.ts
app/(admin)/admin/ai-reports/page.tsx   the cost row
CLAUDE.md                               ai_usage_events in the data model
TownHall_Checklist (1).xlsx             QA row: submission succeeds when metering fails
```

## Acceptance criteria

1. Every analysis — succeeded or failed — writes exactly one `ai_usage_events` row.
2. A failing metering insert never affects the submission or the `ai_summary` update.
3. Cost is computed at write time from a dated rate map and stored as `numeric`.
4. Absent usage writes null tokens and null cost.
5. The table has RLS on, no policies, and a not-a-quota-ledger warning on both
   the migration and the table.
6. No user-facing change; `/admin/ai-reports` shows spend, median/p95,
   analyses and failure rate for the month.
7. `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test`.

## Manual test plan

- Apply the migration in the Supabase SQL editor; confirm the table, RLS on, no policies.
- Submit a test as a tester → one `succeeded` row with tokens and a cost of
  roughly $0.002–$0.01.
- Unset `GEMINI_API_KEY` locally and submit → submission saves, one `failed` row
  with the error.
- Revoke the table temporarily (or point at a missing table) and submit →
  submission saves and `ai_summary` still populates; one log line.
- Open `/admin/ai-reports` in both themes.

## Commit sequence

1. `feat(db): add ai_usage_events, a cost record`
2. `feat(ai): record token usage and cost for every analysis`
3. `feat(admin): show this month's AI cost on ai-reports`
4. `test(ai): cover cost calculation and non-fatal metering`
5. `docs: record ai_usage_events and the metering QA row`

## Open questions

None blocking. The rates ($0.50 / $3.00 per 1M) come from the brief; confirm
against Google's pricing page on the day this merges and update the checked-on
date if they have moved.
