# SPEC: Screenshots Belong to the Step That Went Wrong

**Status:** Implemented on `feat/step-screenshots` — decisions 1–4 decided 1 Nov 2026 (§6)
**Branch:** `feat/step-screenshots`
**Source:** `docs/TWNHALL_STEP_SCREENSHOTS_PROMPT.md`
**Migration:** one — `test_result_entries.screenshot_urls`, and `submit_audit_log` replaced (same signature)
**New dependency:** none
**Risk:** medium — touches the submission write, the one RPC that saves a report,
and every surface that shows a screenshot. Reports already filed are not
rewritten.

## Summary

Today a report carries one pile of screenshots — **at least one required, up
to 10** — attached to the report as a whole. The builder sees them in a
carousel above the steps and has to guess which screenshot shows which step.
The builder guide says so outright: *"Screenshots are attached to the report,
not to individual steps."*

After this change:

- **A screenshot is offered only on a step that did not pass.** That's Fail
  and Blocked on a functional test, and Unclear and Couldn't tell on a UI /
  Design test. Those are the same two stored statuses, `fail` and `blocked`
  (`entryStatusCopy()` only relabels them), so one rule covers both
  vocabularies: **`status !== "pass"`**.
- **A screenshot belongs to its step.** It is stored on the step's
  `test_result_entries` row and shown under that step everywhere a report is
  read: the builder's mission page, the PDF, the tester's own feed and admin.
- **A Pass (or Clear) step has no upload control**, and the server refuses a
  file sent for one.
- **The report-level screenshot section goes away for missions with steps.** It
  stays exactly as it is for missions with no steps, because those have nothing
  to attach a screenshot to.

## §0 — Verified before writing this

**The rule today**, enforced in three places:

- `screenshotsSchema` (`lib/validation/schemas.ts:406`): `.min(1, "At least one
  screenshot is required.")`, `.max(MAX_SCREENSHOTS)` with `MAX_SCREENSHOTS = 10`.
- `AuditLogForm.handleSubmit` refuses with no screenshot, and `isReady`, the
  submit hint and `ReportProgressBar` ("All steps answered · add a screenshot")
  all wait for one.
- `submitTestResult` uploads `formData.getAll("screenshots")` and passes one
  `p_screenshot_urls` array to `submit_audit_log`, which writes it to
  `test_results.screenshot_urls` (and `[1]` to the legacy `screenshot_url`).

**Nothing per-step exists yet.** `test_result_entries` has no screenshot column.
The current `submit_audit_log` (`20261027_01`, six arguments) reads
`step_id … expected_result` off each entry and nothing else.

**The step card is shared.** `AuditLogSteps` renders on the tester's
`/mission/[id]` and inside the builder's `MissionPreview` (CLAUDE.md: "the
preview is the tester's page, never a copy of it"). The preview's frame is
`<fieldset disabled inert>`, so no status can be picked there. That means a
control shown only on a non-pass step never appears in the preview, and the
preview needs no change.

**Files cannot live in the draft.** `DraftEntry` is written to `localStorage`
as JSON. Screenshots are `File`s held in component state and are already lost
on reload today; the page says "Your answers save on this device", not your
screenshots. That stays true, and §3 keeps the files out of `DraftEntry`.

**Every reader goes through `screenshotList(row)`**, which knows only the
report-level columns. Those readers are:

- the builder's views: `MissionResultRow` (carousel and lightbox),
  `ProjectDetailTabs` and `FeedbackListPaged` (both with `ScreenshotStrip`)
- the tester's feed: `/tester` → `SubmissionsFeed`
- admin: `admin/content` and `admin/missions/[id]`
- exports: the CSV/XLSX export (a count column) and the PDF (`lib/report.ts`, the
  report route, `ReportDocument`'s "Each person's notes and screenshots")
- storage cleanup: `storagePathsFor()` in `actions/admin/submissions.ts` and
  `actions/admin/projects.ts`

**The screenshot is also the proof of a visit.** The tester tour says so
(`components/tours/tours.tsx:149`: "A screenshot is required for every
submission — proof you actually visited"), and the cohort is paid per report on
submission (compensation model §6). Under this change, a report where every
step passes carries no screenshot. Decision 2 is about exactly that.

**Missions with no steps** still use the report-level screenshot and comment
(`hasSteps`). **Counted 1 Nov 2026: 12 of 25 live missions (15 of 29 overall)
have an empty `test_steps`.** Of the 15 audit-log reports filed so far, 8 passed
every step.

## §1 — What the tester sees

On each step card, **below** "Steps to reproduce", and only while the status is
not Pass:

- An **"Add a screenshot"** control (optional, per decision 1) that takes up to
  `MAX_STEP_SCREENSHOTS` files (decision 3). Thumbnails with a remove ×, the same
  validation (`screenshotSchema`: PNG/JPG/WEBP, 5 MB) and the same
  `compressImage()` before upload.
- One line beneath it: *"Show what went wrong while it's on screen. Crop out
  anything with your name, email or photo."* This is the anonymity line CLAUDE.md
  calls "the one defence", and it moves to where the control now is.
- `id`/`name` `entries.<i>.screenshots`, so `useFocusFirstError` can land on it
  when the server refuses a file. That's the "control names match schema keys"
  rule.

**Switching a step back to Pass** hides its screenshots but keeps them in
memory. They don't upload while the step is a pass, and they come back if the
tester switches it to Fail again. An accidental tap never deletes work.

**Elsewhere on the form, for a mission with steps:**

- The "Screenshots of Your Test" section, its drop zone and its "N of 10
  attached" line are not rendered.
- Before unlock, *"Screenshot as you go. You'll need at least one to submit…"*
  becomes *"If something breaks or stops you, screenshot it while it's on
  screen. You can attach it to that step."*
- `isReady`, the submit hint ("Answer every step to submit.") and
  `ReportProgressBar` stop waiting for a screenshot. `progressLabel()` loses its
  "add a screenshot" branch for missions with steps.
- The unsaved-changes warning counts per-step screenshots too.

**A mission with no steps is unchanged**: report-level uploader, at least one
screenshot, the comment.

## §2 — Storage and the write

**Migration `20261101_01_step_screenshots.sql`:**

```sql
alter table public.test_result_entries
  add column if not exists screenshot_urls text[] not null default '{}';
```

Then `submit_audit_log` is replaced with **the same six-argument signature**. Its
only change is reading each entry's URLs:

```sql
coalesce(
  (select array_agg(u) from jsonb_array_elements_text(v_entry->'screenshot_urls') u),
  '{}'
)
```

`coalesce`, because `->` on a missing key is `NULL` and a column default does not
fire for an explicit `NULL`. That's the `20260907_01` trap. The `revoke`/`grant`
lines are restated, never assumed to survive the `create or replace`. With a
rollback note in the file's usual style.

**Why a column on the entry, not a step id beside each report-level URL:**
`test_result_entries` is already the per-step table (CLAUDE.md: entries are
aggregated independently). A URL there is deleted with its entry (cascade) and
read with it in every query that already selects entries. Tagging report-level
URLs would leave a second index to keep in step.

**Deploy order: migration first, then the code.** The old function ignores the
new key, so new code against the old function would drop step screenshots
without an error. The old code against the new function is harmless, because a
missing key gives `'{}'`.

**In `submitTestResult`**, after the existing refusals and the rate-limit check,
before any upload:

- Files arrive as `screenshots.<step_id>`. For each entry, `formData.getAll()`
  that key and validate every file with `screenshotSchema`.
- **The server builds the URLs. The client never sends one.** `auditEntrySchema`
  has no `screenshot_urls` key, and Zod strips unknown keys, so a URL in the
  payload is dropped. The action uploads each step's files and adds
  `screenshot_urls` to that entry before calling the RPC.
- **Refusals**, each returned as a field error on `entries.<i>.screenshots`:
  - a file for a step whose status is `pass`: *"Step N passed. Screenshots go on
    a step that didn't."* The form never sends this, so if it happens, the two
    sides have drifted.
  - more than `MAX_STEP_SCREENSHOTS` on one step
  - more than `MAX_SCREENSHOTS` across the report
  - a `screenshots.<id>` key naming no step on the mission
- **Report-level `screenshots`** stays accepted on every mission, because a tab
  opened before the deploy still sends it. It's required (min 1) only when the
  mission has no steps. `screenshotsSchema` splits into a required and an
  optional form. On a mission with steps, the new form never sends it.
- The rate-limit comment stays true: uploads per report are still capped at
  `MAX_SCREENSHOTS`.
- **One predicate decides "this step takes screenshots"**: `takesScreenshots(status)`
  in `lib/vocabulary.ts`, beside `ENTRY_STATUSES`. The form imports it to render
  the control, and the action imports it to refuse. That's the same one-definition
  rule as `auditEntrySchema` / `firstIncompleteEntry`.

## §3 — The form's state

Screenshots stay out of `DraftEntry`. `AuditLogForm` holds
`stepShots: Record<step_id, Shot[]>` and passes each step its own list. To do
that, `AuditLogSteps` gains two **optional** props, `shotsFor(stepId)` and
`onShotsChange(stepId, shots)`:

- When they're absent, as in `MissionPreview`, the control renders with no files
  and does nothing. Under `inert` it can't be reached anyway.
- The thumbnails, the remove × and the object-URL cleanup (`URL.revokeObjectURL`
  on remove and unmount) move into a small `StepScreenshots` component. It
  replaces the report-level block, which stays only for the no-steps branch, so
  there's one copy of the upload UI, not two.

On submit: compress, then `fd.append(\`screenshots.${stepId}\`, file)` only for
steps where `takesScreenshots(status)` holds. Hidden screenshots on a step
switched back to Pass are never sent.

## §4 — Where the builder, tester and admin read them

**One read helper, extended, not a second one.** In `lib/utils/screenshots.ts`:

- `screenshotList(row)`: unchanged. It means the **report-level** list (legacy
  rows, no-step missions, and pre-deploy tabs).
- `entryScreenshots(entry)`: `entry.screenshot_urls ?? []`.
- `allScreenshots(row, entries)`: report-level, then each entry's in step order.
  For counts, caps and cleanup.

No inline `screenshot_urls ?? []` anywhere else. CLAUDE.md's rule ("every
screenshot read goes through `screenshotList()`") is reworded to name all three.

| Surface | Change |
|---|---|
| **Builder mission page** (`MissionResultRow` + `SubmissionBody`) | Each non-pass entry shows its thumbnails under "Steps to reproduce". A tap opens **the existing lightbox**, scoped to that step's images (no second lightbox). The carousel above the steps renders only when the report has report-level screenshots. Otherwise it's absent, and "No screenshot captured" is not shown, because no screenshot is the normal state of an all-pass report. |
| **Lists** (`ProjectDetailTabs`, `FeedbackListPaged`) | `ScreenshotStrip` gets `allScreenshots()`. The count includes step screenshots. |
| **Tester feed** (`/tester`, `SubmissionsFeed`) | The card count and the dialog use `allScreenshots()`. In the dialog, each thumbnail is captioned "Step N". |
| **Admin** (`admin/content`, `admin/missions/[id]`) | Same as the builder: under the step. Admin keeps real names, as always. |
| **CSV / XLSX** | The Screenshots column on a step row counts **that step's** screenshots; on a legacy or no-step row, the report's. Still counts, never URLs. |
| **PDF** | Step screenshots render in the by-step detail, directly under that tester's answer to that step, which is where a forwarded reader needs them. Report-level screenshots stay in "Each person's notes and screenshots". `SCREENSHOT_CAP` (40) and the route's fetch list count `allScreenshots()`. Captions, `screenshotNote()` and `X-Screenshots-Missing` are unchanged. |
| **Cleanup** (`actions/admin/submissions.ts`, `projects.ts`) | `storagePathsFor()` takes the entries' URLs too. Without this, deleting a report leaves its step screenshots orphaned in the bucket. |
| **Every query** that selects `test_result_entries(...)` for one of the above | Adds `screenshot_urls`. `SubmissionEntry` (`Pick<TestResultEntryRow, …>`) and `TestResultEntryRow` in `lib/types/db.ts` gain it. |

**Reports already filed are not touched.** There's no way to know which step an
old screenshot showed, so they keep rendering exactly as today, through
`screenshotList()`.

**Anonymity is unaffected.** `screenshot_urls` is a storage URL, not a person
key. `scripts/anonymity.test.mts` still passes, and no new `select("*")` is
added.

## §5 — The AI summary

`generateAnalysis` gets the images **with the step each belongs to**. Each step's
images go into the message right after a text part reading `"Screenshot for step
N (FAIL):"`, and report-level images follow under their existing line. In
`ANALYSIS_PROMPT`, *"in the order the tester captured them — read them as one
journey"* becomes *"each screenshot is attached to the step it shows"* whenever
there are step screenshots. `imageCount` for metering is the total.

## §6 — Decisions

**Decided 1 Nov 2026:**

1. **Required on Fail, optional on Blocked.** Stored statuses, so Unclear (a
   `fail`) requires one and Couldn't tell (a `blocked`) doesn't.
   `needsScreenshot()` beside `takesScreenshots()`; the form and the action both
   import it.
2. **(b), generalised: every report carries at least one screenshot.** A step
   report whose steps hold none attaches one "final result" screenshot,
   report-level. That covers all-pass reports and pass-plus-blocked reports with
   nothing attached. Cross-tester disagreement and time-per-report flags on
   `/admin/payouts` were discussed as a stronger proof and are not built.
3. Recommended: 3 per step, 10 per report.
4. Recommended: unchanged.

Where this changes the sections above: §1's "isReady … stop waiting for a
screenshot" and §2's "required (min 1) only when the mission has no steps" become
"at least one screenshot anywhere on the report", checked by the action once it
has both. `screenshotsSchema` loses its minimum instead of splitting in two.
`progressLabel()` keeps its "add a screenshot" branch, now counting every
screenshot.

The original options, as written:

**Decision 1 — Optional or required on a non-pass step?**
**Recommended: optional**, which matches "should only be an option". A blocked
tester often has nothing worth capturing ("the link 404'd"), and a required
upload would push them to screenshot anything just to get past the form. The
alternative is required on Fail and Blocked: more evidence, more friction, and a
new way to block a submission.

**Decision 2 — An all-pass report now has no screenshots at all. Accept it?**
Today's minimum of one screenshot is also the proof a tester opened the product,
and cohort testers are paid ₦1,000 per report on submission.
- **(a) Accept — recommended.** It's what was asked, and a pass is fully stated
  by the builder's own `step_expected`. The proof that remains is weaker:
  `started_at` (from the browser), the builder's rating, and `RATING_FLAG_BELOW`
  on `/admin/payouts`. Say so plainly in CLAUDE.md, and rewrite the tour's
  "proof you actually visited" line.
- **(b) One "final screen" screenshot on a report with no failures.** That keeps
  the proof, but it is a report-level screenshot under another name, and it
  contradicts the ask.
- **(c) (a) now, and watch it.** Add a count of cohort reports with zero
  screenshots to `/admin/payouts` as a follow-up, once there is a month of data.

**Decision 3 — How many per step?**
**Recommended: `MAX_STEP_SCREENSHOTS = 3`** per step, with `MAX_SCREENSHOTS = 10`
kept as the per-report total. Three covers "before, the error, after". The total
keeps the 6 MB Server Action body limit (`next.config.ts`) and the rate-limit
arithmetic where they are today.

**Decision 4 — The no-steps fallback.**
**Recommended: unchanged** (report-level, at least one required). Those missions
predate test cases, and there's no step to attach to. If the §0 count is zero
live missions, the alternative is to drop the report-level uploader entirely and
leave only the legacy read path.

## §7 — Tests

- **`lib/__tests__/vocabulary.test.ts`**: `takesScreenshots` is false for `pass`
  and `""`, and true for `fail` and `blocked`. It's crossed with
  `entryStatusCopy()` so Unclear and Couldn't tell resolve to true.
- **`actions/__tests__/submissions.test.ts`**, following TEST.md §1 (auth
  rejection, happy path, error surfacing):
  - A step mission with **zero screenshots** submits. That's the old min-1 rule,
    deliberately gone.
  - Files on a `fail` step upload, and its entry reaches the RPC with exactly
    those URLs.
  - A file on a `pass` step is refused, with a field error on
    `entries.<i>.screenshots`, **before any upload**.
  - Per-step cap, report total cap, and an unknown step key are each refused
    before upload.
  - A `screenshot_urls` key in the client's `entries` JSON never reaches the RPC.
  - A no-step mission still requires one report-level screenshot. A step mission
    sent report-level `screenshots` (an old tab) still saves them.
- **`components/tester/__tests__/`**: the control renders on non-pass steps only;
  Fail → Pass → Fail keeps the files; `progressLabel()` and the ready state no
  longer mention a screenshot on a mission with steps.
- **`components/missions/__tests__/missionPreview.test.ts`**: still passes
  unchanged. Add an assertion that no file input is reachable in the preview.
- **`lib/__tests__/report.test.ts`** / **`reportDocument.test.ts`**: a step
  screenshot lands under its step in the by-step detail; report-level ones stay
  in the per-person section; the cap counts both.
- **Export route test**: the step row's Screenshots column is that step's count.
- **Storage cleanup**: `storagePathsFor()` includes entry URLs.
- **`scripts/screenshots.test.mts`**: the required/optional split of
  `screenshotsSchema`, and `MAX_STEP_SCREENSHOTS`.
- **`scripts/guides.test.mts`**: pin `MAX_STEP_SCREENSHOTS` in the tester guide,
  as it already pins `MAX_SCREENSHOTS`.

## §8 — Copy and documentation

- **Tester guide** (`/guides/tester`, the "screenshots" section, id unchanged):
  "At least one screenshot is required on every report" becomes "Attach
  screenshots to a step that failed or got blocked: up to N per step, M per
  report." Passing steps need none.
- **Builder guide** (`:242`): *"Screenshots are attached to the report, not to
  individual steps"* becomes *"Each screenshot is attached to the step it shows,
  and only failed or blocked steps carry them."*
- **Tour** (`tours.tsx:149`): drop "required … proof you actually visited". New
  text: "Got stuck or found a bug? Attach a screenshot to that step."
- **Feedback notification email** (`emails/feedback-notification.tsx:70`): "to
  see screenshots" becomes "to see the full report". A report may have none.
- **`CLAUDE.md`**:
  - a paragraph on step screenshots: stored on the entry, offered only when
    `takesScreenshots`, server-built URLs, migration-before-code
  - the reworded `screenshotList`/`entryScreenshots`/`allScreenshots` rule
  - decision 2's outcome, stated plainly
  - `test_result_entries.screenshot_urls` added to the table
- **`TownHall_Checklist (1).xlsx`**: mark QA-2.4-4 and QA-2.10-14 **RETEST**,
  and add section **2.26 Step screenshots**:
  - QA-2.26-1: Fail a step on a process-flow test. "Add a screenshot" appears
    under Steps to reproduce. Pass shows none.
  - QA-2.26-2: On a UI / Design test, Unclear and Couldn't tell show it; Clear
    doesn't.
  - QA-2.26-3: Attach 2 to a failed step, switch it to Pass (they disappear),
    then back to Fail (they're back). Submit with it on Pass, and the builder
    sees none for that step.
  - QA-2.26-4: An all-pass report submits with no screenshot.
  - QA-2.26-5: The builder's mission page shows each screenshot under its own
    step, and the lightbox opens on that step's images.
  - QA-2.26-6: The PDF shows each step screenshot under that tester's answer,
    checked with `pdfimages -list`, not by eye.
  - QA-2.26-7: A report filed before this change still shows its screenshots
    exactly as before.
  - QA-2.26-8: The admin deletes a report with step screenshots, and the objects
    are gone from the bucket.
  - QA-2.26-9: A mission with no steps still asks for one report-level
    screenshot.
  - QA-2.26-10: Both themes, 360px and desktop. The per-step thumbnails wrap
    inside the card with no horizontal scroll, and every control is 48px.

## Out of scope

Moving old screenshots onto steps. Persisting screenshots across a reload, which
would need a server-side draft, deferred by decision. Annotating or cropping
screenshots in the browser. Changing the 5 MB size cap or the formats.

Account deletion's storage cleanup. `deleteAccountAction` calls the
`delete_user` RPC, which is not in `supabase/migrations/`, and no app code
removes that person's screenshot objects. That's true today for report-level
screenshots too, so it's a separate check and fix, noted here so it isn't
mistaken for part of this one.
