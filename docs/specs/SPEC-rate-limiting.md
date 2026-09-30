# SPEC: Rate Limiting

**Status:** Draft — awaiting approval
**Branch:** `feat/rate-limiting`
**Base:** `main` (at `10ad1d1`)
**Depends on:** Nothing.
**Source:** `docs/TWNHALL_RATE_LIMITING_PROMPT.md`
**Migration:** `20261002_01_rate_limits.sql` — one table, one RPC
**Risk:** medium. Cost-bearing actions fail closed, so a limiter bug can stop
people working. The kill switch (§3.3) is the recovery path.

## Summary

A short-window abuse guard on the surfaces that spend money, email reputation
or tester supply. One Postgres table, one atomic plpgsql function, one pure
module holding the numbers and the arithmetic, one thin module that calls the
RPC and decides what a store failure means.

**A rate limit is not an allowance.** The allowance (`lib/allowance.ts`) is a
business quota — reports a month, spent at publish. A rate limit is "five of
these an hour, or you are probably a script". They live in separate modules
with separate vocabulary and neither imports the other. Mission publish is
limited *before* `publishMission()` is called, and the limiter never learns
what the allowance said.

## Non-goals

- Allowance enforcement, shadow metering — separate PRs, already merged.
- CAPTCHA, WAF, bot detection, IP reputation. This PR is the floor.
- A limit on AI analysis. It runs in `submitTestResult`'s `after()`, so the
  submission limit covers it. A `ponytail:` note goes there: when generation
  becomes builder-triggered it needs its own key.

## §1 — The store

**Postgres, in the existing Supabase project.** Not Upstash, not Redis. Vercel
instances share nothing in memory, so the counter has to live somewhere shared,
and at tens of requests a minute the extra round trip to Supabase costs nothing
worth measuring. A new vendor is a new line on a $66/month budget.

*Honest ceiling:* every limited request is a write to one table. At roughly a
hundred times today's traffic that table becomes a hotspot and this should move
to a KV store. The module boundary (§3) is the one place that would change.

### Table

```sql
create table public.rate_limits (
  key          text        not null,  -- e.g. 'signin:email:a@b.com'
  window_start timestamptz not null,
  hits         int         not null,
  primary key (key, window_start)
);
create index on public.rate_limits (window_start);
alter table public.rate_limits enable row level security;  -- no policies
```

### `rate_limit_hit(p_key text, p_limit int, p_window_seconds int)`

Returns `(allowed boolean, retry_after int)`. **Fixed window**: the window is
`floor(epoch / window) * window`, and the check-and-increment is one statement —

```sql
insert into rate_limits (key, window_start, hits) values (p_key, v_start, 1)
on conflict (key, window_start) do update set hits = rate_limits.hits + 1
returning hits into v_hits;
```

The upsert takes the row lock, so two concurrent calls at the boundary
serialise: one sees `limit`, the other `limit + 1`. No read-then-write in
application code, so nothing to race. `SECURITY DEFINER`, `search_path`
pinned, execute revoked from `anon` and `authenticated`, granted to
`service_role` — the `submit_audit_log` pattern.

*Fixed window ceiling:* a burst straddling a boundary can get up to 2× the
limit through. Acceptable for an abuse floor; a sliding window is the upgrade
if it ever matters.

### Cleanup

**A sweep inside the same function, on roughly 1 call in 100:**
`delete from rate_limits where window_start < now() - interval '1 day'`, using
the `window_start` index. Chosen over a periodic job because there is no job
infrastructure in this project (no `pg_cron` use, no Vercel cron) and adding
one for a garbage table is more machinery than the garbage. Chosen over a
per-key delete because keys that never come back (an attacker's IPs) would
never be cleaned. The longest window is one hour, so a day's margin never
deletes a live row. At today's volume the table stays in the hundreds of rows.

## §2 — What is limited

All numbers live in `RATE_LIMITS` in `lib/rateLimit.ts` and nowhere else.

### Tier 1 — unauthenticated, email-sending (degrade on store failure)

| Surface | Action | Keys | Limit | Fallback (per instance) |
|---|---|---|---|---|
| Sign-up | `signUpWithEmail` | IP | 10 / hour | 3 / hour |
| Sign-in | `signInWithEmail` | IP | 30 / 15 min | 10 / 15 min |
| | | email | 10 / 15 min | 5 / 15 min |
| Password reset | `requestPasswordReset` | IP | 10 / hour | 3 / hour |
| | | email | 5 / hour | 2 / hour |
| Resend confirmation | `resendConfirmation` | IP | 10 / hour | 3 / hour |
| | | email | 5 / hour | 2 / hour |
| OAuth / confirm callback | `app/api/auth/callback` | IP | 30 / 10 min | 10 / 10 min |

- **Every attempt counts**, success or failure. Counting only failures needs a
  peek-then-record pair of calls; ten sign-ins in fifteen minutes is not a
  legitimate pattern worth the second round trip.
- **Email is normalised** (`trim().toLowerCase()`) before it becomes a key.
- **Layered on Supabase Auth's limits, not replacing them.** GoTrue's
  30 emails/hour and 60-second per-user interval are per address; these are
  per IP and catch the case it cannot see — one actor working through a list.
  `resendConfirmation`'s comment and its `over_email_send_rate_limit` branch
  stay; the comment is updated to say this is the other half.
- **Fallback numbers are about a third of the normal limit.** A person hitting
  several Vercel instances gets a bucket on each; a third assumes about three
  warm instances, which is generous for current traffic. Sign-in's email
  fallback stays at 5 so a legitimate person with a few typos still gets in
  during an outage.
- **The email key is a lockout lever.** Anyone can spend a victim's 10
  sign-in attempts and keep them out of *password* sign-in for up to fifteen
  minutes. That is the cost of keying on email, which the brief requires
  because IP-only limiting on a login is decorative. Google sign-in and
  password reset are separate buckets and stay open.

### Tier 2 — authenticated, cost-bearing (fail closed)

Keyed on the profile id. Past the auth gate, the account is the identity.

| Action | Where | Limit |
|---|---|---|
| Test result submission | `submitTestResult`, after auth, before the upload | 10 / hour |
| Mission publish | `createMission` (intent publish), `updateMission` (intent publish), `toggleMissionStatus(…, true)` — before `publishMission()` | 20 / hour |
| Project create | `createProject` | 10 / hour |
| Feedback export | `app/api/export/feedback` | 10 / hour |

- **Submission, 10 an hour.** A real audit log takes a tester well over five
  minutes; ten an hour is a ceiling nobody honest reaches, and a script meets it
  inside a minute. One report per mission already exists; this bounds the
  count across missions.
- **Screenshot upload has no key of its own.** The only upload path is inside
  `submitTestResult`, after the limit check, so uploads are bounded at
  10 submissions × `MAX_SCREENSHOTS` (10) = 100 images an hour per account, and
  refused submissions upload nothing. A separate key would limit the same thing
  twice. If an upload path ever exists outside submission, it needs one.
- **Mission publish is counted on the publish intent, not on the allowance's
  answer.** A publish the allowance refuses still counts — the limiter does not
  read the allowance, by design.
- **Server Actions are POSTs to the page route.** Middleware sees the POST but
  cannot tell which action it carries, so action limits live in the action.
  This is written in `lib/rateLimitDb.ts`'s header so nobody goes looking in
  `middleware.ts`.

### Tier 3 — the API routes

The matcher excludes `api`, and **it stays that way.** Each route limits
itself, because:

- the gate chain in `middleware.ts` (confirm → terms → verify → `accessFor`)
  is written for pages and would redirect a webhook or a callback mid-flow;
- `scripts/access.test.mts` and MW-03 assume the exclusion;
- every API route already gates itself (`requireAccount()`, `requireAdmin()`,
  the webhook secret), so the limit sits beside a check that already exists.

| Route | Finding | Change |
|---|---|---|
| `webhooks/submission` | A secret check **exists**: `x-webhook-secret` against `WEBHOOK_SECRET`, 401 on mismatch, 500 if unset. It is a shared secret, not an HMAC signature — Supabase Database Webhooks send a static header, so that is what is available. The compare is `!==`, which is not constant-time. | Constant-time compare (`crypto.timingSafeEqual`). Limit per IP, 120 / minute, degrade mode. The legitimate caller is Supabase itself, so the limit is generous: it caps a flood of unauthenticated requests, it does not meter real submissions. |
| `export/feedback` | Tier 2 behaviour at an API path. | 10 / hour per account, fail closed, **after** `requireAccount("builder")`. |
| `auth/callback` | Code-exchange attempts. | Tier 1, per IP (table above). |
| `admin/payouts` | Admin-only, already `requireAdmin()`. | Nothing. Not in the brief; an admin is not an abuse vector worth a key. |

### The contact route needs nothing

`lib/contact.ts` is a `mailto:` address and an X link. There is no server
endpoint, so nothing to abuse. **If a server-side contact form ever replaces
the mailto, it is the most abusable endpoint in the app on day one** and needs
a Tier 1 limit before it ships.

## §3 — Failure behaviour

`lib/rateLimitDb.ts` exports one function:

```ts
checkRateLimit(rule: RateLimitName, key: string): Promise<RateLimitResult>
// { ok: true } | { ok: false, retryAfter: number }
```

Each rule carries a `mode`, and the mode decides what a store failure means.

### 3.1 — `degrade` (Tier 1, webhook)

The RPC errors or throws → **log `[rate-limit] store unavailable, degrading to
in-memory` at `console.error`** → apply the stricter fallback limit from a
per-instance `Map`. Never a total lockout: a database blip must not become
"nobody can sign in", including the person fixing it.

This does not touch authentication. RLS, `requireAccount()` and middleware
never consult the limiter; a degraded limiter means brute force is less
throttled for a few minutes, never that anyone gets in without credentials.

The in-memory map is only used in degraded mode. Stale entries are dropped
when read; it is bounded by one outage's worth of IPs on one instance.

### 3.2 — `closed` (Tier 2)

The RPC errors or throws → `console.error('[rate-limit] store unavailable,
refusing', rule)` → `{ ok: false, retryAfter: 60 }`. The action does not
proceed. The worst case for an honest tester is "try again in a minute".

### 3.3 — The kill switch

`RATE_LIMIT_DISABLED=true` — every check returns `{ ok: true }` without
touching the store, and logs `[rate-limit] DISABLED by RATE_LIMIT_DISABLED`
at `console.warn` **on every check**, so it cannot sit forgotten in the logs.
Unset or anything else means enabled. On Vercel an env change needs a
redeploy of the existing build, not a new build — "Redeploy" on the current
deployment, no code change.

## §4 — Responses

**Server actions** cannot answer 429 — they return the form state every form
already renders (`AuthCard`'s `role="alert"`, `danger-ink`, themed in both
modes). A limited action returns
`{ success: false, error: tooManyMessage(retryAfter) }`.

**API routes** return **429** with `Retry-After: <seconds>` and the same
message as a plain-text body.

**The message** comes from one function, `tooManyMessage(seconds)`:

- ≤ 90 s → "Too many attempts. Try again in a minute."
- otherwise → "Too many attempts. Try again in N minutes." (rounded up)

It never states the limit, the count or the window.

**Two browser-navigation routes need more than a status code**, because a 429
on a top-level navigation renders the browser's own unthemed page:

- **Export** is an `<a download>`. `ExportPanel` changes to fetch the CSV,
  show `tooManyMessage` in `danger-ink` under the button on a 429, and save the
  blob otherwise. The route still answers 429 + `Retry-After`.
- **Callback** redirects to `/login?error=rate_limited` rather than answering
  429 — it is a redirect endpoint and every other outcome of it is a redirect.
  `/login` shows the message through the existing `AuthCard` alert.
  **(decide — see Open questions.)**

### Enumeration

The limiter runs **before** any Supabase Auth call and knows nothing about
whether an address exists, so a limited response is byte-identical for a real
and an invented address, and returns without the auth round trip in both
cases — same body, same timing class. A test pins it.

## §5 — Tests

Pure: `lib/__tests__/rateLimit.test.ts`

- under the limit passes; at the limit the next fails; the next window passes;
- sign-in IP and email keys are independent;
- `Test@x.com ` and `test@x.com` produce the same key;
- the in-memory fallback is stricter than the store limit for every rule;
- `tooManyMessage` never contains the limit or window numbers.

Wrapper: `lib/__tests__/rateLimitDb.test.ts`, RPC mocked

- degrade-mode rule with the store down → falls back, still allows a first
  sign-in, logs the fallback;
- closed-mode rule with the store down → refused;
- `RATE_LIMIT_DISABLED=true` → allowed, RPC never called;
- **concurrency** — against an in-memory fake RPC that does what the upsert
  does, `limit + 1` concurrent calls produce exactly `limit` passes. The real
  proof is the single-statement upsert; the migration header carries a manual
  SQL check for it (two sessions, one key).

Actions: extend the existing suites

- `auth-email.test.ts` — limited sign-in returns the same result for a
  registered and unregistered email, and never calls Supabase Auth;
- `submissions.test.ts` — limited submission uploads nothing;
- `export/feedback/__tests__/route.test.ts` — 429, `Retry-After`, body leaks
  no parameters.

## Files

```
supabase/migrations/20261002_01_rate_limits.sql           new
lib/rateLimit.ts                                          new — pure
lib/rateLimitDb.ts                                        new
lib/__tests__/rateLimit.test.ts                           new
lib/__tests__/rateLimitDb.test.ts                         new
actions/auth.ts
actions/submissions.ts
actions/missions.ts
actions/project.ts
app/api/auth/callback/route.ts
app/api/export/feedback/route.ts
app/api/webhooks/submission/route.ts
components/settings/ExportPanel.tsx
app/(public)/login/page.tsx                               (callback message)
actions/__tests__/auth-email.test.ts
actions/__tests__/submissions.test.ts
app/api/export/feedback/__tests__/route.test.ts
.env.example                                              new — kill switch
CLAUDE.md
TownHall_Checklist (1).xlsx
docs/specs/SPEC-rate-limiting.md                          new
```

## Open questions

1. **Numbers.** The tables in §2 are my picks. Submission at 10/hour is the
   one that touches paid cohort testers — raise it if a cohort tester could
   honestly do more.
2. **Callback over-limit** — redirect to `/login?error=rate_limited`
   (recommended, themed) or a bare 429 as the brief literally says?
3. **Export as fetch** — `ExportPanel` becomes a small client fetch so a 429
   can be shown themed (recommended), or leave the `<a download>` and accept
   the browser's own failed-download message?
4. **`.env.example` does not exist** in the repo. Create it with only the kill
   switch documented (recommended), or with every variable the app reads?

## Manual test plan

1. Wrong password eleven times on one address → "Too many attempts. Try again
   in N minutes." Same message, same speed, for an address with no account.
2. The limited message renders in both themes and at 360px.
3. `RATE_LIMIT_DISABLED=true`, redeploy → the same eleven attempts are all
   answered "That email and password do not match."; logs say DISABLED.
4. Revoke `service_role`'s execute on `rate_limit_hit` on a branch database →
   sign-in still works (log shows degrade); submission is refused with "try
   again in a minute".
