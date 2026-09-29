# SPEC: Bug Fix Round 1

**Status:** Built
**Branch:** `fix/account-switch-choose-account-phone`
**Base:** `main`
**Migration:** none
**Risk:** low, except §3.2, which changes what the verification form and the
profile editor accept

## Summary

Three bugs found by watching someone use the app on an Android phone. One PR,
three commits, one per bug. Two of them turned out to have a second cause
underneath the one that was reported.

1. Settings → Account on a **tester** account offers "Switch to tester account".
2. On `/choose-account`, "Create this account" looks dead. There's no pending
   state, and every first creation takes two round trips.
3. The phone error always shows a Nigerian example, and the phone number is
   never checked against the selected country.

## Non-goals

- Allowance enforcement, the cohort flag, rate limiting, shadow metering.
- Loosening `.isValid()` to `.isPossible()`. The validator is correct: the
  reported `+267 801234567809` has 12 national digits, and Botswana uses 7–8.
- A DOM test environment. The repo has none (`vitest` runs `node`). Where a
  test needs to see UI behaviour, the decision is moved into a pure function
  and that function gets the test, the same way `lib/settingsTabs.ts` and
  `lib/phone.ts` are tested.

---

## §1 — The account switch is builder-shaped

### 1.1 — Cause

`AccountControl` takes only `hasTesterAccount: boolean` and hard-codes
"tester" in the heading, both copy blocks, the button label and the
`switchAccount("tester")` call. It was lifted out of the builder sidebar, where
"the other account" could only mean tester.

### 1.2 — Fix

- The Settings page calls `getActiveAccount()` from `lib/auth.ts`, which already
  intersects the `th_account` cookie with the real `accounts` rows. **The raw
  cookie is never read.** It passes `active: AccountType` and `types:
  AccountType[]` down through `SettingsClient` → `AccountPanel` →
  `AccountControl`.
- `AccountControl({ active, holdsOther })` gets `other = active === "builder" ?
  "tester" : "builder"`. It uses that for the heading, the label and the switch
  call.
- The copy comes from a pure `accountSwitchCopy(active, holdsOther)` in a new
  `lib/accountSwitch.ts`. It returns `{ heading, body, label }`, so both
  directions can be tested without a DOM.
- If `getActiveAccount()` returns `active: null` (signed in, no account yet),
  the page redirects to `/choose-account`. Middleware already lets `/settings`
  through for that user, so without this redirect the page would have no role
  to write the copy from.

### 1.3 — Copy, both directions

| Active | Holds other | Heading | Body | Button |
|---|---|---|---|---|
| builder | no | Tester account | *unchanged:* "Testing someone else's product is how you earn reports on your own. You'll complete a short tester profile first — a few fields and your skills." | Add tester account |
| tester | no | Builder account | "Put something you've built in front of other testers. You add a project, write a short test case — one action and what should happen, per step — and get back a step-by-step report from each tester. You'll confirm your details first; it's one short step." | Add builder account |
| either | yes | {Other} account | "You hold both. They are separate accounts with their own dashboards and their own history — switching changes which one you are using, not what your profile says." | Switch to {other} account |

The tester-side sentence is taken from `/guides/builder` §1 and §3 (a project,
a test case of action + expected result, the step-by-step report). It is not
the builder sentence with the nouns swapped. "One short step" is accurate:
builder verification is a single step (`builderVerificationSchema =
builderStep1Schema`), while the tester one also asks for skills.

The "you hold both" paragraph reads correctly from either side. It names no
role, and "what your profile says" is true in both directions because
`profiles` is shared. It stays as it is.

### 1.4 — Tab set (§1.5 of the brief): what I found

| Tab | Role-correct on a tester account? |
|---|---|
| Profile | Yes. Per-person. |
| Account | Wrong until §1.2 lands. |
| Activity | Yes. `GiveAndTake` is per-person. It has a stale line, though: "The control for that is in Profile, above". The control moved to the Account tab in `feat/settings-tabs`. Fixed to "…in the Account tab." |
| **Plan** | **No.** `PlanSection` reads `plan_id` from the **builder** accounts row, and every line of the tier content is builder-side ("5 tester reports a month", "Up to 5 testers on a mission"). A tester account has no plan. A tester-only person currently sees "Your plan: Community" for a thing they cannot have. |

**Fix:** `SETTINGS_TABS` stays the full list. A pure `tabsFor(active)` in
`lib/settingsTabs.ts` drops `plan` for `tester`. `tabFromParam(value, tabs)`
resolves against the visible set, so `/settings?tab=plan` on a tester account
opens Profile instead of a hidden tab. `nextTabIndex` takes the length of the
visible list, so arrow keys never land on a tab that isn't rendered.
`SettingsTabs` renders from the passed list.

A builder who also holds a tester account and is acting as the tester doesn't
see Plan. That's deliberate: Settings describes the account you are acting as,
and the switch is one tap away.

### 1.5 — Tests

- `accountSwitchCopy`: the label for each active role, with the other role held
  and not held. The builder-side add body is asserted verbatim, so the good
  sentence can't drift.
- `tabsFor("tester")` has no `plan`, and `tabsFor("builder")` has all four.
  `tabFromParam("plan", tabsFor("tester"))` resolves to `profile`. Arrow-key
  wrap works over three tabs.
- `scripts/access.test.mts` is unchanged and still passes.

---

## §2 — "Create this account" feels dead

### 2.1 — Fix A: one pending state across both cards

A new client component, `components/setup/RoleCards.tsx`, renders both forms.
It holds `pendingRole: AccountType | null`, which each form's `onSubmit` sets.
The tapped card shows "Creating…" (or "Switching…" when the role is already
held). **Both** buttons get `disabled`, with `aria-busy` on the tapped one.

- It keeps `<form action={serverAction}>`, so with JS off the page still posts.
- `useFormStatus()` was rejected because it only sees its own form, so the
  other card would stay live.
- `onSubmit` fires before the action and doesn't call `preventDefault`, so
  React still runs the action. The disabled state then stops a second tap
  within the same submit.
- The server page still decides which action each card gets. It passes the
  bound actions and the `alreadyHeld` flag in as props, so the client
  component never chooses between create and switch. `ROLES` content moves with
  the cards. The icons are components and can't cross the server/client
  boundary, so `ROLES` moves into the client file.
- No reset on failure, as built. A throwing action lands on the error
  boundary, which replaces the subtree, and a success redirects away, so the
  locked state never outlives the submit.

The label logic goes in a pure `roleCardState(type, alreadyHeld, pendingRole)`
that returns `{ label, disabled, busy }`. That is what gets tested.

Disabling here is correct under CLAUDE.md. The rule is against disabling to say
"not finished". This disables *while a submit is in flight*.

### 2.2 — Fix B: land where they will end up

`createAccount` and `switchAccount` both `redirect(homeFor(type))`. An
unverified account is then bounced by middleware to `/verify/[role]`, which is
a second round trip. `switchAccount` has the same bug when you switch to a held
role you never finished verifying.

`lib/access.ts` has `homeFor()` and `verifyPathFor()` but nothing that combines
them. The combination is currently written inline in `middleware.ts` (and
mirrored in the test's `settlesAt`). The fix adds it once, in `lib/access.ts`:

```ts
/** Where an account belongs right now: its home, or its gate if still closed. */
export function landingFor(account: AccountType, verified: boolean): string {
  return verified ? homeFor(account) : verifyPathFor(account)
}
```

Both actions read the account's `verification_completed_at` after the upsert,
using the existing `accountRowsFor`, exported from `lib/auth.ts`. They then
`redirect(landingFor(type, verified))`. Middleware's inline branch is left
alone. It also has to compare against the current path, and changing it isn't
needed to fix this.

`app/verify/[role]/loading.tsx` is added: a `SetupShell`-shaped skeleton, so
the destination paints right away.

### 2.3 — Tests

- `roleCardState`: nothing pending means both are enabled with their idle
  labels. Pending builder means both are disabled and builder reads
  "Creating…". Pending on a held role reads "Switching…".
- `createAccount` for a new, unverified account redirects to `/verify/builder`
  (and `/verify/tester`), not to the role's home.
- `createAccount` for an already-held, verified type redirects home. The upsert
  still uses `ignoreDuplicates`, so it stays idempotent.
- `switchAccount` to an unverified held account lands on its verify path.
- `landingFor` is added to `scripts/access.test.mts` and checked against
  `settlesAt` for every combination of account and verified.

---

## §3 — Phone validation

### 3.1 — The country-specific hint

`phoneExampleFor(country)` in `lib/phoneExample.ts` returns
`"+267 71 123 456"` from `getExampleNumber(country, examples)`, or `null`
when `isSupportedCountry` is false or no example exists. `phoneHintFor()`
builds the helper text from it. `phoneErrorFor()` appends the example to the
phone error, because `Field` shows an error *instead of* its helper, and
without this the example would vanish at exactly the moment it's needed. The null case covers
BV, HM and AQ, the same guard as `dialCodeFor`.

- It gets its own module, not `lib/phone.ts` and not the schema. The examples
  JSON is only imported where the hint renders: `VerificationFlow` and
  `SettingsForm`, both client components. `lib/validation/schemas.ts` never
  touches it.
- The helper text under the phone field shows the hint before any error, and
  it updates as the country changes. It is "Include your country code — e.g.
  +267 71 123 456." With no country selected, or no metadata, it falls back to
  "Include your country code."
- The placeholder follows the same example. The fallback is `+`.
- The schema message becomes generic: "Enter a valid phone number for the
  selected country, including its country code." The Nigerian example is gone.

`SettingsForm` has the same hard-coded Nigerian helper and placeholder, so it
gets the same treatment. It's the same bug on a second surface that writes the
same column.

### 3.2 — The country and the number must agree

**Comparing calling codes, not `getPossibleCountries()`.** I checked
`getPossibleCountries()` on `+1 415 555 2671` and it returns only `["US"]`. The
area code resolves to the US, so a Canadian user with a +1 415 number would be
rejected. Calling-code equality accepts every country that shares a code: US,
CA and the NANP Caribbean on +1, RU and KZ on +7. That's the intended level of
strictness, since the check exists to catch "Botswana selected, Nigerian
number", not to police area codes.

```ts
function phoneMatchesCountry(phone: string, country: string): boolean
// parsed.countryCallingCode === getCountryCallingCode(country)
// true when either side is unparseable/unsupported — other rules own those errors
```

**Where it attaches.** The brief says to use `superRefine` on the composed
object. There's a trap in that: in Zod 4, calling `.partial()` on a refined
object **throws** ("`.partial()` cannot be used on object schemas containing
refinements", verified). `verificationStepSchemaFor()` calls `.partial()` on
the role schema. So:

- The unrefined objects stay private: `testerStep1Base`, `testerVerificationBase`.
- One exported `withPhoneCountry(schema)` adds the `superRefine`. When either
  field is absent it skips, so the partial step save still works. It puts the
  issue on `path: ["phone"]` with "That number isn't a {Country} number. Check
  the country code, or change the country above." That way `FieldError` and
  `useFocusFirstError` land on the phone input.
- It's applied to `testerStep1Schema` (and so its alias `builderStep1Schema`
  too), to `testerVerificationSchema`, to `verificationStepSchemaFor`
  (`withPhoneCountry(base.partial())`), and to `updateProfileSchema`.
- `updateProfileSchema` carries the same risk. `SettingsForm` sends `country`
  and `phone` whenever either is set, so the check fires there too. A partial
  payload that carries only one of the two can't be checked against the stored
  row from inside the schema. That's accepted: it's the same case as the step
  save, and the form always sends both.

**Existing rows.** Rows that already hold a mismatched pair aren't migrated.
The next edit in Settings will surface the error on the phone field. That is
the risk the header names.

### 3.3 — Tests

The table in the brief is the fixture:

- A valid and an invalid number for each of BW, NG, ZA, GH, KE and US, checked
  against `testerStep1Schema`.
- `+267 801234567809` is rejected and `+267 71234567` passes.
- **Mismatch:** a NG number with BW selected is rejected, with the issue on
  `phone`.
- **No false rejection:** `+1 415 555 2671` passes with US *and* with CA.
- `verificationStepSchemaFor("tester")` still builds (no throw), accepts `{}`,
  and rejects a mismatched pair.
- `phoneHintFor("BW")` includes `+267`. `phoneHintFor("BV")` and
  `phoneHintFor("")` return `null` and don't throw.
- E.164 is unchanged: `+234 801 234 5678` → `+2348012345678`.

---

## §4 — Settings still leaks builder-only sections to testers

**Status:** Built on `fix/settings-roles-design-statuses`. §1–§3 were already
merged in #23 and weren't reopened.

This is §1's bug in two more places. `tabsFor()` filtered the tab strip, but
two sections inside the tabs never learned which account was looking. Each one
now takes `active` and decides for itself.

### 4.1 — Export: hidden on a tester account

`AccountPanel` renders `ExportPanel` and its divider only when `active ===
"builder"`. The section is hidden rather than given an empty state, because an
empty state is for something that will fill in and this never will: the
export is feedback received on your own missions, and a tester has none.

The section is not gated on `hasFeedback`. A builder with no feedback yet
still gets the section and its "Nothing to export yet" state.

**Deferred:** a tester exporting *their own report history* is a plausible
future feature, and a different one. It needs different data, a different
query and different copy. It isn't in this PR.

### 4.2 — Activity: kept, and re-pointed for testers

Removing Activity for testers would be the wrong call. For a tester, reports
written and average rating are their whole track record, and this is the
closest thing they have to the reputation panel that `846414a` deleted.

- **Builder:** unchanged. Five metrics, the existing empty state, and the
  "no tester account" prompt.
- **Tester:** a section titled "Your testing" with three metrics: reports
  written, approved (of N), and average rating. `received` and `ratio` are
  dropped rather than shown as 0 and "—", since for a pure tester they read as
  failure rather than "not applicable".
- **Tester empty state:** keyed on `given === 0`, because what came back on
  their own projects isn't part of a tester's record.
- **Rating:** still "—" until something is rated, never 0.0.
- **Copy:** nothing about pay, earnings or ranking. Cohort payment happens
  outside the product.

### 4.3 — Tests

`components/settings/__tests__/roleSections.test.ts` renders the real
components with `renderToStaticMarkup`, so no DOM is needed:

- A tester sees no export section.
- A builder with zero feedback sees the section and its empty state.
- A tester's Activity has no received count or ratio. A builder's is unchanged.
- An unrated tester sees "—", never "0.0".
- A tester's Activity says nothing about pay or earnings.
- `tabsFor` still hides Plan from a tester.

---

## §5 — Pass / Fail / Blocked does not fit UI Design Testing

### 5.1 — The actual bug

A `ui_design` step is an elicitation prompt ("describe your first
impression"). The description *is* the deliverable. As built, a tester could
mark such a step Pass and write nothing, and the builder got a green tick
carrying no information. Relabelling the buttons alone wouldn't have touched
that.

### 5.2 — Part 1: `actual_result` is required on every `ui_design` step

`auditLogSchemaFor(category)` in `lib/validation/schemas.ts`:

- **`ui_design`:** it returns the log schema with one more refine. Every
  entry, **pass included**, owes an `actual_result` of at least
  `DESCRIPTION_MIN = 20` characters. Twenty characters is about one short
  clause ("The headline is clear but tiny"), which is the least a builder can
  act on. "ok", "fine" and "looks good" all fail it.
- **Everything else:** `process_flow`, `component`, and a null or unknown
  category (older rows exist) all get `auditLogSchema` unchanged.
  **`actual_result` stays optional on a pass for all of them.**
- **No migration:** the column is already `NOT NULL default ''`, so this is a
  Zod change only.
- **Where it runs:** in `submitTestResult`, after the mission row is read
  (`category` was added to its select). The payload doesn't carry the category
  and shouldn't be trusted to. The check runs before the screenshot upload, so
  a refused log costs no storage.
- **What it passes on:** `entries` goes to `submit_audit_log` unchanged. The
  new check only judges them, so the RPC's argument shape is identical for
  every category.
- **The form mirrors it:** `firstIncompleteEntry(entries, category)` and
  `draftIsComplete(entries, category)`. The ENT-08 drift guard now crosses 5
  categories × 4 statuses × 4³ text values.

**This inverts a documented decision.** `20260907_01` made `actual_result`
optional on a pass because a functional pass is already stated by
`step_expected`, and asking again filled the column with "as expected". That
reasoning holds for functional steps and only for them. On a design step,
`actual_result` isn't a restatement: it's the answer the action asked for.

### 5.3 — Part 2: the status judges the expectation

On a `ui_design` step:

- The card asks **"What you saw"** first, directly under the builder's step,
  with a required helper line.
- The status question below it reads **"Did the builder's expectation
  hold?"** in place of "How did it go?".
- `actual_result` isn't asked a second time in the fail/blocked block.

The status is a filter: five testers × three steps is fifteen written entries,
and the builder needs to know which to read first. The prose is the feedback.

### 5.4 — Part 3: relabel, display only

`entryStatusCopy(status, category)` and `statusQuestionFor(category)` in
`lib/vocabulary.ts` sit alongside the existing label maps. I used the wording
from the brief unchanged:

| Stored | Label | Hint |
|---|---|---|
| `pass` | Clear | It landed the way the builder described. |
| `fail` | Unclear | You saw it, and it didn't land that way. |
| `blocked` | Couldn't tell | You couldn't judge this — it didn't load, or wasn't there. |

`ENTRY_STATUSES` is unchanged. There's no fourth status, no rating column and
no migration.

### 5.5 — Where the labels follow

- **Tester's submission form:** yes.
- **A tester reading their own filed report:** no such surface exists today.
  Testers can't open a submitted report, so there's nothing to relabel.
- **Builder's review screen, pass-rate summary and CSV:** they keep Pass /
  Fail / Blocked. The rule is that the tester is shown the category's wording
  while answering, and every surface that reads or compares reports uses the
  stored vocabulary.
  - `/dashboard/feedback` interleaves missions of every category, and
    `PassRate` counts across them. Two vocabularies on one screen would make a
    builder translate "Clear" into "Pass" to compare.
  - The CSV already carries a Category column, so nothing is lost there.
  - The builder now also sees the tester's description on every design step,
    and that's where the meaning is.
- **Database, AI prompt, aggregates:** unchanged. `renderEntries` still emits
  `PASS` / `FAIL` / `BLOCKED`.

### 5.6 — Deferred: a rating scale

Graded design feedback (1–5 per step) is a real option and deliberately not
built. It needs a column, a migration, and changes to the review UI, the CSV
and the AI prompt. Required prose plus a three-way filter tests whether the
problem was the *shape* of the answer or the *missing description*. If
builders still can't act on design reports once every step carries a written
answer, the scale becomes a decision informed by real reports.

### 5.7 — Tests

- `auditEntry.test.ts` (ENT-12, ENT-13, ENT-08):
  - A `ui_design` pass with an empty or two-character description is rejected
    on `[0, "actual_result"]`.
  - `process_flow`, `component`, null and unknown categories still accept a
    bare pass.
  - The form and the server agree across every combination.
- `submissions.test.ts`:
  - A bare `ui_design` pass is refused before any write.
  - A described one is accepted.
  - Every other category, including null, accepts a bare pass.
  - `submit_audit_log` gets the same argument shape and the stored statuses.
- `designStatuses.test.ts`:
  - The labels and question for `ui_design` and for every other category.
  - `ANALYSIS_PROMPT` still says `PASS` / `FAIL`.
- `components/tester/__tests__/designSteps.test.ts`: the rendered card shows
  the design labels, the expectation question and "What you saw" above the
  status on `ui_design`, and the originals everywhere else.

### 5.8 — Not changed, noted

- **A pre-existing mismatch on functional categories:** the form requires
  `ENTRY_TEXT_MIN` (4) characters on fail/blocked fields, while the schema
  requires 1. The drift guard doesn't catch it because it never tests 1–3
  characters. It's harmless in the safe direction (the form is stricter), and
  I've left it as it was.
- **Design steps still ask for "Steps to reproduce"** on Unclear and Couldn't
  tell, because `auditEntrySchema` requires it for every non-pass. The
  placeholder is still the functional one.

---

## Constraints

Semantic tokens only, in both themes. Control names match schema keys, and the
phone issue is keyed `phone`. The layout holds down to 360px: the role cards
are already `grid-cols-1` below `sm`, and the hint is one line that wraps.

## Documentation

- **`CLAUDE.md`:** the active account type is a required input to Settings
  components, because the switch label was wrong for six weeks without it.
  Also: phone and country are checked together, by calling code, and
  `.partial()` can't follow a refinement.
- **`TownHall_Checklist (1).xlsx`:** QA rows for the tester-side switch label,
  the choose-account pending state, and the phone/country mismatch. Later
  also for the tester-side Settings sections and the UI Design status labels.
- **`CLAUDE.md` (§5):** the audit-log rule now names the `ui_design`
  exception, and the data-model note on `actual_result` says the same.

## Commits

1. `fix(settings): make the account switch and tabs follow the active role`
2. `fix(choose-account): lock both cards on submit, land on the real route`
3. `fix(phone): show the selected country's example, check number vs country`
4. `docs: record active-role input and phone/country rule`

Second round, on `fix/settings-roles-design-statuses` (§1–§3 already merged in #23):

5. `fix(settings): hide export and re-point activity on a tester account`
6. `fix(missions): require a description on ui_design steps, relabel them`
7. `docs: record the ui_design rule and the round-1 additions`
