# SPEC: Telling Testers About New Test Cases

**Status:** Implemented on `feat/tester-notifications` — decisions 1–4 decided 1 Nov 2026, all as recommended (§5)
**Branch:** `feat/tester-notifications`
**Source:** `docs/TWNHALL_TESTER_NOTIFICATIONS_PROMPT.md`
**Migration:** one — `missions.first_published_at`, three columns on `accounts`, `publish_mission` replaced
**New dependency:** none
**New env var:** `UNSUBSCRIBE_SECRET` (server-only)
**Risk:** low–medium. A new recurring email to every tester, a public
unsubscribe endpoint, and one extra read on every tester page.

## Summary

Nothing tells a tester that a new test case went live. They find out only by
opening Available Test Cases. Two additions:

1. **A counter on "Available Test Cases"** in the sidebar, and on "Tests" in
   the phone's bottom bar. It counts test cases published **since the tester
   last opened that page**, and clears when they open it.
2. **A daily digest email** listing the test cases that went live since the
   last digest, sent once a day. Testers can turn it off with **an on/off
   switch in Settings** or **an unsubscribe link in the email**.

## §0 — Decided, and verified before writing this

**Decided 2026-11-01:** a daily digest, not an email per test case. The counter
means "since the tester last opened Available Test Cases". Opting out is a
Settings switch plus an unsubscribe link in the email.

**What testers receive today:** a welcome email once (`actions/verification.ts`)
and an approval email when a builder approves a report (`actions/review.ts`).
The admin broadcast can go to everyone or to one address, but not to testers
only. **Nothing fires on publish.** There is no badge, no "seen" state and no
opt-out anywhere (`emails/README.md`: "No unsubscribe system (not needed for
beta)"). That line stops being true with this change.

**A test case does not record when it went live.** `missions` has `created_at`
and `is_active`, nothing more. A test case is created as a draft
(`createMission` inserts `is_active: false`) and goes live later, so
`created_at` is not the publish time. **Every publish goes through one
function**, `publish_mission` (`20260930_01`, via `publishMission()` in
`lib/allowanceDb.ts`), from `createMission` with the publish intent and from
`toggleMissionStatus` when reopening. It sets `is_active = true`, so that is
where the timestamp goes.

**What the Available Test Cases page lists** (`app/(tester)/explore/missions/page.tsx`):
missions with `is_active = true` on unflagged projects, newest first, filtered
by `missionsForTester()`. That filter keeps paid cohort testers away from test
cases the cohort isn't paid for (CLAUDE.md, "the feed filter is not the
boundary"; here it's the right filter, because it's a courtesy and so is a
notification). The page shows a dual-role person their own test cases too,
with "Project Owner" in place of the form. It doesn't hide test cases already
tested.

**The nav** comes from `NAV.tester.links` in `lib/appNav.ts`
("Available Test Cases", short "Tests"). `Sidebar` and `BottomNav` render it.
`DashboardLayout`, a server component, already resolves the active account,
so it can pass a count down through `AppShell`. Layouts don't re-render on a
client-side navigation, so a count computed there goes stale until the next
full render. §2 handles that.

**Mail:** `lib/mail.ts` already sends in batches of 100 with
`resend.batch.send` (the admin broadcast), from `FROM_NOTIFICATIONS`. Every
send is logged as `email.sent` or `email.failed` with its template. The daily
cron (`app/api/cron/daily`, 06:00 UTC = **07:00 Lagos**, `CRON_SECRET`) runs
isolated `step()`s, so one failure never stops the rest.

**Public routes:** anything outside both roles' prefixes is public
(`lib/access.ts:176`), and `app/api` is outside the middleware matcher. A
signed-in user still in the setup chain is redirected by middleware's gates, so
`/unsubscribe` has to be explicitly exempt (§4).

## §1 — Schema (one migration)

```sql
-- When a test case first went live. Set by publish_mission, never cleared.
alter table public.missions add column if not exists first_published_at timestamptz;
update public.missions set first_published_at = created_at
  where is_active is distinct from false and first_published_at is null;

-- Per tester account: role-scoped state lives on accounts (CLAUDE.md).
alter table public.accounts
  add column if not exists missions_seen_at    timestamptz not null default now(),
  add column if not exists digest_through      timestamptz not null default now(),
  add column if not exists digest_opted_out_at timestamptz;
```

- **`default now()` on both timestamps is deliberate.** On the day this ships,
  every existing tester's counter starts at **0** and their first digest covers
  only what's published from then on. Nobody wakes up to a badge of 14 or an
  email of last month's test cases. A new tester starts the same way, from when
  their account was created.
- The columns sit on builder rows too, unused. That's cheaper than a side table.
  Each gets a column comment saying it's read for tester accounts only.
- **`publish_mission` is replaced, same signature**, with one change:
  `first_published_at = coalesce(first_published_at, now())` in its `update`.
  `revoke`/`grant` are restated (CLAUDE.md: never assume they survive a
  `create or replace`), with a rollback note.
- **Indexes:** `missions (first_published_at)`, partial `where is_active`, plus
  a partial index on `accounts (type) where digest_opted_out_at is null`.

## §2 — The counter

**One definition of "a new test case for this tester"**, in a new
`lib/newMissions.ts`. It's server-only and reads through `createAdminClient()`,
because `projects.owner_id` is not readable otherwise:

```ts
/** Live test cases this tester can see, first published after `since`. Newest first. */
export async function newMissionsFor(userId: string, since: string, limit?: number): Promise<NewMission[]>
export async function newMissionCount(userId: string): Promise<number>  // reads missions_seen_at itself
```

The rules are the page's, minus two things a "new" signal should never include:

- `is_active = true`, project not flagged, `first_published_at > since`
- **minus test cases on the tester's own projects** (a dual-role person
  publishing their own test case must not get a badge for it)
- **minus test cases they've already tested** (possible through search before
  visiting the page)
- **then `missionsForTester()`**, the same cohort courtesy filter the page applies

The page keeps its own query, which lists more than this (own and tested
included). Its live/flagged rules move into a shared `liveMissionFilter` so the
two cannot disagree about what counts as live.

**Where it shows:**

- `DashboardLayout` computes `newMissionCount()` **only when the active account
  is `tester`**. Builders cost nothing. It passes the count through `AppShell`
  to `Sidebar` and `BottomNav`. `NAV` gains an optional `badge: "newMissions"`
  key on the Available Test Cases link, so the nav definition stays the one
  list.
- **Sidebar:** a pill after "Available Test Cases" showing the number, `9+`
  above nine, with `aria-label`/sr-only text "N new test cases". It uses a
  palette **fill** (`bg-sky text-obsidian`), never Voltage: Voltage is the one
  CTA per viewport, and a badge isn't a CTA. The number is the text, so colour
  never carries the meaning alone.
- **Bottom bar:** the same number as a small pill on the "Tests" icon's corner,
  outside the 9-character label. The 48px target is unchanged.
- **Zero shows nothing.** No "0" pill.

**Clearing it:** the page renders a tiny client component,
`<MarkMissionsSeen renderedAt={…} />`. On mount, it calls a server action
`markMissionsSeen(renderedAt)`:

- `requireAccount("tester")`, then update **that tester account**:
  `missions_seen_at = greatest(missions_seen_at, least(renderedAt, now()))`.
  It uses the time the page was **rendered**, not clicked. A test case published
  between the server render and the mount stays "new", because the tester
  hasn't actually seen it.
- **Not done during the page render itself.** Link prefetching can render a
  route the tester never opens, and a prefetch must not clear the badge.
- The shell clears the badge locally as soon as the pathname is
  `/explore/missions`, so it doesn't sit on screen until the next full render.
  The server value catches up on the next render.
- **No polling or realtime.** The count is as fresh as the last full render,
  by decision (Out of scope).

## §3 — The daily digest

**A new step in the daily cron**, `step("tester_digest", …)`, at 07:00 Lagos,
**before** the retention and alert steps. In `lib/digest.ts`
(selection, pure where possible) and `lib/mail.ts` (`sendTesterDigests()`):

**Who:** tester accounts with `verification_completed_at` set,
`digest_opted_out_at` null, a profile that isn't `banned` or `suspended`, and an
email on the profile. The setup chain guarantees a verified tester has a
confirmed address.

**What, per tester:** `newMissionsFor(userId, since)` where
`since = greatest(digest_through, missions_seen_at)` (decision 3), and only
test cases **still live at send time**. One that filled or closed overnight is
left out. **No test cases, no email.**

**Exactly once per window.** For each tester:

- **Claim first:** `update accounts set digest_through = <run start> where id =
  … and digest_through = <value read> returning id`. That's the
  `reminder_sent_at` pattern in the same cron. A re-run, or a second invocation
  on top of the first, finds nothing to claim.
- Then send. A failed send is logged (`email.failed`, template `tester-digest`)
  and **not retried**. Those test cases appear on the page and the badge anyway.
  A missed email is cheap; a double email teaches people to unsubscribe.
- The claim also happens when there's nothing to send, so the window always
  moves forward.

**Sending:** `resend.batch.send` in batches of 100, the broadcast's pattern.
Each email carries its own unsubscribe headers (below). **Check that the batch
endpoint carries per-email `headers`**; if it doesn't, send one at a time for
this template. At today's tester count, that's well inside the cron's time.
Then add `export const maxDuration` to the cron route if it isn't there, sized
for the worst case and written next to the step.

**The email** is `emails/tester-digest.tsx`, React Email, with a footer matching
`feedback-notification.tsx`:

- Subject: **"New test case: <title>"** for one, **"<N> new test cases on
  Twnhall"** for more.
- Up to **5** test cases, newest first: title, project name, category · device,
  each linking to `/mission/[id]` through `siteLink()` (or the existing
  `NEXT_PUBLIC_APP_URL` pattern if the email-links fix hasn't merged yet). Then
  "and N more", and one button, **Browse test cases**, linking to
  `/explore/missions`.
- **Never the builder's name or email.** Project name and test case title are
  already public on Explore. That's the anonymity rule in reverse: CLAUDE.md
  says the tester is never sent the builder's `owner_id`.
- **No pay, no ₦, no "paid"**, even to cohort testers. The cohort is paid
  outside the product, against `/admin/payouts`.
- Footer: *"You're getting this because you have a Twnhall tester account.
  Unsubscribe · Turn this off in Settings."*

**Logged:** `email.sent` with `{ template: "tester-digest", count }` per batch,
the broadcast's shape. The admin's Email page then counts digests with no new
code.

## §4 — Opting out

**Settings.** A **Notifications** section on the **Account** tab, rendered only
when `active === "tester"` (CLAUDE.md: settings take the active account, never
the raw cookie). There's no new tab, so `tabsFor()` stays as it is. One switch:
**"Email me a daily list of new test cases"**, on by default. A server action
`setDigestEmail(on: boolean)`:

- Zod-parsed, `requireAccount("tester")`, and an update to that account only:
  `digest_opted_out_at = on ? null : now()`.
- Turning it back on also sets `digest_through = now()`, so switching on later
  never sends a backlog.
- Records `notifications.digest_on` / `notifications.digest_off` with
  `{ source: "settings" }`. Both names are added to `EVENT_NAMES`.

**The unsubscribe link and one-click.**

- **The token** is HMAC-SHA256 over `"tester-digest:" + accountId`, keyed by
  `UNSUBSCRIBE_SECRET` (server-only, never `NEXT_PUBLIC_`). It's in
  `lib/unsubscribe.ts` (`unsubscribeToken`, `verifyUnsubscribe`, a
  constant-time compare). It doesn't expire: an unsubscribe link from any old
  email must still work. It's scoped by its prefix to this one email, so it
  can't be replayed against anything else.
- **`GET /unsubscribe?a=<accountId>&t=<token>`** is a page, not an action. It
  shows *"Stop the daily test case email?"* with one button. **A GET never
  unsubscribes**, because mail scanners and link previewers open every link in
  an email. The button posts a server action that verifies the token and sets
  `digest_opted_out_at`. Then the page says *"Done. You won't get the daily
  email. Turn it back on any time in Settings."* A bad or tampered token gets
  one generic line, and the page never says whether the account exists.
- **`POST /api/unsubscribe`** is RFC 8058 one-click, which is what Gmail's and
  Yahoo's unsubscribe button calls. Every digest sends:
  - `List-Unsubscribe: <https://www.twnhall.com/api/unsubscribe?a=…&t=…>`
  - `List-Unsubscribe-Post: List-Unsubscribe=One-Click`

  The route verifies the token, opts out and answers 200, with no page and no
  sign-in. Like every `app/api` route, it gates itself.
- **Both paths are public and work signed out**, in any state of the setup
  chain. `/unsubscribe` is added beside `isEmailGateExempt()`'s exemptions in
  `lib/access.ts`, with the reason written next to it. It's covered by
  `scripts/access.test.mts`.
- **Rate limit: Tier 1, `degrade`**, a new `unsubscribe:ip` rule in
  `RATE_LIMITS`. It's a public, unauthenticated endpoint, so it gets the same
  treatment as the auth forms, and it never locks anyone out of opting out.
- The action and route both record `notifications.digest_off` with
  `{ source: "email" }`.

## §5 — Decisions

**Decision 1 — Does a test case that's closed and reopened count as new again?**
**Recommended: no, first publish only.** That's `coalesce(first_published_at,
now())` above. A builder pausing and resuming a test case would otherwise put it
back in everyone's badge and digest each time. The alternative,
`last_published_at`, is better for a builder who reopens with fresh slots, and
worse for everyone's inbox.

**Decision 2 — The send time.**
**Recommended: 07:00 Lagos**, as a step in the daily cron that already runs
then. It's one cron, nothing new to schedule, and a tester sees the list before
the day starts. A different hour means a second entry in `vercel.json`.

**Decision 3 — Leave out of the digest what the tester has already seen on the page?**
**Recommended: yes**, `since = greatest(digest_through, missions_seen_at)`. An
active tester who opened Available Test Cases last night has already seen
those test cases. Emailing them again makes the digest feel like noise. A tester
who never visits gets everything.

**Decision 4 — Existing testers: on by default?**
**Recommended: on.** It's about the product they signed up to test, and every
email carries a one-click unsubscribe plus the Settings switch. The alternative,
off until switched on, means almost nobody ever gets it. If you want a heads-up
first, send a one-off admin broadcast the day it ships: *"From tomorrow you'll
get a daily list of new test cases. Turn it off in Settings."*

## §6 — Tests

- **`lib/__tests__/newMissions.test.ts`:**
  - excludes own projects, already-tested test cases, drafts, flagged projects,
    and anything `first_published_at <= since`
  - applies the cohort filter (mock `missionsForTester`)
  - newest first; respects `limit`
- **`markMissionsSeen`** (TEST.md §1):
  - refuses without a tester account
  - moves `missions_seen_at` forward to `renderedAt`, never back, and never
    later than now (a client claiming a future time is clamped)
- **Digest selection (`lib/__tests__/digest.test.ts`):**
  - opted-out, unverified, banned and suspended testers are skipped
  - `since` is the later of the two timestamps (decision 3)
  - a test case closed before the run is left out
  - nothing new means no email, but the window still moves
- **Digest send:**
  - the claim is compare-and-set: two concurrent runs send once
  - a Resend error is logged and the window isn't rolled back
  - one subject vs many subjects
  - 5 listed, plus "and N more"
- **The email (`emails/__tests__/tester-digest.test.ts`):**
  - renders titles and project names, never an owner name or email
  - no "₦", "paid" or "payout" anywhere
  - links are absolute
  - the unsubscribe link and the `List-Unsubscribe` headers carry a token that
    verifies
- **`lib/__tests__/unsubscribe.test.ts`:**
  - round-trips
  - a token for another account fails
  - a tampered token fails, and the compare is constant-time
  - a token from another purpose prefix fails
- **`POST /api/unsubscribe`:** a valid token opts out with 200; a bad one gets a
  generic 400; a rate-limited request gets 429 with `Retry-After`.
- **The `/unsubscribe` page:** a GET changes nothing (assert no write); the
  button opts out.
- **`setDigestEmail`:** a tester only; on → off → on works; turning on moves
  `digest_through` to now.
- **Access:** `/unsubscribe` is reachable signed out and by a signed-in user
  stuck on `/terms-accept` (`scripts/access.test.mts`).
- **Nav:** `lib/__tests__/appNav.test.ts` still holds the 9-character label
  cap; the badge key exists only on the tester's Available Test Cases link.
- **Migration:** `publish_mission` sets `first_published_at` once; a close then
  reopen leaves it unchanged.

## §7 — Copy and documentation

- **`emails/README.md`**: replace "No unsubscribe system (not needed for beta)"
  with a short section on the digest, the token and the one-click headers.
- **`.env.example`, `README.md`**: add `UNSUBSCRIBE_SECRET`, generated as a long
  random string, server-only, and set in Vercel Production and Preview.
  **Redeploy after setting it**, the lesson of the email-links fix.
- **Tester guide** (`/guides/tester`): one short paragraph on the daily email,
  the badge, and how to turn the email off. If it's a new section, it goes
  through `lib/docNav.ts`.
- **Privacy page**: one line saying testers get a daily email about new test
  cases and can turn it off. The page lists what's emailed, so it must not go
  stale.
- **`CLAUDE.md`**:
  - a "Tester notifications" paragraph: `first_published_at` and its one writer;
    `newMissionsFor` as the one definition; badge cleared on mount, never on
    render; claim-then-send; GET never unsubscribes; the token's scope
  - the four columns added to the Data Model table
  - `/unsubscribe` added to the gate-exemption notes
- **`TownHall_Checklist (1).xlsx`**, new section **2.27 Tester notifications**:
  - QA-2.27-1: As a builder, publish a test case. The tester's sidebar shows
    **1** next to Available Test Cases, and the phone bar shows 1 on Tests.
  - QA-2.27-2: Open Available Test Cases. The badge disappears at once and
    stays gone after a reload.
  - QA-2.27-3: A dual-role person publishing their own test case gets no badge
    for it.
  - QA-2.27-4: Close and reopen a test case. No new badge (decision 1).
  - QA-2.27-5: A paid cohort tester gets no badge or digest entry for a test
    case published from earned credit only.
  - QA-2.27-6: Trigger the daily cron on staging. A tester with new test cases
    gets one email listing them; a second run sends nothing.
  - QA-2.27-7: Each digest link opens the right test case on the live site, with
    no localhost and no `//`.
  - QA-2.27-8: Gmail shows its own **Unsubscribe** button beside the sender.
    Using it stops the next digest.
  - QA-2.27-9: Open the email's unsubscribe link signed out. The page asks
    first, the button opts out, and Settings now shows the switch off.
  - QA-2.27-10: Paste the unsubscribe link into a chat app that previews links,
    and the tester is **still subscribed**.
  - QA-2.27-11: Settings → Account on a tester shows the switch; on a builder it
    doesn't. Off → no digest the next morning. On → the next digest has only
    what was published after switching on.
  - QA-2.27-12: Both themes, 360px and desktop. The badge never pushes the
    sidebar label onto two lines, and the bottom-bar badge doesn't cover the
    label.

## Out of scope

- An email per test case, or a real-time or push notification.
- Polling or realtime updates of the badge.
- A notifications inbox or a list of what's new.
- Notifications to builders (they already get one per report).
- Filtering the digest by skills, category or device. It's worth doing once
  testers have more than a few test cases a day to choose from; `newMissionsFor`
  is the place it would go.
- An admin control to turn the digest off globally. If one is needed, it's an
  env kill switch on the cron step, in the `RATE_LIMIT_DISABLED` pattern, and
  its own small change.
