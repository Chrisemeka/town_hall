# SPEC: The Setup Flow

**Status:** Awaiting approval
**Branch:** `feat/onboarding-flow`
**Base:** `feat/homepage-redesign` — nothing is merged yet, so it keeps stacking
**Blocks:** `feat/welcome-email` (PR 2), which hangs off §5's completion screen
**Source:** `docs/TWNHALL_ONBOARDING_FLOW_PROMPT.md` — PR 1
**Migration:** none
**Risk:** low-medium — touches three gated routes, changes no gate logic

## Summary

Make `/terms-accept`, `/choose-account` and `/verify/[role]` read as one
continuous setup instead of three unrelated pages. A shared shell, one step
indicator spanning the chain, the semantic token layer on all three, and a
completion screen before the dashboard. **No gate logic moves. No field is
added, removed or reordered.**

## Why

The chain works and was expensive to get right. What it does not do is *look*
like a chain: three shells, three widths, no sense of progress, and — since
Stage 1 — a light public site handing the user to a page that is still hard-dark
halfway through.

## Non-goals

- **Merging the three routes.** §1.
- **Any change to `middleware.ts`, `lib/access.ts` or `lib/auth.ts`.** Not one
  line. `scripts/access.test.mts` passing unchanged is an acceptance criterion.
- **New fields.** The reference collects company name, industry and RC number.
  Twnhall collects what it collects.
- **A "Skip setup" link.** §7.
- **A searchable country combo box.** `SPEC-verification-gate.md` already
  recorded that as a deliberate non-goal; nothing here reopens it.
- **Component-render tests.** §9 — there is no DOM test environment in this
  repo and this PR does not quietly add one.
- **The dashboard, admin, or any public page.**

## §1 — Three routes stay three routes

Each is a real gate with its own column, checked in two places per `CLAUDE.md`:

| Route | Gate | Checked in |
|---|---|---|
| `/terms-accept` | `profiles.accepted_terms_at` | `middleware.ts`, the page |
| `/choose-account` | an `accounts` row exists | `middleware.ts`, `accessFor()` |
| `/verify/[role]` | `accounts.verification_completed_at` | `middleware.ts`, `requireAccountForVerification()` |

Collapsing them means re-implementing that routing inside one page and giving
up the two-layer guarantee. **The shell is a component the three pages opt
into, not a wrapper that swallows them.**

## §2 — `/choose-account` is not only a setup step

**This is the constraint the brief does not mention, and it shapes the shell.**

`/choose-account` is in `SHARED_PREFIXES`, reachable at any time, and it is how
an *existing, fully verified* user adds or switches a role. The page already
knows: `const isFirstChoice = held.length === 0`.

So the shell cannot unconditionally announce "Setting up your account" — a
two-year-old account adding a tester role would be told it is being set up, and
shown a progress indicator for a journey it is not on.

**The shell takes a `stage` prop, and `/choose-account` passes it only when
`isFirstChoice`.** Otherwise it renders the same shell with no step indicator
and a neutral context line ("Add a role"). One component, two honest modes.

## §3 — The setup shell

`components/setup/SetupShell.tsx` — a Server Component.

```
┌──────────────────────────────────────────────┐
│  ◇ Twnhall          Setting up your account  │   top bar, 64px, border-b line
├──────────────────────────────────────────────┤
│                                              │
│      ① Terms ✓  ② Account ✓  ③ Identity …    │   step indicator
│                                              │
│   ┌────────────────────────────────────┐     │
│   │  Heading                           │     │   card: surface-raised,
│   │  One line of subhead               │     │   16px radius, 40px padding
│   │                                    │     │
│   │  [ fields ]                        │     │
│   │                                    │     │
│   │  [ Primary ]  [ Back ]             │     │
│   └────────────────────────────────────┘     │
└──────────────────────────────────────────────┘
```

- Owns the `data-theme` attribute, read from the `th_theme` cookie exactly as
  `app/(public)/layout.tsx` does. §6.
- Max width **640px** for terms and verify; `/choose-account` keeps **760px**
  because two role cards side by side do not fit in 640.
  **Not everything at one width** — but the top bar and indicator are identical
  across all three, which is what carries the continuity.
- No theme toggle. The setting arrives from the public site; adding a control
  here is a second thing to decide in the middle of a task.

## §4 — One step indicator, and the count must be honest

`lib/setup.ts` — a pure, import-free module in the shape of `lib/access.ts`
and `lib/review.ts`, so `scripts/setup.test.mts` can check it without a DOM.

```ts
export type SetupStage =
  | "terms" | "account" | "identity" | "skills" | "review" | "done"

export function setupStagesFor(role: AccountType | null): SetupStage[]
```

| Caller | Role known? | Stages rendered |
|---|---|---|
| `/terms-accept` | no | `terms`, `account`, then a trailing `…` |
| `/choose-account` (first choice) | no | `terms ✓`, `account`, then `…` |
| `/verify/builder` | yes | `terms ✓`, `account ✓`, `identity`, `review`, `done` |
| `/verify/tester` | yes | `terms ✓`, `account ✓`, `identity`, `skills`, `review`, `done` |

**The trailing `…` is the point.** The role does not exist until
`/choose-account` completes, so the later stages are genuinely unknown. The
brief is explicit: render the stages you know and resolve the rest once the
role exists — **do not fabricate a fixed list to look tidier.**

**The profile portion is 3 for a builder and 4 for a tester** (identity →
review → done; identity → skills → review → done). That difference is correct
and stays visible. **Do not pad the builder flow to four.** §9 asserts both
counts.

**At 360px** the indicator is the thing that breaks. Six pills do not fit. It
renders as a single line — `Step 3 of 5 · Identity` — below 640px, and as pills
above. Same data, one source, two presentations. Tested at 360 specifically,
not "mobile".

## §5 — The completion screen

`completeVerification` currently returns `redirectTo` and `VerificationFlow`
pushes it. A screen goes in between.

**It is a terminal state of `VerificationFlow`, not a new route.** A new route
would need its own entry in `accessFor()` and its own gate reasoning — and the
gate has just closed behind the user, so a fourth gated route is exactly the
thing §1 says not to add. `NavigatingPanel` is already this shape; it grows
into `CompletionPanel`.

Content, from the guides and nowhere else:

| | Builder | Tester |
|---|---|---|
| 1 | Create a project — name, URL, category, two-sentence summary | Browse open missions on Explore |
| 2 | Write a test case — ordered steps, an action and what should happen | Read the builder's test case before you start |
| 3 | Publish the mission and wait for reports | File the audit log step by step as you go |

A single primary CTA into the role's home. The three items are **data in
`lib/setup.ts`**, not JSX, so §9 can assert they are role-correct without a DOM.

**Refresh behaviour, stated so it is not discovered:** reloading this screen
sends the user to their dashboard, because the gate is now open and
`/verify/[role]` redirects a verified account away. That is correct — the
screen is a hand-off, not a destination — and it is why it does not need a
route of its own.

This is where PR 2's welcome email is acknowledged ("We've sent you a note
with this"). The line is written now and stays inert until PR 2 sends anything.

## §6 — The theme boundary moves

`/verify/[role]` hard-codes `bg-obsidian text-chalk`. **And the other two are
just as hard-coded the other way** — `bg-bone text-midnight` — which the brief
does not mention. So today the chain runs light → light → **dark**, arriving
from a public site that may be in either theme.

All three move to the semantic layer (`surface`, `surface-raised`, `ink`,
`ink-muted`, `line`, `accent`, `accent-ink`, `danger-ink`). The shell sets
`data-theme` from the cookie, server-side, so there is no flash.

`CLAUDE.md`'s surface rule needs its third revision: themed surfaces are no
longer "the `(public)` group" but "the public group **and the setup chain**".
The app surfaces — dashboard, tester, admin — are still dark and still literal.

**`components/ui/Field` and `inputClass()` cannot be reused here** for the same
reason `AuthCard` could not: they are the same Design.md §5.2 chrome spelled in
literal dark tokens. `VerificationFlow` uses them today. It moves to the
semantic spelling introduced in `components/public/AuthCard.tsx` — which is
already exported and already correct — rather than growing a third copy.

## §7 — No "Skip setup"

The reference has *"Skip setup — go to dashboard."* Verification is a hard gate
in `middleware.ts` and `requireAccountForVerification()`. A skip link either
defeats the gate or bounces straight back, and a link that returns you to where
you were is worse than no link.

## §8 — Behaviour that must not regress

Each of these is load-bearing and each has a comment in the current code saying
why. None of them changes:

- **Per-step saving.** `saveVerificationStep` on every Continue, so a closed tab
  returns to its step and not an empty form.
- **Resume.** `firstIncompleteStep()` derives the entry point from the same
  per-step schemas the form validates with. It **moves into `lib/setup.ts`** so
  it can be tested directly, and its behaviour is unchanged.
- **`completeVerification` re-validates the whole role schema**, because a
  client can call it without ever submitting a step.
- **Per-role completion.** The `.eq("type", role)` on the accounts update — a
  person holding both accounts who verifies as a tester must not have their
  builder account opened.
- **Control names match schema keys**, or `useFocusFirstError` and `FieldError`
  cannot find the field.
- **`revealStep`** — a field on an earlier step is not mounted, so the focus
  hook needs the step revealed before it can land.
- **Never disable submit to mean "not finished."** Disabled during an in-flight
  action is a different claim and keeps its own label ("Saving…").

## §9 — Tests

**There is no DOM test environment.** `vitest.config.mts` is
`environment: "node"`, and there is no `jsdom`, `happy-dom` or Testing Library
in `package.json`. Adding one is a real decision about how this codebase tests
UI and it is not this PR's to make quietly.

So the models move out of the components and the models get tested — which is
how `lib/access.ts`, `lib/review.ts` and `lib/vocabulary.ts` are already done
here. `lib/setup.ts` holds the stage list, the resume logic and the
next-steps content; the components render it.

**`scripts/setup.test.mts`** — pure, in the shape of `scripts/access.test.mts`:

| Assertion | Why |
|---|---|
| builder profile stages = 3, tester = 4 | §4 — the brief's headline rule |
| a null role yields only the stages known before the role exists | §4 — no fabricated tail |
| `firstIncompleteStep` returns the first gap, the review index when full | §8 — resume |
| a partially-filled profile resumes at the incomplete step, not step 0 | §8 |
| next-steps content is three items per role and differs between them | §5 |
| every stage has a label, and no label is empty | §4 — the indicator cannot render a blank pill |

**`scripts/access.test.mts` passes unchanged.** No gate behaviour moved, and
that file is the proof.

**Not covered, and stated rather than implied:** that the indicator *renders*
the right pills, that the completion screen *displays* the right copy, and that
both themes look right. Those need a DOM or a pair of eyes. §"Manual test plan".

## §10 — Files

**New**
```
lib/setup.ts                     stages, resume, completion content — pure
components/setup/SetupShell.tsx  top bar + indicator + card chrome
components/setup/StepIndicator.tsx  pills ≥640px, "Step 3 of 5" below
scripts/setup.test.mts
```

**Edited**
```
app/terms-accept/page.tsx           into the shell, semantic tokens
app/choose-account/page.tsx         into the shell, semantic tokens, §2's two modes
app/verify/[role]/page.tsx          into the shell, firstIncompleteStep moves out
components/verification/VerificationFlow.tsx
                                    semantic tokens, indicator lifted out,
                                    NavigatingPanel becomes CompletionPanel
components/TermsAcceptForm.tsx      semantic tokens
CLAUDE.md                           surface rule, third revision
DESIGN.md                           the setup shell and the step indicator
```

**Untouched:** `middleware.ts`, `lib/access.ts`, `lib/auth.ts`,
`actions/verification.ts` (PR 2 edits that one, not this one).

## Acceptance criteria

1. All three routes render inside `SetupShell` with an identical top bar and
   step indicator.
2. The indicator shows 3 profile stages for a builder and 4 for a tester, and
   the builder flow is not padded.
3. Before the role exists, the indicator renders only the stages that are known
   and marks the rest unresolved — no fabricated tail.
4. `/choose-account` reached by an existing user shows no step indicator and
   does not claim setup is in progress.
5. All three routes are correct in both themes, server-rendered with no flash.
6. Every colour is a semantic token. Error text and borders are `danger-ink`.
7. One Voltage CTA per viewport on every screen in the chain.
8. At 360px the indicator degrades to one line and nothing scrolls sideways.
9. Per-step saving, resume, whole-schema revalidation and per-role completion
   all behave exactly as before.
10. The completion screen shows three role-correct next steps and one CTA.
11. No submit button is disabled to express incompleteness.
12. `scripts/access.test.mts` passes **unchanged**.
13. `scripts/setup.test.mts` passes and is wired into `npm test`.
14. `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`.
15. `CLAUDE.md` and `DESIGN.md` record the moved theme boundary.

## Manual test plan

The part no test here covers. Walk it as a genuinely new user, in both themes,
at desktop and 375px, tabbing with a keyboard:

- Sign up → confirm → terms → account choice → profile → completion → dashboard.
- **Builder:** three profile stages. **Tester:** four. Neither padded.
- Fill identity, close the tab, sign back in → land on the step after it, with
  the saved values in place.
- On review, press Complete with a field cleared in the database → the error
  names the field and the flow returns to the step that owns it.
- A verified user visits `/choose-account` → no indicator, no "setting up".
- A verified user visits `/verify/[role]` → redirected home.
- At 360px: the indicator is one line, no horizontal scroll, tap targets ≥44px.

## Commit sequence

1. `feat(setup): add the setup stage model`
2. `feat(setup): add the shared setup shell and step indicator`
3. `refactor(setup): move the terms gate into the shell`
4. `refactor(setup): move the account picker into the shell`
5. `refactor(setup): move the profile flow into the shell and onto the tokens`
6. `feat(setup): add the completion screen`
7. `test(setup): cover the stage model, resume and completion content`
8. `docs: extend the surface rule to the setup chain`

## Open questions

**One, and it is worth settling before I build rather than after.**

§4 reads the brief's two halves together: §1.1 wants "one step indicator
rendered across all three routes", and §1.2 gives the counts as 3 and 4 —
which count only the profile steps, not terms and account choice.

I have taken that to mean **one indicator spanning the whole chain**, with
terms and account as checked stages once passed, and the 3/4 rule applying to
the profile portion. The alternative reading is that the indicator shows *only*
the profile steps and the first two routes carry no numbered progress at all.

The first is what "one continuous setup" asks for and it is what this spec
builds. Say if you meant the second.
