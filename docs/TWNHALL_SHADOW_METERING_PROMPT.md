# Twnhall — AI Shadow Metering: Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

One small PR. It records what every AI analysis costs, and changes nothing else.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions.
2. Read `TEST.md` §1.
3. Read `lib/ai.ts` and the `after()` block in `actions/submissions.ts` (~line 160).
4. Read `docs/specs/` and match that spec format.

Write the spec into `docs/specs/SPEC-ai-shadow-metering.md` first and **stop for approval before implementing**. All four gates before done: `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test`.

**Branch:** `feat/ai-shadow-metering`

## What this is, and what it is emphatically not

**Shadow metering records cost. It does not charge, limit, or display anything.**

Every tester submission already fires a Gemini call. That call returns `text` *and* `usage` — and `lib/ai.ts` destructures only `{ text }`, discarding the token counts on every single call. This PR stops discarding them.

**Explicitly out of scope, and none of it is a follow-on to sneak in:**

- No quota, no counter, no balance, no limit.
- No user-facing change of any kind. Nobody signs in and sees anything different.
- No change to when or whether analysis runs. It stays automatic, in the same `after()` block.
- No billing, no money, no plan interaction.

`lib/plans.ts` already carries a header warning against reading its numbers in order to block something. **Put the equivalent warning on this migration and on the table.** A cost table is exactly the thing a future session will mistake for a quota ledger.

## Why it is worth doing now rather than with enforcement

The cost-per-insight figure in `docs/Twnhall_Monetisation_Plan_v4.docx` §2 — roughly $0.0017 to $0.0103 — was **computed from Gemini's published rates against assumed screenshot and step counts.** It is a model, not a measurement. The plan's §10 says a real cost 100× higher would flip the "don't meter the AI" conclusion.

Data takes calendar time to accumulate; this code takes a day. Ship the meter now and by the time limits are being discussed there are months of real usage behind the decision. Ship it alongside enforcement and the first limit is set against an empty table.

---

## 1 — The table

One migration, `supabase/migrations/<YYYYMMDD>_01_ai_usage_events.sql`. Follow the house style: a comment block explaining *why*, `if exists` / `if not exists` guards, safe to run more than once.

```
ai_usage_events
  id                  uuid primary key default gen_random_uuid()
  test_result_id      uuid references test_results(id) on delete set null
  project_id          uuid
  profile_id          uuid           -- the project owner, i.e. who it was for
  model               text not null
  input_tokens        int
  output_tokens       int
  image_count         int not null default 0
  estimated_cost_usd  numeric(12,8)
  status              text not null  -- 'succeeded' | 'failed'
  error               text
  created_at          timestamptz not null default now()
```

Four decisions in that shape, each with a reason:

**`on delete set null`, not cascade.** This is a cost record. If a submission is later deleted, the money was still spent — the row must survive and lose only its link. A cascade would quietly erase your own spending history.

**`project_id` and `profile_id` are denormalised**, for the same reason: they must outlive the submission they came from, and they are how you aggregate cost per builder.

**`model` is stored on every row.** When the model changes, historical rows have to stay attributable to what actually ran.

**`estimated_cost_usd` is `numeric`, not a float.** Values are around 0.005 and get summed over thousands of rows; float accumulation error is real and `numeric` is exact in Postgres.

**RLS:** on, with **no policies**, per `CLAUDE.md`. Service role only. Nothing in the browser should ever read this table.

**No backfill.** Submissions analysed before this shipped have an unknowable cost. Do not invent rows for them. Note in the spec that the first weeks of data are partial by construction, so nobody later reads a low early total as a trend.

---

## 2 — Cost calculation

A rate map, keyed by model. Put it in `lib/ai.ts` or a small `lib/aiCost.ts` — your call, but say which and why.

Current rates for `gemini-3-flash-preview`: **$0.50 per 1M input tokens, $3.00 per 1M output.** Comment them with the date they were checked; published rates go stale and a silently wrong constant is worse than an obviously old one.

**Compute the cost at write time and store the result.** Do not compute it at read time from a live rate table — a price change would then retroactively rewrite what past analyses cost, which destroys the only thing this table is for.

**Do not try to decompose `input_tokens` into text versus image.** The `usage` object already includes image tokens in the input total. Store `image_count` alongside it and let the correlation between the two emerge from the data. Guessing at a split would be inventing precision you do not have.

---

## 3 — Capturing usage

`lib/ai.ts` currently ends `generateAnalysis` with:

```
const { text } = await generateText({ ... })
return { text }
```

Return the usage alongside the text.

**Check the actual field names against AI SDK 6 rather than assuming.** They were renamed across a major version — `promptTokens`/`completionTokens` became `inputTokens`/`outputTokens` — and the object can be absent entirely depending on provider and call shape. **Handle `usage` being undefined**: write the row with null token counts and null cost rather than throwing or skipping the row.

---

## 4 — The insert, and the one rule that matters

The write goes in the existing `after()` block in `actions/submissions.ts`, alongside the `ai_summary` update.

**Adding observability must not add a failure mode.** That block is already wrapped so a Gemini failure cannot lose a submission — `CLAUDE.md` and the QA checklist's `SUB-04` both depend on it. The metering insert must sit inside its **own** try/catch, nested within the existing one, so that:

- A failed metering insert never affects the submission.
- A failed metering insert never affects the `ai_summary` update.
- It logs and moves on, exactly as the surrounding code does.

The row is a side effect of a side effect. It must be the least important thing in that block.

**Record failures too.** Right now a Gemini error is swallowed by the catch and leaves no trace. Write a row with `status = 'failed'` and the error message, even when there are no token counts. The failure *rate* is worth as much as the cost — if five percent of analyses are failing, that is a product problem nobody can currently see.

Service-role client with an explicit column list, per `CLAUDE.md`.

---

## 5 — Somewhere to look

A table nobody reads is a table nobody maintains.

`app/(admin)/admin/ai-reports/page.tsx` already exists and already aggregates AI data by sentiment. Add a small cost summary to it: total spend this month, median and p95 cost per analysis, analyses run, and the failure rate.

Keep it modest — this is a second commit, not a second feature. The point is that the number is in front of you habitually rather than only when you remember to open the SQL editor.

Follow the theme tokens; the dashboard is themed now.

---

## 6 — The queries this exists to answer

Put these in the spec so the table is useful from day one rather than accumulating unread:

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

Those four answer the only question this table exists for: **is the AI allowance worth enforcing at all, and if so at what number.**

---

## 7 — Tests

- Cost calculation, tested directly against known token counts and the rate map.
- A successful analysis writes exactly one row with `status = 'succeeded'`.
- A failed analysis writes exactly one row with `status = 'failed'` and the error.
- **A failed metering insert leaves the submission and the `ai_summary` update intact** — this is the important one.
- Absent `usage` writes a row with null tokens and null cost rather than throwing.
- `SUB-04` from the QA checklist still passes: AI failure remains non-fatal.

---

## 8 — Documentation

- **`CLAUDE.md`** — `ai_usage_events` in the data model, marked service-role-only, with a line stating it is a cost record and not a quota ledger.
- **A `ponytail:` note in the code** — when AI generation eventually moves from automatic to builder-triggered, the metering hook moves with it. Without that note it gets orphaned in the refactor.
- **`TownHall_Checklist (1).xlsx`** — a QA row confirming a submission still succeeds when the metering insert fails.

## Out of scope

Tier enforcement of any kind. On-demand AI generation. Screenshot and text caps. Any user-facing surface. All of it is separate work with its own sequencing — see the monetisation plan §8 and §9.
