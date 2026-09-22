# SPEC: The Welcome Email

**Status:** Awaiting approval
**Branch:** `feat/welcome-email`
**Base:** `feat/onboarding-flow` — the doc says "main with PR 1 merged", but
nothing is merged yet, so it keeps stacking
**Depends on:** PR 1's completion screen, which already carries the inert line
this makes true
**Source:** `docs/TWNHALL_ONBOARDING_FLOW_PROMPT.md` — PR 2
**Migration:** none
**Risk:** low, and one correctness fix that is not low — see §1

## Summary

One React Email template, sent through Resend from `lib/mail.ts`, fired from
`completeVerification` once the gate actually opens. Role-specific content,
read from `lib/setup.ts` so it cannot drift from the completion screen the
user just read.

## §1 — "It must fire once." It currently would not.

The brief says: *"`verification_completed_at` being set should prevent
re-entry, but verify that rather than assuming."* **I verified it. It does
not.**

`completeVerification` opens with:

```ts
const { userId } = await requireAccountForVerification(role)
```

`requireAccountForVerification` returns `{ userId, verified }` — and the action
destructures only `userId`. It deliberately **does not** act on `verified`,
because that helper exists precisely to skip the verification gate; that is
what stops the flow redirecting to the page it is already on.

Then the write has no guard either:

```ts
.from("accounts")
.update({ verification_completed_at: new Date().toISOString() })
.eq("user_id", userId)
.eq("type", role)
```

So a second call re-validates, **overwrites the timestamp with a fresh one**,
returns success — and would send a second welcome email. The UI never does
this (the completion screen is terminal, and middleware bounces a verified
user off `/verify/[role]`), but a server action is an addressable endpoint,
and the brief is explicit: **do not rely on the UI to enforce it.**

### The fix: let the database decide who opened the gate

```ts
const { data: opened, error } = await admin
  .from("accounts")
  .update({ verification_completed_at: new Date().toISOString() })
  .eq("user_id", userId)
  .eq("type", role)
  .is("verification_completed_at", null)   // ← only if it is not already open
  .select("id")
```

`UPDATE … WHERE verification_completed_at IS NULL … RETURNING` is atomic in
Postgres. Two concurrent calls, exactly one row comes back. So:

- **one row returned** → this call opened the gate → send the email
- **no rows** → it was already open → send nothing, still return success

Success either way, because from the caller's point of view the gate is open
and that is what it asked for. The email is the thing that must not repeat.

**This also closes a bug that predates the email.** Today a second call
silently moves `verification_completed_at` forward, so "when did this account
verify" quietly becomes "when was this action last called". The `IS NULL`
guard stops that as a side effect.

**`requireAccountForVerification` is not touched.** Its skipping of the
verified check is load-bearing and documented; the guard belongs on the write,
which is the thing that must happen once.

## §2 — One template, not two

The brief leaves this open and asks for the reasoning.

**One template with a role branch**, and the content comes from
`nextStepsFor(role)` and `completionHeadlineFor(role)` in `lib/setup.ts`.

Because **PR 1's completion screen already renders exactly this content from
exactly those functions.** Two hand-written templates would be a third and
fourth copy of the same three sentences, and they would drift from the screen
the user read thirty seconds earlier — which is worse than either being wrong
on its own, because the person has both.

The chrome is identical between roles anyway; only the heading and the three
steps differ. A role branch is smaller than a duplicated layout.

```
emails/welcome.tsx
  props: { role, name, nextSteps, headline, ctaUrl, ctaLabel }
```

The template takes the content as props rather than importing `lib/setup.ts`
itself, matching `feedback-notification.tsx` — a template renders what it is
handed, and that is what makes it testable without a database.

## §3 — Trigger

From `completeVerification`, **after** §1's guarded update confirms this call
opened the gate, and **before** the `revalidatePath` calls.

### Non-fatal, by construction rather than by care

`sendFeedbackNotification` already swallows everything — missing API key,
render failure, Resend error, unexpected throw — and returns `void`.
`sendWelcomeEmail` follows that shape exactly. **The contract lives in
`lib/mail.ts`, not at the call site**, so no future caller has to remember to
wrap it.

The call is additionally wrapped in `after()` from `next/server` (stable in
Next 16.2.1, and `next/server.d.ts` re-exports it):

```ts
after(() => sendWelcomeEmail({ ... }))
```

Two reasons. The user gets the completion screen without waiting on an SMTP
round trip, which is a few hundred milliseconds on the one screen that is
their reward for finishing setup. And un-awaited promises in a serverless
function can be dropped when the response ends — `after()` is the supported
way to say "run this, but not before I answer".

**The trade, stated:** `after()` failing silently in some deployment context
would mean the mail never sends and nothing complains. That is the same
failure mode the send already has (it swallows its own errors), so it does not
add a class of problem — but it is why §6's manual check is "it arrived in a
real inbox", not "the action returned success".

### The address

`completeVerification` already reads the profile. `email` joins the existing
`select`, so this costs **no extra query**. No email on the row → log and
return; a welcome email is not worth failing a gate over.

## §4 — Content

**Short.** The reference runs to a founder letter, an old-way/new-way
comparison and a feature inventory. This one welcomes the person and gives
them one clear next action.

| | |
|---|---|
| Subject | Builder: *"You're set up on Twnhall"* · Tester: *"You're set up — here's how to pick up your first mission"* |
| Preview | The role's headline from `completionHeadlineFor()` |
| Body | A line of welcome, the three `nextStepsFor(role)` items, one button |
| CTA | Builder → `/dashboard`, Tester → `/explore`, built from `NEXT_PUBLIC_APP_URL` |
| Footer | Matches `feedback-notification.tsx` |

**Promises nothing unbuilt.** No tier limits stated as enforced, no video
feedback, no guaranteed turnaround, no paid missions — the same rule as the
homepage and the pricing page. `lib/setup.ts`'s content is already asserted
against a forbidden-words list in `lib/__tests__/setup.test.ts`; sourcing the
email from there means it inherits that guarantee rather than needing its own.

## §5 — Deliverability

- **Same sender as the existing mail.** `FROM_NOTIFICATIONS`, already
  `Twnhall <notifications@twnhall.com>` and overridable by env. **Do not
  introduce a new address or subdomain** — a fresh sender has no reputation,
  and a first-contact email is the worst place to spend that.
- **The domain is verified** in Resend as of Stage 1's SMTP work, which is what
  makes this deliverable at all.
- **A plain-text alternative ships with every send**, rendered by
  `render(..., { plainText: true })` exactly as the other two do. A
  HTML-only message is one of the cheapest spam signals there is.
- **One link, no images, no shortener.** The template is text and a button.
- Welcome mail to someone who just completed a signup is expected mail, which
  is most of the battle.

`emails/README.md` gains this flow alongside the existing two, and says plainly
that **this one is ours** — unlike the confirmation and reset mail, which
Supabase Auth renders from its own dashboard templates and which editing
`emails/` will never change.

## §6 — Tests

`TEST.md` §1's pattern. React Email's `render()` returns a string and needs no
DOM, so the template is testable in the existing node environment — no new
test infrastructure.

**`emails/__tests__/welcome.test.ts`**

| Assertion | Why |
|---|---|
| renders for both roles | the base case |
| contains that role's three next steps, verbatim | it is fed from `lib/setup.ts`; this proves the wiring, not the copy |
| the two roles' output differs | a role branch that does not branch |
| the CTA href matches the role's home | builder → `/dashboard`, tester → `/explore` |
| the plain-text render is non-empty and carries the steps | §5 — a text part that is blank is worse than none |

**`actions/__tests__/verification.test.ts` — extended**

| Assertion | Why |
|---|---|
| a successful completion sends exactly one email | the base case |
| a **second** `completeVerification` sends nothing | §1 — the guard, not the UI |
| ...and still returns `{ success: true, redirectTo }` | the gate is open; the caller got what it asked for |
| a throwing `sendWelcomeEmail` leaves `verification_completed_at` set and `redirectTo` intact | §3 — non-fatal means the gate does not care |
| a profile with no email address sends nothing and still succeeds | §3 |
| the update carries `.is("verification_completed_at", null)` | the guard is the fix; asserting the call shape is how it stays |

`after` is mocked to invoke its callback inline (`vi.mock("next/server", () => ({ after: (fn) => fn() }))`),
so the send is observable in a test without the test knowing about scheduling.

**Not covered, and stated rather than implied:** that the mail *arrives*, and
that it *renders* in a real client. A string containing the right words is not
a deliverable email. §7.

## §7 — Files

**New**
```
emails/welcome.tsx
emails/__tests__/welcome.test.ts
```

**Edited**
```
lib/mail.ts                          + sendWelcomeEmail, same shape as the other two
actions/verification.ts              the IS NULL guard, the send, email on the select
actions/__tests__/verification.test.ts
emails/README.md                     the third flow, and which mail is ours
CLAUDE.md                            the trigger point and the non-fatal contract
```

**Untouched:** `lib/auth.ts`, `middleware.ts`, `lib/access.ts`,
`components/verification/VerificationFlow.tsx` — PR 1 already wrote the line
this makes true.

## Acceptance criteria

1. Completing verification sends one welcome email to the account's address.
2. A second `completeVerification` for the same account sends **nothing**, and
   still returns success.
3. `verification_completed_at` is never overwritten once set.
4. A mail failure — no API key, render error, Resend error, throw — leaves the
   gate open, the redirect intact and the completion screen unaffected.
5. Content is role-correct and read from `lib/setup.ts`, matching the
   completion screen word for word.
6. Nothing unbuilt is promised.
7. Sends from the existing verified sender; HTML and plain text both.
8. `emails/README.md` documents the flow and that Supabase owns the auth mail.
9. `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`,
   `npm test`.

## Manual test plan

The part no test here covers, and the brief is right to insist on it:

- Complete setup as a **new builder** → the mail arrives → open it in Gmail and
  in one non-Gmail client. Check the button works and the three steps match the
  completion screen.
- The same as a **new tester** → different content, CTA lands on `/explore`.
- Check the **spam folder first**, not after. A first-contact email in spam is
  worse than no email.
- Unset `RESEND_API_KEY` and complete setup → gate opens, completion screen
  renders, dashboard reachable, one line in the server log.
- Call `completeVerification` twice against a staging account → one email, and
  `verification_completed_at` unchanged by the second call.

## Commit sequence

1. `fix(verification): only open the gate once`
2. `feat(email): add the welcome template`
3. `feat(email): send the welcome email when the gate opens`
4. `test(email): cover the template and the fire-once guard`
5. `docs: record the welcome email and who owns which mail`

## Open questions

None. §2's template question is answered and reasoned; §1's fire-once question
was the one the brief asked me to verify, and the answer changed the work.
