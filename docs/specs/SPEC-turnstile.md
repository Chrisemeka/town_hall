# SPEC: Cloudflare Turnstile on the auth forms

**Status:** Implemented on `feat/turnstile-captcha`
**Branch:** `feat/turnstile-captcha`
**Base:** `main` (at `d6fc8ba`)
**Depends on:** Nothing. Captcha is already on in the Supabase dashboard.
**Source:** `docs/TWNHALL_TURNSTILE_PROMPT.md`
**Migration:** none
**Risk:** high, and already being paid. See §0.

## Summary

Bot signups are arriving, and captcha protection is already switched on in
Supabase with the Turnstile secret installed. GoTrue now refuses every
protected auth call that arrives without a token, and the app sends none. This
PR renders the Turnstile widget in the four email forms, carries its token
through `FormData` to the server actions, and passes it to Supabase as
`options.captchaToken`.

## Non-goals

- A widget on Google sign-in (§4).
- Calling Cloudflare's `siteverify` from the app (§5).
- Changing any rate limit value, deleting accounts, or changing when the
  signup grant is issued (§7).
- Captcha on anything that is not an auth endpoint.

## §0 — Live incident: three of four forms are broken now

Probed 2026-10-09 against the live project, with the anon key and an invented
`@example.invalid` address (no account, so nothing was created or sent):

| Call | GoTrue answer |
|---|---|
| `POST /token?grant_type=password` | `400 captcha_failed` — "no captcha_token found" |
| `POST /recover` | `400 captcha_failed` |
| `POST /resend` | `400 captcha_failed` — **resend is protected**, the docs just don't say |
| `POST /signup` | not probed: if captcha weren't enforced it would create an account. The docs say it's protected, and it gets the same fix. |

**Email/password sign-in, password reset and resend are down in production.**
Google sign-in still works. The app hides all three failures:

- `signInWithEmail` maps every error to "That email and password do not
  match." A user with the right password gets told it's wrong, and the
  obvious next step (reset it) is broken too.
- `requestPasswordReset` logs the error and shows "a reset link is on its
  way". No link comes.
- `resendConfirmation` shows the raw GoTrue message.

So the fix ships first, and the error mapping in §2.3 is part of it.

## §1 — Keys

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: public, rendered into the HTML. Already
  in `.env.local`. **Must be added to Vercel (preview and production) before
  deploy.** Without it the widget can't render and every form shows the §3
  load-failure message.
- The secret key lives only in the Supabase dashboard. It is not an app
  variable and the app never calls `siteverify`. `.env.example` lists the site
  key and a comment saying the secret stays out of the app, so nobody "fixes"
  the gap by adding it to Vercel.
- **Local dev:** `localhost` must be in the widget's hostname allowlist in the
  Cloudflare dashboard, or the widget will fail to render in dev. This is the
  first thing that will confuse someone running locally.

## §2 — How the token travels

### 2.1 Widget: direct script, no dependency

`components/public/auth/Turnstile.tsx` loads
`https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` once
and calls `turnstile.render()` on a container inside the `<form>`. I'm not
using `@marsidev/react-turnstile`. The lifecycle work in §3 comes down to
three callbacks and one `reset(widgetId)` call, about forty lines. A wrapper
dependency would hide the one behaviour (reset after every submission) that
we most need to be able to see.

Turnstile writes the token into a hidden input it creates in the container.
`response-field-name` is set to `captcha_token`, the schema key, so the
control name matches the schema (CLAUDE.md, Validation). The container gets
`id="captcha_token"`, so `useFocusFirstError` has something to scroll to,
because the hidden input can't take focus.

### 2.2 Server

`captchaTokenSchema = z.string().min(1, "Complete the verification above.")`.
It's added as `captcha_token` to `signUpSchema` and `signInSchema`. Reset and
resend use a new `emailCaptchaSchema` (`emailOnlySchema` plus the token).
`emailOnlySchema` itself stays as it is, because `/confirm-email` uses it to
parse its query string, and a query string carries no token. A missing token comes back as a field error, like any other
field. Each action passes it through:

```ts
supabase.auth.signUp({ email, password, options: { captchaToken, … } })
supabase.auth.signInWithPassword({ email, password, options: { captchaToken } })
supabase.auth.resetPasswordForEmail(email, { captchaToken, redirectTo })
supabase.auth.resend({ type: "signup", email, options: { captchaToken, … } })
```

The client-side pre-parse in `SignUpForm` / `SignInForm` reads `captcha_token`
from the same `FormData`. So a click before the widget has issued a token says
"Complete the verification above." beside the widget, without a round trip.

### 2.3 Error mapping

GoTrue answers a bad, expired or reused token with `error.code ===
"captcha_failed"`. All four actions map that to a `captcha_token` field error:
"Verification expired. Complete it again and resubmit." It never reads as a
wrong password. `requestPasswordReset` still swallows every *other* error (the
enumeration rule). A captcha failure doesn't depend on whether the address
exists, so surfacing it leaks nothing.

## §3 — Token lifecycle

- **Reset after every submission.** Each form calls `reset()` whenever its
  `useActionState` result changes identity. On success the action redirects,
  so in practice this is the failure path: a wrong password followed by the
  right one works on the second try. A reset also clears the hidden input, so
  a resubmit before the new token arrives gets the client-side "complete the
  verification" message, not a dead token.
- **Expiry while the form sits open.** `refresh-expired: "auto"`: Turnstile
  fetches a fresh token when the old one expires. If a dead token still gets
  through, GoTrue's `captcha_failed` comes back as "Verification expired",
  and the reset above issues a new one.
- **Widget failure.** If the script fails to load (blocked, offline) or
  `error-callback` fires, a line in the widget's place says: "Verification
  couldn't load. Check your connection or disable blockers for this page, then
  refresh." The submit button stays live. Pressing it gives the field error
  beside that line.
- **The submit button is never disabled waiting for a token.** The one
  existing exception, `ResendConfirmation`'s cooldown, is a statement about
  the server and stays as it is.

## §4 — Google sign-in is exempt

`signInWithOAuth` redirects to Google. There's no form post to attach a token
to, and GoTrue doesn't expect one. **No widget on the Google button.** Don't
add one for symmetry. OAuth signups stay uncaptcha'd, and that's correct:
Google does the bot filtering on that path.

## §5 — Rate limiting: leave it

The limiter runs before the Supabase call, so a submission that fails captcha
still spends a rate-limit hit. **Decision: leave it.**

- Checking captcha first would mean calling `siteverify` from the app, which
  puts the secret key in Vercel. **Rejected:** the secret's whole value is that
  only Supabase holds it, and a verified token is single-use, so we'd have to
  verify, then hand GoTrue a token it then refuses as already spent.
- The cost is small. `signin:email` is 10 per 15 minutes. With §3's reset, a
  stale token costs one hit, not a run of them.
- Raising limits to absorb captcha retries is out of scope and not needed.

Rate limiting is not relaxed. Captcha stops automation at the door; the
limiter stops a human or a solver service grinding.

## §6 — Appearance

- `theme` comes from `document.documentElement.dataset.theme`. That's the
  attribute `app/layout.tsx` sets from `readTheme()`, so it's the app's
  resolved theme, never `auto`. *Ceiling:* a theme toggled while an auth form
  is open leaves the widget in the old theme until reload. Rare, cosmetic,
  left as it is.
- Size is picked from the container's width at render. `flexible` fills the
  card when the container is 300px or wider. Below that it's `compact`
  (150px): at a 360px viewport the card's content box is about 232px, and
  `flexible`'s minimum of 300px would overflow it. `AuthCard`'s padding is
  unchanged. *Ceiling:* the size isn't re-picked on resize.
- The widget goes directly above the submit button.

## §7 — Bot damage audit: not run, needs the user

The audit queries (signups per day, unconfirmed counts, grant rows held by
profiles with no verified account) were blocked in-session by the permission
classifier as PII handling, even the aggregate-only version. The user should
run them, or allow them. What to look at:

- `auth.users` per day for the last three weeks, split by provider and
  `email_confirmed_at`. A bot run shows up as password signups that never
  confirm.
- `report_ledger` rows with `kind = 'grant'` whose profile has no
  `accounts.verification_completed_at`. That's the outstanding grant
  liability, at 3 reports each.
- Whether any of those grants were spent: `kind = 'reserved'`,
  `bucket = 'grant'`.

What the existing tools can do: `/admin/users` sets `moderation_status` /
`ban_reason` per profile. Unconfirmed password signups can't get past
`/confirm-email`, so they can't publish, test or spend a grant. Nothing gets
mass-deleted in this PR. If the grant liability is material, moving the grant
to first project is a separate decision.

## §8 — What this stops

Turnstile stops naive automation: scripted posts, headless browsers, simple
frameworks. It doesn't stop a solver service or a real driven browser. With
the per-IP limits, it should handle the current influx. **Measure:** password
signups per day on `/admin` and the Turnstile dashboard's solve and fail
rates, for a week after deploy. If signups don't fall, the problem isn't
naive automation, and the response is different.

## §9 — Tests

`actions/__tests__/auth-email.test.ts`, extending the existing mocks:

- Each of the four actions with no `captcha_token` returns a `captcha_token`
  field error, makes no Supabase call and spends no rate-limit hit (the parse
  runs first).
- A token reaches the Supabase call as `captchaToken`.
- `captcha_failed` from GoTrue comes back as a `captcha_token` field error
  ("expired"), on sign-in not as "do not match", and on reset not as success.
- A captcha failure spends a rate-limit hit (§5): the limiter mock was
  called.
- `signInWithGoogle` passes no captcha token.

The widget's reset-after-failure is client behaviour, and the repo has no DOM
test environment. The reset is one effect keyed on the action state, and it
goes on the by-hand list (§10, case 2) rather than pulling in jsdom.

## §10 — By hand, both themes, 360px and desktop

1. Sign up with email. The account is created and the confirmation arrives.
2. **Wrong password, then the right one. The second attempt works.**
3. Request a password reset. The email arrives.
4. Resend a confirmation.
5. Google sign-in: no widget, works as before.
6. Leave sign-in open six minutes, then submit. It goes through, or shows the
   verification message. No dead form.

## Commits

1. `Pass the Turnstile token through the auth actions`: schemas, actions,
   error mapping, tests.
2. `Render Turnstile on the four email auth forms`: component, forms.
3. `Document Turnstile`: CLAUDE.md, `.env.example`, checklist rows.
