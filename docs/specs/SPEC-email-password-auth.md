# SPEC: Email and Password Auth

**Status:** Ready to build — **§0's three blockers are all cleared**
**Branch:** `feat/email-password-auth`
**Base:** `main` with `feat/public-theme` and `feat/public-pages` merged
**Depends on:** PR 1 (tokens, shell), PR 2 (public pages, footer)
**Source:** `docs/TWNHALL_UI_REVAMP_STAGE1_PROMPT.md` — PR 3
**Migration:** none
**Risk:** **high** — touches the auth invariant the whole app rests on

## Summary

Add email + password as a second way in, alongside Google. Four new pages
(`/signup`, `/login`, `/forgot-password`, `/reset-password`), one new gate page
(`/confirm-email`), an email-confirmation gate inserted at the front of the
existing chain, and an initials avatar everywhere `avatar_url` is null.

## §0 — What was blocked, and how it resolved

Three things this spec could not close from inside the repo. **All three are
now answered**; each entry records what came back.

### 0.1 — The existing users' confirmation state — **CLEAR**

```
total: 41   confirmed: 41   unconfirmed: 0
```

**Ship the gate as specified. No grandfather clause**, because there is nobody
to grandfather: every existing user already has `email_confirmed_at` set, which
is what OAuth does at first sign-in. Nobody is locked out on deploy.

(The brief said 36 existing users. It is 41 — the number grew between the brief
being written and this being built. It does not change the answer.)

### 0.2 — The Supabase Auth settings — **CLEAR**

| Setting | Required | Actual | |
|---|---|---|---|
| Confirm email | On | **On** | ✓ |
| Minimum password length | ≤ 8 | **8** | ✓ exactly — the project minimum is our Zod minimum, so neither is looser |
| Per-user min interval between emails | ≥ 60s | **60s** (GoTrue default) | ✓ §6.2's cooldown stands on this |
| Automatic identity linking | link only on a confirmed email | **verified by hand — see §5** | ✓ better than required |

One correction that mattered while this was open: *"allow manual linking"* is
`GOTRUE_SECURITY_MANUAL_LINKING_ENABLED`, which enables `linkIdentity()` for an
**already signed-in** user to attach another provider to their own account.
That is a different setting from automatic linking, that direction is safe, and
**Twnhall does not call it** — nor should it without a separate decision.

Automatic linking is not a dashboard toggle at all, so §0.2 could never have
been closed by reading a setting. §5 closed it by test.

### 0.3 — Email throughput — **CLEAR, configured**

The built-in sender caps a project at **2 emails per hour across all users**,
which is a queue rather than a signup flow: the third person to sign up in an
hour gets nothing, and cannot tell that apart from a typo'd address.

**Custom SMTP → Resend is configured.** The cap no longer applies. It remains a
setup step for any fresh environment, which is why it is in the README rather
than only here — and the confirmation and reset copy lives in the Supabase
dashboard templates, not in `emails/`.

### 0.4 — Signup rate limiting: 30 per 5 minutes per IP

Also volunteered, and it belongs in the record next to the decision to skip a
bot check: **sign-up/sign-in is limited to 30 per 5 minutes per IP.** That is
not a bot check — it is per-IP, and anything distributed walks straight past
it — but it is not nothing either. It bounds the damage a single source can do
to roughly 360 attempts an hour. Recorded in §9.

## Non-goals

- **No Cloudflare Turnstile or any bot check.** The reference design shows one;
  the brief skips it. Recorded as known risk in §9 — **email signup is
  spammable and the confirmation gate is the only thing standing in front of
  it.** Supabase's built-in rate limits help and are not a bot check.
- **No migration.** Supabase owns email-confirmation state; the
  `accepted_terms_at` / `verification_completed_at` pattern does **not** apply
  here, and adding a column would create a second answer to a question
  `auth.users` already answers.
- **No avatar upload, no `avatars` bucket.** `CLAUDE.md` is explicit. Initials
  only.
- **No social providers beyond Google.**
- **No account-settings page for changing email or password.** The reset flow
  covers the password; changing an email is a separate feature with its own
  re-confirmation problem.
- **No "I've verified — continue" button** on `/confirm-email`. The brief drops
  it and is right: it invites clicking before the mail is read, and the
  confirmation link already returns the user to the app.

## §1 — The name collision, settled first

**`app/verify/[role]/` already exists and means "complete your role profile."**
It is the per-role verification gate on `accounts.verification_completed_at`.
It has nothing to do with email.

The new page is **`/confirm-email`**. Not `/verify/email`, not `/verify-email`.
Two gates with near-identical names is how someone eventually wires the wrong
one — and `lib/access.ts` already exports `VERIFY_PREFIX = "/verify"` and
`isVerifyPath()`, both of which would start matching a page that is not part of
that gate at all.

| Path | Gate | Stored on |
|---|---|---|
| `/verify/[role]` | Role profile complete? | `accounts.verification_completed_at` |
| `/confirm-email` | Email address proven? | `auth.users.email_confirmed_at` (Supabase's) |

## §2 — The gate chain

Current order, from `app/api/auth/callback/route.ts` and `middleware.ts`:

```
auth → profile upsert → terms → choose-account → per-role verification → home
```

Email confirmation inserts **first**:

```
auth → EMAIL CONFIRMED? → profile upsert → terms → choose-account → verification → home
```

**Supabase's `email_confirmed_at` is the source of truth.** It arrives on the
`user` object that `supabase.auth.getUser()` already returns in middleware — so
the gate costs **no extra query**, and it can be read before the profile fetch
that the terms gate needs.

### 2.1 — Two layers, as always

Per `CLAUDE.md`: never middleware alone, never the in-page check alone.

1. **`middleware.ts`** — before the terms gate, after the anonymous bounce:
   if `user && !user.email_confirmed_at` and the path is not `/confirm-email`,
   redirect to `/confirm-email`.
2. **`lib/auth.ts`** — `resolveAccountOrRedirect()` is where the identity half
   of the guard already lives, and every protected surface reaches it through
   `requireAccount()` or `requireAccountForVerification()`. The email check goes
   **there**, before the account resolution, so both paths inherit it and no
   new exported helper is needed.

### 2.2 — Three exemptions, and no more

- **`/confirm-email` itself.** Same shape as the terms gate's exemption: the
  page that lifts a gate is the one page the gate must not apply to.
- **`/reset-password`.** A recovery link signs the user in with a session whose
  email may be unconfirmed if the account was never confirmed. Bouncing them to
  `/confirm-email` mid-recovery strands them.
- **Sign-out.** Already reachable — it is a server action, not a gated route.

**Admins are not exempt.** The terms gate exempts `role === 'admin'`; this one
does not. An admin with an unproven address is the same risk as anyone else,
and the escape hatch (resend, confirm) is always open. Noted because the
asymmetry with the terms gate will look like an oversight otherwise.

### 2.3 — Signed-in users on the auth pages

`middleware.ts` currently bounces a signed-in user off `/` only. `/login` and
`/signup` join that bounce — a signed-in user shown a login form is a bug
report waiting to happen. `/forgot-password` and `/reset-password` do **not**:
a signed-in user resetting their password is a legitimate thing to be doing.

## §3 — `lib/access.ts`

`/confirm-email` and `/reset-password` join `SHARED_PREFIXES`, for the reason
`/terms-accept` is there: they are per-person, not per-role, and they must not
be role-scoped or the verification gate fires on a page the user needs in order
to get past an earlier gate. §8's test covers the composition.

`/login`, `/signup` and `/forgot-password` need no entry — `accessFor()` already
allows anything no role prefix claims, exactly as in PR 2. They are pinned by
test, not by list.

`middleware.ts`'s `protectedPrefixes` gains `/confirm-email` (it needs a session
to be meaningful) and **not** `/login`, `/signup`, `/forgot-password`,
`/reset-password` — an anonymous user must reach all four.

## §4 — The profile upsert, and a bug the brief's plan would hit

The brief says: *"`full_name` must go into `user_metadata` at `signUp()` so the
existing callback upsert picks it up unchanged — read that upsert before writing
this."* I read it. **It will not pick it up.**

```ts
.upsert({ id, email, full_name, avatar_url }, { onConflict: 'id', ignoreDuplicates: true })
```

`ignoreDuplicates: true` makes the whole row a no-op when a profile already
exists — which is correct and deliberate (it must never clobber an edited name
or an accepted-terms timestamp). But a profile row **already exists by then**:
Supabase's `on_auth_user_created` trigger fires on the INSERT into `auth.users`,
which happens at `signUp()` time, before the confirmation link is clicked. By
the time the callback runs, the row is there and the upsert does nothing.

Whether that row carries the name depends on whether the trigger copies
`raw_user_meta_data->>'full_name'`. **The trigger is not in this repo** — no
migration defines it — so that cannot be answered here either.

**Fix, and it is correct whichever way the trigger behaves:** after the upsert,
backfill *only columns that are currently null* from `user_metadata`. The
callback already re-reads the profile on the next line, so this costs no extra
read:

- `full_name` null and metadata has one → set it.
- `avatar_url` null and metadata has one → set it.
- Anything already set → untouched, always.

This also fixes a case that exists today: a Google sign-in on an account whose
profile was created some other way never backfills the avatar.

## §5 — Identity linking — **verified, and case 2 is closed by GoTrue**

The scenario: someone signs up with `alice@gmail.com` and a password, then later
clicks "Continue with Google" with the same address.

**Case 2 was tested by hand against the project and characterised.** The result
is better than the spec asked for — GoTrue does not merely decline to link an
unproven credential, it **invalidates it**:

| Observed | |
|---|---|
| 13:25:15 | Unconfirmed password signup on the address |
| 13:26:42 | Google sign-in on the same address takes over the existing row |
| After | `email_confirmed_at` set by the OAuth login; the email identity **removed** (`identity_count: 1`, `providers: ["google"]`); `encrypted_password` **cleared** (`has_password: false`); the original password rejected at `/login` |

So the takeover path is shut by design, not by anything in this repo. An
attacker who types someone else's address at signup does not gain a credential
that survives the real owner arriving — it is destroyed by their arrival.

| Case | Behaviour | Status |
|---|---|---|
| Password first, **confirmed**, then Google | Links into one row: two identities, one profile, one set of `accounts`. | As specified |
| Password first, **unconfirmed**, then Google | Google takes the row. The password identity and the password itself are discarded. | **Verified — closed by GoTrue** |
| Google first, then password signup, same address | No second identity, no working password, no disclosure that the address is taken. | As specified |
| Google first, then password **reset** | Sets a password on the existing user. The intended route for the case above. | As specified |

`CLAUDE.md`'s invariant — "one person cannot hold two identities" — holds
throughout: there is never more than one `auth.users` row for an address.

### 5.1 — The consequence, which is a real one

**A legitimate user who signs up with a password, skips confirmation, then
signs in with Google silently loses their password.** Nothing tells them. They
find out the next time they try to use it, possibly months later, and the
symptom — "my password stopped working" — points at nothing.

This cannot be prevented in our code; it is GoTrue discarding an unproven
credential, which is the correct thing for it to do. So it is handled by saying
so, in the two places it is about to matter:

1. **A standing line under the sign-in form:** *"Signed up with Google? Use the
   Google button above."* **Standing, not conditional** — a message that appears
   only when the address happens to be a Google account is an enumeration
   oracle, and the generic failure message stays generic.
2. **A line on `/confirm-email`**, which is the moment someone is deciding
   whether to bother: confirming is what keeps the password working.

**Not in `/guides/builder` or `/guides/tester`.** Those are about writing test
cases and filing audit logs; a paragraph on credential lifecycle in the middle
of one would be noise to every reader who has not hit it. The two placements
above are where the person is standing when it becomes relevant.

**No automated test.** Every branch is GoTrue behaviour, so a mocked Supabase
client would assert the mock and nothing else. It was verified by hand and the
transcript is above; the standing line is static copy.

## §6 — The pages

All four public auth pages live in the `(public)` group and use PR 1's semantic
tokens. Layout per the brief's reference: a centred card on a tinted ground,
max-width 440px, `surface-raised` on `surface`, 16px radius, 40px padding.

**Per `CLAUDE.md`:** every control's `name` equals its schema key
(`useFocusFirstError` and `FieldError` both resolve by that string — `SettingsForm`
is the cautionary tale), and **no submit button is ever disabled to mean "not
finished"**. Validate on click, name the missing field.

**Per `DESIGN.md`:** the auth card's inputs take `border-ink-muted`, not
`border-line` — `line` is 1.19:1 and fails WCAG 1.4.11's 3:1 for a control
boundary. `components/ui/Field` and `inputClass()` are dark-surface (`bg-obsidian`,
`text-chalk`) and **cannot be reused here**; the public auth card needs the
semantic-token spelling of the same chrome. One small `components/public/AuthField.tsx`,
not a second design.

### 6.1 — `/signup` and `/login`

**`/signup`:** Google button, an "or sign up with email" divider, then
`full_name`, `email`, `password`, `confirm_password`. Link to `/login`.

`full_name` goes into `user_metadata` at `signUp()` via `options.data`, and
`options.emailRedirectTo` points at `/api/auth/callback` — the confirmation link
comes back through the same PKCE `?code=` exchange the OAuth flow uses, so the
callback handles both with no branch. See §4 for the backfill that makes the
name actually land.

On success, redirect to `/confirm-email?email=<address>`. The address is in the
query because with "Confirm email" on there is **no session yet** — `signUp()`
returns a user and no session — so the page has nothing else to read it from.
It is not a secret (the user just typed it), and `next.config.ts` already sets
`Referrer-Policy: strict-origin-when-cross-origin`, so the path does not leak
cross-origin.

**`/login`:** Google, divider, `email` + `password`, "Forgot password?" →
`/forgot-password`, link to `/signup`. **One page for everyone** — no
builder/tester split, per the brief's standing decision.

A sign-in attempt against an unconfirmed account must fail closed. Supabase
returns `email_not_confirmed`; surface it as a form-level error offering the
resend link, never as a generic "wrong password", which sends people to reset a
password that is fine.

### 6.2 — `/confirm-email`

"We sent a link to **`<email>`**", a **Resend** button, and "Wrong address?
Sign out and register again."

**The cooldown is 60 seconds, enforced by GoTrue, surfaced by us.** Without one
this is an email-bomb button pointed at whatever address was typed.

`supabase.auth.resend({ type: 'signup', email })` is rate-limited by the
project's *max frequency for sending emails* (§0.2, default 60s) and returns
`over_email_send_rate_limit` when called too soon. The action surfaces that
error rather than swallowing it; the button shows a visible countdown on top.

**That is the server-side enforcement, and it is Supabase's, not ours** — which
is the right place for it given "migration: none" and given that `auth.users`
already holds `confirmation_sent_at`. Rebuilding a rate limiter in app code
would mean a second, weaker answer to a question the auth server already
answers. The consequence is that §0.2's max-frequency setting is load-bearing,
not cosmetic.

`resend()` does not disclose whether an address exists, so the page's response
is identical either way.

### 6.3 — `/forgot-password` and `/reset-password`

`resetPasswordForEmail(email, { redirectTo: '/reset-password' })`. The response
is **always** the same — "If that address has an account, a link is on its way"
— whether or not it does. Anything else is an enumeration oracle.

`/reset-password` reads the recovery session, collects `password` +
`confirm_password`, calls `updateUser({ password })`. If there is no recovery
session (link expired, opened in another browser), it says so and offers
`/forgot-password` again rather than rendering a form that cannot work.

## §7 — Avatars

`app/api/auth/callback/route.ts` reads `avatar_url` from Google metadata.
Email/password users have none, and `CLAUDE.md` is explicit that the `avatars`
bucket does not exist and Twnhall stores no images for this.

**The survey found this is mostly already handled, and one place where it is
not:**

| Surface | Today | After |
|---|---|---|
| `components/admin/SubmissionsList.tsx` | initials | `<Avatar>` |
| `app/(admin)/admin/users/page.tsx` | initials | `<Avatar>` |
| `app/(admin)/admin/ai-reports/page.tsx` | initials | `<Avatar>` |
| `components/layout/TopNav.tsx` | **generic person icon** | `<Avatar>` — initials |

Three byte-identical copies of an `initials(name, email)` helper exist across
those files. One `components/ui/Avatar.tsx` takes `{ src, name, email, size }`
and renders the image or the initials, and the three copies are deleted with it.

That is what makes "a null `avatar_url` renders initials everywhere" true by
construction rather than by inspection — which matters, because every
email/password user from here on has a null one.

`app/(admin)/admin/missions/[id]/page.tsx` passes `avatarUrl` through to
`SubmissionsList` and needs no change of its own.

## §8 — The public shell

PR 1 left a single "Continue with Google" button in the header with a note that
PR 3 replaces it. It does:

- **Header:** `Sign in` (secondary → `/login`) and `Get started` (the one
  Voltage fill → `/signup`). The Google form button comes out — both auth pages
  offer Google above the divider, so the header no longer needs to.
- **Footer:** `Get started` → `/signup` joins the Guides column, completing the
  four-column table PR 2 left one entry short. The Guides-column Google form
  button becomes a plain `/login` link.
- **Mobile sheet:** `Sign in` and `Get started` join the link array.

## §9 — Tests

Vitest for the actions, following `Test.md` §1 and the existing
`actions/__tests__/*.test.ts` pattern (`vi.mock` of `next/navigation`,
`@/lib/supabase/server`, `@/lib/supabase/admin`; a redirect is a throw).

**`actions/__tests__/auth-email.test.ts`**

| Case | Expected |
|---|---|
| `signUpWithEmail` happy path | `signUp()` called with `options.data.full_name` and `emailRedirectTo`; redirect to `/confirm-email?email=…` |
| duplicate email | Supabase's obfuscated response surfaces as the same success page — **no disclosure** |
| password under 8 | Zod field error on `password`, no Supabase call |
| mismatched confirmation | Zod field error on `confirm_password`, no Supabase call |
| `signInWithEmail` wrong password | `{ error }` on the form, no redirect |
| `signInWithEmail` unconfirmed | blocked, error names confirmation and offers resend — **not** "wrong password" |
| `resendConfirmation` rate-limited | `over_email_send_rate_limit` surfaced, not swallowed |
| `requestPasswordReset` unknown address | identical response to a known one |

**`scripts/access.test.mts` — extended.** `/confirm-email` and
`/reset-password` allowed for builder, tester and null; neither role-scoped.
Extend the existing gate-composition walk so the chain
`email → terms → account → verification` is shown to terminate — it already
proves the last three do; this adds the new first link.

**`lib/__tests__/initials.test.ts`** — the helper is about to serve every
avatar in the product: empty name falls through to email, one-word name, an
address with dots, an empty-everything case returning `""` rather than throwing.

**Not tested, and the spec says why:** §5's linking matrix. Every branch is
GoTrue behaviour; a mocked Supabase client would assert the mock. Verified by
hand against a staging project, and case 2 is the one that must be tried
deliberately.

## §10 — Documentation

- **`README.md`** — the env block is missing `SUPABASE_SERVICE_ROLE_KEY`,
  `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`, `WEBHOOK_SECRET` and `CRON_SECRET`
  today. Complete it, and add the **Supabase Auth SMTP** step (§11).
- **`CLAUDE.md`** — the `/confirm-email` vs `/verify/[role]` distinction, the
  gate order, and the identity-linking requirement.
- **`DESIGN.md`** — the centred auth card.
- **`TownHall_Checklist (1).xlsx`** — QA rows for signup, confirmation, resend
  cooldown, password reset, Google/password linking, and a null-avatar sweep.

## §11 — The branded confirmation email is configuration, not code

The reference shows branded mail from `verify@task2k.com`. **That does not come
from `emails/`.** Supabase Auth sends confirmation and recovery mail through its
own SMTP with its own templates — React Email in this repo has no part in it.

To brand it: point **Supabase Auth SMTP at Resend** (the account and domain
already exist) and edit the **Confirm signup** and **Reset password** templates
in the Supabase dashboard. Configuration, outside the repo, and easy to miss —
hence §10's README entry.

Until that is done the mail arrives from Supabase's default sender, which is
functional and unbranded. **It does not block the PR**, but it is the first
thing a new user sees.

## Acceptance criteria

1. `/signup`, `/login`, `/forgot-password`, `/reset-password` and
   `/confirm-email` render in the `(public)` group, correct in both themes at
   360px, 768px and 1440px.
2. Signing up with email creates an unconfirmed user and lands on
   `/confirm-email` showing the address that was typed.
3. A signed-in user with a null `email_confirmed_at` is redirected to
   `/confirm-email` from every protected route — **by middleware and by
   `lib/auth.ts` independently.** Disabling one must not open the gate.
4. `/confirm-email` and `/reset-password` are reachable while unconfirmed.
5. Confirming the email continues into the terms gate, then choose-account,
   then per-role verification, in that order.
6. **Existing Google users reach their dashboard with no new gate** — verified
   against §0.1's answer, not assumed.
7. Resend is refused inside 60 seconds, server-side, and the refusal is shown
   rather than swallowed.
8. Sign-in with an unconfirmed address is blocked and says so.
9. `/forgot-password` gives an identical response for a known and an unknown
   address.
10. `/reset-password` without a recovery session explains itself instead of
    rendering a dead form.
11. §5's four linking cases behave as specified — **checked by hand**, with the
    settings from §0.2 recorded in the PR description.
12. Every avatar surface renders initials when `avatar_url` is null; the three
    duplicate `initials()` helpers are gone.
13. `full_name` from signup reaches `profiles.full_name` (§4), and no existing
    profile column is overwritten by the backfill.
14. Header and footer offer Sign in / Get started; no dead links.
15. No submit button is disabled to express incompleteness; every control name
    matches its schema key.
16. `scripts/access.test.mts` and the new Vitest file pass; `npm test` green.
17. `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`.
18. `README.md` documents every env var and the SMTP step.

## Manual test plan

**Before anything else:** run §0.1's command and record the output in the PR.

**Signup**
- New address → mail arrives → link → terms → choose-account → verify → home.
- Same address again → same page, no "already registered" disclosure.
- Password `1234567` → inline error on `password`, focus moves there, no request.
- Mismatched confirmation → inline error on `confirm_password`.

**The gate**
- Sign up, do not confirm, force a session, visit `/dashboard` → `/confirm-email`.
- Comment out the middleware branch → still gated by `lib/auth.ts`. Restore.
- Comment out the `lib/auth.ts` branch → still gated by middleware. Restore.

**Resend**
- Press twice inside 60s → second is refused with a countdown, not silently.

**Reset**
- Known address and unknown address → identical response.
- Open the link, change the password, sign in with the new one.
- Open an expired link → explanation, not a dead form.

**Linking — the one that matters (§5 case 2)**
- Sign up `test+link@…` with a password. **Do not confirm.**
- Sign in with Google using the same address.
- **Expected: not linked.** If the Google sign-in lands in the account the
  password created, stop — that is the takeover path, and the project's linking
  setting is wrong.

**Avatars**
- A password user's initials in the sidebar, admin users, admin submissions and
  AI reports. Then a Google user's photo in all four.

## Commit sequence

1. `feat(auth): add the email confirmation gate`
2. `fix(auth): backfill null profile columns from user metadata`
3. `feat(auth): add signup and sign-in with email`
4. `feat(auth): add the confirm-email holding page`
5. `feat(auth): add password reset`
6. `refactor(ui): render initials wherever an avatar is missing`
7. `feat(public): offer Sign in and Get started in the shell`
8. `test(auth): cover the email actions and the new gate`
9. `docs: record the confirm-email gate and the SMTP step`

## Open questions

Both in §0, both pre-merge, neither blocking the code:

1. **Do all existing users have `email_confirmed_at` set?** One command, above.
2. **What are the four Supabase Auth settings?** Dashboard, and case 2 of §5
   tried by hand.
