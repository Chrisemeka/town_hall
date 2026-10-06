# Twnhall — Tester Anonymity: Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

**A builder must not be able to identify the tester who filed a report.** Not by name, not by email, not by any stable identifier they can correlate across missions.

One PR, three commits. Smaller than it sounds — most of the builder surface is already anonymous — but two of the three leaks are ones you would not find by looking at the screen.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions.
2. Read `app/(developer)/dashboard/feedback/page.tsx`, especially the comment at the `test_results` query.
3. Read `app/(developer)/dashboard/[projectId]/mission/[missionId]/page.tsx`.
4. Read `app/api/export/feedback/route.ts` and `lib/csv.ts`.
5. Read `emails/feedback-notification.tsx` and `app/api/webhooks/submission/route.ts`.
6. Read `docs/specs/` and match that spec format.

Write the spec into `docs/specs/SPEC-tester-anonymity.md` first and **stop for approval before implementing.** All four gates before done: `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test`.

**Branch:** `feat/tester-anonymity`
**Migration:** none
**Risk:** low to build, high to get subtly wrong — see §5

---

## Where things actually stand

Audited before this prompt was written. Report any disagreement with this table before implementing:

| Surface | Shows the tester? |
|---|---|
| `/dashboard/feedback` | **No.** Already a flat numbered list — the query selects no tester identity at all |
| `/dashboard/[projectId]` | **No.** No tester identity selected |
| Mission detail page | **No name**, but `select("*")` ships `tester_id` to the client — see §2 |
| **CSV export** | **Yes.** A "Tester" column, populated by an explicit join on `profiles.full_name` |
| **Notification email** | **Yes.** `testerName` in the props, the preview text and the body |
| Admin | **Yes — and it stays that way.** See §4 |

So the work is three commits, not a redesign.

---

# 1 — The CSV export

`app/api/export/feedback/route.ts` has `"Tester"` in `HEADERS`, reads `tester_id` on every row, then does a second query — `profiles.select("id, full_name")` — purely to resolve names.

**Replace the name with a per-mission number.** Do not simply delete the column: a builder reading fifteen rows across three missions needs to know which rows came from the same person within one mission, and that grouping is useful and not identifying.

**Numbering rule: within each mission, order by `created_at` ascending and number from 1.** A tester files exactly one report per mission — `submit_audit_log` refuses a second, and `lib/review.ts` explains why — so this is well defined with no ties to break beyond identical timestamps. Say in the spec how you break those.

The numbering is **per mission, not per file.** "Tester 1" in mission A and "Tester 1" in mission B are different people, and the column header or a note should not imply otherwise.

Delete the profiles lookup entirely. That is one fewer query on a rate-limited export path.

---

# 2 — The raw identifier on the mission page

This is the leak that matters and the one nobody sees.

`app/(developer)/dashboard/[projectId]/mission/[missionId]/page.tsx` queries:

```
.select("*, missions!inner(title, project_id)")
```

`select("*")` on `test_results` includes **`tester_id`**. No name is rendered, but the UUID travels to the browser inside the React Server Component payload. A builder who opens devtools gets a stable per-tester identifier they can correlate across every mission they run.

**Anonymity that survives only until someone opens devtools is not anonymity**, and it is worse than none, because it will have been promised.

**Replace `select("*")` with an explicit column list that omits `tester_id`.** Check what the page and its children actually need — the review flow keys on `resultId`, not `tester_id`, so this should come out cleanly. If something genuinely needs it, say what and why rather than working around it.

**Then grep the rest of the builder tree for the same pattern.** `select("*")` on a table carrying a foreign key to a person is the shape of this bug, and one instance is rarely alone. Report everything you find, fix what is builder-facing, leave admin alone.

---

# 3 — The notification email

`emails/feedback-notification.tsx` carries `testerName` in the props interface, the preview text and the body.

- Remove `testerName` from `FeedbackNotificationProps`.
- Preview text becomes `New feedback on {projectName}` or similar. **Check this one in a real inbox** — the preview renders in the message list before the email is opened, so a leak there is more visible than one in the body.
- The body already has the fallback: `{testerName || "A tester"}`. **"A tester just submitted feedback on your project X" is wording that already exists in this file** — use it rather than writing a new sentence.
- Remove whatever `app/api/webhooks/submission/route.ts` does to resolve the name, and the query behind it.

**Leave `submissionSummary` alone.** The tester's words are the product. It is the attribution being removed, not the content.

---

# 4 — Admin keeps real names, and that is not an oversight

Every `app/(admin)/` page joins `profiles` for `full_name` and `email`. **None of that changes.**

You pay these people. The payout ledger, the rating gate and every support conversation need real identity. Anonymity here means *builder-facing*, and the spec should say so in one sentence so a later reader does not "finish the job" by stripping admin too.

---

# 5 — What this cannot deliver, and why that has to be written down

**The product can stop telling the builder who the tester was. It cannot stop the builder finding out.** Three leaks are outside the code's reach:

**Screenshots.** This is the big one. A tester's screenshot can contain their browser profile photo, a logged-in header with their name, their email in a form field, their own desktop. Screenshots are the most valuable part of a report and they are unfiltered.

**The tester's own words.** "I tried signing up with my email amos@…" happens constantly and no validator will catch it.

**A small pool.** Twenty testers, five per mission, a builder running several missions: writing style and timing correlate.

Two things follow, and the spec should carry both:

**A line in `CLAUDE.md` stating the limit**, so nobody later believes the system guarantees something it does not.

**A warning to the tester at submission time**, near the screenshot control: their screenshots go to the builder, and anything identifying should be cropped out. That one sentence is the only real defence any of this has, and it is cheap.

**Be careful what the product promises in copy.** "Anonymous" is a guarantee. "We don't share your name with builders" is true. Prefer the second everywhere — tester guides, the welcome email, onboarding.

---

# 6 — One thing to raise, not to build

Removing the name costs the builder something real: **credibility.** A report from a named person reads as a real human; "Tester 3" with no attributes reads as it could be anything. A builder paying $19 a month may reasonably wonder.

The usual fix is non-identifying attributes next to the number — skills, country, a "verified tester" badge. **Do not build this**, and flag why: with a twenty-person cohort, skills plus country is close to identifying on its own, which would quietly undo the work.

Report it as an open question. A plain "Verified tester" badge, carrying no attributes, is probably the safe version — but it is the user's call.

---

## Consistency with work already specified

`docs/TWNHALL_SHAREABLE_REPORT_PROMPT.md` §6 already requires Tester 1, 2, 3 in the shared PDF, with the same ordering rule. **Use the same numbering helper in both** rather than writing it twice — put it somewhere pure and importable, in the shape of `lib/reciprocity.ts`.

If that prompt has not been run yet, write the helper here and note it in the spec so the report work picks it up.

## Tests

- The CSV contains no `full_name` for any tester, and numbering restarts per mission.
- Two exports of the same data produce the same numbers.
- **The mission page's server payload contains no `tester_id`.** Assert on the absence directly — this is the one that silently regresses.
- The notification email contains no tester name in the body *or* the preview text.
- Admin pages still show real names.
- `scripts/access.test.mts` still passes.

## Before calling the PR done

Four gates, then:

1. Open the mission detail page as a builder, view source / inspect the RSC payload, and search it for a UUID that is not the mission or result id.
2. Export a CSV spanning two missions and confirm numbering restarts.
3. Receive a real notification email and read the preview line in the inbox list, not just the opened message.

## Documentation

- **`CLAUDE.md`** — tester identity is never sent to a builder surface; admin is exempt; the limits in §5 stated plainly; `select("*")` on a table with a person foreign key called out as the shape of this bug.
- **`emails/README.md`** — the notification no longer carries a tester name.
- **`TownHall_Checklist (1).xlsx`** — QA rows for the CSV column, the RSC payload check, the email preview text, and admin still showing names.

## Out of scope

Anonymising the builder from the tester — a tester seeing whose product they are testing is the point. Any change to admin. Messaging between builder and tester. The credibility badge in §6.
