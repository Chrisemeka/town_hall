# Twnhall — Approval Notification Email: Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

One mail change: tell the tester when their report is approved. Small, but it has a decision in it that is not obvious from the ask (§1.4).

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions.
2. Read `lib/mail.ts`, `emails/README.md`, `emails/feedback-notification.tsx` and `emails/welcome.tsx`.
3. Read `actions/review.ts` and `lib/review.ts`.
4. Read `app/api/webhooks/submission/route.ts`.
5. Read `TEST.md` §1 and `docs/specs/` for the spec format.

Write the spec into `docs/specs/SPEC-mail-approval-anonymity.md` first and **stop for approval before implementing.** All four gates before done: `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test`.

**Branch:** `feat/approval-notification`
**Migration:** none
**Risk:** low

---

# 1 — Tell the tester their report was approved

## 1.1 — Send it from the action, not a webhook

The existing feedback notification is **not** sent by the app. A Supabase Database Webhook fires on INSERT into `test_results` and POSTs to `app/api/webhooks/submission/route.ts`, which sends the mail.

**Do not follow that pattern here.** A webhook on UPDATE would fire on every update to `test_results` — including the `ai_summary` write from the `after()` block in `actions/submissions.ts`, which happens seconds after every submission. You would be filtering noise in a route handler to recover information the application already has.

Send it from **`reviewSubmission` in `actions/review.ts`**, after the `test_results` update succeeds and before the `revalidatePath` calls. That matches how `sendWelcomeEmail` fires from `completeVerification`.

## 1.2 — It must be non-fatal, and the contract lives in `lib/mail.ts`

Add `sendApprovalNotification` to `lib/mail.ts` alongside the existing three.

**Put the try/catch inside the send function, not at the call site.** `sendWelcomeEmail`'s comment states the reasoning and it applies identically here:

> *"The non-fatal contract lives HERE rather than at the call site, so no future caller has to remember to wrap it."*

A mail failure must not turn a successful approval into an error the builder sees. The rating is already saved.

## 1.3 — It already cannot double-send, but verify that

`nextStatus()` returns `null` when the current status is already `approved`, and `reviewSubmission` returns an error before writing. Approval is terminal — `lib/review.ts` explains why.

So a second approval never reaches the mail call. **Confirm that by reading the code rather than assuming it**, and say so in the spec. Do not add a "has it already been sent" flag; the state machine is the guard.

## 1.4 — There is no written review to show, and that is the thing to decide

The ask says "showing the review given." Read `reviewSubmission` carefully before designing the email:

```
const patch = { status: next, rating, review_note: null, reviewed_at: ... }
```

A builder approves and gives a **rating**. That is the entire review. `review_note` is explicitly **set to null** on every approval — the column survives only because legacy `changes_requested` rows carry one.

So the email can honestly contain: the mission, the project, the rating, and a link. No words from the builder, because the builder never writes any.

**Report this to the user before building, with two options:**

**Option A — ship what exists.** The email shows the rating out of 5 and a link to the report. Honest, zero extra scope, and a thin email.

**Option B — add an optional note on approval.** `test_results.review_note` already exists, so this needs **no migration** — add an optional textarea to the review form, stop nulling the column when something was typed, and include it in the email when present. Perhaps two hundred lines across the form, the action, the schema and the template.

Option B is what makes this email worth receiving, and under the tester cohort model a builder's note is the only written feedback a tester ever gets on their own work — which is the thing that improves report quality. But it is a product decision, not an implementation detail.

**Do not pick one. Ask, then build the one chosen.** If the answer is A, leave a `ponytail:` note at the nulling line in `actions/review.ts` recording that B was considered and why it was deferred.

## 1.5 — Finding the tester's email

The submission's `tester_id` points at the profile. Look up the address the **same way the webhook route already looks up the project owner's** — one convention, not two. Read that route and follow it.

If the address cannot be resolved, log and return. Do not throw.

## 1.6 — Content

**Short, and role-correct.** The reader is a tester, not a builder. Follow `emails/feedback-notification.tsx` for structure and `emails/README.md` for conventions.

- Subject names the mission, not the project — the tester did the mission and may not know the project by name.
- Render both HTML and a plain-text part. Every send in `lib/mail.ts` does, and HTML-only is a cheap spam signal.
- A rating of 5 and a rating of 2 are the same email with a different number. **Do not write congratulatory copy that reads as sarcasm on a low rating**, and do not write consoling copy that patronises a high one. Neutral, factual, one clear link.
- **Nothing about payment, earnings, or standing.** Cohort payment happens outside the product and does not appear inside it.
- Promise nothing unbuilt. Same rule as the homepage and the welcome email.

---

# 2 — Tester anonymity: moved to its own prompt

The second change — taking the tester's name out of the builder's notification — turned out to be one surface of a larger decision: **the builder should not be able to identify the tester anywhere.**

That work is specified in **`docs/TWNHALL_TESTER_ANONYMITY_PROMPT.md`**, which covers the notification email along with the CSV export and a raw-identifier leak on the mission page.

**Do not implement the email change here.** Run that prompt instead; it includes this email.

---

## Constraints — this commit

- **Email templates live in `emails/`** and go out through Resend via `lib/mail.ts`. Supabase Auth's own templates (confirmation, password reset) are configured in the Supabase dashboard and are **not** touched by this work.
- **Every send gets a plain-text part.**
- Send from the existing verified sender. A fresh address or subdomain has no reputation.
- Mail failures are logged and swallowed. Never fatal, never retried in-request.

## Before calling the PR done

Four gates, then:

1. Approve a submission and confirm the email **arrives and renders in a real client** — not merely that the send returned OK.
2. Approve with the lowest rating and read the copy back. If it sounds sarcastic, rewrite it.
3. Break the mail send deliberately (bad API key) and confirm the approval still saves, the rating still shows on `/tester`, and the builder sees no error.


## Documentation

- **`emails/README.md`** — the new template and when it fires.
- **`CLAUDE.md`** — approval mail fires from `reviewSubmission`, not from a webhook, with the reason; the non-fatal contract.
- **`TownHall_Checklist (1).xlsx`** — QA rows for approval mail delivery, mail failure leaving the approval intact.

## Out of scope

The Supabase Auth email templates. Any change to who can see tester identities in the app itself. Digests, batching, unsubscribe preferences — nobody has asked for an email preference centre and one notification per approval is not a volume problem at this scale.
