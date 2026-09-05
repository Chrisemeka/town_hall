# SPEC: Onboarding Polish and Mission-Card Cleanup

**Status:** Awaiting approval
**Branch:** `feat/onboarding-polish`
**Base branch:** `main` (with `chore/normalize-line-endings` merged — see Merge-order dependency)
**Depends on:** Nothing functionally. Ordering constraint against `feat/profile-editor` only.
**Blocks:** `feat/project-category` (PR 2), which branches off `main` with this merged.

## Summary

Four small, independent changes bundled because none justifies its own PR and none touches the
database:

1. Builder onboarding collects a timezone (testers already do).
2. The phone field auto-fills the dial code from the selected country.
3. A terminal loading state between onboarding and the dashboard, plus route-level `loading.tsx`
   skeletons for the three authenticated landing surfaces.
4. Mission **cards** stop rendering the task description. Mission **detail pages** keep it.

No migration. No new columns. No new dependencies.

## Why

**1.1** — `VerificationFlow.tsx` gates the timezone field behind `role === "tester"` with the comment
*"builders have no timezone-dependent surface yet."* Scheduled load-test windows will need a
builder's timezone on both sides, so the comment is about to become false. Collecting it now costs
one field on a form builders already fill in; collecting it later costs a second gate.

**1.2** — The phone helper currently says *"Include your country code — e.g. +234 801 234 5678."* We
ask the user to type something the form already knows, because they just picked their country from
the dropdown directly above it.

**1.3** — `onComplete()` runs `completeVerification(role)` inside `startTransition`, then
`router.push(result.redirectTo)`. `pending` covers the server action but goes false the moment it
resolves, leaving a visible dead gap where the user sits on the review step with nothing happening
while the destination route does its data fetching. There are currently **zero** `loading.tsx` files
in the app, so every server-rendered navigation has the same gap — onboarding is just where it is
most damaging, because it is the user's first impression of the product working.

**1.4** — Mission cards repeat the task description that the mission detail page shows in full. It
makes cards tall and uneven for no scanning benefit; title plus metadata is what a card is for.

## Non-goals

- **No re-verification of existing builders.** See Rollout. Builders already through the gate are
  not re-prompted, and `verification_completed_at` is never cleared by this PR.
- **No timezone on the profile editor.** `feat/profile-editor` already covers editing it in Settings.
  This PR only changes what onboarding *collects*.
- **No phone validation change.** `lib/phone.ts` stays UX-only; `phoneSchema` in
  `lib/validation/schemas.ts` remains the sole authority on whether a number is valid. The new
  helpers cannot make an invalid number pass.
- **No country combo box / search.** Country stays a plain `<select>`, per SPEC-profile-editor.
- **No global `loading.tsx`.** Not at `app/layout.tsx` level — it would fire on every navigation
  including cheap ones and make the app feel slower, not faster.
- **No skeleton library.** Skeletons are plain divs using existing Tailwind tokens.
- **No mission-card redesign.** Removing the description is a deletion, not a re-layout.
- **No change to mission detail pages, admin views, or `task_description` in the data model.**

## Merge-order dependency — decide before implementation

`feat/profile-editor` is 5 commits ahead of `main`, `main` has nothing it lacks, and the merge is a
clean fast-forward with zero conflicts. It is unmerged and last touched 2026-08-17.

**Both that branch and this PR modify `components/verification/VerificationFlow.tsx`**, in different
ways:

| | `main` today | `feat/profile-editor` |
|---|---|---|
| Skills UI | inline `SkillsStep`, imports `addSkill` / `removeSkill` / `suggestionsFor` from `@/lib/skills` | `<SkillsInput>` from `@/components/ui/SkillsInput` |

This PR edits `IdentityStep` and the `STEPS` record — different regions of the same file — so textual
conflict risk is low but not zero, and both branches also touch `lib/validation/schemas.ts`.

**Recommendation: fast-forward `feat/profile-editor` into `main` first**, then branch this PR off the
result. It is a zero-conflict merge today and gets strictly harder the longer it sits. If it merges
*after* this PR, the same reconciliation still has to happen, just with two diverged branches
instead of one.

If the merge is declined, this PR still works — it imports nothing from `feat/profile-editor` — but
`docs/specs/SPEC-profile-editor.md` should be marked abandoned rather than left claiming
"Ready to build".

## Data model changes

**None.** No migration in this PR.

`profiles.timezone` (text, nullable) already exists from the verification-gate migration and is
already written by `saveVerificationStep` / `completeVerification` through the `COLUMN_FOR` map in
`actions/verification.ts`. 1.1 changes only which role is *required* to fill it.

---

## 1.1 — Builder onboarding collects timezone

### Validation — `lib/validation/schemas.ts`

`builderStep1Schema` becomes `identityFields + timezoneField`, making it structurally identical to
`testerStep1Schema`. Define one and alias the other so they cannot drift:

```ts
/** Identity plus timezone. Both roles collect the same fields at step 1. */
export const testerStep1Schema = z.object({ ...identityFields, ...timezoneField })
/** Identical to tester step 1. Aliased, not re-declared, so the two cannot drift. */
export const builderStep1Schema = testerStep1Schema
```

`builderVerificationSchema = builderStep1Schema` already exists and needs no edit — it picks the
timezone requirement up automatically, which is what makes `completeVerification` reject a builder
with no timezone.

### UI — `components/verification/VerificationFlow.tsx`

- `STEPS.builder[0].fields` becomes `["fullName", "country", "phone", "timezone"]`. Without this the
  field renders but `slice()` never sends it, so `saveVerificationStep` would silently drop it and
  `completeVerification` would then reject the user for a field they had filled in.
- In `IdentityStep`, remove the `{role === "tester" && (...)}` wrapper around the timezone `<Field>`
  and delete the now-false comment above it.
- `IdentityStep` may no longer need its `role` prop. Check before removing it; leave it if another
  branch in that component still uses it.

### Auto-detect

The existing `useEffect` calling `Intl.DateTimeFormat().resolvedOptions().timeZone` now fires for
builders too. It already guards with `if (values.timezone) return`, so a saved value is never
overwritten on revisit. No code change needed — a test asserts the guard rather than trusting the
read.

### Server actions

`actions/verification.ts` needs **no change**. `COLUMN_FOR` already maps `timezone → timezone`, and
both actions validate through `verificationSchemaFor(role)` / `verificationStepSchemaFor(role)`,
which now carry the builder requirement. Acceptance criteria assert this rather than assume it.

---

## 1.2 — Auto-populate the phone dial code from the selected country

`libphonenumber-js` is already a dependency. No new package.

### `lib/phone.ts` — two new exported functions

```ts
/**
 * The "+234" for a country, or null when the country is unset, unknown, or has
 * no calling code in libphonenumber's metadata.
 *
 * The null case is real: COUNTRIES carries all 249 ISO 3166-1 codes, and
 * libphonenumber has no metadata for several of them (Bouvet Island, Heard &
 * McDonald, and friends). getCountryCallingCode() throws on those, so the
 * support check has to happen before the call, not around it.
 */
export function dialCodeFor(country: string): string | null

/** Whether `value` is nothing but `country`'s dial code, modulo whitespace. */
export function isBareDialCode(value: string, country: string): boolean
```

`dialCodeFor` guards with `isSupportedCountry` before calling `getCountryCallingCode`.
`isBareDialCode` compares `value.trim()` against `dialCodeFor(country)` and returns `false` for an
unknown country, so an unsupported ISO code degrades to "leave the field alone" rather than throwing.

### Behaviour — `onCountryChange` in `IdentityStep`

Evaluated against the **previous** country, which is still in `values.country` when the handler runs:

| Phone field before | Action |
|---|---|
| Empty / whitespace only | Set to `"<newDial> "` (trailing space) |
| Exactly the previous country's dial code | Replace with `"<newDial> "` |
| A real number the user typed | **Do not clobber.** Re-run `formatPhoneAsYouType(values.phone, code)` |
| Any of the above, new country unsupported | Leave the phone value untouched |

The third row is the one that matters: a user who types their number and then corrects the country
dropdown must not lose it.

Shared calling codes are handled by construction — US and CA are both `+1`, so switching between them
replaces `"+1 "` with `"+1 "`. No double prefix, because the branch *replaces* the bare dial code
rather than prepending to it.

### Helper text

Replace *"Include your country code — e.g. +234 801 234 5678."* with **"We've filled in your country
code."** The form no longer instructs the user to do something it does for them.

Keep the `placeholder` as-is: it is only visible when the field is empty, which now only happens
before a country is picked.

### Boundary

Both functions live in `lib/phone.ts`, not inline in the component, and are unit-tested.
`lib/phone.ts` already documents that it is UX-only and that the schema stays the authority on
validity — these two functions sit inside that boundary, and neither is referenced by any schema.

---

## 1.3 — Loading state between onboarding and the dashboard

Both halves are needed. (a) covers the gap while the destination loads; (b) covers what the
destination shows while it loads.

### a) Terminal navigating state in `VerificationFlow`

```ts
const [navigating, setNavigating] = useState(false)
```

Set `true` immediately before `router.push(result.redirectTo)` and **never set back to false** — the
component is being torn down, and clearing it would flash the review step back into view for a frame.

When `navigating` is true the card body renders a full-panel loading state *in place of* the form: a
voltage spinner centred, plus copy naming the destination — `"Setting up your builder dashboard…"` /
`"Setting up your tester dashboard…"`. The step indicator, both buttons and the form fields are not
rendered at all in this state, so there is nothing left to disable or click.

Per DESIGN.md §9 motion nudges once and stops — no infinite pulse on the copy. A spinner is the one
permitted rotation, because it communicates ongoing work rather than decorating.

### b) Route-level `loading.tsx`

Three files, one per destination `homeFor()` can return, plus the tester's personal surface:

- `app/(developer)/dashboard/loading.tsx`
- `app/(tester)/explore/loading.tsx`
- `app/(tester)/tester/loading.tsx`

Each is a **skeleton matching that route's real layout**, not a centred spinner. Verified container
shapes:

| Route | Container | Content to skeleton |
|---|---|---|
| `/dashboard` | `max-w-[1128px] mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-10` | Header block, then `grid grid-cols-1 md:grid-cols-2 gap-6` of 4 card skeletons |
| `/explore` | same container | Header block, filter-pill row + `w-full sm:w-[280px]` search, then the project grid |
| `/tester` | same container plus `flex flex-col gap-8` | Header, action row, then `grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start` |

Card skeletons use the real card treatment from DESIGN.md §5.3 — `bg-graphite`, `border border-iron`,
`rounded-[12px]`, `p-6` — with `bg-iron` blocks standing in for text lines at the real heights. All
spacing divisible by 4.

**DESIGN.md has no skeleton specification.** §8 covers empty states only, and a skeleton is not an
empty state — an empty state is a terminal answer ("Nothing here yet") while a skeleton is a
placeholder for content that is arriving. Deriving the treatment from §5.3 card geometry is a
deliberate choice, made because inventing a new visual language for loading would be the larger
departure. Flagging it rather than burying it: **if there is a house skeleton treatment not captured
in DESIGN.md, say so and this changes.**

Skeletons are decorative and must be hidden from assistive tech — `aria-hidden="true"` on the
skeleton tree, with a single visually-hidden live region announcing "Loading…", per DESIGN.md §10.

---

## 1.4 — Remove the description from mission cards

### Scope correction — what the codebase actually shows

The task named six files to check. A full grep of `task_description` across `components/`, `app/`,
`actions/` and `lib/` returns this:

| File | Renders | Verdict |
|---|---|---|
| `components/ProjectDetailTabs.tsx:146` | `mission.task_description` on the mission card | **Remove.** The one real target. |
| `components/InlineEditMission.tsx:88` | `mission.task_description` | **Dead code** — see below |
| `components/BrowseMissions.tsx` | — | No description rendered. Nothing to do. |
| `components/MissionListPaged.tsx` | — | No description rendered. Nothing to do. |
| `components/tester/MissionStrip.tsx` | — | No description rendered. Nothing to do. |
| `app/(tester)/explore/missions/page.tsx` | — | No description rendered. Nothing to do. |
| `app/(developer)/dashboard/missions/page.tsx` | — | No description rendered. Nothing to do. |
| `components/ExploreGrid.tsx:178` | `project.description` | Project card, not a mission card. **Out of scope** (PR 2 changes it for a different reason). |
| `app/(tester)/mission/[id]/page.tsx:93` | `mission.task_description` | Detail page. **Keep.** |
| `app/(developer)/dashboard/[projectId]/mission/[missionId]/page.tsx:108` | `mission.task_description` | Detail page. **Keep.** |
| `app/(admin)/admin/missions/[id]/page.tsx:169` | `mission.task_description` | Admin. **Keep.** |
| `AddMissionForm` / `EditMissionForm` / `actions/missions.ts` / `schemas.ts` | form field + write path | Untouched. |

**So 1.4 is a one-line deletion in `ProjectDetailTabs.tsx`, not a six-file sweep.** The other five
files listed never rendered a mission description.

`components/InlineEditMission.tsx` has **no importers anywhere in the repo** and styles itself with
tokens that do not exist in this design system (`text-on-surface`, `bg-surface-variant`,
`border-outline-variant`) — an orphan from a previous design language. It is not a mission card and
is not reachable. **Recommend deleting the file** as part of this PR, but flagging rather than doing
it silently: it is a deletion the task did not ask for, and if it is being kept deliberately for a
planned surface, say so and it stays.

### After removal

`ProjectDetailTabs` mission cards keep the voltage watermark number, title, status badge, feedback
count and the "Open →" link. Against DESIGN.md §5.3's Mission Card sketch that is everything except
the excerpt line, so the card does not become thin — no compensating metadata is needed, and none is
added. `task_description` stays on the `Mission` type and in the page's `select`: the feedback tab in
the same component reads other mission fields and the query is shared.

*(If on review the card does look thin at desktop width, the fallback is the created date — already
in the query. Not adding it speculatively.)*

---

## Server actions

**No server action changes in this PR.** 1.1 works entirely through the schema that
`actions/verification.ts` already calls; 1.2–1.4 are client and presentational.

Acceptance criteria assert the no-change claim — that a builder completion is rejected without a
timezone — rather than assuming it.

## Tests

Following TEST.md §1: auth rejection, happy path, error surfacing.

**`actions/__tests__/verification.test.ts`** (extend; mocks `requireAccountForVerification` and
`createAdminClient` through the existing `fakeAdmin` harness)

| ID | Case | Expected |
|---|---|---|
| VER-B1 | `completeVerification("builder")` with `timezone: null` on the profile | `{ success: false }`, `fieldErrors.timezone` set, `verification_completed_at` **not** written |
| VER-B2 | `completeVerification("builder")` with a valid timezone | `{ success: true }`, `verification_completed_at` written, redirect `/dashboard` |
| VER-B3 | `saveVerificationStep("builder", { timezone })` | timezone reaches the `profiles` update under the explicit column list |
| VER-B4 | `builderStep1Schema` and `testerStep1Schema` are the same object | alias holds; guards against re-declaration drift |

**`lib/__tests__/phone.test.ts`** (extend; already exists with a `keydown()` helper)

| ID | Case | Expected |
|---|---|---|
| PH-01 | `dialCodeFor("NG")` | `"+234"` |
| PH-02 | `dialCodeFor("")` and an unsupported ISO code (e.g. `"BV"`) | `null`, does not throw |
| PH-03 | `isBareDialCode("+234", "NG")` and `"+234 "` (trailing space) | `true` |
| PH-04 | `isBareDialCode("+234 801 234 5678", "NG")` | `false` |
| PH-05 | `isBareDialCode("+1", "US")` and the same value against `"CA"` | `true` for both — shared calling code |
| PH-06 | Empty field, country picked | phone becomes `"+234 "` |
| PH-07 | Bare dial code, country changed | replaced not prepended — `"+1 "`, never `"+1+1 "` |
| PH-08 | Real number, country changed | digits preserved; only grouping changes |

**`scripts/vocabulary.test.mts`** — no new vocabulary in this PR, no change.

**Gates:** `npx tsc --noEmit` clean, `npm run lint` with no new `as any`, `npm run build` clean,
`npm test` green.

Not unit-tested, covered by the manual plan instead: the `loading.tsx` skeletons and the `navigating`
panel are presentational, and a snapshot test of them would assert the markup against itself.

## Rollout

**No migration, so no rollout ordering against the database.** Ship the branch.

**Existing builders are not re-prompted, and this is correct.** Every builder verified before this
ships has `timezone = NULL` on `profiles` but `verification_completed_at` set on their `accounts`
row. The gate in `middleware.ts` and `requireAccount()` reads *only* `verification_completed_at` — it
does not re-run `verificationSchemaFor(role)` against the stored profile. Those builders stay through
the gate and never see the new field.

That is intended, not an oversight:

- Re-prompting would mean clearing `verification_completed_at` for every existing builder, locking
  ~36 live accounts out of their dashboards until they re-complete a flow they already completed.
- The data is not needed yet. Nothing in the product reads `profiles.timezone` for a builder today;
  the field is being collected ahead of scheduled load-test windows.
- When a builder-facing feature *does* hard-require a timezone, it prompts then, with context for why
  it is being asked — a better prompt than a re-verification wall with no explanation.

**Consequence to accept:** for some period `profiles.timezone` is populated for all new builders and
null for all pre-existing ones. Any builder-facing feature reading it must handle null. The column is
already nullable, so this is a code-review note, not a migration.

**Rollback:** revert the branch. Nothing written by this PR needs unwinding — a timezone collected
from a new builder stays valid and useful whether or not the feature is reverted.

## Acceptance criteria

1. `builderStep1Schema` is an alias of `testerStep1Schema`, defined once.
2. `STEPS.builder[0].fields` includes `"timezone"`.
3. The timezone `<Field>` renders for both roles; the `role === "tester" &&` wrapper and its comment
   are gone.
4. `completeVerification("builder")` rejects a profile with no timezone and does not set
   `verification_completed_at`.
5. Browser timezone auto-detect fires for builders and does not overwrite a saved value on revisit.
6. `dialCodeFor` and `isBareDialCode` are exported from `lib/phone.ts` and unit-tested.
7. Selecting a country with an empty phone field fills `"+<dial> "`.
8. Changing country when the field holds only the old dial code replaces it with no double prefix,
   including for shared calling codes (US↔CA).
9. Changing country when the field holds a real number preserves every digit.
10. An unsupported ISO country code leaves the phone field untouched and throws nothing.
11. Phone helper text no longer instructs the user to type a country code.
12. `navigating` is set before `router.push` and never cleared; the review step is not visible after it.
13. The navigating panel names the destination role.
14. Three `loading.tsx` files exist at the paths listed and match their routes' container widths and
    grid shapes.
15. No `loading.tsx` at `app/layout.tsx` level.
16. Skeletons are `aria-hidden` with a single live region announcing loading.
17. `ProjectDetailTabs` mission cards no longer render `task_description`.
18. Both mission detail pages, and the admin mission page, still render it.
19. `ExploreGrid`'s `project.description` is unchanged.
20. `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test` all pass.

## Manual test plan

**Builder onboarding (new account):**
- Reach `/verify/builder`. Confirm the Timezone field is present and pre-filled from the browser.
- Clear the timezone, click Continue. Confirm an inline error and no advance.
- Pick a country with the phone field empty. Confirm the dial code appears with a trailing space.
- Type a full number, then change the country. Confirm the digits survive.
- Change the country again without typing. Confirm the dial code swaps cleanly.
- Complete verification. Confirm the loading panel appears, names the builder dashboard, and that the
  review step does not flash back before `/dashboard` paints.
- Reload `/verify/builder` mid-flow. Confirm the saved timezone is not overwritten by auto-detect.

**Tester onboarding:** walk the same flow and confirm nothing regressed — timezone still collected,
skills step unchanged.

**Existing verified builder** (`nforshifu234.dev@gmail.com` — verified, `timezone` currently null):
- Sign in. Confirm you land on `/dashboard` and are **not** sent to `/verify/builder`.
- Confirm `accounts.verification_completed_at` is unchanged after the deploy.

**Loading skeletons:** throttle the network, navigate to `/dashboard`, `/explore`, `/tester`. Confirm
each skeleton matches its route's real layout rather than shifting on paint.

**Mission cards:** open a project detail page with several missions. Confirm cards show number,
title, badge, feedback count and Open link, and no description. Open a mission and confirm the
description is there. Check the same mission in `/admin/missions/<id>`.

## Reference

- Codebase patterns: `CLAUDE.md`
- Components, buttons, inputs, cards, badges: `DESIGN.md` §5; empty states §8; motion §9; a11y §10
- Test pattern and gates: `TEST.md` §1
- Prior specs for format: `docs/specs/SPEC-verification-gate.md`, `docs/specs/SPEC-profile-editor.md`
