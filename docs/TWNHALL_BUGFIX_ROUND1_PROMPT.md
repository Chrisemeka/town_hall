# Twnhall — Bug Fix Round 1: Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

Five reported bugs, found by watching a real person use the app on an Android phone. One PR, five commits. None of them is large; several have a second cause underneath the reported symptom.

**§1 and §4 are the same bug in four places** — Settings assuming a builder is looking at it. Fix them together.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions.
2. Read `TEST.md` §1.
3. Read `docs/specs/` and match that spec format.

Write the spec into `docs/specs/SPEC-bugfix-round1.md` first and **stop for approval before implementing.** All four gates before done: `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test`.

**Branch:** `fix/account-switch-choose-account-phone`
**Migration:** none
**Risk:** low, except §3.2 which changes what the verification form accepts

---

# 1 — The account switch is builder-shaped

## 1.1 — The symptom

On a **tester** account, Settings → Account shows a button reading **"Switch to tester account"**. The person is already on the tester account.

## 1.2 — The cause

`components/settings/AccountControl.tsx` hard-codes "tester" as the other role — in the section heading, in both copy blocks, in the button label, and in the intent of the `/choose-account` link. Its only prop is `hasTesterAccount: boolean`.

`components/settings/AccountPanel.tsx:72` passes exactly that one boolean and knows nothing more.

The component's own header comment explains why: it was lifted out of the builder sidebar, where "the other account" could only ever mean tester. Settings is now reachable from both dashboards and that assumption is no longer true.

**This is not a string fix.** Every sentence in the component is written from the builder's side, including the copy about earning reports by testing.

## 1.3 — The fix

Replace `hasTesterAccount: boolean` with the **active account type** plus whether the other account is held, and derive the rest:

```
const other = active === "builder" ? "tester" : "builder"
```

Thread `active` down from the Settings page. It must be the **validated** active account — the one already intersected with real `accounts` rows — never the raw `th_account` cookie. `CLAUDE.md` is explicit about this and the cookie is unsigned.

## 1.4 — Write both directions of the copy, don't mirror it

The existing builder-side sentence is good and stays:

> "Testing someone else's product is how you earn reports on your own. You'll complete a short tester profile first — a few fields and your skills."

The tester-side equivalent is **not that sentence with the nouns swapped.** A tester adding a builder account is doing something different: putting their own product in front of other testers. Write it from that person's position, and take the specifics from `/guides/builder`.

Same for the "you hold both" paragraph — it is currently role-neutral in substance but says "switching changes which one you are using, not what your profile says," which is true from either side. Check it reads correctly both ways rather than assuming it does.

## 1.5 — While you are in here

The Settings **tab set** is the same class of bug. `lib/settingsTabs.ts` exists — confirm the tabs a tester sees are role-correct. A Plan tab on a tester account would be the same mistake in a different place. Report what you find; fix it in this commit if it is wrong.

## 1.6 — Tests

- The switch button label is correct for each active role.
- The add-account branch renders the correct role's copy for each active role.
- `scripts/access.test.mts` still passes — no gate behaviour changed here.

---

# 2 — "Create this account" feels dead

## 2.1 — The symptom

On `/choose-account`, tapping **"Create this account"** produces no visible change. A real user assumed the page had hung and reached for refresh.

## 2.2 — Two causes, and the second is the bigger one

**Cause A — no pending state.** `app/choose-account/page.tsx` is a server component. Each card is a `<form action={createAccount.bind(null, type)}>` wrapping a plain `<button type="submit">`. Nothing anywhere reflects that a submit is in flight.

**Cause B — a double redirect.** `createAccount` in `actions/accounts.ts` ends with:

```
redirect(homeFor(type))
```

`homeFor` returns `/dashboard` or `/explore`. But a just-created account has `verification_completed_at` null, so middleware immediately bounces it to `/verify/[role]`.

**Every first-time account creation is therefore two server round trips with a dead page in between.** On a mobile connection that is comfortably long enough to read as broken. The missing spinner is what the user noticed; this is what they were waiting for.

## 2.3 — Fix A: pending state that disables both cards

**Both**, not just the one tapped. Someone who taps Builder, sees nothing, then taps Tester will create both accounts — `createAccount` is idempotent per type, so nothing errors, and they silently end up holding a role they never wanted.

`useFormStatus()` will not do this on its own: it reports only its own form's status, so the other card stays live.

Suggested shape — a small client component rendering both forms and holding `pendingRole: AccountType | null`, set on submit, driving the label ("Creating…") on the tapped card and `disabled` on both. Keep the `<form action={...}>` elements rather than moving to `onClick` handlers, so the page still works with JS off.

If you see a cleaner way that still disables both, take it — but say in the spec which you chose and why.

Note the page has a second mode: for someone who already holds the role, the action is `switchAccount` and the label is "Continue". That path needs the same treatment and the same label discipline ("Switching…").

## 2.4 — Fix B: don't make them wait for a bounce

Send them to the route they are actually going to end up on.

**Do not re-implement the gate chain to do it.** `lib/access.ts` is the single source of truth for route permissions, and a second copy of "where does an unverified account belong" inside an action is exactly the divergence `CLAUDE.md` warns about. Look for an existing helper first; if there isn't one, add it *there* and call it from the action.

Also add `app/verify/[role]/loading.tsx` so the destination paints something immediately instead of holding the old page.

## 2.5 — Tests

- A submit disables both cards and labels the tapped one.
- `createAccount` for a new, unverified account lands on the verification route, not via the dashboard.
- `createAccount` remains idempotent — picking a held type still just switches.
- `scripts/access.test.mts` still passes.

---

# 3 — Phone validation

## 3.1 — Read this before changing anything: the validator is correct

The reported case is `+267 801234567809` with Botswana selected, rejected.

**That number is genuinely invalid.** Botswana national numbers are 7–8 digits; that is 12. I ran the current schema's validator against a spread of countries:

```
INVALID | possible:false | parsed:BW | selected:BW | +267 801234567809  | what the user typed
VALID   | possible:true  | parsed:BW | selected:BW | +267 71234567      | BW mobile, 8 digits
VALID   | possible:true  | parsed:BW | selected:BW | +267 3971111       | BW landline, 7 digits
VALID   | possible:true  | parsed:NG | selected:NG | +234 801 234 5678  | NG mobile
VALID   | possible:true  | parsed:US | selected:US | +1 415 555 2671    | US
VALID   | possible:true  | parsed:ZA | selected:ZA | +27 82 123 4567    | ZA
VALID   | possible:true  | parsed:GH | selected:GH | +233 24 123 4567   | GH
VALID   | possible:true  | parsed:KE | selected:KE | +254 712 345678    | KE
```

`phoneSchema` in `lib/validation/schemas.ts` parses with libphonenumber and calls `.isValid()`, which already applies each country's own length and prefix rules. Per-country digit counts are handled.

**Do not loosen `.isValid()` to `.isPossible()`.** Nothing in the evidence above suggests over-strictness — every possible number was also valid — and `isPossible()` only checks length, which would let through numbers with impossible prefixes. The comment above `phoneSchema` explains why parsing beats a regex here; that reasoning stands.

So there are two real bugs, and neither is the length rule.

## 3.2 — Real bug: the error message is always Nigerian

```
"Enter a valid phone number including country code — e.g. +234 801 234 5678."
```

Every country gets that. A Botswana user, correctly told their number is wrong, is shown a Nigerian example and no indication of what Botswana expects. It reads as "this form only wants Nigerian numbers."

**Fix: show an example from the selected country.** `libphonenumber-js` ships `getExampleNumber` with an examples dataset.

**Put the example generation in the client component, not in the schema.** `lib/validation/schemas.ts` is imported by `scripts/*.test.mts` under plain node — note the relative-with-extension imports at the top, which exist for exactly that reason — and the examples JSON is a large payload to drag into a validation module that runs server-side on every submit. The schema keeps a generic message; the form renders the country-specific hint.

**Show it before failure, not only after.** A hint under the field that updates with the country dropdown prevents the error rather than explaining it. The field already re-formats on country change via `phoneForCountryChange`, so the wiring exists.

**Handle the no-metadata countries.** `COUNTRIES` carries all 249 ISO codes; libphonenumber has metadata for fewer. `dialCodeFor()` in `lib/phone.ts` already guards this with `isSupportedCountry` and documents why (Bouvet Island, Heard & McDonald, Antarctica are all selectable). Use the same guard and fall back to the generic message — do not let a missing example throw inside a render.

## 3.3 — Real bug, not reported: the country is never checked

Found while testing the above:

```
VALID | possible:true | parsed:NG | selected:BW | +234 8012345678 | NG number, BW selected
```

Select Botswana, enter a Nigerian number, it passes. The schema validates the number in isolation and never compares it to the `country` field the same form collected. `accounts`/`profiles` rows can hold a country and a phone number from two different countries.

**Fix with a `superRefine` on the composed object schema**, not on `phoneSchema` — the check needs two fields, and `phoneSchema` only sees one. The identity field bag is shared by both role schemas, so do it once where they compose.

**One trap to avoid.** Do not compare `parsePhoneNumberFromString(v).country` to the selected country directly. Many countries share a calling code — +1 covers the US, Canada and most of the Caribbean; +7 covers Russia and Kazakhstan — and for an ambiguous range the parser returns one specific country. A naive equality check would reject a legitimate Canadian number from a Canadian user.

Compare **calling codes**, or use `getPossibleCountries()` and check membership. Whichever you choose, prove it with a test that a +1 number passes with both US and CA selected.

## 3.4 — Tests

- A valid and an invalid number for each of BW, NG, ZA, GH, KE, US — the table in §3.1 is your fixture.
- The reported `+267 801234567809` still fails, and `+267 71234567` passes.
- **Mismatch rejected:** a Nigerian number with Botswana selected.
- **No false rejection:** a +1 number with US selected *and* with CA selected.
- A country with no libphonenumber metadata renders the generic hint and does not throw.
- E.164 normalisation on the way through is unchanged.

---

# 4 — Settings still leaks builder-only sections to testers

## 4.1 — The symptom

On a **tester** account, the Account tab shows **"Export your data"**, whose empty state reads *"Once testers have filed reports on your missions…"* — a sentence addressed to a builder. The Activity tab is also builder-shaped.

## 4.2 — This is §1's bug again, in two more places

`lib/settingsTabs.ts` already got this right for the Plan tab, and its comment names the disease exactly:

> *"A tester account has no plan, so showing one is the same mistake the account switch made — Settings assuming it is always the builder looking at it."*

`tabsFor(active)` filters Plan correctly and the page already resolves `active`. But the filtering stops at the tab strip. Inside the tabs, two sections never got the same treatment:

- **`ExportPanel`** is rendered unconditionally from `AccountPanel`, which receives `hasTesterAccount`, `projects` and `hasFeedback` — and no notion of which account is looking.
- **`GiveAndTake`** renders the same five numbers for both roles.

Fix these in the same commit as §1. It is one bug with four faces, and the fix is the same: thread `active` down and let each section decide.

## 4.3 — Export: hide it on tester

The export is feedback received on your own missions. A tester has no missions, so there is nothing to export and the copy says so in builder's words.

Hide the section entirely on a tester account rather than showing an empty state. An empty state is for something that will fill in; this never will.

**Do not delete `ExportPanel` or gate it on `hasFeedback` alone** — a builder with no feedback yet still needs the section and its empty state.

Note in the spec that a tester exporting *their own report history* is a plausible future feature and a different one — different data, different query, different copy. Not this PR.

## 4.4 — Activity: keep it, re-point it

**The reported instinct here — remove it — is the wrong call, and worth arguing.**

`GiveAndTake` counts `given`, `received`, `approved`, `ratio` and `rating`. For a tester, two of those are the most important numbers in the product:

- **Reports written** and **average rating** are that person's whole track record.
- Under the tester cohort model, reports-this-month *is* their pay, and rating is what decides whether they keep receiving missions.

That makes this screen the closest thing a tester has to a reputation panel — and the reputation panel was deleted in `846414a` along with the earnings work, leaving unpaid testers with no reason to care how they were doing.

`received` and `ratio` are the builder-side halves. For a pure tester they are 0 and `—`, and a wall of zeros reads as failure rather than as "not applicable". The file already knows this lesson — `averageRating` and `giveTakeRatio` both return null rather than zero, with comments explaining that an unrated tester must not look terrible.

**So: same section, role-aware content.**

- **Builder:** unchanged.
- **Tester:** reports written, how many the builder approved, average rating. Drop `received` and `ratio` rather than rendering them empty.

Keep the copy honest — no projected earnings, no implied ranking, nothing about pay. Cohort payment happens outside the product and must not appear inside it.

## 4.5 — Tests

- A tester account renders no export section; a builder with zero feedback still renders it with its empty state.
- Activity renders tester-shaped content on a tester and builder-shaped content on a builder.
- A tester with no ratings renders `—`, never `0.0`.
- `tabsFor` still hides Plan on tester.

---

# 5 — Pass / Fail / Blocked does not fit UI Design Testing

## 5.1 — The symptom

Every mission asks the tester to mark each step **Pass**, **Fail** or **Blocked**, whatever the mission's category. For `ui_design` — *"How it reads and feels — clarity, hierarchy, polish"* — those three words fit badly, and the hints fit worse:

> pass: *"It did what the builder said it would."*

A design does not *do* anything. The tester is being asked for a judgement and handed the vocabulary of a functional test.

## 5.2 — The deeper cause: the prose is optional, and it is the whole point

Read the `ui_design` templates in `lib/testTemplates.ts` (`first-impression`, `visual-hierarchy`, `consistency-polish`). Every action is an **elicitation prompt**, not a task:

```
"Land on the homepage and describe your first impression"
"Say who you think this is built for"
"Point at what you think the main action is"
"Scan the page without reading it, and note the order things caught your eye"
"Find the least readable thing on the page"
```

None of those can pass or fail. A tester who described their first impression has, by doing so, completed the step. Contrast a `process_flow` step — "Click submit" / "The form saves" — which is genuinely binary.

Now the part that makes this more than a wording problem. Migration `20260907_01` made `test_result_entries.actual_result` optional, reasoning:

> *"A passing step's actual result has already been stated in expected_result, which is how a column fills up with 'as expected', 'fine', 'worked'."*

That reasoning is correct **for functional steps and only for functional steps.** On a `ui_design` step, `actual_result` is not supplementary — it is the description the action just asked for, and it is the entire deliverable.

**As built, a tester can click Pass on "describe your first impression" and write nothing.** The builder receives a green tick carrying no information. That is the actual bug, and relabelling the buttons would not touch it.

## 5.3 — The fix, in three parts

**Part 1 — `actual_result` is required for `ui_design` steps.**

Invert `20260907_01`'s rule for this category. The column is already `NOT NULL` with a `''` default, so **this is a Zod change in `lib/validation/schemas.ts`, not a migration** — make the submission schema require a non-empty `actual_result` when the mission's category is `ui_design`, at every status including pass.

Set a sensible minimum length and say what you chose. "ok" is not a description.

Note in the spec that this inverts a documented decision, and why the original reasoning does not carry over.

**Part 2 — the status answers the expectation, not the action.**

With the prose required, the three states become a judgement on `expected_result` — *"The purpose of the product is clear within about five seconds"* — which genuinely is a yes/no claim.

The UI currently undermines this. **"HOW DID IT GO?" sits under the action**, so it reads as grading the description. For `ui_design` it must point at the expectation instead — "DID THAT HOLD?", or wording you prefer, decided in the spec.

**Part 3 — then, and only then, relabel.**

`ENTRY_STATUSES` stays `["pass", "fail", "blocked"]` in the database. Only the label and hint change, keyed by category:

| Stored | Label | Hint |
|---|---|---|
| `pass` | **Clear** | It landed the way the builder described. |
| `fail` | **Unclear** | You saw it, and it didn't land that way. |
| `blocked` | **Couldn't tell** | You couldn't judge this — it didn't load, or wasn't there. |

This is how the codebase already handles this class of thing — `TEST_CATEGORY_LABELS`, `TEST_CATEGORY_BLURBS`, `ENTRY_STATUS_LABELS` and `ENTRY_STATUS_HINTS` are all label maps in `lib/vocabulary.ts`. Add a category-keyed override alongside them.

**Do not add a fourth status, a rating column, or a second response type.** No migration, no change to stored rows, existing reports stay readable, `step_action`/`step_expected` snapshotting untouched.

## 5.3b — Why the status survives at all

It would be defensible to drop status entirely for `ui_design` and keep only prose. Don't, for one reason: **five testers × three steps is fifteen written entries per mission.** The builder needs to know which three to read first. That is what the status is for.

The status is a filter. The prose is the feedback. The bug was that the product had them the other way round.

## 5.4 — Only `ui_design` changes

`process_flow` ("a journey end to end — sign up, checkout, reset a password") and `component` ("buttons, inputs, checkboxes") are genuinely functional. Pass/Fail/Blocked is the right vocabulary for both, `actual_result` stays optional on a pass for both, and neither changes in any way.

The three-way distinction survives in `ui_design` too, including the one `ENTRY_STATUSES`' comment exists to protect: a step nobody could reach still reports differently from one that ran and gave the wrong answer. "Couldn't tell" is that state, not a third flavour of failure.

The vocabulary in §5.3 Part 3 is a starting point — say in the spec if you would word it better.

## 5.4b — Where the labels must and must not follow

**Must:** the tester's submission form, and anywhere a tester reads their own filed report.

**Consider carefully, and decide in the spec:** the builder's review screen and the CSV. An argument each way — the builder picked the category and would recognise the wording, but a builder comparing across missions of different categories may prefer one consistent vocabulary. Pick one, justify it, and be consistent.

**Must not:** the database, the AI prompt in `lib/ai.ts`, or anything that aggregates. `renderEntries` feeds Gemini and the model reasons over `pass`/`fail`/`blocked`; swapping in display labels there changes the analysis for no reason.

## 5.5 — Why not a rating scale

Graded design feedback — 1–5 per step instead of three states — is a real option and is **deliberately not being built here.** It needs a new column, a migration, and changes to the review UI, the CSV and the AI prompt.

Required prose plus a three-way filter is a day's work and tests whether the problem was the *shape* or the *missing description*. If builders still cannot act on design reports once every step carries a written answer, the scale becomes a decision informed by real reports rather than a guess. Note this in the spec as the deferred option and the reason.

## 5.6 — Tests

- **A `ui_design` submission with an empty `actual_result` is rejected — including on `pass`.** This is the important one.
- A `process_flow` or `component` submission with an empty `actual_result` on a pass still succeeds — `20260907_01`'s behaviour is unchanged outside `ui_design`.
- A `ui_design` mission renders the design labels, hints, and the expectation-pointed question; the other categories render the originals.
- A mission with a null or unrecognised `category` — older rows exist — falls back to the default labels, does **not** require `actual_result`, and does not crash.
- The submitted status is still `pass`/`fail`/`blocked` regardless of which labels were shown.
- `renderEntries` output to the AI is unchanged for a `ui_design` mission.
- `submit_audit_log` is called with the same argument shape — no signature change.

---

## Constraints — all five commits

- **Both themes**, semantic tokens only. Never hard-code a literal colour.
- **Voltage `#E8FF47` is a fill only in light mode**, always with Obsidian text on it. Accent text, links, borders and focus rings use Forest `#353D00`.
- **Error text and borders use `danger-ink` `#A81E15`** on light. Ember on Bone is 2.97:1 and fails both `DESIGN.md`'s 4.5:1 and WCAG's 3:1 for a component boundary.
- **Control names match schema keys.** `useFocusFirstError` and `FieldError` both resolve by that string.
- **Never disable a submit button to express "not finished."** Disabling *while a submit is in flight* — §2.3 — is a different thing and is correct.
- **Down to 360px.** All three bugs were found on a phone; verify the fixes there.

## Before calling the PR done

Four gates, then on a real phone viewport:

1. Sign in on a tester account, open Settings → Account, confirm the button says the right thing and works.
2. As a new user, reach `/choose-account`, tap a card, and confirm something changes immediately and both cards lock.
3. On a tester account, confirm no export section and tester-shaped Activity.
4. Open a UI Design mission as a tester: confirm the three choices read Clear / Unclear / Couldn't tell, the question points at the expectation, and a step cannot be submitted on Pass with an empty description.
5. In the verification form, select Botswana, confirm the hint shows a Botswana example, enter a Nigerian number and confirm it is rejected for the right reason.

## Documentation

- **`CLAUDE.md`** — that the active account type is a required input to Settings components, with the reason (the switch label was wrong for six weeks because it was not).
- **`TownHall_Checklist (1).xlsx`** — QA rows for the tester-side switch label, choose-account pending state, phone country mismatch, tester-side Settings sections, and UI Design status labels.

## Out of scope

Allowance enforcement, the cohort flag, rate limiting, shadow metering. All of it is the next block of work and none of it belongs on this branch.
