# SPEC: Verification Gate

**Status:** Ready to build
**Branch:** `feat/verification-gate`
**Depends on:** None (foundation feature)
**Blocks:** Every other MVP feature that requires a verified account

## Summary

Add a per-role verification gate to Twnhall. A user cannot use a role (builder or tester) until they have completed a role-specific profile. Verification is stored on `accounts.verification_completed_at` and enforced in the same two-layer pattern as `profiles.accepted_terms_at`.

## Why

Every subsequent MVP feature — paid missions, reputation, structured feedback — assumes we know who the person is and what they can do. Right now the only identity data Twnhall has is what Google returns at OAuth. That is not enough to accept payouts, match testers to missions, or give builders a basis for choosing whether to accept a tester's work.

## Non-goals

The following are explicitly out of scope for this feature. Do not build them.

- BVN/NIN capture — deferred to the paid-missions feature where payout rails require it
- GitHub/LinkedIn OAuth linking — deferred to reputation feature
- Skill quizzes, profession verification, document uploads — deferred
- SMS/phone verification codes — the phone number is captured but not verified in this feature
- Admin ability to manually mark an account verified — the gate is user-driven only
- Reactivating a verified account after deletion — out of scope
- Any UI reflecting verification status to other users (e.g., "verified tester" badge) — deferred to reputation feature

## Data model changes

One migration. One new column.

```sql
ALTER TABLE accounts
  ADD COLUMN verification_completed_at timestamptz NULL;

CREATE INDEX idx_accounts_verification_completed_at
  ON accounts (verification_completed_at)
  WHERE verification_completed_at IS NULL;
```

The partial index is deliberate — the common query is "is this account unverified?" and the null-only index keeps it fast without indexing every verified row forever.

**Existing rows:** the migration leaves all existing `verification_completed_at` values NULL. All 36 existing accounts (and any created before this ships) will hit the gate on next login. This is intentional — see `CLAUDE.md` on the `accepted_terms_at` gate pattern.

**New profile columns** to hold the collected data. All nullable so partial completion is possible:

```sql
ALTER TABLE profiles
  ADD COLUMN country text NULL,
  ADD COLUMN phone text NULL,
  ADD COLUMN timezone text NULL,
  ADD COLUMN bio text NULL,
  ADD COLUMN skills text[] NULL DEFAULT '{}';
```

Rationale for column placement: `country`, `phone`, `timezone` are per-person, not per-role — a person doesn't have two countries. `bio` and `skills` are conceptually per-role (a person's tester bio differs from their builder identity), but storing them on `profiles` is fine for MVP because a person only has one narrative about themselves. If we later need per-role bios, we split then.

## Fields collected

**Tester profile completion** collects:

| Field       | Required | Source                    | Validation                                    |
|-------------|----------|---------------------------|-----------------------------------------------|
| Full name   | Yes      | Pre-filled from Google    | Non-empty, 2–80 chars                         |
| Country     | Yes      | Dropdown, ISO 3166-1      | Must be in enum                               |
| Phone       | Yes      | Text input                | E.164 format, validated by Zod                |
| Timezone    | Yes      | Dropdown, IANA tz names   | Must be in IANA list; auto-detect as default  |
| Bio         | Yes      | Textarea                  | 50–500 chars                                  |
| Skills      | Yes      | Multi-select tag input    | 1–8 tags from a fixed vocabulary              |

**Builder profile completion** collects:

| Field       | Required | Source                    | Validation                                    |
|-------------|----------|---------------------------|-----------------------------------------------|
| Full name   | Yes      | Pre-filled from Google    | Non-empty, 2–80 chars                         |
| Country     | Yes      | Dropdown, ISO 3166-1      | Must be in enum                               |
| Phone       | Yes      | Text input                | E.164 format, validated by Zod                |

**Skills vocabulary** (fixed list for this feature — expandable later):
`Frontend`, `Backend`, `Mobile`, `Design`, `Product`, `Data`, `DevOps`, `QA`, `AI/ML`, `Non-technical user`

The vocabulary lives in `lib/vocabulary.ts` as an exported const array, imported by the Zod schema and the tag-input component. Do not hardcode it in two places.

## Auth changes

Follow the exact pattern of `accepted_terms_at`. Three files:

**`lib/auth.ts` — `requireAccount()`**

The function currently returns the resolved account. Extend it to:

1. Read `accounts.verification_completed_at` for the active account.
2. If NULL, redirect to `/verify/[role]` where `[role]` is `builder` or `tester`.
3. If NOT NULL, return the account as normal.

Do not add a new function. Do not add an "opt-out" parameter. The gate is unconditional for any surface that goes through `requireAccount()`.

**`middleware.ts`**

Mirror the same check at URL level for protected routes. If the active `th_account` cookie resolves to an unverified account, redirect to `/verify/[role]`. Follow the same intersection-with-real-accounts pattern that already exists — never trust the cookie alone.

**`lib/access.ts` — `accessFor()`**

The `/verify/[role]` route itself must be accessible to logged-in users with an unverified account. Add it to `accessFor()` explicitly. Do not let the gate lock users out of the gate.

## UI

New route: `/verify/[role]` where `[role]` is `builder` or `tester`.

The page is a multi-step form. Steps:

**Tester (`/verify/tester`):**
1. Confirm identity — full name (pre-filled, editable), country dropdown, phone input
2. Tell us about yourself — bio textarea with character counter (Design.md §5.2 pattern), timezone dropdown
3. Your skills — multi-select tag input from the fixed vocabulary
4. Review — read-only summary of steps 1–3 with an "Edit" link on each section, plus a Primary "Complete verification" button

**Builder (`/verify/builder`):**
1. Confirm identity — full name (pre-filled, editable), country dropdown, phone input
2. Review — read-only summary, Primary "Complete verification" button

**Design conformance:**
- Single column, max-width `640px`, centered — matches the New Project form pattern (Design.md §6.3).
- Form card: Graphite background, 16px radius, 40px padding.
- Step indicator at the top: dots or numbered pills, DM Mono 12px, Voltage for active step, Ash for inactive.
- Field styling: Design.md §5.2 form input specs exactly. No deviations.
- CTA per step: Primary MD "Continue" plus Ghost "Back" (except step 1, no back).
- Final step: Primary LG "Complete verification". This is the one Voltage button on the page — per Design.md, one Primary per viewport.
- Error handling: Zod errors displayed inline below each field in Ember, DM Mono 12px, per Design.md §5.2.

**Progressive save:** each "Continue" click persists what has been entered so far to `profiles` (partial update). If the user drops off mid-flow, they return to where they left off. The gate does not open until step "Review" is submitted, which sets `accounts.verification_completed_at = now()`.

**Post-verification:** redirect to the role's default landing surface — `/dashboard` for builder, `/tester` for tester.

## Server actions

Two new server actions in `actions/verification.ts`:

**`saveVerificationStep(role, stepData)`**
- Auth: `requireAccount()` but **without the new verification check** (obvious chicken-and-egg — use a lower-level helper for this specific case).
- Validates `stepData` against the Zod schema for that step.
- Updates the relevant columns on `profiles`.
- Does NOT set `verification_completed_at`.
- Returns `{ success: true }` or Zod field errors.

**`completeVerification(role)`**
- Auth: same as above.
- Reads the profile, re-validates the entire dataset against the full role schema (defense in depth — the partial saves might have skipped a step).
- If validation passes: sets `accounts.verification_completed_at = now()` for the active account (`type = role`).
- Returns `{ success: true, redirectTo: '/dashboard' | '/explore' }` or Zod field errors.
- Uses the service-role client for the write, per the RLS pattern in `CLAUDE.md`.
- Revalidates `/dashboard` and `/explore`.

**Refactor note:** because these actions cannot go through the standard `requireAccount()` (which would redirect them to `/verify/[role]` in a loop), introduce a new helper in `lib/auth.ts` called `requireAccountForVerification()`. Same signature and body as `requireAccount()` but skips the verification check. Comment must explain why it exists — future readers will otherwise assume it's a bug.

## Validation

All schemas in `lib/validation/schemas.ts`. Zod, per `CLAUDE.md`.

- `testerVerificationSchema` — full schema, all six fields required
- `builderVerificationSchema` — full schema, three fields required
- `testerStep1Schema`, `testerStep2Schema`, `testerStep3Schema` — partial schemas per step
- `builderStep1Schema` — partial schema
- Phone validation uses `libphonenumber-js` (add to package.json) with `.parsePhoneNumberFromString(v).isValid()`. Do not roll a regex.
- Country enum sourced from `lib/vocabulary.ts` (also new — export `COUNTRIES` as `readonly [string, ...string[]]` for Zod).
- Timezone enum sourced from `Intl.supportedValuesOf('timeZone')` at build time, exported from the same file.

## Acceptance criteria

1. Migration adds `verification_completed_at` to `accounts` and the five new columns to `profiles`.
2. Migration ships with a documented rollback in the same file (SQL comments — no separate down-migration, per how existing migrations in `supabase/migrations/` are structured).
3. An unverified user visiting any protected route is redirected to `/verify/[role]` — both by middleware and by in-page `requireAccount()`.
4. A verified user is never redirected to `/verify/[role]` — visiting it directly redirects them to their role's landing surface.
5. The tester flow collects all six fields across four steps; each step's data persists on "Continue"; drop-off returns to the last incomplete step.
6. The builder flow collects three fields across two steps; same persistence behavior.
7. Zod validation runs on both client (inline errors) and server (via server action). Server-side validation is authoritative.
8. `completeVerification` sets the timestamp only when the full role schema passes.
9. `completeVerification` writes only to the active role's `accounts` row — a person who has both builder and tester accounts and completes tester verification does NOT get their builder account verified.
10. `/verify/[role]` is added to `accessFor()` in `lib/access.ts` and accessible to logged-in-but-unverified users.
11. `requireAccountForVerification()` exists in `lib/auth.ts` with a comment explaining why it bypasses the verification check.
12. Vitest coverage for both server actions following the pattern in Test.md §1 — auth rejection (unauth), happy path (valid data), Zod rejection (invalid data), and the timestamp-is-set assertion.
13. `npx tsc --noEmit` passes.
14. `npm run lint` passes with no new `as any` casts.
15. `npm run build` succeeds.

## Manual test plan

Run these against a local Supabase after each commit lands (see the prompt for commit sequencing):

**After migration commit:**
- Query `\d accounts` in psql. Confirm `verification_completed_at timestamptz NULL` present.
- Query `\d profiles`. Confirm five new columns present.
- Query `SELECT count(*) FROM accounts WHERE verification_completed_at IS NULL;` — should equal current row count.

**After server-actions commit:**
- Call `saveVerificationStep` from a test script with invalid phone. Expect Zod error.
- Call `saveVerificationStep` with valid data. Expect success + column populated.
- Call `completeVerification` with an incomplete profile. Expect Zod error.
- Call `completeVerification` on a fully-populated profile. Expect success + timestamp set.

**After middleware/auth commit:**
- Manually set `verification_completed_at = NULL` for your own account in Supabase console.
- Log in. Expect redirect to `/verify/tester` or `/verify/builder`.
- Manually set the timestamp back to `now()`. Refresh. Expect no redirect.
- Try to visit `/verify/tester` while verified. Expect redirect to `/explore`.

**After UI commit:**
- Full flow as a new user for each role.
- Drop off mid-flow, log out, log back in. Expect to land back on the incomplete step.
- Submit step 1 with an invalid phone. Expect inline error, no navigation.

## Rollout note

Because existing accounts will all be forced through the flow on first login post-deploy, ship this with a short banner (already-existing toast/banner component if available) on the `/verify/[role]` page: "Twnhall now requires a completed profile before you can [test missions / manage projects]. This takes about a minute." — DM Mono 14px, Ash text, Voltage border-left per Design.md §6.7's Mission Instructions block styling.

That is the only user-facing communication in this feature. No emails, no in-app announcements.
