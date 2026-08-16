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
  (developer)/        Builder-facing routes (/dashboard/**)
  (tester)/           Tester-facing routes (/explore/**, /mission/[id])
  (admin)/            Admin console (/admin/**)
  api/                Route Handlers (webhooks, auth callback)
components/           React components
lib/
  auth.ts             requireAccount(), requireAdmin() — auth checks used inside pages/actions
  access.ts           accessFor() — the single pure function for route permissions
  ai.ts               Gemini client
  validation/         Zod schemas
emails/               React Email templates
middleware.ts         URL-level auth gates, session refresh, no-store headers
supabase/migrations/  SQL migrations
```

## Data Model

Five live tables. Concepts match the UI except "feedback" — the table is `test_results`.

```
profiles ──┬── accounts        one identity, two roles (builder + tester)
           ├── projects        owned by profile
           └── test_results    tester's submission on a mission
                    │
missions ───────────┘          mission belongs to project
```

| Table          | Key columns |
|----------------|-------------|
| `profiles`     | `id` (= `auth.users.id`), `full_name`, `avatar_url`, `email`, `role`, `moderation_status`, `ban_reason`, `banned_at`, `banned_by`, `accepted_terms_at`, `seen_tours` |
| `accounts`     | `id`, `user_id` → `profiles.id`, `type` (`builder` \| `tester`), `created_at`. Unique on `(user_id, type)`. |
| `projects`     | `id`, `owner_id` → `profiles.id`, `name`, `description`, `app_url`, `flagged_at`, `flag_reason`, `flagged_by` |
| `missions`     | `id`, `project_id`, `title`, `task_description`, `is_active`, `payout_cents`, `category`, `load_test_at`, `testers_needed` |
| `test_results` | `id`, `mission_id`, `tester_id`, `screenshot_url`, `screenshot_urls[]`, `tester_comment`, `ai_summary`, `ai_sentiment`, `status` (`pending`\|`approved`\|`changes_requested`\|`paid`), `rating`, `review_note`, `reviewed_at` |

## Auth — the load-bearing patterns

**One identity, two accounts.** A person is one `profiles` row with up to two `accounts` rows (`type='builder'` and `type='tester'`). Google OAuth + Supabase's unique email constraint means one person cannot hold two identities. Anything scoped to a role must live on `accounts`, not `profiles`.

**Two layers, always.** Every protected route is gated in **two** places:

1. `middleware.ts` — URL-matcher gate, refreshes session, sets `no-store` on protected routes.
2. `requireAccount()` / `requireAdmin()` in `lib/auth.ts` — re-checked inside every page and server action.

The second exists so that if someone edits the middleware matcher, protection does not disappear. Never rely on middleware alone. Never rely on the in-page check alone.

**Route permissions come from one function.** `accessFor()` in `lib/access.ts` is the single source of truth used by middleware, server code, and `scripts/access.test.mts`. Extend it there — do not scatter permission logic.

**The `th_account` cookie is not authority.** It records which role the user is currently acting as. It is unsigned. Always intersect it with the user's real `accounts` rows (see `lib/auth.ts`, mirrored in `middleware.ts`) before trusting it. A forged cookie must resolve to a real account the user holds, or to `null`.

**Gate pattern for "must complete X before Y."** Precedent: `profiles.accepted_terms_at` is a nullable timestamp — middleware and `requireAccount()` refuse to let the user past protected surfaces until it is set. Verification uses the same shape but on `accounts` (per-role): `accounts.verification_completed_at`. When adding future gates, follow this pattern rather than inventing new mechanisms.

## Data Mutations — RLS + service role

RLS is on with almost no policies. The pattern is deliberate.

- **Privileged reads** go through `createAdminClient()` (service role).
- **The single anon-key RLS policy** is "tester can read their own submissions."
- **Writes go through service role** because RLS cannot restrict *which columns* an update touches. A "builder can review submission" policy would also let a builder rewrite the tester's own comment. So builder reviews are performed server-side with the service-role client, which restricts the column set in code.

Follow this. Do not add RLS policies to solve auth — solve it in the server action with `requireAccount()` + service-role client + explicit column list.

## Atomicity — plpgsql, not ORM transactions

There is no ORM. Nothing exposes `$transaction` or similar. Anything requiring atomicity is a **plpgsql function** in `supabase/migrations/` called via `supabase.rpc('name', args)`. Examples: `commit_mission_credits`, `request_withdrawal` (both reverted, but the pattern remains).

When you need a transaction: write the SQL function in a new migration, invoke via `.rpc()`. Never simulate transactions with sequential `.from().update()` calls.

## Validation

All input validated with Zod at the boundary (`lib/validation/schemas.ts`). Server actions parse `FormData` or JSON through a schema before touching the database. Do not skip. Do not scatter validation through helper functions — it lives at the entry point.

## Design System

Canonical reference: `Design.md`. Non-negotiable rules Claude Code must honor without re-reading the file:

- **Fonts:** Syne (Bold 700) for headings. DM Mono (Regular 400 / Medium 500) for UI, body, buttons, code. No other fonts.
- **Grid:** All spacing values divisible by 4. No exceptions.
- **Accent:** `#E8FF47` (Voltage). One Primary/Voltage CTA per viewport. If you catch yourself adding a second, one of them is wrong.
- **Color never conveys state alone.** Always pair a badge/indicator color with a text label.
- **Contrast:** Body text ≥ 7:1. Labels and large text ≥ 4.5:1. Verify at WebAim before shipping a new pairing.
- **Surfaces:** Dashboard is dark (Obsidian `#0E0E10` base). Landing is light (Bone `#F5F5F7`). Do not mix.

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

- **`missions.payout_cents`** — the column exists but its payment machinery was reverted. Do not wire anything to it outside of the explicit paid-missions feature work.
- **The `avatars` Storage bucket** — it does not exist in this project. If a Supabase example references it, ignore. `avatar_url` on `profiles` is Google's remote URL populated in `app/api/auth/callback/route.ts`, not something Twnhall stores.
- **`ARCHITECTURE.md`** — stale on the Gemini model version at minimum. Read only for historical context. This file wins on conflict.
- **RLS policies** — do not add them to solve auth. Use `requireAccount()` + service-role client + explicit column lists (see Data Mutations above).

## Reference Documents

| Document          | Canonical for                                 | Trust it?                          |
|-------------------|-----------------------------------------------|-------------------------------------|
| `CLAUDE.md`       | This file. Codebase patterns and conventions. | Yes — wins on any conflict.         |
| `Design.md`       | Visual system, components, empty states.      | Yes.                                |
| `Test.md`         | Test cases, coverage expectations, gates.     | Yes.                                |
| `ARCHITECTURE.md` | Superseded by this file.                      | No — read only for historical context. |
