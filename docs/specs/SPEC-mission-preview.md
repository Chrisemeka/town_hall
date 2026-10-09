# SPEC: Mission Preview

**Status:** Implemented. Revised 2026-10-09: a Preview button opening a
full-screen preview, at the product owner's request, in place of the prompt's side-by-side
live layout (its §6) and its published-mission link (its §7)
**Branch:** `feat/mission-preview`
**Base:** `main`
**Source:** `docs/TWNHALL_MISSION_PREVIEW_PROMPT.md`
**Migration:** none
**Risk:** low. No action, no gate and no query changes beyond two extra
columns on pages the owner check already scopes.

## Summary

A **Preview** button beside Publish and Save as Draft, on both the new and the
edit mission forms, opens what a tester will see for the mission *as it stands
in the form* — no save, no draft row. Built from the tester's own components,
so the preview and the real page cannot drift.

The point is quality, not looks. "Check the thing works" reads fine as a form
row. Placed above *How did it go? Pass / Fail / Blocked*, it reads as a question
nobody can answer. The preview puts the step and the judgement it asks for next
to each other while the builder can still change the step.

## §1 — What the tester page renders, block by block

`app/(tester)/mission/[id]/page.tsx`, top to bottom:

| Block | In preview? | Why |
|---|---|---|
| Breadcrumb `Explore / Project / Title` | **No** | Navigation chrome. It says nothing about the mission's wording, and links inside a mirror only invite clicks. |
| Title (H2) | **Yes** | It's what the tester reads first. An empty title shows as empty, not as a placeholder (§5). |
| Project card: name, app URL, description | **Yes** | The tester's only context about the product. If the description is thin, the builder should see that. |
| Notes from the Builder | **Yes, when non-empty** | Omitted when empty, the same way the page does it. |
| `MissionChips` (category, device) | **Yes** | |
| Test steps (`TestCaseView`) | **Yes** | The page shows the steps twice: here, and again inside the audit log. The preview does the same, because that's what the tester sees. |
| Owner / "You've tested this" / cohort-unpaid notice | **No** | These depend on who the viewer is, not on the mission. The builder would always get "Project Owner", which is the exact view this feature replaces. |
| `BuilderNote` | **No** | Appears only after a review. No report exists yet. |
| `AuditLogForm`: "Open Project in New Tab" + "Screenshot as you go" | **No** | Owned by the form, which §2 says never to mount. The text is the same on every mission, so it reveals nothing about this builder's writing. |
| `AuditLogForm`: "Work through the test case" heading + **`AuditLogSteps`** | **Yes** | This is the part that matters: the three choices, the question above them, and on `ui_design` the required "What you saw". |
| `AuditLogForm`: screenshots, "Anything else?", Submit | **No** | The same on every mission. Submit is exactly what the prompt forbids. |

On the tester's real page, the steps only appear after clicking "Open Project".
The preview shows them open, because the unlock is a step in the tester's
journey, not part of what they're asked.

## §2 — What gets shared, and what changes to allow it

### 2.1 `MissionBrief`: extracted from the tester page

Title, project card, notes, chips and test steps are written inline in
`app/(tester)/mission/[id]/page.tsx`. The preview can't use them unless they're
pulled out, and copying them would create the second renderer the prompt rules
out. So they move **verbatim** into `components/missions/MissionBrief.tsx`, a
presentational server-safe component (no hooks, no `"use client"`). The tester
page then renders `<MissionBrief … />` in their place.

**The tester's rendered output doesn't change**, byte for byte apart from
whitespace. That keeps this inside "no change to the tester's actual page": the
markup moves, it isn't edited. The `tour-mission-project` /
`tour-mission-testcase` ids go with it, because the tester tour anchors on them.
In the preview they're harmless: no tour runs on a builder page.

### 2.2 `AuditLogSteps`: no change needed

It's already independent of the form. It takes `entries`, `category`,
`onChange` and `errorIndex`, and has no effect, no storage access and no submit
of its own. `draftFor(steps)` builds the entries. The preview passes a no-op
`onChange`. **`AuditLogForm` isn't imported anywhere in the preview's module
graph.** That is what keeps `twnhall:audit-log:*` keys from being written.

### 2.3 `TestCaseEditor`: no change

The Preview button is inside the mission form, so on click it reads the form's
own `FormData`: `title`, `task_description`, and the editor's hidden
`category` / `device_target` / `test_steps` inputs, which already mirror its
state. No prop, no lifted state.

### 2.4 `AuditLogIntro`

The "Work through the test case" heading and its line moved from
`AuditLogForm` into `AuditLogSteps.tsx` as `AuditLogIntro`, so the preview
shares it rather than copying it. The form renders the same markup.

## §3 — The full-screen preview

`components/missions/MissionPreview.tsx`: `PreviewButton` and `TesterView`.

- **Full screen, same tab.** On the builder's request it opens over the whole
  form like a design tool's preview, not as a popup. Same tab, so the unsaved
  mission never has to travel. A new tab would need to pass the draft through
  storage. It is still a native modal `<dialog>`, sized to the viewport: Esc
  closes it, focus stays inside and returns to the Preview button.
- **Top bar (builder chrome, outside the frame):** "Back to editing", the
  title "What testers see" with "Nothing here is live, and nothing is saved."
  (hidden below md), and a Phone / Desktop toggle.
- **One scroll, no bars.** The dialog never scrolls. The canvas under the bar
  is the only scroll container, with its scrollbar hidden and
  `overscroll-contain`, so the form behind stays put.
- **The frame is `<fieldset disabled inert>`.** Inert takes every descendant
  out of focus and pointer events. Disabled does the same natively, and it also
  keeps the frame's textareas out of the mission form's `FormData`. The dialog
  sits inside that form, so without it they would be submitted with the
  mission.
- **Device:** Phone is a 360px frame. Desktop is a browser-width frame with
  the tester page's own 800px column inside it. The preview opens on Phone
  unless the mission targets desktop only, and the toggle is always offered.
- **Unfinished steps.** A step failing `testStepSchema` is left out of the
  frame and named above it: "Step 2 isn't finished, so it's left out below.
  Testers only ever see complete steps." A tester can never see a half-written
  step, because publish refuses one. Passed through, it would make
  `TestCaseView` call the whole case unreadable, which is a fault message
  rather than the tester's view. This is the one place the preview departs
  from the prompt's §9, and it's why.

## §4 — Entry point for a published mission

Not built. The ask is a preview *before publishing*. The edit form of a live
mission has the same Preview button, which covers "why did reports come back
this way". A read-only route can follow if wanted.

## §5 — Empty and partial states

Nothing is tidied, with the one exception in §3:

- **No steps:** `TestCaseView` shows its existing "No steps yet — follow the
  brief above." `AuditLogSteps` with zero entries renders nothing, as it does
  on the tester page. No third empty state.
- **A step with an action but no expected result:** named above the frame and
  left out of it (§3), because testers never receive one.
- **An empty title, or no notes:** an empty heading and no notes block, as a
  tester would see them.

## §6 — Tests

`vitest` runs in `environment: "node"` and the repo has no jsdom or Testing
Library. Existing component tests (`designSteps.test.ts`) use
`renderToStaticMarkup`. These follow that pattern, so they assert on markup:

| Prompt asks | Test |
|---|---|
| Reflects an edit without a save | `TesterView` rendered from a snapshot shows that step's text, twice, as the tester page does. The button-reads-the-form wiring is manual QA §7.1. |
| `ui_design` gives Clear / Unclear / Couldn't tell; others give Pass / Fail / Blocked | Rendered per category through the panel. |
| No control focusable or clickable | `TesterView`'s markup is a single `<fieldset disabled inert>` wrapping everything. |
| No `localStorage` write | (a) `MissionPreview.tsx`, `MissionBrief.tsx`, `AuditLogSteps.tsx` and `TestCaseView.tsx` don't reference `localStorage` or import `AuditLogForm`. (b) The panel renders with a `localStorage` stub whose `setItem` throws. |
| Mobile previews at phone width | Phone renders `max-w-[360px]`; desktop doesn't. |
| Zero steps uses `TestCaseView`'s empty state | The markup contains "No steps yet — follow the brief above." exactly once and no other empty-state copy. |
| `access.test.mts` still passes | Unchanged, run by `npm test`. |

**What this can't prove:** static markup doesn't run effects, so test (b)
can't catch a future `useEffect` that writes storage. Test (a) is the guard
for that. Real focus behaviour under `inert` belongs to the browser and is
covered by manual check §7.3. Proving either in a test needs `jsdom` and
`@testing-library/react` as new dev dependencies. **I'm not adding them unless
you ask.**

## §7 — Manual, at 360px and desktop, both themes

1. Write a mission from scratch, press Preview, close it, edit, and press it
   again. The change shows, and nothing has saved.
2. Write "Check the thing works" and look at it beside the three buttons.
3. Tab inside the open preview: focus moves between Back to editing and the
   Phone / Desktop toggle, and never into the frame.
4. A `ui_design` mission shows "What you saw" on every step.
5. Save after previewing. The mission saves exactly what the editor holds,
   with no `entries.*` fields sent.

## §8 — Docs

- **`CLAUDE.md`:** the preview composes the tester's own components
  (`MissionBrief`, `TestCaseView`, `MissionChips`, `AuditLogSteps`) and must
  never fork them. `AuditLogSteps` is the shared piece; `AuditLogForm` is not
  for reuse, because it writes drafts and submits. Folder layout gains the two
  files.
- **`TownHall_Checklist (1).xlsx`:** QA rows for live update without saving,
  category-correct controls, no localStorage write, and the phone-width frame.

## Commits

1. `Share the tester's mission brief and audit-log heading`: extraction only.
2. `Add a tester preview button to the mission forms`: dialog, forms, pages.
3. `Test the mission preview`
4. `Document the mission preview`: spec, CLAUDE.md, checklist rows.

## Out of scope

Practice reports against your own mission, previewing the Explore card,
changes to what the tester page renders, and saving preview state.
