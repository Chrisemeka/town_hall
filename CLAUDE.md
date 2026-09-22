# CLAUDE.md

This file tells Claude Code how the Twnhall codebase is built. Read it first every session. When this file conflicts with any other doc in the repo, this file wins.

Twnhall is a Next.js app where developers submit projects to be tested by other developers. Each person can hold two roles — builder and tester — under one identity.

## Stack

- **Framework:** Next.js 16.2.1 (App Router) + React 19.2.4, TypeScript 5
- **Backend:** No separate service. Server Components, Server Actions in `actions/`, Route Handlers in `app/api/`. Deploys to Vercel.
- **Database:** Postgres via Supabase. **No ORM.** `@supabase/supabase-js` v2 talks to PostgREST directly. `@supabase/ssr` handles cookie sessions.
- **Validation:** Zod 4 at every boundary (`lib/validation/schemas.ts`).
- **Storage:** Supabase Storage, one bucket: `screenshots`.
- **AI:** Vercel AI SDK 6 + `@ai-sdk/google`. Model: `gemini-3-flash-preview` (see `lib/ai.ts` — do not trust ARCHITECTURE.md which says 1.5 Flash).
- **Email:** Resend + React Email in `emails/`.
- **Styling:** Tailwind CSS 4, Framer Motion 12, Radix Slot, lucide-react.

## Folder Layout

```
actions/              Server actions for all mutations (auth, projects, missions, submissions, admin)
app/
  (public)/           Public, theme-switchable routes + the shell
                      /, /pricing, /guides/**, /about, /contact, /terms, /privacy
  (developer)/        Builder-facing routes (/dashboard/**)
  (tester)/           Tester-facing routes (/explore/**, /mission/[id])
  (admin)/            Admin console (/admin/**)
  api/                Route Handlers (webhooks, auth callback)
components/           React components
  public/             The public shell — header, footer, theme toggle
  missions/           TestCaseEditor (authoring), TestCaseView (display)
  submissions/        SubmissionBody — the one place audit-log vs legacy branches
  tester/             AuditLogForm and the tester's own surfaces
lib/
  auth.ts             requireAccount(), requireAdmin(), requireProjectOwner()
  access.ts           accessFor() — the single pure function for route permissions
  ai.ts               Gemini client + the analysis prompt
  testTemplates.ts    Curated test-case templates (static, not a table)
  sentences.ts        Sentence heuristic for the project summary rule
  theme.ts            readTheme() — the public theme cookie, resolved in one place
  setup.ts            The setup chain's stages, resume and completion content
  contact.ts          CONTACT_EMAIL, X_URL — where "get in touch" goes
  initials.ts         Avatar initials — every email/password user has no photo
  types/db.ts         Hand-written row types — the client has no Database generic
  validation/         Zod schemas
emails/               React Email templates
middleware.ts         URL-level auth gates, session refresh, no-store headers
supabase/migrations/  SQL migrations
```

## Data Model

Six live tables. Concepts match the UI except "feedback" — the table is `test_results`.

```
profiles ──┬── accounts        one identity, two roles (builder + tester)
           ├── projects        owned by profile
           └── test_results    tester's submission on a mission
                    │  │
missions ───────────┘  └── test_result_entries   one row per test-case step
```

| Table          | Key columns |
|----------------|-------------|
| `profiles`     | `id` (= `auth.users.id`), `full_name`, `avatar_url`, `email`, `role`, `moderation_status`, `ban_reason`, `banned_at`, `banned_by`, `accepted_terms_at`, `seen_tours` |
| `accounts`     | `id`, `user_id` → `profiles.id`, `type` (`builder` \| `tester`), `created_at`. Unique on `(user_id, type)`. |
| `projects`     | `id`, `owner_id` → `profiles.id`, `name`, `description`, `app_url`, `category`, `flagged_at`, `flag_reason`, `flagged_by` |
| `missions`     | `id`, `project_id`, `title`, `task_description` (**optional, defaults `''`**), `is_active`, `category`, `test_steps` (jsonb), `device_target`, `template_id`, `load_test_at`, `testers_needed` |
| `test_results` | `id`, `mission_id`, `tester_id`, `screenshot_url`, `screenshot_urls[]`, `tester_comment` (**nullable, legacy**), `ai_summary`, `ai_sentiment`, `status` (`pending`\|`approved`\|`changes_requested`), `rating`, `review_note`, `reviewed_at` |
| `test_result_entries` | `id`, `test_result_id` → `test_results.id` (cascade), `step_id`, `step_index`, `step_action`, `step_expected`, `status` (`pass`\|`fail`\|`blocked`), `issue_summary`, `steps_to_reproduce`, `actual_result` (**`''` on a pass, defaults `''`**), `expected_result` (**no longer collected, defaults `''`**) |

**`missions.task_description` is notes, not the brief.** The brief is `test_steps`. Since
`20260907_01` the column is optional with a `''` default and the form calls it "Notes for Testers"
behind a disclosure — do not make it required again, and do not rename the column: the admin console,
both mission detail pages and the server action all read it by name. Every surface that renders it
omits the block when it is empty rather than showing an empty state, because the test case is
directly below it.

**Which audit-log fields a status owes is decided in one place**, `auditEntrySchema` in
`lib/validation/schemas.ts`, and mirrored by `firstIncompleteEntry` in
`components/tester/AuditLogSteps.tsx`. A **pass** owes nothing but its status — what it confirms is
the builder's `step_expected`, already snapshotted on the row. A **fail** and a **blocked** step owe
`actual_result`, `issue_summary` and `steps_to_reproduce`; blocked is not a lighter kind of failure,
and collecting nothing for it meant the one status meaning "something stopped me" reached the
builder with nothing actionable. If you change either definition, change both —
`lib/validation/__tests__/auditEntry.test.ts` crosses every combination and will tell you.

**`test_result_entries.expected_result` is history, not a field.** `20260908_01` took it off the
form: it was prefilled from the builder's own `step_expected` and ten of the first eleven testers
submitted it unchanged. The column keeps those eleven values — one tester did write their own — so
`SubmissionBody` renders `step_expected` as "Expected" and shows `expected_result` only where the
two differ. Do not reintroduce it as an input.

**`missions.test_steps` is jsonb, `test_result_entries` is a table.** The asymmetry is deliberate:
steps are read and written whole with their mission and never queried across missions, while entries
are aggregated independently. Follow it rather than "fixing" it.

**`test_result_entries.step_action` / `step_expected` are snapshots, not lookups.** They copy the
builder's wording at submission time. A builder editing the mission afterwards must not rewrite what
a tester appears to have been asked. `step_id` correlates; the snapshot is the record.

**`test_results.tester_comment` is legacy and optional.** It was the whole submission before the
audit log; it is now the free-text "anything else?" at the end. Twenty-four submissions predate the
audit log and carry only this. Every surface that renders a submission must handle both shapes —
`components/submissions/SubmissionBody.tsx` is the one place that branches, don't add a ninth
conditional elsewhere.

**Fixed vocabularies live in `lib/vocabulary.ts`** and are enforced in Zod, never as a database
CHECK: `SKILLS`, `COUNTRIES`, `TIMEZONES`, `PROJECT_CATEGORIES`, `TEST_CATEGORIES`,
`DEVICE_TARGETS`, `ENTRY_STATUSES`. `scripts/vocabulary.test.mts` covers each.

## Auth — the load-bearing patterns

**One identity, two accounts.** A person is one `profiles` row with up to two `accounts` rows (`type='builder'` and `type='tester'`). Google OAuth + Supabase's unique email constraint means one person cannot hold two identities. Anything scoped to a role must live on `accounts`, not `profiles`.

**Two layers, always.** Every protected route is gated in **two** places:

1. `middleware.ts` — URL-matcher gate, refreshes session, sets `no-store` on protected routes.
2. `requireAccount()` / `requireAdmin()` in `lib/auth.ts` — re-checked inside every page and server action.

The second exists so that if someone edits the middleware matcher, protection does not disappear. Never rely on middleware alone. Never rely on the in-page check alone.

**Route permissions come from one function.** `accessFor()` in `lib/access.ts` is the single source of truth used by middleware, server code, and `scripts/access.test.mts`. Extend it there — do not scatter permission logic.

**The `th_account` cookie is not authority.** It records which role the user is currently acting as. It is unsigned. Always intersect it with the user's real `accounts` rows (see `lib/auth.ts`, mirrored in `middleware.ts`) before trusting it. A forged cookie must resolve to a real account the user holds, or to `null`.

**Two gates with similar names. They are not the same gate.**

| Path | Asks | Answers from |
|---|---|---|
| `/confirm-email` | Is the address proven? | `auth.users.email_confirmed_at` — **Supabase's**, not ours |
| `/verify/[role]` | Is the role profile complete? | `accounts.verification_completed_at` |

**Email confirmation is the first link in the chain**, ahead of everything:

```
auth → email confirmed? → profile upsert → terms → choose-account → per-role verification → home
```

Enforced in `middleware.ts` and in `resolveAccountOrRedirect()` in `lib/auth.ts`
— two layers, as always. **Do not add a column mirroring `email_confirmed_at`**;
the `accepted_terms_at` pattern does not apply because Supabase already owns
this state. `isEmailGateExempt()` in `lib/access.ts` lists the only two
exemptions and says why each one is there. Admins are *not* exempt, unlike the
terms gate.

**Identity linking is GoTrue's behaviour, not ours, and it is stronger than it
looks — verified against the project, not assumed.** When a Google sign-in
claims an address held by an **unconfirmed** password signup, GoTrue does not
link the two: it takes the row, removes the email identity, and **clears
`encrypted_password`**. The unproven credential is destroyed rather than
inherited, so typing someone else's address at signup buys nothing that
survives the real owner arriving.

**The consequence is a support problem, not a security one.** A legitimate user
who signs up with a password, skips confirmation, then uses Google silently
loses that password and finds out the next time it fails. Nothing in our code
can prevent it. It is handled by saying so in the two places it is about to
matter: a **standing** line under the sign-in form ("Signed up with Google? Use
the Google button above") and a line on `/confirm-email`. **Standing, never
conditional** — a message that appears only for addresses that turn out to be
Google accounts is an enumeration oracle, and the sign-in failure message stays
generic.

Twnhall does not call `linkIdentity()` and should not start without a separate
decision. All four cases and the test transcript are in
`docs/specs/SPEC-email-password-auth.md` §5.

**The setup chain is three routes and stays three routes.** `/terms-accept`,
`/choose-account` and `/verify/[role]` each guard a different column and each
is checked in both layers. `components/setup/SetupShell.tsx` makes them *look*
like one flow; it does not make them one. Collapsing them means
re-implementing this routing inside a page and giving up the two-layer
guarantee.

**The step indicator reads the gates, never a counter.** `lib/setup.ts` derives
every stage's status from `accepted_terms_at`, the `accounts` row and
`verification_completed_at`. That is what makes mid-chain entry correct: a
builder adding a tester role lands straight on `/verify/tester` having passed
terms months ago, and a counter would show Terms as pending. `profileStep` can
move which profile stage is current; it can never reopen an earlier gate.

**`/choose-account` is not only a setup step.** It is in `SHARED_PREFIXES` and
is how an existing verified user adds or switches a role, so the shell shows
the indicator and the "Setting up your account" line **only when
`isFirstChoice`**. Anything added to that page has to hold for both modes.

**Opening a gate must be idempotent if anything hangs off it.**
`completeVerification` writes `verification_completed_at` with
`.is("verification_completed_at", null)` and `.select()`, so
`UPDATE … WHERE … IS NULL … RETURNING` tells it whether *this* call opened the
gate. That row is what authorises the welcome email. The action cannot refuse a
repeat call on its own — `requireAccountForVerification()` deliberately skips
the verified check — and the UI is not an enforcement layer, so the database is.
Anything else that should happen once per gate hangs off the same row.

**The welcome email is ours; the auth mail is not.** `emails/welcome.tsx` sends
through `lib/mail.ts` and fires from `completeVerification` inside `after()`, so
the completion screen does not wait on SMTP. Its content comes from
`lib/setup.ts`, the same source the completion screen renders — change the copy
there, not in the template. It is non-fatal by construction: `sendWelcomeEmail`
swallows every failure and returns `void`, so no caller has to remember to wrap
it. Confirmation and password-reset mail come from Supabase Auth's own
dashboard templates and **cannot be changed from `emails/`**.

**Gate pattern for "must complete X before Y."** Precedent: `profiles.accepted_terms_at` is a nullable timestamp — middleware and `requireAccount()` refuse to let the user past protected surfaces until it is set. Verification uses the same shape but on `accounts` (per-role): `accounts.verification_completed_at`. When adding future gates, follow this pattern rather than inventing new mechanisms.

## Data Mutations — RLS + service role

RLS is on. Reads are policy-driven, writes are not. The pattern is deliberate.

- **Privileged reads** go through `createAdminClient()` (service role).
- **Every write goes through service role** with an explicit column list, gated in code. As of
  `20260906_01` and `20260906_02` there are **no anon write policies** on `projects`, `missions` or
  `test_results` — the server actions are the only way in.
- **Ownership is checked in code, not by the database.** `requireProjectOwner()` in `lib/auth.ts`
  replaced the owner-scoped RLS policies those migrations removed. Service role bypasses RLS, so a
  write action that skips this guard has *no* ownership check at all. Call it.
- **Reads need the same guard, and it is easy to forget.** `projects` and `missions` are readable by
  anyone, so an owner-scoped *page* has to compare `owner_id` itself — `accessFor()` only proves the
  caller is a builder, not which builder. Every `/dashboard/[projectId]` page does this and answers
  `notFound()`, never a 403: distinguishing "not yours" from "no such project" confirms it exists.
  On the mission pages the check is against the **mission's own project**, not the `projectId` in the
  URL, or owning the project in the path would be enough to open someone else's mission through it.

**Why writes are not left to RLS**, since the previous note here was wrong and cost a session to
disprove: RLS cannot restrict *which columns* an update touches. The owner-scoped policies that used
to exist correctly stopped one builder writing another's rows — but let a builder write **any column
on their own row** straight through PostgREST with the public anon key, including
`projects.flagged_at` (un-flagging themselves after moderation), `projects.owner_id`,
`missions.payout_cents` and arbitrary JSON into `missions.test_steps`. All four were verified against
the live database before being closed. (`payout_cents` has since been dropped — the hole was real
when it was found.)

**Read policies still exist and are not uniform.** `projects` and `missions` are readable by anyone
(`using (true)` — the Explore feed depends on it, including logged out). `test_results` has a
tester-own read *and* a project-ownership read that the builder feedback pages rely on through the
anon client; its definition is not in this repo, so do not drop or "tidy" it without probing first.
`test_result_entries` has RLS on with no policy at all — service role only.

Follow this. Do not add RLS policies to solve auth — solve it in the server action with
`requireAccount()` + `requireProjectOwner()` + service-role client + explicit column list.

## Atomicity — plpgsql, not ORM transactions

There is no ORM. Nothing exposes `$transaction` or similar. Anything requiring atomicity is a **plpgsql function** in `supabase/migrations/` called via `supabase.rpc('name', args)`.

- **`submit_audit_log`** — live. Writes one `test_results` row plus N `test_result_entries` in one
  transaction. `SECURITY DEFINER` with a pinned `search_path`, and **execute is revoked from `anon`
  and `authenticated`** — a definer-rights function callable from the browser is a wider hole than
  any it closes. Grant new RPCs to `service_role` only, the same way. Replaced in `20260907_01` to
  `coalesce` an absent `actual_result`: `->>` on a missing JSON key returns `NULL`, and a column
  default does **not** fire for an explicit `NULL`. Any optional field added to the entry payload
  needs the same treatment, and the `revoke`/`grant` lines restated with it — never assume they
  survived a `create or replace`.
- `commit_mission_credits`, `request_withdrawal` — payment RPCs, reverted long before payments
  were removed from the product entirely. Named here only because the pattern they used is the one
  to follow; nothing in Twnhall moves money.

When you need a transaction: write the SQL function in a new migration, invoke via `.rpc()`. Never simulate transactions with sequential `.from().update()` calls.

## Validation

All input validated with Zod at the boundary (`lib/validation/schemas.ts`). Server actions parse `FormData` or JSON through a schema before touching the database. Do not skip. Do not scatter validation through helper functions — it lives at the entry point.

**A form's control names must match its schema keys.** `useFocusFirstError` resolves
an errored field to its element by `name`, then `id`, and `components/ui/FieldError`
derives the message id from the same string. A control called `display-name` against
a schema key `full_name` is invisible to both — that mismatch existed in
`SettingsForm` and is why the rule is written down. Where a field has no single
control (a button group, an array-level error), give the group's first button or
the section that `name`/`id` so there is still something to move to.

**Never disable a submit button to express "not finished yet."** A disabled control
cannot say what is missing, and the message written for it becomes unreachable —
which is exactly what happened in `AuditLogForm`, where three error strings sat
behind a button that never fired them. Keep it live, validate on click, and say
which field is outstanding.

## Design System

Canonical reference: `Design.md`. Non-negotiable rules Claude Code must honor without re-reading the file:

- **Fonts:** Syne (Bold 700) for headings. DM Mono (Regular 400 / Medium 500) for UI, body, buttons, code. One exception, and only one: **DM Sans** for long-form prose on public surfaces — pricing, about, the guides. App surfaces keep DM Mono for body text. No other fonts.
- **Grid:** All spacing values divisible by 4. No exceptions.
- **Accent:** `#E8FF47` (Voltage). One Primary/Voltage CTA per viewport. If you catch yourself adding a second, one of them is wrong.
- **Color never conveys state alone.** Always pair a badge/indicator color with a text label.
- **Contrast:** Body text ≥ 7:1. Labels and large text ≥ 4.5:1. Verify at WebAim before shipping a new pairing.
- **Surfaces:** App surfaces — `(developer)`, `(tester)`, `(admin)` — are dark
  (Obsidian `#0E0E10` base) and use the **literal** palette tokens (`bg-obsidian`,
  `text-chalk`, `border-iron`). **Themed** surfaces use the **semantic** token
  layer (`surface`, `surface-raised`, `ink`, `ink-muted`, `line`, `accent`,
  `accent-ink`, `danger-ink`), which resolves per theme from `[data-theme]`.
  Two groups of routes are themed: the `(public)` group, where
  `app/(public)/layout.tsx` sets the attribute, and **the setup chain** —
  `/terms-accept`, `/choose-account`, `/verify/[role]` — where
  `components/setup/SetupShell.tsx` does. The setup chain is post-auth but
  pre-dashboard: handing someone from a light public site to a hard-dark page
  halfway through signup looks like a bug, so it follows the theme.
  Do not use a semantic token on an app surface. A literal on a public surface
  must be a deliberate inversion that reads in both themes, and must say so in a
  comment — the dark icon chips on the landing page are the precedent.
- **Voltage is a fill only on a light ground.** `#E8FF47` on Bone is 1.02:1 —
  invisible. Light mode pairs a Voltage fill with Obsidian text (17.3:1) and uses
  **Forest `#353D00`** (10.6:1) as accent *ink* — links, small-caps labels, icons,
  focus rings, active borders. Dark mode collapses both back to Voltage. `accent`
  and `accent-ink` already encode this; use them rather than re-deriving it.
- **`line` is a divider, not a control boundary.** At 1.19:1 it fails WCAG 1.4.11's
  3:1 for a control's visible boundary. Inputs and other bounded controls on public
  surfaces take `border-ink-muted` (6.3:1 light, 5.7:1 dark).
- **Ember is not an error colour on a light ground.** `#FF4F4F` is 5.95:1 on
  Obsidian but **2.97:1 on Bone** — it fails the 4.5:1 label bar and WCAG
  1.4.11's 3:1 for an error border. Public surfaces use `danger-ink`
  (`#A81E15`, 6.74:1), which collapses back to Ember in dark. Same shape of
  rule as Voltage/Forest above.
- **Theme default is light, with no `prefers-color-scheme` fallback.** Deliberate —
  deferring to the OS makes the default unpredictable. `lib/theme.ts` owns the
  resolution and `scripts/theme.test.mts` pins it.

Component behavior (button variants, input states, card styles, empty states) is defined in `Design.md` §5 and §8. Match existing components in `components/` before inventing new ones.

## Testing

Canonical reference: `Test.md`. Every feature ships with:

- Vitest/Jest coverage for new server actions following the pattern in Test.md §1 — auth rejection, happy path, error surfacing.
- `npx tsc --noEmit` passes with zero errors.
- `npm run lint` passes with **no new `as any` casts**.
- `npm run build` succeeds cleanly.

"Done" for a feature means all four gates pass, not just that the code runs.

## Commits & Branches

- **One feature = one branch = many small commits = one PR.**
- Branch names: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`.
- Commit granularity: schema migration → server action → UI → tests, each as separate commits. Someone reviewing the PR should be able to walk through the history and understand each step.
- Commit messages: imperative mood, subject ≤ 72 chars, wrap body at 72.
- Do not squash before merge unless asked — the small-commit history is the review artifact.

## Do Not Touch

- **The pricing page's honesty.** `/pricing` describes tiers that **no code
  enforces** — there is no report counter, no per-mission tester ceiling, no
  active-mission limit. That is the monetisation plan's Phase 2 on purpose, and
  it binds the page: it describes the shape of the offer, never the state of an
  account (no "you're on Community", no usage meter), the Pro call to action
  opens a conversation at `/contact` and is never a Subscribe or Upgrade
  button, and nothing unshipped is listed. When tier enforcement lands, the
  page changes with it — until then, do not add a control implying a
  transaction that does not exist.
- **Payments** — Twnhall has none, by decision. `missions.payout_cents` and the `paid` submission status were dropped in `20260906_03`, and the tester's earnings panel with them. Testing here is reciprocal and unpaid. Do not reintroduce a payout field, a balance, or a `paid` state without that being the explicit ask.
- **The `avatars` Storage bucket** — it does not exist in this project. If a Supabase example references it, ignore. `avatar_url` on `profiles` is Google's remote URL populated in `app/api/auth/callback/route.ts`, not something Twnhall stores. Every email/password user has a null one, so **every avatar surface goes through `components/ui/Avatar.tsx`**, which falls back to initials. Do not hand-roll the img-or-fallback branch again — there were three copies of it.
- **`ARCHITECTURE.md`** — stale on the Gemini model version at minimum. Read only for historical context. This file wins on conflict.
- **RLS policies** — do not add them to solve auth. Use `requireAccount()` + service-role client + explicit column lists (see Data Mutations above).

## Reference Documents

| Document          | Canonical for                                 | Trust it?                          |
|-------------------|-----------------------------------------------|-------------------------------------|
| `CLAUDE.md`       | This file. Codebase patterns and conventions. | Yes — wins on any conflict.         |
| `Design.md`       | Visual system, components, empty states.      | Yes.                                |
| `Test.md`         | Test cases, coverage expectations, gates.     | Yes.                                |
| `ARCHITECTURE.md` | Superseded by this file.                      | No — read only for historical context. |
