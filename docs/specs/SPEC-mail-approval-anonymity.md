# SPEC: Approval Notification Email

**Status:** Approved 2026-10-06 — Option B, race guard included
**Branch:** `feat/approval-notification`
**Source:** `docs/TWNHALL_MAIL_CHANGES_PROMPT.md` §1 (§2, tester anonymity,
already shipped under `feat/tester-anonymity`)
**Migration:** none
**Risk:** low

## Summary

When a builder approves a submission, the tester gets one email: which
mission, which rating, a link. Sent from `reviewSubmission`, not a webhook,
through a new `sendApprovalNotification` in `lib/mail.ts` that swallows every
failure.

## §1 — Trigger: the action, not a webhook

The feedback notification is sent by a Supabase Database Webhook on INSERT.
An UPDATE webhook here would fire on every write to `test_results` —
including the `ai_summary` write from `submitTestResult`'s `after()` block
seconds after each submission — and the route would filter noise to recover
what `reviewSubmission` already knows.

So: `reviewSubmission` in `actions/review.ts`, after the update succeeds and
before `revalidatePath`, inside `after()` from `next/server` — the same shape
as `sendWelcomeEmail` from `completeVerification`. The builder's response
does not wait on SMTP.

## §2 — Non-fatal, in `lib/mail.ts`

`sendApprovalNotification(props & { to })` copies `sendWelcomeEmail`: missing
key → return; render failure, Resend error, unexpected throw → log, return
`void`. The contract lives in the send function, so no caller wraps it. The
recipient lookup (§5) sits inside the same `after()` callback and is wrapped
there, because a failed lookup must not throw either.

## §3 — Double-send: verified, not assumed

Read in `actions/review.ts` and `lib/review.ts`:

1. The action reads the row's current `status` and runs
   `nextStatus(toStatus(row.status), "approve")`.
2. `nextStatus` returns `null` when `current === "approved"` (and `toStatus`
   maps legacy `paid` to `approved`, so those are covered too).
3. On `null` the action returns `"This submission is already approved."`
   **before** the update — so the mail call, placed after the update, is
   unreachable for an already-approved row.

**One gap, stated honestly:** the read and the write are two statements. Two
approvals of the same pending row racing in the same few milliseconds could
both pass the read. The update today has no `.neq("status", "approved")`
filter. The fix is the welcome email's: add `.neq("status", "approved")` and
`.select("id")` to the update and send only when a row came back. That is a
guard on the write, not a "sent" flag — the state machine stays the guard,
the database just enforces it atomically. Two lines; included unless you say
otherwise.

## §4 — There is no written review. Decide A or B.

`reviewSubmission` writes `review_note: null` on every approval. A builder
gives a rating 1–5 and nothing else. "Showing the review given" can only
mean the rating.

- **Option A — ship what exists.** Mission, project, rating out of 5, link.
  Honest, zero extra scope, thin. A `ponytail:` note at the nulling line
  records that B was considered and deferred.
- **Option B — optional note on approval.** `review_note` already exists, no
  migration. Optional textarea in `SubmissionReview`, a `reviewNote` field on
  `reviewSchema` (trimmed, max length, empty → null), stop nulling when
  something was typed, render it in the email when present. Under the cohort
  model it is the only written feedback a tester ever gets on their own work.

**Chosen: B.** Max 1000 characters. The builder sees their own note on the
approved row; the tester sees it on their `/tester` feed row (previously
shown only for legacy `changes_requested`) and in the email.

## §5 — Recipient

Same convention as the webhook's owner lookup:
`profiles.select("email, full_name").eq("id", tester_id).maybeSingle()`
through the service-role client. The action's existing read gains
`tester_id`, `missions(title, …, projects(name, …))` — one query, not three.
No address → `console.warn` and return. No throw.

`tester_id` and the tester's email are read server-side and go only to
Resend, addressed to the tester. Nothing reaches the builder's response
(CLAUDE.md, Tester anonymity).

## §6 — Content

Template `emails/approval-notification.tsx`, structure of
`feedback-notification.tsx`, dark like the other three.

- **Subject:** `Your report on "<mission title>" was approved` — the mission,
  not the project.
- **Body:** "Hi {first name}," / "The builder reviewed your report on
  **<mission>** (<project>) and approved it." / card: Mission, Rating
  `N out of 5` / button **View your reports** / footer "You're receiving this
  because you submitted a report on Twnhall."
- **Neutral.** No "great job", no "don't worry". A 1 and a 5 are the same
  sentence with a different number.
- Nothing about pay, earnings, standing or credit.
- HTML + plain-text part, same `render(..., { plainText: true })` as every
  other send.

### The link — and a finding

**The tester has no page that shows a per-report rating.** `/tester`'s
`SubmissionsFeed` shows status (Approved) but not the rating; `/settings`
shows only the average; `/mission/[id]` is the brief, not the report. So the
email is the *only* place a tester learns the rating of one report. The link
goes to `/tester`, where the report is listed as Approved with the note — it does not
promise "see your rating" there, because it isn't there.

This also means the prompt's QA step "the rating still shows on `/tester`" is
not checkable as written; the replacement check is "the row shows Approved on
`/tester` and in the builder's mission page with its rating".

Showing the rating on the tester's feed row is a small, separate change; not
in this PR unless asked.

## §7 — Files

| File | Change |
|---|---|
| `emails/approval-notification.tsx` | new template |
| `emails/__tests__/approval-notification.test.ts` | renders; rating 1 and 5 differ only in the number; text part present; no pay words |
| `lib/mail.ts` | `sendApprovalNotification` |
| `actions/review.ts` | widen read, guard write, `after()` send |
| `emails/README.md`, `CLAUDE.md` | the fourth flow; why not a webhook |
| `TownHall_Checklist (1).xlsx` | QA rows: delivery, failure leaves approval intact |
| B only: `lib/validation/schemas.ts`, `components/SubmissionReview.tsx`, schema test | optional note |

## §8 — Gates and manual checks

`npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm test`. Then by
hand: approve and read the mail in a real client; approve with 1 and read it
back; set a bad `RESEND_API_KEY`, approve, confirm the row saves and the
builder sees success.
