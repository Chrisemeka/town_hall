# Twnhall — Rate Limiting: Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

One PR. It adds a rate limiter and applies it in three tiers, each with different failure behaviour.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions.
2. Read `TEST.md` §1.
3. Read `middleware.ts` — in particular its `config.matcher`.
4. Read `supabase/migrations/20260906_02_tester_audit_log.sql` for the plpgsql-function-plus-`.rpc()` house pattern.
5. Read `docs/specs/` and match that spec format.

Write the spec into `docs/specs/SPEC-rate-limiting.md` first and **stop for approval before implementing.** All four gates before done: `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test`.

**Branch:** `feat/rate-limiting`
**Migration:** yes

## The distinction this whole PR depends on

**A rate limit is not an allowance.**

An allowance is a business quota — ten reports a month — and it belongs to `feat/report-allowance`. A rate limit is a short-window abuse guard — five submissions an hour — and it belongs here.

Conflating them produces a product that tells a paying customer "quota exceeded" because they clicked twice. Keep them in separate modules with separate vocabulary, and do not let one call the other.

---

## 1 — The store

**Postgres, in the Supabase instance already being paid for.** Not Upstash, not Redis.

Vercel is stateless, so in-memory counters do not survive across instances — that much is given. But the volumes here are tens of requests a minute, the extra round trip is irrelevant at that scale, and a new vendor is a new line item against a fixed-cost budget of $66/month that the whole business model is sensitive to.

Note the tradeoff honestly in the spec: at a hundred times this traffic, Postgres would be the wrong store and this would need migrating. That is a good problem and it is not today's.

**The check-and-increment must be atomic.** A read-then-write in application code races, and a limiter that races is a limiter that does not limit. Use a plpgsql function invoked with `.rpc()`, following `submit_audit_log` — SECURITY DEFINER, pinned `search_path`, execute revoked from `anon` and `authenticated`.

The table needs a cleanup path. Expired rows are garbage and will otherwise grow forever; say in the spec whether that is a delete inside the same function, a periodic job, or a partial index plus a sweep, and why.

**RLS on, no policies.** Service role only.

---

## 2 — Failure behaviour: two modes, decided

When the limiter's own store is unreachable, what happens is not one answer.

### 2.1 — Auth routes: degrade, never lock out

**Fail closed against the shared store, then fall back to a strict in-memory per-instance limit.**

Not a total lockout. If a database blip meant nobody could sign in, a minor outage would become a full product outage — including for the person trying to fix it.

The fallback is deliberately **stricter** than the normal limit, because it is per-instance and someone hitting several instances gets several buckets. A tighter number partly compensates. Pick it, and say in the spec what you picked and why.

What this is not: authentication is unaffected by any of it. RLS, `requireAccount()` and the middleware gate are what protect a builder's test logs, and none of them consult the limiter. A degraded limiter means brute-force attempts are less throttled for a few minutes. It does not mean anyone gets in without credentials.

**Log loudly when the fallback engages.** Silent degradation is how a store stays broken for a week.

### 2.2 — Cost-bearing actions: fail closed, properly

**If the limiter cannot be consulted, the action does not proceed.**

Here the failure mode is someone scripting submissions, each of which fires a Gemini call and — from a cohort tester — creates a ₦1,000 liability. The worst case for a legitimate tester is "try again in a minute," which is an annoyance, not a lockout.

### 2.3 — A kill switch

One environment variable that disables the limiter entirely.

Fail-closed behaviour means a limiter bug can stop people working. Recovery must be a config change, not a deploy and a build. Default it to enabled, and make it loud in logs when it is off.

---

## 3 — Tier 1: unauthenticated and email-sending

Highest priority. These are reachable by anyone and each one spends money or domain reputation.

| Surface | Risk | Key on |
|---|---|---|
| Sign-up | Every attempt fires a Supabase confirmation email — quota burn, reputation damage, fake accounts | IP |
| Sign-in | Credential stuffing, brute force | **IP and email** |
| Password reset request | Email-bombing a known address | IP and email |
| Resend confirmation | Same | IP and email |

**Key on email as well as IP for sign-in.** An attacker rotates IPs; the address they are attacking does not change. IP-only limiting on a login endpoint is close to decorative.

**Do not duplicate what Supabase Auth already does.** With the custom SMTP configured in Stage 1, it enforces 30 emails/hour and a 60-second per-user minimum interval. Those are per-user. Yours are per-IP and exist to catch the case Supabase's cannot see: one actor working through a list of addresses. Layer, don't replace.

**Normalise the email before keying on it** — case and whitespace — or `Test@x.com` and `test@x.com` get separate buckets.

**Never let the response reveal whether an account exists.** Rate-limit responses must be identical for a real address and an invented one, in both body and timing. A limiter that throttles known addresses faster than unknown ones is an account-enumeration oracle.

### The contact route needs nothing

`lib/contact.ts` is a `mailto:` helper — entirely client-side, no server endpoint. There is nothing to abuse, and that is a consequence of the decision not to build a payment system.

**Note it in the spec.** If a server-side contact form ever replaces the mailto, it becomes the most abusable endpoint in the application on day one.

---

## 4 — Tier 2: authenticated and cost-bearing

Key on the account, not the IP. These are past the auth gate; the IP is no longer the interesting identity.

| Action | Why |
|---|---|
| **Test result submission** | The critical one. Fires a Gemini call, and from a cohort tester creates a ₦1,000 liability. |
| **Screenshot upload** | Storage plus Gemini tokens — a 1920×1080 image is six tiles, roughly 1,548 tokens. Limit the rate; the per-submission count cap is separate and already exists in `screenshotsSchema`. |
| Mission publish | A builder spamming missions consumes tester supply, the scarcest thing in the business |
| Project create | Unlimited on both tiers, with no bound at all |

**AI analysis needs no separate limit today** — it fires inside submission's `after()` block, so limiting submission covers it. Leave a `ponytail:` note that when generation becomes builder-triggered, it needs its own.

**Server Actions are POSTs to the page route**, so middleware sees them but cannot tell which action was invoked. Action-level limiting therefore lives in the action. Say so in the spec so the next person does not go looking for it in middleware.

---

## 5 — Tier 3: the API routes, which currently have no gate at all

`middleware.ts`'s matcher excludes `api`:

```
'/((?!_next/static|_next/image|api|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
```

So none of these pass through it:

| Route | Risk |
|---|---|
| `app/api/webhooks/submission/route.ts` | Unauthenticated by nature. The most exposed surface in the app. Needs signature verification **and** a limit — check whether the signature check exists and report what you find. |
| `app/api/export/feedback/route.ts` | Expensive query, a bulk-exfiltration path on a stolen session, and the known CSV-injection vector |
| `app/api/auth/callback/route.ts` | OAuth code-exchange attempts |

Handle the webhook per-route, since it needs signature logic anyway. For the other two, either bring `api` into the matcher and make middleware api-aware, or limit per-route — **your call, but say which and why**, and if you change the matcher, verify nothing depended on the exclusion.

The export route is Tier 2 behaviour (fail closed, key on account) living at an API path. Tier is about what the surface costs, not where it sits.

---

## 6 — Responses

- **HTTP 429**, with `Retry-After`.
- A message in plain words that says when to try again — never a bare "rate limit exceeded."
- Themed like every other error state: `danger-ink` `#A81E15` on light, Ember in dark. Ember on Bone is 2.97:1 and fails both `DESIGN.md` and WCAG.
- **Never leak the limit's parameters.** "Try again in a minute" — not "you have used 5 of 5 attempts in 300 seconds," which is a map of exactly how to stay under it.

---

## 7 — Tests

The limiter's own arithmetic belongs in a pure module with no database and no request, in the shape of `lib/access.ts` and `lib/reciprocity.ts`.

- Under the limit passes; at the limit the next request fails; the window expires and it passes again.
- IP and email keys are independent for sign-in.
- Email normalisation: `Test@x.com` and `test@x.com` share a bucket.
- **Auth with the store down degrades to in-memory and still allows a legitimate sign-in.**
- **A cost-bearing action with the store down is refused.**
- The kill switch disables everything.
- Concurrent requests at the boundary do not both pass — this is the one that proves the atomicity.
- 429 carries `Retry-After` and leaks no parameters.
- Rate-limited responses are identical for a registered and an unregistered email.

---

## 8 — Before calling it done

Four gates, then by hand:

1. Wrong password repeatedly → limited, with a sane message, and the same response shape for an address that does not exist.
2. A limited response renders correctly in **both themes** and at **360px**.
3. The kill switch actually switches it off.

## 9 — Documentation

- **`CLAUDE.md`** — the limiter, the tier split, the two failure modes and why they differ, the kill switch env var, and the sentence that a rate limit is not an allowance.
- **`.env.example`** — the kill switch, documented.
- **`TownHall_Checklist (1).xlsx`** — QA rows for login limiting, submission limiting, the degraded-store path, and the kill switch.

## Out of scope

Allowance enforcement — `feat/report-allowance`. Shadow metering. CAPTCHA, WAF, bot detection, IP reputation. If sustained abuse happens, that is a different conversation with different tools; this PR is the floor, not the ceiling.
