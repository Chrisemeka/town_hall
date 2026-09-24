# SPEC: CSV Export

**Status:** Awaiting approval
**Branch:** `feat/feedback-export`
**Base:** `feat/settings-tabs` — nothing from Stage 3 is merged yet, so it keeps
stacking
**Source:** `docs/TWNHALL_BUILDER_DASHBOARD_PROMPT.md` — PR 3
**Migration:** none
**Risk:** medium — ownership and injection are both real

## Summary

A Route Handler that returns every piece of feedback on the caller's own
projects as CSV, one row per test-case step. It lands as the Export section of
Settings → Account, which PR 2 built expecting it.

## §1 — Two things that are actually dangerous

Stated first because the rest is mechanics.

### 1.1 — There is no middleware on this route

`middleware.ts`'s matcher is:

```
/((?!_next/static|_next/image|api|favicon.ico|…).*)
```

**`api` is in the negative lookahead, so `app/api/**` gets no gate at all.**
Verified, not assumed. `CLAUDE.md`'s two-layer rule — middleware *and* an
in-code check — has one of its layers structurally absent here, so the
in-code check is not a second opinion, it is the only opinion.

The handler calls **`requireAccount("builder")`** itself. That also carries the
email-confirmation and per-role verification gates with it, which a
hand-rolled `getUser()` would silently skip.

`requireAccount` redirects rather than returning a status. In a Route Handler
Next turns that into a 307, which is the right behaviour for a link a browser
follows — and it is what the two existing handlers' rejection paths amount to,
though `app/api/webhooks/submission` answers 401 because its caller is
Supabase rather than a person.

### 1.2 — Ownership is the whole file

The export must contain **only** feedback on missions belonging to projects
the caller owns. Getting this wrong hands one builder another's feedback.

Service-role client with an explicit `projects.owner_id = user.id` filter, per
`CLAUDE.md` — service role bypasses RLS, so that filter is the only thing
scoping the read. The same inner-join shape PR 2 used for the "reports
received" count:

```
test_results → missions!inner → projects!inner  where owner_id = <caller>
```

When the request names a single project, ownership of **that** project is
checked too — not just that the caller owns *some* project. A `?project=<id>`
the caller does not own returns an empty export, not someone else's.

## §2 — CSV injection

A field beginning `=`, `+`, `-` or `@` is a **formula** to Excel and Google
Sheets. A tester can put `=HYPERLINK("http://evil","click")` in an issue
summary, the builder opens the export, and it runs. Every field in this file is
attacker-supplied text.

**One function, `neutralise()`, in `lib/csv.ts`**, applied to every field
before quoting:

- A leading `=`, `+`, `-`, `@`, tab or carriage return gets a `'` prefix.
- Then normal RFC 4180 quoting: wrap in `"` if the value contains a quote,
  comma, newline or carriage return, and double any embedded `"`.

Order matters — neutralise first, then quote, or the prefix lands outside the
quotes and does nothing.

**The known cost, accepted:** a legitimate `-5` or `+234…` exports as `'-5`.
Prefixing is the standard mitigation and a visible apostrophe is a smaller
problem than a live formula. Written down so it is not "fixed" later by
someone who thinks it is a bug.

Tested directly, against all six leading characters, because this is the kind
of function that gets simplified away.

## §3 — One row per entry

A submission has N `test_result_entries`; CSV is flat. **One row per entry**,
repeating the submission columns — that is what filters and pivots in a
spreadsheet, and it avoids cramming a list into a cell.

| # | Column | Source |
|---|---|---|
| 1 | Project | `projects.name` |
| 2 | Mission | `missions.title` |
| 3 | Test category | `missions.category`, as its label |
| 4 | Device target | `missions.device_target`, as its label |
| 5 | Submitted at | `test_results.created_at`, ISO 8601 |
| 6 | Tester | `profiles.full_name` — §5 |
| 7 | Submission status | `test_results.status` |
| 8 | Rating | `test_results.rating` |
| 9 | **Tester comment** | `test_results.tester_comment` — **see below** |
| 10 | Step | `test_result_entries.step_index` |
| 11 | Action | `step_action` |
| 12 | Expected | `step_expected` |
| 13 | Step status | `entries.status` |
| 14 | Actual result | `actual_result` |
| 15 | Issue summary | `issue_summary` |
| 16 | Steps to reproduce | `steps_to_reproduce` |
| 17 | AI sentiment | `ai_sentiment` |
| 18 | Screenshots | `screenshot_urls` length |

### 3.1 — The brief's column list drops the legacy content

**Column 9 is not in the brief's suggested list, and without it the legacy
rows export as metadata and nothing else.**

The brief says legacy submissions "get one row with the comment populated and
the step columns empty" — but there is no comment column in the list to
populate. Twenty-four submissions predate the audit log and carry *only*
`tester_comment`; exporting them without it would produce twenty-four rows
whose entire content is missing.

It is not only a legacy column either: `tester_comment` is the "anything
else?" field on every modern submission too, so leaving it out drops content
from the current shape as well.

### 3.2 — Legacy submissions

`CLAUDE.md`: twenty-four submissions predate the audit log and carry only
`tester_comment` with no entries. **They must not be silently dropped.**

Each gets **one row**, submission columns populated including the comment, and
columns 10–16 empty. That is the same branch
`components/submissions/SubmissionBody.tsx` already makes — the existing
precedent for these two shapes — and this follows it rather than inventing a
second rule. A left join on entries produces exactly this if the code does not
filter the nulls away, which is the easy mistake.

## §4 — Mechanics

- **Route Handler**, `app/api/export/feedback/route.ts`, `GET`, returning
  `text/csv; charset=utf-8` with `Content-Disposition: attachment`. Not a
  client-side blob: the data needs a server-side ownership check before it is
  assembled, and a blob built in the browser would need the rows shipped to
  the browser first.
- **UTF-8 with a BOM** (`﻿`). Without it Excel mangles non-ASCII, which
  here means Nigerian names and the naira sign.
- **Scope:** `?project=all` (default) or `?project=<uuid>`. Per-mission is
  over-granular for a settings page.
- **Filename:** `twnhall-feedback-2026-09-24.csv` — dated so two downloads do
  not collide in a downloads folder.
- **Empty state:** nothing to export says so in the UI rather than downloading
  a file with only a header row. The section knows the count already.
- **`ponytail:`** — the whole result is assembled in memory. Fine at the
  current volume (tens of rows); it needs streaming when it is thousands, and
  the comment names that as the upgrade path.

### 4.1 — The UI

The Export section of Settings → Account, above Danger Zone. PR 2 put Delete
there and left the space: both are operations on your own data, which is the
familiar pairing.

A project `<select>` (All projects, then each by name) and a download link.
Control names match schema keys per `CLAUDE.md`, and the submit is never
disabled to mean "not finished".

## §5 — PII

**The tester's display name is included.** The builder already sees it on
every submission in the app; withholding it in the export would make the file
less useful without making anything more private.

**No email addresses. Ever.** A CSV leaves your control the moment it is
downloaded — it gets mailed, dropped in a shared drive, opened on a laptop in
a café. The app never shows a builder a tester's address and neither does
this.

No avatar URLs and no user ids either: neither is useful in a spreadsheet and
both are identifiers that outlive the file.

## §6 — Tests

**`lib/__tests__/csv.test.ts`** — the part that has to be right:

| Case | Expected |
|---|---|
| `=HYPERLINK(…)`, `+1`, `-5`, `@sum`, leading tab, leading CR | prefixed with `'` |
| `a=b`, `5-3` | untouched — only a *leading* character is a formula |
| value with a comma | quoted |
| value with a `"` | quoted, the quote doubled |
| value with a newline | quoted, newline preserved |
| `=a,b"c` | neutralised **and** quoted, in that order |
| null / undefined / number | an empty cell, not `"null"` |
| a full row round-trips through a parser | commas, quotes and newlines come back identical |

**`app/api/export/feedback/__tests__/route.test.ts`**:

| Case | Expected |
|---|---|
| unauthenticated | rejected, and **no query runs** |
| a builder's export | contains their rows |
| …and **none of another builder's** | the ownership assertion, and the one that matters |
| `?project=<not mine>` | empty, not someone else's |
| a legacy comment-only submission | one row, comment populated, step columns empty |
| no feedback at all | header only, still valid CSV |
| the BOM is present | Excel |
| no email address anywhere in the output | §5 |

## §7 — Files

**New**
```
lib/csv.ts                                    neutralise, quote, toCsv
lib/__tests__/csv.test.ts
app/api/export/feedback/route.ts
app/api/export/feedback/__tests__/route.test.ts
components/settings/ExportPanel.tsx
```

**Edited**
```
components/settings/AccountPanel.tsx    the Export section, above Danger Zone
app/(developer)/settings/page.tsx       the caller's projects, for the select
CLAUDE.md                               the route's self-auth requirement
```

## Acceptance criteria

1. A builder downloads a CSV containing feedback on their projects only.
2. **No row from any project the caller does not own**, whatever `?project=`
   says.
3. Unauthenticated requests are rejected without touching the database.
4. One row per entry; legacy comment-only submissions appear with the comment
   and empty step columns.
5. Every field passes through `neutralise()` before quoting.
6. Quotes, commas and newlines survive a round trip.
7. UTF-8 BOM; a dated `Content-Disposition` filename.
8. No email addresses in the output.
9. Nothing to export says so rather than downloading a header-only file.
10. Four gates.

## Manual test plan

- **Open the export in a real spreadsheet**, not a text editor. Excel *and*
  Google Sheets — the BOM and the formula behaviour differ between them.
- File a submission whose issue summary is `=1+1`, export, open it: the cell
  shows the text, not `2`.
- A submission with a comma, a quote and a newline in one field.
- Export as a builder with two projects, then scoped to one.
- Export with no feedback at all.
- A legacy submission, if one is reachable on staging.

## Commit sequence

1. `feat(export): add the CSV writer and its injection guard`
2. `feat(export): add the feedback export route`
3. `feat(settings): add the export section`
4. `test(export): cover injection, ownership and the legacy shape`
5. `docs: record the export route's self-auth requirement`

## Open questions

None. §3.1 is a correction to the brief's column list rather than a question —
the column is added, because without it the legacy rows carry nothing.
