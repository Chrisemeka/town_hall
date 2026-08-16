# SPEC: Profile Editor

**Status:** Ready to build (after `feat/verification-gate` merges)
**Branch:** `feat/profile-editor`
**Base branch:** `main` (updated with verification-gate merged)
**Depends on:** `feat/verification-gate` — the columns being edited (`country`, `phone`, `timezone`, `bio`, `skills`) were introduced there
**Blocks:** Nothing directly, but improves the collected-data experience for every future feature

## Summary

Extend the existing Settings > Profile section to allow editing of the fields introduced by the verification gate: `country`, `phone`, `timezone`, `bio`, and `skills`. Reuse existing patterns — the `SaveProfileForm` component, the "Save Profile" button, the success toast. Introduce no new UX patterns.

Includes a small refactor as commit 1: relocating the skills combo box out of `components/verification/` into a shared location (`components/inputs/`), since it's now used in two places.

## Why

The verification gate collects data that testers and builders never see again after they complete verification. That's a broken loop — users who provided their phone number or skills expect to be able to view and update them. This spec closes that loop.

## Non-goals

Explicit non-goals to prevent scope creep:

- **No avatar upload.** Avatar stays as the Google OAuth URL. Adding upload requires a new Storage flow, image resizing, and moderation — that's a separate feature.
- **No re-verification on edits.** Editing phone, country, or any other field does NOT clear `verification_completed_at`. Users legitimately change these values; forcing re-verification would be user-hostile.
- **No notification preferences.** Deferred.
- **No email editing.** Email stays locked (auth invariant).
- **No timezone auto-detect button.** Users pick from the dropdown as they do at verification.
- **No searchable country combo box.** Country stays as a plain `<select>`, same pattern as verification.
- **No confirmation modals on destructive edits.** Zod validation handles the one destructive case (removing all skills, blocked by min-1 constraint).
- **No admin-facing view of profile data.** Admins can already see profiles via the admin console; that surface is unchanged.
- **No display of role-specific stats (missions completed, rating, etc.).** That's reputation-layer work, separate feature.

## Data model changes

**None.** Every column edited by this feature already exists on `profiles` from the verification-gate migration:
- `country` — text
- `phone` — text (E.164 normalized)
- `timezone` — text (IANA)
- `bio` — text
- `skills` — text[]

Also unchanged: `full_name` (already editable), `email` (locked), `avatar_url` (locked).

No new migrations. No new tables. No new columns.

## Server actions

One new server action in `actions/profile.ts` (extend if the file already exists, create if not):

**`updateProfile(fields)`**
- Auth: `requireAccount()` — no bypass needed, this is a role-scoped surface
- Validates `fields` against a new `updateProfileSchema` in `lib/validation/schemas.ts` — this schema is a subset of `testerVerificationSchema` covering only editable fields, plus `bio` which is optional (nullable, max 500 chars)
- Applies `normalizeSkills()` to the skills field if present, same as verification actions
- Uses service-role client for the write, restricted to the six editable columns: `full_name`, `country`, `phone`, `timezone`, `bio`, `skills`. Explicit column list — do not use a spread
- Returns `{ success: true }` or `{ error: string, fieldErrors?: Record<string, string> }`
- Revalidates `/settings`

**Field visibility on save:** the server action accepts a partial payload. A user editing only their phone number sends `{ phone: "..." }` and only that column is updated. Other fields are not touched. This matches the intent of "one form per section, but users often only change one field."

**Skills-only rule:** the `skills` field on the payload is only accepted if the user has a tester account. If a builder-only user's payload includes `skills`, the server action silently drops it (does not error — the field just won't reach the DB). Reasoning: builders don't have skills, and defending against this at the server is easier than trusting the UI to hide the field correctly.

## UI

Extend the existing Settings page. The Profile section currently has:
- Display Name (editable)
- Email (locked)
- Save Profile button (existing)

Add below Display Name and above Email:

- **Country** — same `<select>` component and styling as the verification flow's country dropdown
- **Phone** — same input with `AsYouType` formatting and non-numeric filter as the verification flow's phone input
- **Timezone** — same `<select>` component and styling as the verification flow's timezone dropdown
- **Bio** — textarea, optional, max 500 chars, live character counter (matches Design.md §5.2 textarea pattern)
- **Skills** — the relocated combo box component (see refactor below). Only rendered if the user has a tester account. Uses the same styling and behavior as the verification skills step.

All fields pre-populated from the current profile data.

Field ordering top-to-bottom: Display Name, Country, Phone, Timezone, Bio, Skills, Email (locked), Save Profile button.

**Save behavior:**
- Click "Save Profile" triggers `updateProfile` with all currently-filled field values
- On success: show existing success toast (whatever pattern the current Save Profile flow uses)
- On Zod field errors: display inline in Ember, DM Mono 12px, below each field with an error
- On generic server error: display a banner above the Save Profile button in Ember, DM Mono 14px

**No re-verification prompt.** No "Are you sure? This may require re-verification" copy anywhere. The gate does not re-fire on edits.

## Refactor — commit 1 of this PR

Move the skills combo box from `components/verification/` to `components/inputs/SkillsInput.tsx` (or match your existing convention if `components/inputs/` doesn't exist — put it somewhere shared, not under a feature-specific folder).

- Update the one existing import in the verification flow to reference the new path
- Run existing tests to confirm nothing broke
- The component's props and behavior are unchanged
- Commit as: `refactor(components): relocate SkillsInput to shared inputs folder`

This is the first commit of the PR, before any profile-editor work. Reviewer can verify the relocation is behavior-preserving before evaluating the feature.

## Zod schemas

New schema in `lib/validation/schemas.ts`:

```
updateProfileSchema = z.object({
  full_name: z.string().min(2).max(80).optional(),
  country: countryEnum.optional(),
  phone: phoneSchema.optional(),
  timezone: timezoneEnum.optional(),
  bio: z.string().max(500).nullable().optional(),
  skills: skillsArraySchema.optional(),
})
```

All fields optional so partial payloads are valid. Reuses the same primitives (`countryEnum`, `phoneSchema`, `timezoneEnum`, `skillsArraySchema`) as the verification schemas — extract these into named exports if they aren't already, so both features share the same source of truth.

`bio` is nullable AND optional: `null` means "user explicitly cleared their bio," missing means "user didn't send this field, don't touch the DB."

## Acceptance criteria

1. Skills combo box is relocated from `components/verification/` to `components/inputs/` (or equivalent shared location), verification flow imports from the new path, verification tests still pass.
2. `updateProfileSchema` exists in `lib/validation/schemas.ts` and reuses the same primitive schemas as verification.
3. `updateProfile` server action exists in `actions/profile.ts`, validates against the schema, applies `normalizeSkills` when skills are present, writes only to the six explicitly-listed columns.
4. `updateProfile` uses service-role client (not RLS-dependent).
5. `updateProfile` silently drops the `skills` field if the caller does not have a tester account.
6. `updateProfile` does NOT modify `verification_completed_at` under any circumstances.
7. Settings > Profile section renders all editable fields pre-populated with current values.
8. Skills field is only rendered when the user has a tester account.
9. Save Profile button triggers `updateProfile` with all currently-entered values.
10. Success shows the existing success toast pattern used elsewhere on Settings.
11. Zod field errors display inline in Ember per Design.md §5.2.
12. Server error displays as a banner in Ember above the Save Profile button.
13. Vitest coverage for `updateProfile`: unauth rejection, Zod rejection for invalid inputs, happy path with column verification, per-role skills isolation (builder-only user attempting skills update — assert skills column is unchanged), no-change verification (`verification_completed_at` unchanged after edit).
14. `npx tsc --noEmit` passes.
15. `npm run lint` passes with no new `as any` casts.
16. `npm run build` succeeds.

## Manual test plan

Run against local dev server after the UI commit lands:

**As a builder-only user:**
- Load `/settings`. Confirm all editable fields present, populated correctly, no Skills field visible.
- Change phone number to something valid. Save. Confirm success toast, confirm value persists on refresh.
- Change phone to something invalid. Save. Confirm inline Ember error, no navigation, no toast.
- Change country. Save. Confirm persists.
- Clear bio (if any). Save. Confirm bio is null in DB after.

**As a tester (with a tester account):**
- Load `/settings`. Confirm Skills field is visible.
- Add a skill via the combo box. Save. Confirm persists.
- Remove all skills. Confirm Zod error (min-1) prevents save.
- Add a duplicate skill. Confirm inline error, no save.

**As a user with both accounts:**
- Load `/settings` while active role is builder. Confirm Skills field IS visible (per decision 8 — show if user has tester account regardless of active role).
- Switch active role to tester. Refresh `/settings`. Confirm Skills field still visible.
- Edit skills. Save. Confirm persists.
- Switch back to builder. Confirm skills value unchanged.

**Verification invariant:**
- Note your `verification_completed_at` timestamp for both accounts before editing.
- Edit and save your profile.
- Query `accounts.verification_completed_at` for both accounts — confirm unchanged.

## Reference

- Verification gate spec: `docs/specs/SPEC-verification-gate.md` (includes Amendment 01)
- Codebase patterns: `CLAUDE.md`
