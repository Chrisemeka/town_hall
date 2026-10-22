# SPEC: Downloadable PDF Report

**Status:** Approved 2026-10-17 with all four recommendations — implemented
**Branch:** `feat/pdf-report`
**Source:** `docs/TWNHALL_PDF_REPORT_PROMPT.md` (supersedes
`docs/TWNHALL_SHAREABLE_REPORT_PROMPT.md`)
**Migration:** none
**New dependency:** `@react-pdf/renderer@4.9.0` (runtime). Possibly
`pdfjs-dist` (dev only, §8 — decision 2).
**Risk:** medium — anonymity in a file that cannot be unshared, and server-side
image fetching

## Summary

A builder picks a project and a mission (or all missions) in Settings →
Account → Export, and downloads a PDF report of the results: a summary page
that says what to fix first, then the detail organised by step. Free to every
builder for now. Uses the same selection as the CSV export, with a second
button beside the first.

## §0 — Compatibility, verified before writing this

The prompt makes this the one thing that could kill the choice, so it was
checked first:

- `@react-pdf/renderer@4.9.0` peer dependencies: `react ^16.8 || ^17 || ^18 || ^19`.
  React 19.2.4 is in range.
- Next 16.2.1 already lists `@react-pdf/renderer` in
  `server-external-packages.json`, so it is required from `node_modules` at
  runtime rather than bundled. No `next.config` change needed for that.
- End to end: a throwaway `app/api/pdf-smoke/route.tsx` calling
  `renderToBuffer(<Document><Page><Text/></Page></Document>)` passed
  `next build`. Under `next start` it returned `200` with a body that begins
  `%PDF-1.3`. The route has been deleted.

No fallback to a print route is needed.

## §1 — Free, with the gate point marked

There is no `plan_id` check. In the route, where the check would go:

```ts
// ponytail: free to every builder for now, by decision. A plan gate goes
// here: resolve the plan via planIdFor() (lib/vocabulary.ts), the same
// resolution the allowance in lib/allowance.ts runs at publish.
```

`lib/plans.ts` is **not touched**. "Shareable formatted report" does not go
back on Pro's `includes`. It returns to `/pricing` only when it is actually
gated.

## §2 — Selection: one panel, two buttons

`ExportPanel` keeps its project select, its mission select (`""` = every
mission) and its `ExportProject` prop. Both buttons use that one selection.
The data is the `exportable()` loader `/settings` already runs. No second
query, so the two exports cannot offer different lists.

Changes to `ExportPanel`:

- The mission select's `""` option drops its "— one sheet each" suffix and
  becomes **"All missions"**. That suffix only described the spreadsheet, and
  the PDF does not split. The CSV button keeps its own label ("Download
  Excel" / "Download CSV"), so the format is still stated.
- A **"Include screenshots"** checkbox under the selects, **checked by
  default**. The note beside it reads *"Makes the file larger."* It only
  affects the PDF, and its label says so ("Include screenshots in the PDF").
- A second button, **"Download PDF"**, beside the CSV button and with the same
  outline style. Neither button is Voltage: two equal exports with one filled
  would be the "second CTA" Design.md warns about, and this panel has never
  had one.
- `download()` already fetches the file, reads the filename from
  `Content-Disposition` and shows a refusal in the panel's alert. It is
  generalised to take the href and a fallback filename, so the cap message
  (§4) and the rate-limit 429 appear in the same `role="alert"` line.
- The intro paragraph and the empty-state line add one clause about the PDF.

## §3 — Generation

`@react-pdf/renderer`'s `renderToBuffer()` runs inside the Route Handler.

**The report has its own component tree, `components/report/`, and reuses
nothing from the web UI.** The earlier shareable-report spec required the
tester's own components because that document *mirrored the tester's view*.
This document is a report with its own layout, so the rule from the mission
preview ("the preview is the tester's page, never a copy") does not apply
here. The spec states this so the two rules do not get mixed up later.

It shares **logic**, not markup:

| Concern | Source |
|---|---|
| Tester labels | `testerNumbers()` + `testerLabel()`, `lib/testerNumbers.ts` |
| Status labels by category | `entryStatusCopy(status, category).label`, `lib/vocabulary.ts` |
| Category / device labels | `testCategoryLabel`, `deviceTargetLabel` |
| Submission status | `toStatus`, `STATUS_LABEL`, `lib/review.ts` |

Files:

- `lib/report.ts`: **pure and import-light**. It turns submission rows into
  a `ReportModel` (cover facts, per-step agreement, the detail grouped by
  step, the closing notes). Every number and grouping rule lives here, and it
  is where most of the tests go.
- `components/report/ReportDocument.tsx`: the react-pdf tree. It renders a
  `ReportModel` and does no arithmetic.
- `lib/exportDb.ts`: `loadFeedback(userId, projectId, missionId?)`, the
  owner-scoped service-role query, moved out of the CSV route. **Both routes
  call it.** The ownership filter is the dangerous part of either file, so it
  should exist once. The select is the union of what both need.
  (`step_id`, `tester_comment`, `ai_summary` and `screenshot_urls` are added.
  `tester_id` is **not**. Nothing in the report needs it, so it never
  reaches the process that renders the PDF.)

### Fonts — decision 1

Recommended: **bundle the brand fonts** as TTF files in
`components/report/fonts/` (all OFL from Google Fonts): Syne Bold for headings,
DM Sans Regular/Medium for prose (the DM Sans long-form exception applies; this
is a document that is read), and DM Mono Medium for labels and step numbers.
That is about 250 KB in the function. The files are registered with
`Font.register` from an absolute path, and the route gets an
`outputFileTracingIncludes` entry so Vercel ships them.
`Font.registerHyphenationCallback(w => [w])` stops react-pdf's default
hyphenation from splitting words in the middle.

Alternative: the built-in Helvetica. No files, no tracing config, and it looks
generic. Fine if you would rather not carry font files.

## §4 — The route: `GET /api/export/report`

`app/api/export/report/route.tsx`, beside `export/feedback`. It has the same
shape and the same comments about having no middleware.

```
?project=P&mission=M[&screenshots=0]   one mission
?project=P[&screenshots=0]             every mission, one document
```

In order:

1. `requireAccount("builder")`. This is the only gate, because `app/api` has no
   middleware.
2. `checkRateLimit(["export:pdf:account", userId])`, a **new rule**:
   `{ limit: 5, windowSeconds: HOUR, fallback: 0, mode: "closed" }`. That is
   half the CSV's 10. One render costs seconds of CPU and up to 40 image
   fetches. Five an hour still covers a builder downloading, changing the
   screenshot toggle and trying again. Tier 2 fails closed, like every
   cost-bearing route.
3. `loadFeedback()`. Ownership comes from `missions.projects.owner_id = userId`
   on the join, never from the request. "Not yours" and "no reports" get the
   same 404 text the CSV uses.
4. **The cap**, checked before anything is fetched or rendered:
   - **≤ 60 reports** per document.
   - **≤ 40 screenshots** per document when screenshots are on. Most tester
     reports carry one to three screenshots.
   - Over either cap → `413` with a plain-text message:
     *"That's too much for one PDF — choose a single mission, or turn off
     screenshots."* For one mission that is over the cap, it reads *"turn off
     screenshots"*, or for reports *"This mission has more reports than one PDF
     holds — use the CSV export instead."* A refusal only, never a cut-short
     file.
   - `export const maxDuration = 60`, so the function has room to finish
     everything within the caps.
5. Screenshots (when on) are fetched with these guards:
   - **Only URLs under `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/screenshots/`**
     are fetched. Anything else becomes a caption. The URLs are written by
     `submitTestResult`, but a server that fetches whatever a row says is how
     you get SSRF, so the check stays even though nobody controls those rows
     today.
   - Each fetch has a 5 s timeout, and they run 6 at a time in parallel.
   - PNG/JPEG only, which is all react-pdf embeds. The magic bytes are checked,
     not the extension. Anything else, any failure and any timeout all become
     the caption *"Screenshot couldn't be included."* There is never a broken
     image box.
6. `renderToBuffer()` → `Response` with
   `Content-Type: application/pdf`,
   `Content-Disposition: attachment; filename="<project>-<mission|all-missions>-report-<YYYY-MM-DD>.pdf"`
   (the existing `slug()`, moved to `lib/exportDb.ts` so both routes share it),
   and `Cache-Control: no-store`.

## §5 — Content

### 5.1 Cover (page 1, top)

The project name, the mission title (or "All missions"), "Generated
17 Oct 2026" and a Twnhall wordmark (text in Syne, so no image asset). Then the
evidence: **N testers · N reports · filed 2 Oct – 11 Oct 2026**. For one
mission it also shows the category and the device target.

### 5.2 Summary: agreement first

For each mission, still on page one when there is one mission:

**What to fix first.** Steps are grouped by `step_id`, falling back to
`step_index` for any older entry without one. Every step with at least one
non-pass answer is listed, **ordered by how many testers reported a problem,
most first**. Ties go by step order.

> **Step 2 — "Say who you think this is built for"**
> **4 of 5 testers: Unclear**

- "N of M": M is the number of reports that answered **that step**, not the
  number of reports on the mission. A legacy report has no entries and is
  never counted against a step.
- When one non-pass status accounts for every problem, it is named:
  "4 of 5 testers: Unclear". When fail and blocked are mixed, the line reads
  "3 of 5 testers hit a problem — 2 Fail, 1 Blocked".
- One tester gives "1 of 1 tester: Fail", with the singular. An even split
  gives "2 of 4 testers: Fail", and the summary does not try to break the tie.
- Under the list: *"No problems reported on steps 1, 3, 5."* One line rather
  than a block per step, because those steps have nothing to fix.
- If no step has any problem: *"Every tester passed every step."*

Below that come **the status mix** (*"Across 25 answers: 17 Pass · 5 Fail ·
3 Blocked"*, using the category's labels), **the average rating** (*"Average
rating 3.8 / 5 from 4 reviewed reports"*, or *"Not yet rated"*), and **the test
case** as a numbered list of action → expected. The test case is read from
the **report snapshots** (the most recent report's `step_action` /
`step_expected` for each step), never from `missions.test_steps`.

When all missions are covered, page one becomes a **contents page**: one row
per mission with its report count and its headline ("Top issue: Step 2,
4 of 5 Unclear"), and each mission's summary opens that mission's section.

### 5.3 Detail, organised by step

For each step, in order:

- A heading: **Step 2**, then the action and expected text from the snapshot.
- Each tester's answer below it, in tester-number order. Each answer shows
  **Tester 2 · Unclear**, then *what they saw* (`actual_result`), *issue*
  (`issue_summary`) and *steps to reproduce*, each only when it has content.
  This is the same omission rule `SubmissionBody` follows.
- **If a report's snapshot differs from the step heading** (the mission was
  edited between two submissions), that answer shows *"Asked as: …"* with that
  report's own wording. The snapshot is the record, as CLAUDE.md says.
- Screenshots belong to the whole report, not to a step (`screenshot_urls` is
  per submission). So they go in §5.4, under each tester's block, at a maximum
  height of 260 pt (about a third of an A4 page) and a maximum width of the
  column.

### 5.4 Per tester, at the end

There is one block per report, in tester order:

- **Tester 2**: the submission status, plus the rating if it has one.
- *Anything else* (`tester_comment`), if present. For the 24 legacy reports
  this is their whole content. They appear only here and are labelled
  *"Filed before step-by-step reports."*
- **AI summary**, labelled *"AI-generated summary — written by a model from
  this tester's report, not by the tester."* It has its own tinted box so it
  cannot pass for the tester's words when the PDF is forwarded.
- The screenshots, or their caption.

### 5.5 Testers are numbered, always

`testerLabel(testerNumbers(reports).get(id))` is the only way a person is
named. Numbers are computed over **every report on the mission** (the export
never narrows within a mission), so "Tester 2" in the PDF is also Tester 2 on
the mission page and in the CSV. `tester_id` is not selected (§3), so it
cannot leak.

## §6 — Readability

- **Light theme only.** The palette is hard-coded in the document. It does
  not read the theme cookie, and it does not use CSS variables, which react-pdf
  cannot resolve anyway. Inks are taken from the light values of the `*-ink`
  tokens, so status colours keep their contrast, and every colour comes with
  its text label.
- A4, 11 pt body text with 16 pt leading, and 56 pt side margins.
- **Repeated step heading:** react-pdf has no "repeat on break", so every
  tester answer starts with a small running label **"Step 2 (cont.)"** that is
  only shown on a page that does not also show the step's heading. Simpler and
  certain alternative: each answer carries a one-line "Step 2 · Tester 3"
  header, so an answer stranded on page 7 still says where it belongs. **I
  recommend the second**: it is one line, it is always right, and it needs no
  page-position logic. (Decision 3.)
- `wrap={false}` on each tester's answer, so an answer stays on one page.
  React-pdf ignores it for anything longer than a page and splits it anyway,
  which is the right fallback. Each step heading has `minPresenceAhead` so it is
  never left at the bottom of a page.
- A `fixed` footer on every page reads *"Project · Mission"* on the left and
  *"Page N of M"* on the right.
- All missions: a page break before each mission section.

## §7 — Plans and pricing untouched

`lib/plans.ts`, `/pricing` and `/settings`' plan section are untouched. The
`ponytail:` comment in §1 marks where the gate goes.

## §8 — Tests

`lib/__tests__/report.test.ts` (pure model):

- Agreement counts: 4 of 5, 1 of 1, an even split of 2 of 4, mixed fail and
  blocked, and every step passed.
- The order is by problem count, falling back to step order.
- `ui_design` labels are Clear / Unclear / Couldn't tell. Other categories get
  Pass / Fail / Blocked.
- Snapshots: two reports with different `step_action` for the same `step_id`
  render the heading from the newest report and give the other report "Asked
  as".
- A legacy report (no entries) appears in the closing section and in no step
  count.

`components/report/__tests__/reportDocument.test.ts` (renders a real PDF
through `renderToBuffer` and extracts its text):

- A one-mission PDF contains the mission title, every step and every tester
  label.
- **Anonymity:** the fixture rows carry a full name, an email and a tester
  UUID on their joined profile. **None of them appear in the extracted text.**
- With screenshots off, the PDF contains no image XObjects. A broken or foreign
  URL produces the caption text.
- All missions gives one document with a heading for each mission.

**Decision 2: text extraction.** react-pdf compresses its streams and subsets
its fonts, so reading the PDF's text needs a real parser. I recommend
`pdfjs-dist` as a **devDependency only**. The alternative is asserting on the
React tree before rendering. That needs no new dependency, but it is not "the
text of the output" the prompt asks for.

`app/api/export/report/__tests__/route.test.ts`, in the pattern of the existing
route and action tests (mocked `requireAccount`, Supabase and rate limit):

- A caller who is not the owner gets a 404 and no PDF. The owner filter is
  asserted on the query.
- Over the report cap, and over the image cap, the route answers 413 with the
  message and never calls render.
- A rate-limited request gets a 429 with `Retry-After`.
- The headers are `application/pdf` and the filename contains the project and
  mission slugs.

`scripts/anonymity.test.mts` is extended so `lib/exportDb.ts`'s select is
checked for `tester_id` the same way the other selects are.

Then the four gates, plus the manual checks in the prompt's §8 on a seeded
mission with five testers and long answers (page breaks, footers, image height,
page one read cold, a search for a real name).

## §9 — Docs

- **CLAUDE.md**:
  - the route;
  - free for now, with the gate marked;
  - tester numbering is mandatory on every exported surface;
  - `components/report/` is its own tree, with the reason;
  - the caps;
  - the new rate-limit rule;
  - the screenshot-origin allowlist.
- **`docs/TWNHALL_SHAREABLE_REPORT_PROMPT.md`** gets a "Superseded by
  `docs/TWNHALL_PDF_REPORT_PROMPT.md`" banner at the top. It is not deleted.
- **`TownHall_Checklist (1).xlsx`** gets QA rows for:
  - a single mission;
  - all missions;
  - the screenshot toggle;
  - anonymity in the output text;
  - the cap message.

## §10 — Commits

1. `feat(report): PDF report route, model and document`. This adds the
   dependency, `lib/report.ts`, `lib/exportDb.ts` (with the CSV route moved
   onto it), `components/report/`, the route and the rate-limit rule.
2. `feat(settings): Download PDF beside the CSV export`, which is the
   `ExportPanel` change.
3. `test(report): model, rendered text, route; docs`, which adds the tests, the
   CLAUDE.md section, the superseded banner and the checklist rows.

## Decisions for you

1. **Fonts:** bundle Syne, DM Sans and DM Mono (recommended), or use built-in
   Helvetica.
2. **Text extraction in tests:** `pdfjs-dist` as a dev dependency
   (recommended), or assert on the tree.
3. **Stranded answers:** a "Step N · Tester M" line on every answer
   (recommended), or a page-aware "(cont.)" label.
4. **Caps:** 60 reports, 40 screenshots and a 60 s maxDuration, with 5 PDFs an
   hour per account. Say if any of these should move.

## Out of scope

Plan gating, links or hosted sharing, emailed or scheduled reports,
cross-project roll-ups, and editing the report before export.

## Implementation notes — where the build differs from the above

- **Cover, all missions:** "N reports across M missions", not "N testers".
  Reports are people only within one mission, and without `tester_id` (never
  selected) the document cannot count people across missions.
- **Every section is its own `<Page>`**: cover/summary, then each mission's
  detail, then each mission's "Each tester". `break` was dropped: on a View
  taller than a page it loops forever, and nested inside a View it collapsed
  the layout onto itself.
- **No `lineHeight` anywhere** (spec §6 said 16pt leading). The fonts' natural
  leading is about 1.35 and reads well; every override tried broke something —
  on the Page it drops the page-number text, unitless or inherited it near
  double-spaces, in points it overprints lines.
- **Stranded answers:** decision 3 as recommended — every answer opens with
  "Step N · Tester M · Status". `minPresenceAhead` keeps step headings off the
  foot of a page.
- **The step heading's label** carries the agreement line too ("Step 2 · 4 of
  5 testers: Unclear"), so the detail restates the finding where it is argued.
