# Twnhall — Builder Dashboard Revamp: Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

Stage 3 of the UI/UX revamp. Stage 1 (public pages, theme, auth) and Stage 2 (onboarding) are merged.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions — **except** where this prompt explicitly replaces a rule, which it does once (§1.1).
2. Read `DESIGN.md` §5 and §8.
3. Read `TEST.md` §1.
4. Read `docs/specs/` and match that spec format.

**Three PRs, in order.** Write each spec into `docs/specs/SPEC-<name>.md` first and **stop for approval before implementing**. Commit granularity per `CLAUDE.md`. All four gates before done: `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test`.

### Decisions already made — do not relitigate

- **The dashboard gets themed.** The literal-token refactor is in scope. PR 1.
- **The reciprocity section shows only what is countable today.** No monthly budget, no earned-report balance — that is tier enforcement, sequenced as Phase 2 in the monetisation plan and gated on the tester cohort launching.
- **`accounts.plan_id` is added now**, for display and admin override only. **Enforcement is not part of this work.**

---

# PR 1 — Theme the dashboard

**Branch:** `feat/dashboard-theme`
**Migration:** none
**Risk:** medium — large, mechanical, touches ~60 components

Do this **alone**. Mixing a rename across sixty files with four new features makes the diff unreviewable, and a theming bug hiding inside a feature PR is a bad trade.

## 1.1 — This finishes off a CLAUDE.md rule

`CLAUDE.md` originally said:

> **Surfaces:** Dashboard is dark (Obsidian `#0E0E10` base). Landing is light (Bone `#F5F5F7`). Do not mix.

Stage 1 narrowed that to "app surfaces stay dark, public surfaces follow the theme." **That rule now goes entirely.** Every surface follows the theme. Rewrite it in `CLAUDE.md` and `DESIGN.md` rather than leaving a half-true sentence in place.

## 1.2 — The surface and text tokens

Mechanical swap across `app/(developer)`, `app/(tester)`, `app/(admin)` and every component they use:

| Literal | Semantic |
|---|---|
| `bg-obsidian` | `bg-surface` |
| `bg-graphite` | `bg-surface-raised` |
| `text-chalk` | `text-ink` |
| `text-ash` | `text-ink-muted` |
| `border-iron` | `border-line` |

Move the theme provider and the `data-theme` attribute up so they cover every route, not only `(public)`. The cookie-based SSR approach from Stage 1 stays — no flash, no blocking script.

## 1.3 — The status colours are the part that will be missed

Stage 1 established two colour pairs. **The dashboard needs two more, and the status badges are everywhere in the builder's views.**

**Mint `#3FFFA2` on Bone is roughly 1.2:1.** It is the `approved` badge. On a light surface it is invisible. `DESIGN.md` requires ≥4.5:1 for labels, and WCAG 1.4.11 requires 3:1 for a component boundary.

Derive a **`success-ink`** the same way `danger-ink` `#A81E15` was derived — a darker mint that clears 4.5:1 on Bone and collapses back to Mint in dark. Verify at WebAIM, and put the measured ratio in the spec.

Do the same audit for **Sky `#47B8FF`** wherever it is used. Same failure mode.

And carry Stage 1's two pairs into the dashboard:

- **Voltage `#E8FF47` is a fill only in light mode**, always with Obsidian text on it. Accent text, links, borders and focus rings use Forest `#353D00`.
- **Error text and borders use `danger-ink` `#A81E15`** on light, Ember in dark.

`DESIGN.md` should end this PR documenting **four** pairs as one pattern, not four separate special cases.

## 1.4 — Two more things that break on a light surface

**Shadows.** `--shadow-card: 0 2px 12px rgba(0, 0, 0, 0.4)` is designed for a dark ground. At 40% black on Bone it reads as a smudge. Give it a theme variant.

**Charts.** `recharts` is used in `components/admin/SignupsChart.tsx` and `RoleDistributionChart.tsx`. Axis, grid and series colours are almost certainly literal. They need the same treatment, and the series palette has to stay distinguishable in both themes.

Also check the Onborda tour styling in `components/tours/` and the three `loading.tsx` skeletons.

**Leave `emails/` alone.** Email clients do not honour a site's theme, and the templates are already light-on-white.

## 1.5 — Include the admin console

It is internal and only you see it, which is exactly the argument for leaving it dark — and exactly how two token systems end up in one codebase. That drift is what this PR exists to remove. Include it.

## 1.6 — Make completeness checkable

Add **`scripts/tokens.test.mts`**: assert that no literal surface or text token (`bg-obsidian`, `bg-graphite`, `text-chalk`, `text-ash`, `border-iron`) appears anywhere in `app/` or `components/` outside the token definitions in `globals.css`.

Blunt string-matching on purpose, in the same spirit as `scripts/guides.test.mts`. A sixty-file rename is exactly the kind of work where one missed file renders dark-on-dark and nobody notices for a month. This makes "the refactor is complete" a thing the suite can answer.

## 1.7 — Verification

Every dashboard, tester and admin route rendered in **both themes**. Not a sample — every route. `app/` has roughly twenty pages; walk them.

Specifically confirm: status badges legible in light, charts legible in light, tour overlay legible in light, focus rings visible on both grounds, skeletons visible on both grounds.

---

# PR 2 — Settings restructure and sidebar reorganisation

**Branch:** `feat/settings-sections`
**Base:** `main` with PR 1 merged
**Migration:** one, small
**Risk:** low-medium

Sidebar and Settings ship **together**. Items move *from* the sidebar *into* Settings; splitting them leaves an intermediate state where "Add tester account" exists in neither place.

## 2.1 — Sidebar and top nav

**Sidebar bottom section becomes exactly three items:** Settings, Replay page tour, Sign out.

- **Remove "Add tester account" / "Switch to tester"** — moves into the Settings Profile section (§2.2).
- **Remove "How it works"** — moves into Settings. *(Worth a moment's thought: Settings is not where most people look for documentation. If it feels wrong once rendered, the alternative is leaving it in the sidebar or linking it from the top nav. Flag it in the spec rather than deciding silently.)*
- **Add Sign out**, moved down from `components/layout/TopNav.tsx`.

The top nav keeps logo, search, New Project and the avatar.

**Check the mobile path.** The sidebar collapses to a sheet on mobile, so sign-out now sits behind a menu that was not previously needed to leave. The QA checklist already carries an unresolved "back button reaches dashboard after logout" item; do not make logout harder to reach while that is outstanding.

## 2.2 — Profile section

The existing `SettingsForm` content, plus the account control that left the sidebar.

`SettingsForm` **already receives `hasTesterAccount`** — the data is there, only the control needs adding.

- **Has a tester account** → "Switch to tester account", calling `switchAccount('tester')` from `actions/accounts.ts`.
- **Does not** → "Add tester account". Note that adding one lands them on `/verify/tester`, because `accounts.verification_completed_at` is per-role and theirs is null. **The button copy should say so** — "you'll complete a short tester profile first" — rather than surprising them with a gate.

## 2.3 — The reciprocity section

**Name it something plain.** "Give and take" is the clearest option — it describes the mechanic in the user's own words. "Your contribution" or "Testing activity" also work. Not "Reciprocity"; it is a word people have to translate.

Everything below is derivable from existing tables today:

| Metric | Source |
|---|---|
| Tests completed | `count(test_results where tester_id = me)` |
| Feedback received | `count(test_results)` joined through `missions` → `projects where owner_id = me` |
| **Give / take ratio** | given ÷ received |
| Average rating | `avg(test_results.rating where tester_id = me and rating is not null)` |
| Approved submissions | the same count filtered to `status = 'approved'` |

**The ratio is the important one.** The monetisation plan calls it the highest-leverage number in the business and notes that nothing measures it. This section measures it — for the user, and for you.

**Three edge cases that must be handled, not discovered:**

- **No tester account.** Show a prompt to add one, not a wall of zeros.
- **Received = 0.** The ratio is undefined, not infinity. Render `—`. This is the same lesson `lib/tester.ts` recorded about `averageRating`: *"must render as '—', never as 0.0, or an unrated tester looks terrible."*
- **Nothing done yet.** A proper empty state per `DESIGN.md` §8.

**`averageRating` and its tests already existed** in `lib/tester.ts` before the payments-removal PR deleted them. Recover them from that diff rather than rewriting — and note in the spec that this section is where the reputation display, flagged as outstanding three times in the monetisation plan, finally lands.

## 2.4 — The plan section

**Migration:** `alter table accounts add column plan_id text`. Nullable; null means Community. **No CHECK constraint** — enforce the vocabulary in Zod, consistent with `SKILLS`, `COUNTRIES` and the rest.

**`lib/plans.ts`**, static TypeScript, not a table — the same reasoning as `lib/testTemplates.ts`. Content comes from `docs/Twnhall_Monetisation_Plan_v4.docx` §3: tester reports per month, testers per mission, active missions, AI insights, CSV export, shareable report, priority queue.

The section shows the current plan, what the other tier includes, and a **contact CTA. There is no checkout.** Per the plan's Phase 2, upgrading opens a conversation — `/contact`. Do not build a Subscribe button that goes nowhere.

**Add a plan control to the admin console.** `app/(admin)/admin/users/` and `actions/admin/users.ts`. Without it, adding the column does not actually let you record a sale, and the manual upgrade path stays broken.

**Do not enforce anything.** No report counting, no mission caps, no blocked actions. This PR records who is on which plan and shows it. Tier enforcement is separate work with its own sequencing. Say so in the spec so nobody half-builds it.

## 2.5 — Tests

- The account control renders the right variant for each `hasTesterAccount` state.
- Ratio renders `—` when received is 0.
- The reciprocity section renders its empty state for a user with no tester account.
- `plan_id` round-trips through the admin override.
- Existing `actions/__tests__/profile.test.ts` still passes.

---

# PR 3 — CSV export

**Branch:** `feat/feedback-export`
**Base:** `main` with PR 2 merged
**Migration:** none
**Risk:** medium — ownership and injection are both real

Adds the fourth Settings section.

## 3.1 — One row per entry, not per submission

A submission has N `test_result_entries`. CSV is flat. Export **one row per entry**, repeating the submission columns — that is what filters and pivots usefully in a spreadsheet, and it avoids cramming a list into a cell.

Suggested columns: project name, mission title, test category, device target, submitted at, tester name, submission status, builder rating, step index, step action, step expected, step status, actual result, issue summary, steps to reproduce, AI sentiment, screenshot count.

**Legacy submissions must not be silently dropped.** Twenty-four predate the audit log and carry only `tester_comment` with no entries. Each gets one row with the comment populated and the step columns empty. `components/submissions/SubmissionBody.tsx` is the existing precedent for branching on these two shapes — follow it, do not invent a second rule.

## 3.2 — CSV injection is a real attack path, not a formality

A field beginning with `=`, `+`, `-` or `@` is interpreted as a **formula** by Excel and Google Sheets. A tester can write `=HYPERLINK("http://evil","click")` into an issue summary, the builder opens the export, and it executes.

**Every field passes through a neutraliser** before it reaches the file — prefix a leading `=`, `+`, `-` or `@` with a single quote, on top of normal quote-and-escape handling. Put it in one function, test it directly, and name the threat in the spec so it does not get "simplified" away later.

## 3.3 — Ownership, and no middleware to lean on

The export must contain **only** feedback on missions belonging to projects the caller owns. Service-role client with an explicit `owner_id = user.id` filter, per `CLAUDE.md`. Getting this wrong leaks other builders' feedback, which is about as bad as it gets here.

**`app/api/` is excluded from the middleware matcher** — check `middleware.ts`. A Route Handler therefore gets **no** gate. It must call `requireAccount('builder')` itself. This is exactly the case `CLAUDE.md`'s two-layer rule warns about, with one of the layers structurally absent.

## 3.4 — Mechanics

- **Route Handler** returning `text/csv` with `Content-Disposition: attachment`. Not a client-side blob — the data needs a server-side ownership check before it is assembled.
- **UTF-8 with a BOM.** Without it Excel mangles non-ASCII, which means Nigerian names and the naira sign.
- **Scope selector:** all projects, or one project. Per-mission is over-granular for a settings page.
- **Filename:** dated and identifiable, e.g. `twnhall-feedback-2026-09-22.csv`.
- **Empty state:** if there is no feedback yet, say so rather than downloading an empty file.
- Note as a `ponytail:` that this loads everything into memory. Fine at current volume; it will need streaming eventually.

## 3.5 — PII

Include the tester's display name — the builder already sees it in the app. **Never include email addresses.** A CSV leaves your control the moment it is downloaded.

## 3.6 — Tests

- The injection neutraliser, tested directly against all four leading characters.
- A builder's export contains their feedback and **none** of another builder's.
- An unauthenticated request to the route is rejected.
- Legacy comment-only submissions appear, with empty step columns.
- Quotes, commas and newlines inside a field survive a round trip.

---

## Constraints — all three PRs

- Semantic tokens only after PR 1. Never hard-code a literal colour.
- One voltage CTA per viewport.
- Syne headings, DM Mono UI, 4px grid.
- **Down to 360px.** The Settings page grows from one form to four sections; long metric rows and a plan comparison are both things that break narrow.
- Control names match schema keys, per `CLAUDE.md`. Never disable a submit button to mean "not finished".

## Documentation

- **`CLAUDE.md`** — the surface rule is gone (§1.1); `accounts.plan_id` in the data model; the export route's self-auth requirement.
- **`DESIGN.md`** — four semantic colour pairs as one documented pattern; the shadow variant.
- **`TownHall_Checklist (1).xlsx`** — QA rows for both themes across every route, the moved sidebar items, each Settings section, and an export round-trip opened in a real spreadsheet.

## Out of scope

Tier enforcement of any kind. The tester dashboard's own revamp. Public pages. The DM Mono long-form question, still open.
