# Twnhall — Onboarding Flow Redesign + Welcome Email: Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

Stage 2 of the UI/UX revamp. Visual reference is **task2k**, the same Nigerian user-research platform that informed Stage 1 — its structure and rhythm, not its palette, not its field list, and not its account model.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions.
2. Read `DESIGN.md` §5 and §8.
3. Read `TEST.md` §1.
4. Read `docs/specs/` and match that spec format.

**Two PRs, in order.** Write each spec into `docs/specs/SPEC-<name>.md` first and **stop for approval before implementing**. Commit granularity per `CLAUDE.md`. All four gates before done: `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test`.

Branch off `feat/homepage-redesign` — nothing is merged yet, so keep stacking.

### Read these before writing any code

- **`components/verification/VerificationFlow.tsx`** — the existing wizard. It already has a `StepIndicator`, per-step Zod schemas, per-step saving and a Review step. **This is a redesign of something that works, not a rebuild.** Preserve its behaviour.
- **`actions/verification.ts`** — `saveVerificationStep` and `completeVerification`.
- **`app/terms-accept/page.tsx`** and **`app/choose-account/page.tsx`**.
- **`lib/mail.ts`** — exports `sendFeedbackNotification` and `sendAdminBroadcast`. Nothing else.
- **`emails/`** — contains `admin-broadcast.tsx`, `feedback-notification.tsx` and `README.md`. **There is no welcome email.**
- The guides you wrote in Stage 1, `/guides/builder` and `/guides/tester` — the current, accurate description of the product. All onboarding copy comes from these.

### The chain as it stands

```
email confirmed → /terms-accept → /choose-account → /verify/[role] → dashboard
```

Three separate routes with three different shells. The reference reads as one continuous setup; that disconnect is the main thing being fixed.

### What is collected today — and stays

| Role | Steps |
|---|---|
| **Builder** | Identity (`fullName`, `country`, `phone`, `timezone`) → Review |
| **Tester** | Identity (same four) → Skills (`skills`) → Review |

From the `STEPS` record in `VerificationFlow.tsx`. **No fields are added, removed or reordered in this work.**

### Decisions already made — do not relitigate

- **The three routes stay three routes.** See §1.1.
- **No new fields.** The reference collects company name, industry, RC number. Twnhall collects what it collects.
- **No "Skip setup" link.** See §1.5.
- **One sign-in, one identity, two accounts.** Unchanged from Stage 1. The reference's company/tester split is not Twnhall's model.

---

# PR 1 — The setup flow

**Branch:** `feat/onboarding-flow`
**Migration:** none
**Risk:** low-medium — touches three gated routes, changes no gate logic

## 1.1 — Make three routes feel like one flow

**Do not merge them into a single route.**

Each is a real gate — `profiles.accepted_terms_at`, the existence of an `accounts` row, `accounts.verification_completed_at` — and each is checked in **two** places per `CLAUDE.md`: `middleware.ts` and `requireAccount()`. Collapsing them into one page means re-implementing that routing inside the page and giving up the two-layer guarantee. That chain was expensive to get right and it is not what this work is for.

Instead, build a **shared setup shell**:

- A persistent top bar — logo plus a context line ("Setting up your account").
- **One step indicator rendered across all three routes**, current stage highlighted, completed stages checked.
- A consistent card, width and background across the three.

Three routes, one continuous experience. The shell is a layout component the three pages opt into, not a wrapper that swallows them.

Note that the role is unknown until `/choose-account` completes, so the indicator's later stages are role-dependent. Render the stages you know and resolve the rest once the role exists — do not fabricate a fixed list to look tidier.

## 1.2 — The step count must match reality

The reference shows four steps. Yours:

- **Builder:** Identity → Review → Done — **3**
- **Tester:** Identity → Skills → Review → Done — **4**

**Do not pad the builder flow to four.** A progress bar that invents a step is worse than an honest three. The count differing by role is correct and should be visible.

## 1.3 — Restyle the panels

Take the reference's approach — generous cards on a tinted ground, a clear heading and one-line subhead per step, a single strong primary action — and apply it to the fields that already exist.

**On the chip-grid pattern:** the reference uses a grid of selectable cards for industry. The closest analogue here is the tester **Skills** step, currently `components/ui/SkillsInput.tsx`. That component accepts **custom skills**, not just the fixed `SKILLS` vocabulary, and `normalizeSkills()` in `lib/vocabulary.ts` exists specifically to handle them. A fixed chip grid would silently drop that. **Only adopt the grid if custom entry survives alongside it** — otherwise leave the combo box and restyle it.

Country and timezone stay as `<select>`. They are long lists; a chip grid would be worse, and `SPEC-verification-gate.md` already recorded "no searchable country combo box" as a deliberate non-goal.

## 1.4 — Add a completion screen

`completeVerification` currently redirects straight to the destination. Insert a screen before that:

- Confirmation that setup is done.
- A short **what happens next** block — three items, role-specific.
- A prominent CTA into the dashboard.

Content describes **only what exists**. For a builder: create a project, write a test case, publish a mission. For a tester: browse missions, read the builder's test case, file an audit log. Take the specifics from the guides — not from the reference email, which promises a much larger feature surface than Twnhall has.

This screen is also where PR 2's welcome email is acknowledged, so build it with that in mind.

## 1.5 — Do not copy the "Skip setup" link

The reference has *"Skip setup — go to dashboard."* Twnhall cannot.

Verification is a hard gate on `accounts.verification_completed_at`, enforced in middleware and in `requireAccountForVerification()`. A skip link either defeats the gate or bounces straight back, and the second is worse than having no link. Leave it out.

## 1.6 — Bring these pages into the theme system

`app/verify/[role]/page.tsx` currently hard-codes `bg-obsidian text-chalk`. Arriving there from a light-themed public site will look like a bug.

Move all three routes onto the semantic tokens from Stage 1's `(public)` work. They are post-auth but pre-dashboard, so they belong to the themed surface, not the dark app surface. Note in the spec that this extends the theme boundary — `CLAUDE.md`'s surface rule needs the sentence updating again.

## 1.7 — Behaviour that must not regress

- **Per-step saving.** `saveVerificationStep` persists on every Continue so someone who closes the tab returns to their step, not an empty form. `firstIncompleteStep()` in the page derives where to resume from the same schemas the form validates with. Keep both.
- **`completeVerification` re-validates the whole role schema** rather than trusting that the steps were completed. Keep that.
- **Control names match schema keys.** `useFocusFirstError` and `FieldError` both resolve by that string; `SettingsForm` is the cautionary tale in `CLAUDE.md`.
- **Never disable the submit button** to express "not finished." Validate on click and name the outstanding field.

## 1.8 — Tests

- The step indicator renders the right count per role (3 builder, 4 tester).
- Resume lands on the first incomplete step after a partial save.
- The completion screen renders for both roles with role-correct content.
- `scripts/access.test.mts` still passes — no gate behaviour changed.
- Both themes render on all three routes.

---

# PR 2 — The welcome email

**Branch:** `feat/welcome-email`
**Base:** `main` with PR 1 merged
**Migration:** none
**Risk:** low, with one external dependency

## 2.1 — This email is yours

Unlike the confirmation and password-reset mail, which Supabase Auth generates from its own dashboard templates, **the welcome email is application mail.** It goes out through Resend via `lib/mail.ts`, from a React Email template in `emails/`. Your templates, your design, your copy.

Follow `feedback-notification.tsx` for structure and `emails/README.md` for conventions. Add a `sendWelcomeEmail` export to `lib/mail.ts` alongside the existing two.

## 2.2 — Trigger

From `completeVerification` in `actions/verification.ts`, **after** the `accounts` update that opens the gate succeeds.

**It must be non-fatal.** An email failure cannot block the gate, the completion screen or the redirect. Use the same pattern as the AI analysis in `actions/submissions.ts` — the work already succeeded; the mail is a side effect.

**It must fire once.** `verification_completed_at` being set should prevent re-entry, but verify that rather than assuming, and do not rely on the UI to enforce it.

## 2.3 — Content

**Role-specific.** A builder's first action and a tester's first action are different. Two templates, or one with a role branch — your call, but say which in the spec and why.

**Short.** The reference email runs to a founder letter, an old-way/new-way comparison, and a full feature inventory. Twnhall's does one job: welcome the person and give them one clear next action.

**Promises nothing unbuilt.** No tier limits stated as enforced, no video feedback, no guaranteed turnaround, no paid missions. Same rule as the homepage. Source the specifics from the guides.

## 2.4 — Deliverability

The Resend sending domain is already configured from Stage 1's SMTP work. Confirm this template sends from the same verified domain and does not trip spam heuristics — a first-contact email landing in spam is worse than no email.

## 2.5 — Tests

- Template renders for both roles with expected content.
- A mail failure leaves `verification_completed_at` set and the redirect intact.
- The send is invoked exactly once per completion.
- Follow `TEST.md` §1 for the server-action coverage pattern.

---

## Constraints — both PRs

- **Both themes**, semantic tokens only. Never hard-code a literal colour.
- **Voltage `#E8FF47` is a fill only in light mode**, always with Obsidian text on it. Accent text, links, borders and focus rings use Forest `#353D00`. Voltage as text on Bone is ~1.1:1.
- **Error text and borders use `danger-ink` `#A81E15`** on light, collapsing to Ember in dark. Ember on Bone is 2.97:1 and fails both `DESIGN.md`'s 4.5:1 and WCAG's 3:1 for a component boundary.
- **One voltage CTA per viewport.**
- Syne headings, DM Mono UI, 4px grid, no exceptions.
- **Down to 360px.** Step indicators are the classic thing that breaks on narrow screens — test that specifically, not just "mobile".

## Before calling either PR done

Four gates, then **walk the whole chain in Chrome as a genuinely new user** — signup, confirmation, terms, account choice, profile, completion, dashboard — in both themes, at desktop and 375px, tabbing through every step with a keyboard.

For PR 2, confirm the email **arrives and renders in a real client**, not merely that the send returned OK.

## Documentation

- **`CLAUDE.md`** — the surface rule now covers the onboarding routes too (§1.6); the welcome email's trigger point and its non-fatal contract.
- **`emails/README.md`** — the new template and when it fires.
- **`TownHall_Checklist (1).xlsx`** — QA rows for the stepped flow per role, resume-after-close, the completion screen, and welcome-email delivery.

## Out of scope

The dashboard behind it, admin, every public page. The DM Mono long-form question is still open and is not for these branches.
