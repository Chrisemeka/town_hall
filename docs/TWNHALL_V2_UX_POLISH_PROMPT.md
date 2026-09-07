# Twnhall v2 — UX Polish: Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

Six UX changes from testing the v2 build. They split cleanly into two PRs: one that builds shared form-feedback infrastructure, and one that changes specific fields and copy.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions.
2. Read `DESIGN.md` — **§5 (components), §8 (empty states), and the accessibility checklist around line 612.** That checklist already specifies the focus standard this work must meet.
3. Read `TEST.md` §1 for the server-action test pattern.
4. Read the specs in `docs/specs/` and match their structure when you write new ones.

Two PRs, in this order. Write the spec for each into `docs/specs/` first and **stop for approval before implementing**. Commit granularity per `CLAUDE.md`: migration → shared logic → server action → UI → tests.

All four gates before done: `npx tsc --noEmit` clean, `npm run lint` with no new `as any`, `npm run build` clean, `npm test` green.

### Decisions already made — do not relitigate

- A **Blocked** step gets the full issue set: what actually happened, summary of the issue, and steps to reproduce. Not just the first.
- The **Save Draft button is removed; the silent localStorage auto-save stays.**
- Item 1's control is labelled **"Add notes for testers"** and the section it reveals is **"Notes for Testers"**.

---

# PR 1 — Form error focus and focus indicators

**Branch:** `feat/form-focus-and-errors`
**Base:** `main`
**Migration:** none
**Risk:** low, but touches every form in the product

Two related accessibility problems. Both are currently unmet items on the `DESIGN.md` checklist.

## 1.1 — Carry the user to the first missing field

**The problem, in the user's words:** a required field near the top of a form gets highlighted red on submit, but the submit button is at the bottom, so nothing appears to happen. The user is looking at the wrong part of the page.

**There is currently no `scrollIntoView` or `.focus()` call anywhere in the codebase.** This is entirely new behaviour, so build it once and wire it everywhere rather than solving it per form.

### The shared hook

Create `lib/hooks/useFocusFirstError.ts`, alongside the existing `useUnsavedChangesWarning`.

It takes the field-errors object a form already produces and, when that object becomes non-empty, moves the user to the first field in error. The details that matter:

- **First in DOM order, not first in object order.** The `fieldErrors` object's key order comes from the Zod schema, which does not necessarily match the visual order of the form. Resolve every errored field to its element, then pick whichever appears earliest in the document (`compareDocumentPosition`). Getting this wrong sends the user to the second error and leaves the first one behind them.
- **Resolve elements by `name` first, then `id`.** Most inputs in this repo carry both (`name="app_url" id="app_url"`), but `name` is what the FormData and the schema agree on.
- **Scroll then focus.** `element.scrollIntoView({ behavior, block: "center" })`, then `element.focus({ preventScroll: true })` — `preventScroll` stops the browser's own focus scroll from fighting the smooth one and landing the field under the sticky header.
- **Respect `prefers-reduced-motion`.** Read `window.matchMedia("(prefers-reduced-motion: reduce)").matches` and use `behavior: "auto"` when set. Never hard-code `"smooth"`.
- **Handle a field that isn't in the DOM.** PR 2 puts a form field behind a disclosure, and a field inside a collapsed section cannot be focused. The hook must accept an optional callback that the form uses to reveal the section before the hook retries. If the element still cannot be found, fall back to scrolling to the form's error summary rather than doing nothing silently.
- **Re-fire on repeat submits.** If the user submits twice without fixing anything, the second submit must move them again. Keying purely on "errors changed" will miss this — the object may be identical. Trigger on the submit event, not only on the errors value.

### While you are in there: associate the errors properly

Every form in this repo renders errors as a bare `<p>` with no relationship to its input. A screen-reader user gets a red message they are never told about. This is cheap to fix at the same time and belongs in the same PR:

- `aria-invalid="true"` on an input in error
- `aria-describedby` pointing at the error text's `id`
- Give each `FieldError` a stable `id` derived from the field name

The `FieldError` helper is duplicated at the bottom of several form files. **Extract one shared version** (`components/ui/FieldError.tsx`) that owns the id convention, and replace the copies. Do not wire the same fix five times.

### Wire it into every form

- `components/CreateProjectForm.tsx`
- `components/EditProjectForm.tsx`
- `components/InlineEditProject.tsx`
- `components/AddMissionForm.tsx`
- `components/EditMissionForm.tsx`
- `components/InlineEditMission.tsx`
- `components/verification/VerificationFlow.tsx`
- `components/admin/BroadcastForm.tsx`
- `components/SettingsForm.tsx`
- `components/tester/AuditLogForm.tsx` — see below, this one is special

Some of these validate on the client before submit and some only surface server errors. Both paths must trigger the focus. Check each form for which it does.

### The audit log needs more than the hook

`AuditLogForm.handleSubmit` currently fails with three blanket messages: `"At least one screenshot is required."`, `"Answer every step before submitting."`, and `"Tell the builder what you found."`

The middle one is the worst offender in the product. On a ten-step log with step 7 incomplete, the tester gets a sentence at the bottom of the page and no indication which step is wrong. **This is exactly the problem this PR exists to fix.**

Change it to:

- Find the first incomplete entry — reuse the per-entry logic in `draftIsComplete` / `AuditLogSteps` rather than writing a second definition of "complete".
- Scroll to that step's card and focus its first empty field.
- Mark that step's card visually as in error, and set the message to name it: `"Step 4 needs an answer."` rather than "Answer every step".
- If the step is complete but its *status* is unset, focus the status control, which is a button group, not an input — the hook must handle a focusable non-input element.

The screenshot error should also scroll to the upload zone rather than only rendering text.

## 1.2 — Focus indicator on the builder/tester switch

`components/layout/Sidebar.tsx` (~lines 125–133) renders the account switch as a raw `<button type="submit">` inside a form. It has `hover:text-chalk` and no focus style at all. A keyboard user tabbing the sidebar cannot see where they are.

**`DESIGN.md` already specifies the standard** in its accessibility checklist (~line 612): *"All interactive elements have `:focus-visible` — `outline: 2px solid #E8FF47; outline-offset: 2px`."* Use that, and match `components/ui/Button.tsx`, which already implements it as `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-voltage focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian`.

Apply the same treatment to the `NavItem` used for "Add {other} account", so the two states of that slot behave identically — a user who switches accounts should not find the focus ring appearing and disappearing depending on which variant renders.

**Then check the rest of the sidebar.** The user asked specifically for the switch button, so that is the requirement. But if the nav links, the close button, or the settings link are also missing focus styles, say so in the PR and offer to include them — a focus ring on one control in a sidebar is arguably worse than none, because it implies the others aren't focusable. Do not silently expand scope; ask.

## Tests for PR 1

- Unit-test the DOM-order resolution: given errors on fields B and A where A appears first in the document, the hook targets A.
- Unit-test the reduced-motion branch.
- Extend `scripts/` or the vitest suite to assert the audit log names the specific incomplete step rather than the generic message.
- Manual keyboard pass: tab through the sidebar and every form, confirm the focus ring is visible at every stop against both `obsidian` and `graphite` backgrounds.

---

# PR 2 — Mission notes, audit log fields, and copy

**Branch:** `feat/mission-notes-and-audit-fields`
**Base:** `main` (with PR 1 merged)
**Migration:** one, small
**Risk:** medium — makes a required column optional

## 2.1 — "What to Test" becomes optional, behind a disclosure

`AddMissionForm.tsx` (~lines 122–172) has two stacked blocks: the **What to Test** textarea (`task_description`, required, minimum 20 characters) and a **Writing a Good Mission** tip box. `EditMissionForm.tsx` has the same field at ~line 139.

Since v2, the `TestCaseEditor` above it already collects the real brief as ordered action / expected-result steps. `task_description` is now supplementary — but it is still mandatory and still the largest thing on the form, which is backwards.

**The change:** a checkbox labelled **"Add notes for testers"**, unchecked by default. Checking it reveals a section headed **"Notes for Testers"** containing the textarea and the tip box. Unchecked, neither appears.

Details:

- Rename the field's visible label to **"Notes for Testers"**. Keep the column name `task_description` — renaming it would touch the admin console, both mission detail pages, the tour, and the audit log's step rendering for nothing.
- Rename the tip box from **"Writing a Good Mission"** to something that matches the new framing — **"Writing Useful Notes"** or similar. Its three tips currently read as instructions for writing a mission brief ("Start with a verb…", "Describe the exact flow…"). The test steps do that job now. **Rewrite the tips** to be about context the steps cannot carry: what the product is, what state it is in, known issues to ignore, credentials or test data testers will need. Propose the new copy in the spec.
- Update the placeholder text for the same reason.
- The helper line *"Be specific — name the screens and the exact steps testers should follow"* now describes the test case, not the notes. Rewrite it.
- **In `EditMissionForm`, the checkbox starts checked when the mission already has a `task_description`**, with the section expanded. A builder editing an existing mission must not think their notes were deleted.
- Keep the character counter and the `MISSION_DESCRIPTION_MIN` floor, but apply it **only when the box has content**. Empty is valid; 5 characters is not.

### Schema

```ts
task_description: z
  .string()
  .trim()
  .max(MISSION_DESCRIPTION_MAX)
  .refine((v) => v === "" || v.length >= MISSION_DESCRIPTION_MIN, {
    message: `Add at least ${MISSION_DESCRIPTION_MIN} characters, or leave the notes off.`,
  })
  .optional()
  .or(z.literal("")),
```

Write it however fits the file's existing style — the requirement is that empty passes and short-but-non-empty fails with a message that tells the user both ways out.

### Migration

Check whether the column is `NOT NULL` before writing anything:

```sql
select is_nullable, column_default
from information_schema.columns
where table_name = 'missions' and column_name = 'task_description';
```

If it is `NOT NULL`, either drop the constraint or set a default of `''`. **Prefer a default of `''` over nullable** — every read site in the app currently assumes a string, and making it nullable means auditing all of them. Report which you found and which you did.

### Display sites must handle an empty brief

A mission with no notes must render cleanly, not as a heading over blank space:

- `app/(tester)/mission/[id]/page.tsx`
- `app/(developer)/dashboard/[projectId]/mission/[missionId]/page.tsx`
- `app/(admin)/admin/missions/[id]/page.tsx` — already renders `"No task description."` for empty; align its wording with the new name
- `components/InlineEditMission.tsx` (~line 88)
- `components/ProjectDetailTabs.tsx`

Omit the section entirely when empty rather than showing an empty-state message. The test case is right there above it.

### The tour will point at nothing

`components/tours/tours.tsx` (~line 137) has a step: *"The submitter wrote this to tell you exactly what to test. Read it carefully — staying on brief is what makes feedback useful."*

That step anchors to the task description, which can now be absent. A tour step whose selector matches nothing either crashes Onborda or strands the user. **Re-point the step at the test case, and rewrite its copy** — the test steps are now what "staying on brief" means. Then walk the whole tester tour and confirm the sequence still reads correctly.

## 2.2 — Audit log: "What actually happened" only on Failed and Blocked

`components/tester/AuditLogSteps.tsx` currently renders `actual_result` (labelled "What actually happened") and `expected_result` ("What you expected") unconditionally, then reveals `issue_summary` and `steps_to_reproduce` only when `status === "fail"` (~line 138).

New behaviour:

| Field | Pass | Fail | Blocked |
|---|---|---|---|
| What you expected | shown | shown | shown |
| What actually happened | **hidden** | shown | shown |
| Summary of the issue | hidden | shown | **shown** |
| Steps to reproduce | hidden | shown | **shown** |

So a **Pass** collects only the confirmed expectation, and **Blocked** is treated like Fail. Blocked previously collected no issue detail at all, which meant a blocked step reached the builder with nothing actionable.

Changes needed in three places, and they must agree:

**`components/tester/AuditLogSteps.tsx`** — the conditional rendering above. Note the existing comment at ~line 137 explaining why fail-only fields exist ("asking anyway is how the data becomes 'N/A'"); update it to cover blocked.

**`draftIsComplete`** (~lines 43–48) — currently requires `actual_result` on every entry. It must now require it only for fail and blocked, and require `issue_summary` / `steps_to_reproduce` for both rather than fail alone.

**`lib/validation/schemas.ts`, `auditEntrySchema`** (~lines 262–288) — this is the authority and the client must not be able to bypass it:

- `actual_result` drops from a hard `.min(ENTRY_TEXT_MIN)` to optional, with a `.refine` requiring it when `status !== "pass"`.
- The two existing `.refine` calls that check `status !== "fail"` become `status === "pass" ||` — so they apply to blocked too.
- Every refine needs its `path` set so PR 1's focus hook can find the field.

**Database:** `test_result_entries.actual_result` is `NOT NULL`. A passing step now has no actual result. Set a default of `''` and write `''` for passing steps rather than making the column nullable — same reasoning as `task_description`. Check `submit_audit_log` in `supabase/migrations/` and make sure the plpgsql function handles an absent key in the entries JSON without failing.

**Existing rows are unaffected** — every entry written before this has an `actual_result`. Confirm the builder-side renderer omits the field cleanly when it is `''` rather than printing an empty label.

## 2.3 — Rename "Proof of Visit"

The label does not say what to upload. Rename it to name the artefact: **"Screenshots of Your Test"** — or propose better in the spec, the requirement is that a first-time tester reads the heading and knows to upload screenshots.

The existing helper text below it is good and should stay: *"Upload screenshots from the project… Capture the whole journey, not just the final screen."*

Change it in all four places so the vocabulary is consistent:

- `components/tester/AuditLogForm.tsx` ~line 311 (the heading)
- `components/MissionResultRow.tsx` ~lines 85–88 (the builder-side section header), plus the `alt` text at ~lines 103 and 255 — `alt="Proof of visit 1"` should describe the image, e.g. `alt="Test screenshot 1 of 4"`
- `app/guidelines/page.tsx` ~lines 99, 146, 156
- `app/page.tsx` ~line 159

**On the guidelines page, keep the concept and change the name.** The paragraph at ~line 156 explains that the screenshot serves a dual purpose — evidence that the tester really used the product, and visual context. That reasoning is still exactly right and is worth more than the label was. Rewrite around the new name; do not delete the explanation.

## 2.4 — Remove the tester's Save Draft button

`components/tester/AuditLogForm.tsx` ~lines 421–429.

**Worth knowing before you delete it: this button does not work.** It writes only `feedback` (the free-text comment) to `localStorage` under `draft:${missionId}` — a key **nothing in the codebase ever reads**. The functioning auto-save is separate: it writes the full `entries` array to `twnhall:audit-log:${missionId}` on every change and restores it on mount.

So the button has been promising to save work it never saved, and discarding the nine-tenths of the form that actually matters. Removing it is a straight fix.

- Delete the button and its `onClick`.
- **Keep the auto-save.** It is the real thing and it protects the longest form in the product.
- The CTA row is now a single button — check the layout and the `DESIGN.md` one-voltage-CTA rule still reads correctly with the second button gone.
- Consider a quiet line under the submit button telling the tester their progress is saved automatically. The old button, broken as it was, at least signalled that drafts existed; deleting it silently removes that reassurance. Propose copy in the spec.
- Grep for `draft:${missionId}` and remove any other reference to the dead key.

## Tests for PR 2

- `auditEntrySchema`: pass without `actual_result` accepted; fail without it rejected; blocked without `issue_summary` rejected; blocked without `steps_to_reproduce` rejected.
- `draftIsComplete` agrees with the schema on all three statuses — these two definitions of "complete" drifting apart is the most likely bug in this PR. Test them against the same fixtures.
- Mission create/update with an empty `task_description` succeeds; with 5 characters fails.
- The `submit_audit_log` RPC accepts an entry with an empty `actual_result`.
- Render tests: a mission with no notes, and a submission with a passing entry, both render without empty headings.

---

## Documentation, after both PRs

- **`CLAUDE.md`** — update the Data Model table for `task_description`'s new optionality and `test_result_entries.actual_result`'s default. If the audit log's conditional-field rule is described anywhere, update it to cover blocked.
- **`DESIGN.md`** — the accessibility checklist item on `:focus-visible` can now be ticked for the sidebar. If PR 1 establishes a house pattern for error focus and `aria-describedby`, document it in §5 so the next form follows it instead of reinventing it.
- **`TownHall_Checklist (1).xlsx`** — add rows for: submitting an incomplete form carries you to the missing field; the sidebar switch shows a focus ring on keyboard tab; a mission with no notes renders correctly; a passing audit step does not ask what actually happened; a blocked step does.
- **`app/guidelines/page.tsx`** — already covered in 2.3, but re-read the whole page afterwards for any other reference to a required mission brief.

## One thing to raise in the PR description

Items 2.1 and 2.2 both make a previously required field optional, and 2.2 removes a field from the Pass path entirely. That is less data per submission by design — the friction was producing filler. Worth watching after release: if builders start reporting that passing steps tell them nothing, the answer is a short optional note on Pass, not restoring the mandatory field.
