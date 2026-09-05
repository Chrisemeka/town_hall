# SPEC: Project Category and Two-Sentence Summary

**Status:** Awaiting approval
**Branch:** `feat/project-category`
**Base branch:** `main` (with `feat/onboarding-polish` and `chore/fix-lint` merged)
**Depends on:** PR 1 (`feat/onboarding-polish`) — merged
**Blocks:** PR 3 (`feat/mission-test-cases`), which branches off `main` with this merged

## Summary

Projects gain a **category** from a fixed vocabulary, and the free "Brief Summary" is reframed as a
constrained **two-sentence** answer to "what is it, and who is it for".

One migration, adding one nullable column. `description` keeps its name.

## Why

The Explore feed is a flat list of projects with a paragraph each. A tester scanning it cannot filter
to the kind of product they are equipped to test, and the summaries vary from six characters to a
three-sentence pitch. Category makes the feed filterable; the sentence constraint makes the summaries
comparable to each other.

## Non-goals

- **No rename of `description` to `summary`.** It is read by `ExploreGrid`, both project detail
  pages, all three admin surfaces and the global search. Renaming buys nothing and breaks all of
  them. The form's *label* changes; the column does not.
- **No `NOT NULL` or `CHECK` on `category`.** Every existing row is null and must keep rendering.
- **No re-validation of existing rows.** The new rules apply at write time only.
- **No category on missions.** `missions.category` is repurposed in PR 3 and is untouched here.
- **No taxonomy management UI.** The list is code, like `SKILLS` and `COUNTRIES`.
- **No multi-category projects.** One category, one column.
- **No search over category text.** Category is a filter, not a search term.

## Data model changes

One migration, `supabase/migrations/<date>_01_project_category.sql`:

```sql
alter table public.projects
  add column if not exists category text;
```

Nullable, no default, no constraint. Existing rows stay null and render an "Uncategorised" chip.

The vocabulary is enforced in Zod at the write boundary, matching how `COUNTRIES` and `SKILLS` are
handled — see CLAUDE.md, "Validation". A `CHECK` here would also make every future vocabulary edit a
migration.

`lib/types/db.ts` — add `category: string | null` to `ProjectRow`. It stays `string`, not a union,
for the reason that file already documents: the database does not back the vocabulary, so a union
would claim a guarantee nothing upholds.

---

## Findings from the live database — read this before approving the validation rules

I ran a read-only query against the 10 live projects. Two of the proposed rules need amending.

### Length: the 300 → 200 cap

| | value |
|---|---|
| Projects | 10 |
| Description length — min / median / max | 6 / 107 / 239 |
| Over 300 chars | **0** |
| Over 200 chars | **3** |

Nothing is near the old 300 cap, so lowering it to 200 costs nothing at write time. **Three existing
projects sit between 200 and 239 characters** and will be forced to trim on their next edit. That is
the consequence to accept, and it is small.

### Sentences: the rule as written rejects half the live data

Running the proposed heuristic — strip abbreviations and decimals, count `/[.!?](\s|$)/`, allow 1–2,
reject 0 and 3+ — against the live descriptions:

| Terminators found | Projects |
|---|---|
| 0 | **4** |
| 1 | 3 |
| 2 | 2 |
| 3 | 1 |

**5 of 10 would be rejected, and 4 of those fail only because they have no full stop at all.** They
are not fragments:

- `"End-to-end whatsapp automation platform for businesses + an ecommerce store that lives entirely on whatsapp"` — 107 chars
- `"Siwes placement platform"`
- `"HR ERP"`
- `"ssssssssssssssssssssssssssssssss"` — junk, and rightly rejected, but by the length/quality bar, not by punctuation

Only **one** project is a genuine 3-sentence rambler, which is the case the rule is actually for.

**Recommendation: treat a non-empty description with no terminator as one sentence.** Count
terminators, then `sentences = max(1, count)`, and reject only 3 or more. Rejecting 0 punishes the
terse summary the feature is trying to encourage — "say what it does and who it's for" does not
require a full stop, and a builder who writes four good words should not be told to add punctuation
to proceed.

With that amendment, 1 of 10 live projects fails instead of 5, and the one that fails is the one the
rule exists to catch.

**This needs your decision.** The rest of the spec assumes the amendment; say so and I will implement
the reject-0 version instead.

---

## Vocabulary

Add to `lib/vocabulary.ts`, in the shape of `SKILLS` and `COUNTRIES` — a `const` array plus a derived
type. **Proposed list, amend freely before implementation:**

```ts
export const PROJECT_CATEGORIES = [
  "Fintech", "HealthTech", "EdTech", "E-commerce", "SaaS / B2B Tools",
  "Developer Tools", "AI / ML", "Social & Community", "Marketplace",
  "Productivity", "Media & Entertainment", "Logistics & Mobility",
  "Gaming", "Other",
] as const

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number]
```

`"Other"` is last and must exist. A builder whose category is missing will otherwise pick a wrong
one, which is worse for the filter than an honest catch-all.

Sanity-checked against the 10 live projects: tribute/celebration sites, WhatsApp commerce automation,
an industrial-placement platform, and an HR ERP. Those land on Social & Community, E-commerce, EdTech
(or Other) and SaaS / B2B Tools respectively — the list covers them without stretching.

`scripts/vocabulary.test.mts` gains coverage: non-empty, no duplicates, no blank entries, `"Other"`
present and last.

## Validation — `lib/validation/schemas.ts`

```ts
export const PROJECT_SUMMARY_MAX = 200   // was 300
export const PROJECT_SUMMARY_MAX_SENTENCES = 2

export const projectCategorySchema = z.enum(PROJECT_CATEGORIES, {
  message: "Choose a category.",
})
```

`projectSchema.description` gains a `.refine()` calling `countSentences()`. `category` is added as a
**required** field on the schema — new and edited projects must carry one, while existing rows stay
null in the database because they are never re-validated.

Error copy, per the brief: `"Keep it to two sentences — say what it does and who it's for."`

### `lib/sentences.ts` — new, exported, unit-tested

The counting function does not get inlined into the schema.

```ts
/** Sentence-ish count. A nudge, not a parser — see the note in the file. */
export function countSentences(text: string): number
```

Behaviour:

1. Strip abbreviations (`e.g.`, `i.e.`, `etc.`, `vs.`, `Inc.`, `Ltd.`, `Corp.`, `Dr.`, `St.`, `U.S.`,
   `Jr.`, …), decimal numbers (`v2.0`, `3.5`), and URLs.
2. Count matches of `/[.!?](\s|$)/`.
3. Return `Math.max(1, count)` for non-empty input, `0` for empty.

**Be honest about what this is.** It is a heuristic and it will be wrong sometimes — an abbreviation
not in the list inflates the count, and a semicolon-joined run-on sails through. The real constraint
is the 200-character cap, which is exact and cheap; the sentence check is a nudge on top of it. If it
proves annoying in practice the fallback is to drop the `.refine()` and keep the cap, which is a
one-line change. That fallback belongs in the file's own comment, not just here.

## Server actions — `actions/project.ts`

- `createProject`: add `category` to the explicit `.insert()` column list.
- `updateProject`: add `category` to the explicit `.update()` column list.

Both already parse `FormData` through `projectSchema` before touching the database, so the vocabulary
and sentence rules are enforced by the same parse. No new auth work — both already reject
unauthenticated callers.

## UI

### `components/CreateProjectForm.tsx`

- **Category** `<select>` above the summary field. Options from `PROJECT_CATEGORIES`, placeholder
  `"Select a category"`. Same `<select>` treatment as the verification country field (DESIGN.md
  §5.2) — 40px, `#1A1A1F` on `#2C2C35`, voltage focus border.
- Relabel "Brief Summary" → **"What is it? (2 sentences)"**.
- Placeholder becomes a genuine two-sentence example, e.g.
  `"A budgeting app for freelancers with irregular income. It forecasts lean months so you can set aside for them."`
- Helper text and the character counter move to the 200 cap.

### `components/EditProjectForm.tsx`

Same field, same schema, pre-populated. A project with `category = null` shows the placeholder
option selected, so the builder is asked once, on their next edit, rather than being blocked.

### `components/InlineEditProject.tsx` — recommend deleting

The brief lists this as a third form that must not drift. **It has no importers anywhere in the
repo** — the same situation as `InlineEditMission` and `test-card`, both deleted earlier in this
work. There are two live project forms, not three.

Recommend deleting it in this PR rather than adding a category field to a form nobody renders.
Flagging rather than doing it silently, as with the other two.

### `components/ExploreGrid.tsx`

- Render the category as a chip on each project card. Null renders **"Uncategorised"** in `ash` on
  the neutral badge treatment. Per DESIGN.md §5.4, the chip carries a text label, never colour alone.
- Add category to the client-side filter. The existing `FILTERS` row is `all | recent`, which is a
  *sort*, not a filter — the category control is a separate `<select>` beside the search input rather
  than more pills, because fourteen pills would wrap to three rows on desktop and swamp the row.
- The select lists only categories **present in the loaded projects**, plus "All categories". Listing
  all fourteen when eleven match nothing produces dead options.
- Empty state on a filter miss reuses the existing "Nothing matches." copy and Clear-filters button
  (DESIGN.md §8); the Clear button resets category as well as search and sort.

**One voltage CTA per viewport** is unaffected — every control here is secondary or ghost.

## Tests

**`actions/__tests__/project.test.ts`** (new; follows the `fakeAdmin` harness shape in
`verification.test.ts`, per TEST.md §1)

| ID | Case | Expected |
|---|---|---|
| PROJ-C1 | `createProject` unauthenticated | throws `Unauthorized`, no write |
| PROJ-C2 | `createProject` happy path | `category` present in the insert's explicit column list |
| PROJ-C3 | `createProject` with a category outside the vocabulary | field error, no write |
| PROJ-C4 | `createProject` with a 3-sentence description | field error on `description`, no write |
| PROJ-C5 | `createProject` with a 201-char description | field error, no write |
| PROJ-C6 | `updateProject` writes only `name`, `app_url`, `description`, `category` | no other column touched |
| PROJ-C7 | `updateProject` unauthenticated | throws, no write |

**`lib/__tests__/sentences.test.ts`** (new)

| ID | Case | Expected |
|---|---|---|
| SEN-01 | `"HR ERP"` — no terminator | 1 |
| SEN-02 | `"Does one thing. Does it well."` | 2 |
| SEN-03 | `"One. Two. Three."` | 3 → rejected by the schema |
| SEN-04 | `"Built for teams, e.g. agencies and studios."` | 1 — abbreviation not counted |
| SEN-05 | `"Ships v2.0 next week."` | 1 — decimal not counted |
| SEN-06 | `"See https://a.co/b for details."` | 1 — URL not counted |
| SEN-07 | `""` | 0 |
| SEN-08 | The four live descriptions that currently have no terminator | all 1, all accepted |

**`scripts/vocabulary.test.mts`** — `PROJECT_CATEGORIES` non-empty, no duplicates, no blanks,
`"Other"` present and last.

**Gates:** `npx tsc --noEmit`, `npm run lint` (now clean at zero — this PR must keep it there),
`npm run build`, `npm test`.

## Rollout

**Migration first, then code.** The column is nullable with no default, so it is additive and safe to
apply ahead of the deploy; code that does not know about it is unaffected.

**Existing rows are never re-validated.** All 10 live projects keep rendering with `category = null`
and whatever description they have, including the three over 200 characters and the one with three
sentences.

**Editing an old project applies the new rules to it.** A builder opening the edit form on one of the
three long descriptions cannot save until they trim it to 200, and must pick a category. This is the
consequence of enforcing at the boundary rather than backfilling, and it needs your explicit
acceptance. The alternative — grandfathering old rows through a laxer schema — means two validation
rules live in the codebase forever, and the second one silently rots.

**No backfill of `category`.** Guessing categories for 10 projects on the builders' behalf puts wrong
data in a filter people will trust. They get asked on next edit; until then the chip reads
"Uncategorised", which is true.

**Rollback:** revert the branch, then `alter table public.projects drop column if exists category;`.
Ship the code revert first. Dropping the column destroys categories builders have set.

## Acceptance criteria

1. Migration adds `projects.category` as nullable text, no constraint, and is safe to re-run.
2. `PROJECT_CATEGORIES` exists in `lib/vocabulary.ts` with `"Other"` last, plus a derived type.
3. `scripts/vocabulary.test.mts` covers it.
4. `PROJECT_SUMMARY_MAX` is 200.
5. `countSentences` lives in `lib/sentences.ts`, is exported and unit-tested, and is not inlined in
   the schema.
6. A description with no terminator counts as one sentence and is accepted.
7. A description with three or more sentences is rejected with the specified copy.
8. `category` is required by `projectSchema` and validated against the vocabulary.
9. `createProject` and `updateProject` list `category` explicitly; no spread.
10. Create and Edit forms both render the select, the new label, the two-sentence placeholder and a
    200 counter.
11. A project with `category = null` opens the edit form on the placeholder option, not a wrong one.
12. `ExploreGrid` renders a category chip, "Uncategorised" for null, with a text label.
13. The category filter lists only categories present in the loaded set, plus "All categories".
14. Clear-filters resets category, search and sort together.
15. `ProjectRow` in `lib/types/db.ts` carries `category: string | null`.
16. All four gates pass, with lint still at zero problems.

## Manual test plan

**New project:** create one with each of the first three categories. Confirm the chip on Explore and
the value in the database.

**Sentence rule:** try a four-word summary with no full stop (accepted), a two-sentence summary
(accepted), a three-sentence summary (rejected with the specified copy), 201 characters (rejected).

**Existing project:** open `/dashboard/<id>/edit` on one of the three projects over 200 characters.
Confirm it renders, that the counter shows it over the limit, and that saving is blocked until
trimmed. Confirm the category select starts on the placeholder.

**Explore:** confirm uncategorised projects show "Uncategorised", that the filter lists only present
categories, and that Clear filters resets everything.

**Regression:** admin project list, project detail and global search all still render `description`.

## Reference

- Codebase patterns: `CLAUDE.md`
- Inputs, cards, badges, empty states: `DESIGN.md` §5.2, §5.3, §5.4, §8
- Test pattern and gates: `TEST.md` §1
- Prior specs for format: `docs/specs/SPEC-verification-gate.md`,
  `docs/specs/SPEC-profile-editor.md`, `docs/specs/SPEC-onboarding-polish.md`
