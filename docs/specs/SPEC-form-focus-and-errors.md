# SPEC: Form Error Focus and Focus Indicators

**Status:** Awaiting approval
**Branch:** `feat/form-focus-and-errors`
**Base branch:** `main`
**Migration:** none
**Depends on:** nothing
**Blocks:** `feat/mission-notes-and-audit-fields` — that PR puts a form field behind a disclosure and
relies on the `reveal` callback specified here.

## Summary

Two unticked items on the `DESIGN.md` §10 checklist, fixed together because they are the same
failure from two directions: **the product never tells a keyboard or screen-reader user where they
are.**

1. Submitting an invalid form leaves the user looking at the wrong part of the page. A shared hook
   moves them to the first field in error — first in *document* order — and the errors themselves
   become programmatically associated with their inputs (`aria-invalid`, `aria-describedby`).
2. The builder/tester switch in the sidebar has no `:focus-visible` style at all.

No migration, no server change, no schema change. Every edit is in `components/`, plus one new hook
and one new shared component.

## Why

A required field near the top highlights red on submit; the submit button is at the bottom of a form
that is several screens tall. Nothing appears to happen. There is currently **no `scrollIntoView` and
no `.focus()` call anywhere in the codebase** — this behaviour has never existed, so it gets built
once and wired everywhere rather than solved per form.

The `aria` half rides along because it is the same three lines in the same six places, and because
the error `<p>` elements are currently orphans: a screen-reader user gets a red message they are
never told about.

## Non-goals

- **No form library.** No react-hook-form, no formik. Every form here already owns its own state and
  its own Zod parse; the hook attaches to what they produce.
- **No validation-on-blur.** When errors appear is unchanged; only what happens after they appear.
- **No change to any error message copy** except the audit log's three (below), which change because
  they name nothing.
- **No `aria-live` regions.** DESIGN.md §10 asks for them on the feedback-form unlock and on upload
  errors. Both are real and both are separate work — associating an error with its input is not the
  same job as announcing it, and doing half of an `aria-live` implementation is worse than none.
- **No focus management on route change or modal open.** Out of scope.

## What the code actually looks like, where it differs from the brief

Five findings from reading the tree. Three of them change the plan.

### 1. `InlineEditProject.tsx` and `InlineEditMission.tsx` do not exist on `main`

Both were deleted as unused — `53a92a3 chore(components): delete unused InlineEditProject` and
`21200cd chore(components): delete unused InlineEditMission`. They survive on a dozen stale branches,
which is where the brief's line numbers come from. **Dropped from the wiring list.** Nothing to do.

### 2. The audit log's submit button is disabled, so all three of its error messages are dead code

`AuditLogForm.tsx:415` is `disabled={!canSubmit}`, and `canSubmit` (line 199) already requires
screenshots, a complete draft, and — on a legacy mission — a comment. Every guard inside
`handleSubmit` is therefore unreachable: the three messages the brief calls "blanket" are never
rendered at all.

**So the real defect is worse than reported.** A tester with step 7 incomplete does not get an
unhelpful sentence. They get a dead button, no message, and no indication that anything is wrong —
which is exactly the state DESIGN.md §10's last checklist item exists to forbid.

**This needs a decision (see Open questions).** The proposal: the submit button stops being disabled
by completeness and is disabled only while a submission is in flight. `handleSubmit` becomes the
validator, and the click is what carries the tester to the missing step. There is no way to satisfy
1.1 on this form while the button refuses the click.

### 3. The audit-log step fields have no `name` and no `id`

`AuditLogSteps.tsx`'s `Field` renders a bare `<textarea>` inside a `<label>` — implicitly labelled,
but with nothing for the hook to resolve. They gain names.

### 4. `SettingsForm` ids do not match its schema keys

`id="display-name"` against `errors.full_name`. One field, one file — renamed to `full_name` rather
than teaching the hook a translation table. `VerificationFlow` already matches (`fullName`,
`country`, `phone`, `timezone`) and needs no rename.

### 5. Three files in the entire repo use `focus-visible`

`components/ui/Button.tsx`, `ui/Input.tsx`, `ui/Textarea.tsx`. Everything hand-rolled — every
`NavItem`, the sign-out button, `ReplayTourButton`, the audit-log status buttons, the screenshot drop
zone, every submit button written as a raw `<button>` — has none. See Open questions.

## The hook — `lib/hooks/useFocusFirstError.ts`

Alongside `useUnsavedChangesWarning`, `useHydrated`, `useMediaQuery`.

```ts
export function useFocusFirstError(options?: {
  /** Scope element lookups to one form. Defaults to the document. */
  root?: RefObject<HTMLElement | null>
  /** Reveal a collapsed section holding `field`, then the hook retries. */
  reveal?: (field: string) => void
  /** Scrolled to when no errored field resolves to an element. */
  fallback?: RefObject<HTMLElement | null>
}): (fieldErrors: Record<string, unknown>) => void
```

It returns a stable callback rather than watching a value. That is the direct answer to *re-fire on
repeat submits*: the merged `fieldErrors` object in these forms is rebuilt by a spread on every
render, so an effect keyed on its identity fires constantly, and one keyed on its contents misses the
case the brief calls out — two identical submits must move the user twice. The trigger is the submit,
so the caller owns the trigger.

Callers invoke it in two places, because the repo has two error paths and several forms have both:

| Path | Where the call goes |
|---|---|
| Client Zod parse fails in `onSubmit` | synchronously, right after `setClientErrors(...)` |
| Server action returns `fieldErrors` | in a `useEffect` on the `useActionState` state object, whose identity changes on every action return |

### What it does, in order

1. Resolve every key of `fieldErrors` that has a non-empty value to an element:
   `document.getElementsByName(key)[0]`, then `document.getElementById(key)`, filtered through
   `root.contains(el)` when a root is given. **Never a CSS selector** — audit-log field names contain
   dots (`entries.3.actual_result`), which `querySelector` would parse as a class.
2. Pick the element that appears **earliest in the document**, via `compareDocumentPosition`. Not
   first in object order: `fieldErrors` key order comes from the Zod schema, and on
   `AddMissionForm` the schema order (`title`, `task_description`, `category`, …) already disagrees
   with the rendered order (`title`, then the whole `TestCaseEditor`, then `task_description`).
   Object order would send a builder past their first mistake.
3. Scroll, then focus: `el.scrollIntoView({ behavior, block: "center" })` then
   `el.focus({ preventScroll: true })`. `preventScroll` stops the browser's own focus scroll racing
   the smooth one and parking the field under the sticky 56px top nav.
4. `behavior` is `"auto"` when `window.matchMedia("(prefers-reduced-motion: reduce)").matches`,
   `"smooth"` otherwise. Never hard-coded.
5. If nothing resolved and `reveal` was given, call `reveal(firstKey)` and retry inside one
   `requestAnimationFrame` — the section has to be in the DOM before it can be focused, and one frame
   is enough for a synchronous `setState` from an event handler to have committed. `flushSync` would
   also work and is rejected as the heavier tool for a path that runs once per failed submit.
6. If it still cannot resolve, scroll to `fallback` — the form's error summary — rather than doing
   nothing silently.

### Two pure exports, for the tests

`vitest` runs with `environment: "node"` and the repo has no jsdom, no happy-dom and no
`@testing-library` (`vitest.config.mts`). So the two decisions worth testing are lifted out of the
DOM plumbing:

```ts
/** Earliest in document order. Anything with compareDocumentPosition works. */
export function firstInDocumentOrder<T extends Positioned>(nodes: T[]): T | null

/** The matchMedia read, guarded for a missing window. */
export function prefersReducedMotion(): boolean
```

`firstInDocumentOrder` is testable against stub objects implementing `compareDocumentPosition`, and
`prefersReducedMotion` against a stubbed `globalThis.window`. Neither needs a browser. See Open
questions for what this does not cover.

## `components/ui/FieldError.tsx` — one copy, not six

Six byte-identical definitions today: `AddMissionForm`, `EditMissionForm`, `CreateProjectForm`,
`EditProjectForm`, `admin/BroadcastForm`, `missions/TestCaseEditor` (the last drops `mt-1`; the
shared version keeps `mt-1` and `TestCaseEditor` passes `className` to opt out).

```tsx
export const errorId = (field: string) => `${field}-error`

export function FieldError({ errors, field, className }: {
  errors?: string[]
  field: string
  className?: string
}) {
  if (!errors?.length) return null
  return <p id={errorId(field)} className={cn("font-mono text-[12px] text-ember mt-1", className)}>{errors[0]}</p>
}
```

`field` becomes required so the id convention has exactly one owner. Every input in error then gets:

```tsx
aria-invalid={!!fieldErrors.name?.length || undefined}
aria-describedby={fieldErrors.name?.length ? errorId("name") : undefined}
```

`|| undefined` rather than `false`: `aria-invalid="false"` is a claim, and every unerrored input in
the product making it is noise.

`components/ui/Field.tsx` (used by `SettingsForm` and `VerificationFlow`) renders its own error `<p>`
and gains the same `id={errorId(htmlFor)}`, so both spellings of "field chrome" share one convention.

## Wiring, per form

| Form | Error paths | Notes |
|---|---|---|
| `CreateProjectForm` | client + server | `name`/`id` already paired on every input |
| `EditProjectForm` | client + server | same |
| `AddMissionForm` | client + server | path-keyed client errors (`test_steps.2.action`) already resolve against `TestCaseEditor` — see below |
| `EditMissionForm` | client + server | same |
| `admin/BroadcastForm` | client + server | `<form onSubmit>` with no `useActionState`; both calls sit in the one handler |
| `SettingsForm` | server only | no `<form>` element; call goes in the save handler. `display-name` → `full_name` |
| `verification/VerificationFlow` | client + server | already jumps to the offending *step* (`setStep(broken)`); the hook's `reveal` is wired to that so it jumps to the offending *field* |
| `tester/AuditLogForm` | client + server | see below |
| `missions/TestCaseEditor` | receives errors as a prop | needs `name` on each step row's inputs so `test_steps.2.action` resolves |

`ProjectDetailTabs` and the two `InlineEdit*` files are not forms and are not touched.

## The audit log

### `firstIncompleteEntry` — one definition of "complete"

`draftIsComplete` (`AuditLogSteps.tsx:41`) is rewritten in terms of a new export, so there is no
second definition to drift:

```ts
export type Incomplete = { index: number; field: keyof DraftEntry | "status" }
export function firstIncompleteEntry(entries: DraftEntry[]): Incomplete | null
export const draftIsComplete = (entries: DraftEntry[]) => firstIncompleteEntry(entries) === null
```

It reports the **first missing field on the first incomplete entry**, in rendered order (status →
actual → expected → issue → reproduce), which is what the hook needs to focus.

### What `handleSubmit` does instead of three blanket messages

| Now | After |
|---|---|
| `"At least one screenshot is required."` (unreachable) | same text, and scrolls to the drop zone |
| `"Answer every step before submitting."` (unreachable) | `"Step 4 needs an answer."`, scrolls to step 4's card, focuses its first empty field, marks the card in error |
| `"Tell the builder what you found."` (unreachable) | same text, focuses the comment box |

Step numbers are 1-based to match the `Step 04` label the card already renders.

### Field identity

`AuditLogSteps` `Field` gains `name={`entries.${index}.${field}`}` and the same as `id`. The status
button group is not an input; the **first** status button in each group takes
`id={`entries.${index}.status`}`. The hook needs no special case for it — a `<button>` is focusable
and `focus()` exists on it. The one requirement the hook does impose is that the element it lands on
is focusable, which `<button>` is natively.

### The errored card

`AuditLogSteps` gains `errorIndex?: number`. That card's border goes `border-ember`, and the message
above the field names it. Colour is never the only signal (DESIGN.md §5.4) — the submit-level message
`"Step 4 needs an answer."` is the label.

## The focus indicator — `Sidebar.tsx`

DESIGN.md §10 specifies `outline: 2px solid #E8FF47; outline-offset: 2px`. `Button.tsx:19` already
implements that as a ring, so the sidebar matches `Button.tsx` rather than inventing a second
spelling:

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-voltage
focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian
```

Applied to:

- the `Switch to {other}` submit button (`Sidebar.tsx:126`) — the ask
- `NavItem` (`Sidebar.tsx:58`) — because the slot at line 124 renders the switch button **or** an
  `Add {other} account` NavItem depending on whether the user holds both accounts. A ring that
  appears and disappears with account state is worse than one that is simply absent.

Nothing else in this PR. The rest of the sidebar is in Open questions.

## Tests

`scripts/focus.test.mts`, added to the `npm test` chain beside the other four, plus additions to the
vitest suite where a schema is involved.

| ID | Case | Expected |
|---|---|---|
| FOC-01 | `firstInDocumentOrder` with B before A in the array, A earlier in the document | returns A |
| FOC-02 | `firstInDocumentOrder([])` | `null` |
| FOC-03 | `firstInDocumentOrder` with one node | that node |
| FOC-04 | `prefersReducedMotion()` with `matches: true` | `true` → caller uses `behavior: "auto"` |
| FOC-05 | `prefersReducedMotion()` with `matches: false` | `false` |
| FOC-06 | `prefersReducedMotion()` with no `window` | `false`, no throw |
| FOC-07 | `errorId("task_description")` | `"task_description-error"` |
| AUD-18 | `firstIncompleteEntry` on a complete 3-step draft | `null` |
| AUD-19 | step 2 has no status | `{ index: 1, field: "status" }` |
| AUD-20 | step 2 is `fail` with no `issue_summary` | `{ index: 1, field: "issue_summary" }` |
| AUD-21 | steps 1 and 3 both incomplete | reports step 1 |
| AUD-22 | `draftIsComplete` agrees with `firstIncompleteEntry` across the same fixtures | one definition, no drift |

Manual keyboard pass (recorded in the PR, not automated): tab the sidebar and every form in the
wiring table, confirming the ring is visible against `obsidian` (`#0E0E10`) and `graphite`
(`#1A1A1F`).

## Commits

Per `CLAUDE.md` — no migration, so the chain starts at shared logic.

1. `feat(forms): add the first-error focus hook`
2. `refactor(ui): extract one FieldError and give errors stable ids`
3. `feat(forms): carry the user to the first field in error` — the seven ordinary forms
4. `feat(tester): name the step that is missing an answer` — audit log
5. `fix(sidebar): give the account switch a focus ring`
6. `test(forms): cover document-order resolution and step completeness`
7. `docs: record the error-focus pattern` — `DESIGN.md` §5, checklist tick, `CLAUDE.md`

## Acceptance criteria

- Submitting any form in the wiring table with a required field empty scrolls that field to the
  centre of the viewport and focuses it, whether the error came from the client parse or the server.
- Submitting twice without fixing anything moves the user twice.
- With `prefers-reduced-motion: reduce` set, no smooth scrolling occurs anywhere.
- Every visible error `<p>` has an `id`, and its input carries `aria-invalid` and `aria-describedby`.
- Exactly one `FieldError` definition exists in the repo.
- The audit log names the incomplete step by number and focuses its first empty field.
- Tabbing to the sidebar account switch shows a 2px voltage ring, in both the "switch" and the "add
  account" variants of that slot.
- `npx tsc --noEmit` clean · `npm run lint` with no new `as any` · `npm run build` clean ·
  `npm test` green.

## Manual test plan

1. `/dashboard/new` — submit empty. Lands on Project Name, page scrolled to it.
2. `/dashboard/<id>/missions/new` — fill the title, leave a test step's action empty, submit. Lands on
   the step's action field, not on `task_description` below it. (This is the document-order case.)
3. Same form, submit with only the title filled. Lands on the *first* error in visual order.
4. `/settings` — clear the display name, save. Lands on the name field. Server-error path.
5. Verification flow — force a server field error on an earlier step. Lands on the step, then the field.
6. A mission with a 10-step test case: answer 1–3 and 5–10, leave 4 blank, submit. Message reads
   `Step 4 needs an answer.`, step 4 is scrolled to, its status buttons are focused, its card is
   ember-bordered.
7. Same form with no screenshots: message appears and the drop zone scrolls into view.
8. OS reduced-motion on: repeat 1 and 6, confirm the jump is instant.
9. Keyboard only, no mouse: tab from the top nav into the sidebar. Ring visible on every stop that
   this PR touches.
10. VoiceOver/NVDA on `/dashboard/new`: submit empty, confirm the error text is announced with the
    field rather than sitting silent.

## Open questions — answer before implementation starts

1. **The audit-log submit button.** Enabling it (so the click can explain itself) is the only way
   this form can carry a tester anywhere. Confirmed?
2. **The rest of the sidebar.** `NavItem` and the switch are in scope. Also missing focus styles, and
   *not* currently in scope: the sign-out button (`Sidebar.tsx:157`), `ReplayTourButton`, the mobile
   close control, and — beyond the sidebar — the audit-log status buttons, the screenshot drop zone,
   and every raw `<button>` submit in the forms. Three options: leave them (ship the ask), add them
   to this PR (roughly 8 more one-line class additions, no new risk), or file them as their own PR.
   My recommendation is **add them to this PR** — a focus ring on one sidebar control implies the
   others are not focusable, which is a worse lie than uniform absence.
3. **DOM-level tests.** The hook's actual scroll-and-focus behaviour is not covered by FOC-01…07,
   which test its two decisions in isolation. Covering the real thing needs `jsdom` +
   `@testing-library/react` — two devDependencies and a per-file `@vitest-environment` docblock, in a
   repo that has deliberately stayed on `environment: "node"`. Add them, or accept the pure-function
   tests plus the manual pass?

## Reference

- `DESIGN.md` §5.2 (form inputs, error state), §10 (accessibility checklist, `:focus-visible`)
- `TEST.md` §1 (server-action test pattern — nothing in this PR touches a server action)
- `CLAUDE.md` — commit granularity, "match existing components before inventing new ones"
- `components/ui/Button.tsx:19` — the focus-ring spelling this PR copies
- `lib/hooks/useUnsavedChangesWarning.ts` — the hook this one sits beside
