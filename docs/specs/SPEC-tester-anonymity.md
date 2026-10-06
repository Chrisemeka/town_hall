# SPEC: Tester Anonymity

**Status:** Implemented on `feat/tester-anonymity` — migration not yet applied
**Branch:** `feat/tester-anonymity`
**Base:** `main` (at `e7adee6`)
**Depends on:** Nothing.
**Blocks:** Nothing. `docs/TWNHALL_SHAREABLE_REPORT_PROMPT.md` §6 picks up the numbering helper from §1 here.
**Source:** `docs/TWNHALL_TESTER_ANONYMITY_PROMPT.md`
**Migration:** `20261006_01_private_identity_columns.sql` — apply **after** the code deploys
**Risk:** low to build, high to get subtly wrong — §5

## Summary

A builder must not be able to identify the tester who filed a report, by name or
by any stable identifier. Most builder surfaces already show no identity. Three
places leak it: the CSV export, the notification email, and the raw `tester_id`
the mission page sends to the browser. This spec closes those three and reports
a fourth, which the prompt did not list (§0).

**Admin is exempt, deliberately.** Admins pay the cohort and handle support, so
every `app/(admin)/` surface keeps real names and emails. Do not "finish the job"
by stripping it there.

## §0 — The audit, and where it disagrees with the prompt

| Surface | Prompt says | Found |
|---|---|---|
| `/dashboard/feedback` | No identity | **Agrees.** Explicit column list, no `tester_id`. |
| `/dashboard/[projectId]` | No identity | **Agrees.** Explicit column list on `test_results`. |
| Mission detail page | `tester_id` in the RSC payload | **Agrees, and confirmed:** `MissionResultRow` is `"use client"` and gets the whole `TestResultRow`, so `tester_id` is serialised into the page. |
| CSV export | Name column | **Agrees.** |
| Notification email | `testerName` | **Agrees.** Preview, body, and a `profiles` query in the webhook. |
| Admin | Real names | **Agrees.** Unchanged. |
| **PostgREST, directly** | — | **Not in the prompt. See below.** |

**The leak the prompt misses: the database answers the builder directly.**
CLAUDE.md records that `test_results` has a *project-ownership read policy* that
the builder pages use through the anon client. RLS limits rows, not columns. So
a builder can take their own session JWT and the public anon key (both already in
their browser) and run

```
GET /rest/v1/test_results?select=id,tester_id&mission_id=eq.<theirs>
```

and get every tester's UUID on every mission they own. That is the same
identifier §2 removes from the page, from a source no page change touches. Fixing
§2 without this removes the leak someone would find by opening devtools and keeps
the one someone would find by reading the Supabase docs.

**Decided: fix it in the database (`20261006_01`).** A probe with the anon key
found it worse than stated: **logged out**, anyone could read every column of
`projects`: `owner_id`, `flag_reason`, `flagged_by`. `test_results`, `profiles`
and `accounts` returned nothing to anon. So:

- **`test_results`**: no read grant for `anon` or `authenticated` at all, rather
  than a column grant. The project-ownership policy almost certainly looks up
  `projects.owner_id` in a subquery, which runs with the caller's privileges and
  would start failing once that column is private. With no grant, no policy is
  ever evaluated. Every app read goes through service role, scoped in code, the
  same shape as `test_result_entries`. The policies are left in place, inert.
- **`projects`**: column grant `id, name, description, app_url, category,
  created_at, flagged_at`. The public feed filters on `flagged_at`, so it stays.
  `owner_id`, `flag_reason` and `flagged_by` become service role only.
- `mission_feedback_counts` (a view not in this repo) returns counts to anon,
  who can read no `test_results` rows, so it runs with its owner's rights and is
  unaffected.
- The migration checks itself as `anon` and as `authenticated`. The feed, missions
  and the counts view must still read, and `owner_id`, `flagged_by` and
  `tester_id` must be refused. Anything else rolls it back.

**Code moved first, so the migration can follow it.** Every read of
`test_results` or `projects.owner_id` now uses `createAdminClient()` after the
page's own ownership check: the four `/dashboard` pages, both mission edit pages,
`/dashboard/feedback`, `/dashboard/missions`, the tester home, the tester mission
page and `submitTestResult`'s own-project check. Each selects named columns.
`GlobalSearch` ran in the browser and filtered a builder's results on `owner_id`,
so it moves to a server action, `actions/search.ts`, which takes the role from the
session. Explore and its project page read only granted columns and are unchanged.

**Other wildcard selects in the builder tree.** The grep for `select("*")` and
`(*)` outside admin turned up:

- `dashboard/[projectId]/page.tsx`, `…/edit/page.tsx`, `…/mission/[missionId]/page.tsx`
  (`projects(*)`) read `flagged_by`, the admin who flagged it. **Fixed on request:**
  named columns, and the owner's project page keeps `flag_reason` (it is their
  project) but never `flagged_by`.
- `app/(tester)/mission/[id]/page.tsx` (`projects(*)`) read the builder's
  `owner_id` on the tester's page. **Fixed on request:** the page never reads it.
  "Is this your project?" is answered server-side as a boolean.
- `test_results` read with `*` appears only on the mission page. §2 fixes it.

## §1 — The export

**Revised after QA-2.17-2.** The export took every project, or one, as a single
CSV, so a builder could not pull one mission. It is now always one project, two
ways. The settings panel offers a Project select and a Mission select, listing
only missions with reports:

- **One mission** → `?project=P&mission=M` → CSV, `recipe-book-auth-check-<date>.csv`.
- **All missions** → `?project=P` → `.xlsx`, `recipe-book-feedback-<date>.xlsx`,
  one sheet per mission (oldest first, named for it). A CSV cannot hold sheets.

The cross-project "All projects" export is gone; one workbook per project
replaces it. No project → 400. No reports, or not your project → the same 404,
so a refusal does not confirm a project exists. The workbook comes from
`lib/xlsx.ts`, a dependency-free writer. Its zip is uncompressed, and Excel's
sheet-name rules are enforced in `sheetNames()`. Strings are inline-string cells,
which Excel never evaluates, so the CSV's `neutralise()` prefix is not applied
there; it would show as a literal apostrophe.

`app/api/export/feedback/route.ts`:

- `"Tester"` becomes **`"Tester # (per mission)"`**, so the header itself says the
  number does not carry across missions.
- The value is the tester's number within that mission, from the helper below.
- The `profiles` lookup and `tester_id` in the select are deleted. `id` and
  `mission_id` are selected instead, which the numbering needs. One query fewer
  on a rate-limited path.

**Numbering: `lib/testerNumbers.ts`**, pure and import-free in the shape of
`lib/reciprocity.ts`:

```ts
testerNumbers(rows: { id: string; mission_id: string; created_at: string }[]): Map<string, number>
```

Group by `mission_id`, order by `created_at` ascending, number from 1.
**Ties on `created_at` break on `id` ascending** (plain string compare of the
UUID). That order is arbitrary but fixed, so two exports of the same data give
the same numbers. One report per tester per mission is enforced by
`submit_audit_log` (`20260930_02`), so within a mission a number is a person. The
known ceiling is that deleting a submission renumbers the later ones on that
mission. Nothing deletes submissions today except mission deletion.

The CSV's `project` scope does not affect the numbers. It narrows which missions
are exported, and every mission's reports are always exported whole.

## §2 — The mission page

`dashboard/[projectId]/mission/[missionId]/page.tsx` replaces
`select("*, missions!inner(title, project_id)")` with exactly what
`MissionResultRow` and `SubmissionReview` render:

```
id, mission_id, created_at, screenshot_url, screenshot_urls, tester_comment,
ai_summary, ai_sentiment, status, rating, review_note
```

The `missions!inner(...)` embed is dropped. Nothing reads it, and `mission_id`
is already filtered. **Nothing on the page needs `tester_id`.** The review flow
keys on `resultId`, as the prompt expected.

`MissionResultRow`'s `result` prop narrows from `TestResultRow` to a `Pick<>` of
those columns. A later `select("*")` then still type-checks, so the type does not
stop the regression on its own. The test in §6 does.

**The on-page label (decided: unify).** The mission page shows "Developer #01" from the array
index of a *newest-first* list, so #01 is whoever submitted last, and every new
report renumbers the others. `/dashboard/feedback` does the same across all
missions. Neither is identifying, but neither matches the CSV. **Proposed:** both
use `testerNumbers()` and render "Tester 1", so the number on screen is the
number in the file.

## §3 — The notification email

- `testerName` removed from `FeedbackNotificationProps`.
- Preview: `New feedback on ${projectName}`.
- Body: the existing fallback sentence, with no name: **"A tester just submitted
  feedback on your project X."**
- `app/api/webhooks/submission/route.ts` drops the tester `profiles` query and
  `tester_id` from its required-field check and payload type. Nothing reads it now.
- `submissionSummary` is untouched. The tester's words are the product; the
  attribution is what's removed.

## §4 — Admin

Unchanged. One line in CLAUDE.md says the exemption is deliberate.

## §5 — What this cannot deliver

The product can stop telling the builder who the tester was. It cannot stop the
builder finding out:

- **Screenshots** carry profile photos, logged-in headers, emails in form fields
  and desktops, unfiltered.
- **The tester's own words** ("I signed up with amos@…").
- **A small pool.** About twenty testers and five per mission: style and timing
  correlate.

So:

- **CLAUDE.md** states the limit plainly.
- **`AuditLogForm`** gets one sentence under the screenshot instructions:
  *"Screenshots go to the builder as they are. Crop out anything that shows your
  name, email or photo."*
- **Copy promises "we don't share your name with builders", never "anonymous".**
  The grep found no existing "anonymous" claim in product copy, so nothing needs
  rewording. Without §0's migration, even "we don't share" is only true of what
  the app *renders*, which is another reason to take it.

## §6 — Tests

- `lib/__tests__/testerNumbers.test.ts`: numbering restarts per mission; it is
  ascending by `created_at`; ties break on `id`; input order does not change the
  output.
- `app/api/export/feedback/__tests__/route.test.ts` (extended): the header is the
  new one; no `full_name` appears; `profiles` is never queried; numbers restart
  per mission.
- `scripts/anonymity.test.mts`, a source scan in the shape of `tokens.test.mts`.
  It fails if any file under `app/(developer)/` or `components/` (excluding
  `admin`) contains `tester_id`, or selects `*` from `test_results`. That is
  the assertion that the payload carries no `tester_id`: the value cannot reach
  the payload if no builder file names or wildcards it. The settings page's
  `.eq("tester_id", user.id)`, the caller's own rows, is the one allowlisted line.
- `emails/__tests__/feedback-notification.test.ts`: the rendered HTML and plain
  text contain "A tester" and the project name. A name passed by mistake would
  have to get past a type error first.
- `scripts/access.test.mts` passes unchanged.
- **Admin still shows names:** manual (checklist row). No admin code changes.

## Commits

1. `Number testers per mission in the feedback CSV`: helper, its test, route, route test.
2. `Stop sending tester_id to the mission page`: mission page, `MissionResultRow`, feedback list, source scan.
3. `Read owners and reports server-side only`: every user-session read of `test_results` / `owner_id`, `actions/search.ts`.
4. `Take identity columns off the public API`: the migration.
5. `Drop the tester's name from the feedback email`: template, webhook, email test, README.
6. `Document tester anonymity and warn about screenshots`: CLAUDE.md, `AuditLogForm`, `npm test`, checklist, this spec.

## Files

```
lib/testerNumbers.ts                                          new
lib/__tests__/testerNumbers.test.ts                           new
app/api/export/feedback/route.ts
app/api/export/feedback/__tests__/route.test.ts
app/(developer)/dashboard/page.tsx
app/(developer)/dashboard/missions/page.tsx
app/(developer)/dashboard/feedback/page.tsx
app/(developer)/dashboard/[projectId]/page.tsx
app/(developer)/dashboard/[projectId]/edit/page.tsx
app/(developer)/dashboard/[projectId]/mission/new/page.tsx
app/(developer)/dashboard/[projectId]/mission/[missionId]/page.tsx
app/(developer)/dashboard/[projectId]/mission/[missionId]/edit/page.tsx
app/(tester)/tester/page.tsx
app/(tester)/mission/[id]/page.tsx
components/MissionResultRow.tsx
components/FeedbackListPaged.tsx
components/GlobalSearch.tsx
components/layout/{TopNav,AppShell,DashboardLayout}.tsx      dead userId prop removed
components/tester/AuditLogForm.tsx
actions/search.ts                                             new
actions/submissions.ts
actions/__tests__/submissions.test.ts
supabase/migrations/20261006_01_private_identity_columns.sql  new
emails/feedback-notification.tsx
emails/__tests__/feedback-notification.test.ts                new
emails/README.md
app/api/webhooks/submission/route.ts
scripts/anonymity.test.mts                                    new
package.json                                                  test script
CLAUDE.md
TownHall_Checklist (1).xlsx
docs/specs/SPEC-tester-anonymity.md                           new
```

## Manual test plan

1. As a builder, open a mission with reports, view source / the RSC payload, and
   search it for any UUID other than the mission, project and result ids.
2. Export a CSV spanning two missions. Numbering restarts at 1 on each. Export
   again, and the numbers are the same.
3. Submit a report and read the notification's **preview line in the inbox list**,
   then the opened body. Neither carries a name.
4. Open `/admin/users` and `/admin/payouts`. Real names and emails are still there.
5. After the migration: the PostgREST request in §0, with a builder's JWT, is refused
   for `tester_id`. A tester's home and mission page still show their own reports.

## Decisions

1. **Column grants: taken**, widened to `projects` on request (§0).
2. **One number everywhere: taken** (§2).
3. **Credibility badge: not built.** Not every tester is in the cohort; builders
   also test to earn report credits, so a "verified tester" badge would not mean
   one thing. Revisit as separate work.

## Not done, worth knowing

- `actions/search.ts` has no rate limit, like the PostgREST access it replaces.
  It is a read, not one of CLAUDE.md's Tier 1/2 paths.
- The `profiles` read policies for `authenticated` are still unprobed. Once
  `tester_id` and `owner_id` are unreadable they have nothing to join to, but a
  policy that lets one user read another's profile would deserve its own look.
