# Twnhall — New Test Case Notifications for Testers: Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

Testers aren't told when a new test case goes live. The only way to find one is to open Available Test Cases. This adds two things:

- **A counter** on "Available Test Cases" in the sidebar, and on "Tests" in the phone bar. It counts test cases published since the tester last opened that page.
- **A daily digest email** of new test cases. A tester turns it off with **an on/off switch in Settings** or **an unsubscribe link in the email**, including Gmail's one-click button.

Those three choices are decided. **The spec is written:** `docs/specs/SPEC-tester-notifications.md`. It has what was verified, the schema, the one definition of "new", the digest's claim-then-send cycle, the unsubscribe design, four smaller decisions, and the full test list. This prompt is the order of work and the traps.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions. Pay particular attention to: role-scoped state lives on `accounts`; settings take the active account; the cohort feed filter; the tester is never sent the builder's identity; RPC grants restated; rate-limit tiers; `recordEvent` never throws; one Voltage CTA per viewport.
2. Read the spec end to end.
3. **Check its Status line.** If decisions 1–4 are not marked decided, **stop and ask**. Do not pick for me. The recommendations are: first publish only; 07:00 Lagos in the existing daily cron; skip what the tester has already seen; on by default.
4. Read `actions/missions.ts`, `lib/allowanceDb.ts`, the `publish_mission` definition in `supabase/migrations/20260930_01_report_ledger.sql`, `lib/cohortDb.ts` (`missionsForTester`), `app/(tester)/explore/missions/page.tsx`, `lib/appNav.ts`, `components/layout/{DashboardLayout,AppShell,Sidebar,BottomNav}.tsx`, `lib/mail.ts` (the broadcast's batch loop), `app/api/cron/daily/route.ts`, `lib/access.ts`, `middleware.ts`, `lib/rateLimit.ts`, `lib/events.ts`, and the Settings Account tab components.
5. Read `TEST.md` §1.

All four gates before done: `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test`.

**Branch:** `feat/tester-notifications`
**Migration:** one, with the next free date prefix in `supabase/migrations/`. **Apply it before the code deploys.** The layout reads the new columns on every tester page.
**New env var:** `UNSUBSCRIBE_SECRET`. Ask me to set it in Vercel (Production and Preview) and **redeploy** before the end-to-end check. Never `NEXT_PUBLIC_`.

---

## Commits, in this order

**1 — `feat(db): first_published_at and tester notification state`**
Spec §1: the columns, the backfill, the indexes, and `publish_mission` replaced with `coalesce(first_published_at, now())`. Same signature, `revoke`/`grant` restated, rollback note. **Both `accounts` timestamps default to `now()`**, so every existing tester starts at a zero badge and an empty first digest. Don't backfill them to anything earlier.

**2 — `feat(lib): one definition of a new test case`**
`lib/newMissions.ts` per spec §2, and the shared live filter the page also uses. Service role, explicit columns. It reads `projects.owner_id` only to exclude the tester's own projects, and **never returns it**. The returned type is a `Pick<>` of what the badge and email render. Add tests.

**3 — `feat(nav): the counter`**
The count is computed in `DashboardLayout` **only for an active tester**, then flows through `AppShell` into `Sidebar` and `BottomNav`, with the optional `badge` key on the nav link. Then `MarkMissionsSeen` and the `markMissionsSeen(renderedAt)` action. Three traps:
- **Clear on mount, never during the page render.** Prefetch renders routes nobody opened.
- **Use `renderedAt`, clamped to now, and only ever move forward** (`greatest`).
- **Clear the badge client-side on that pathname at once.** The layout won't re-render on a soft navigation.

The badge uses a palette fill (`bg-sky text-obsidian`), **never Voltage**, with the number as text and sr-only "N new test cases". `9+` above nine, nothing at zero. Check 360px and desktop in both themes.

**4 — `feat(mail): the daily digest`**
`lib/digest.ts`, `emails/tester-digest.tsx`, `sendTesterDigests()` in `lib/mail.ts`, and the cron step, as in spec §3. Traps:
- **Claim, then send.** A compare-and-set on `digest_through` with `.select()`, the `reminder_sent_at` pattern already in this cron. A second run must send nothing. A failed send is logged and not retried.
- **Per-email `List-Unsubscribe` headers.** Verify `resend.batch.send` carries per-email `headers` (read the SDK's types and docs, then test). If it doesn't, send this template one at a time. Then set `maxDuration` on the cron route for the worst case, with the arithmetic in a comment.
- **The email names no builder, and says nothing about pay.** Assert both in the template test.
- **Links are absolute.** Use `siteLink()` if `fix/email-link-origin` has merged; otherwise use the existing `NEXT_PUBLIC_APP_URL` pattern, and leave a `ponytail:` comment to move it.

**5 — `feat(unsubscribe): settings switch, link and one-click`**
Spec §4: `lib/unsubscribe.ts` (HMAC, constant-time compare, purpose prefix), `setDigestEmail`, the Notifications section on the Account tab (tester only), the `/unsubscribe` page, `POST /api/unsubscribe`, the `unsubscribe:ip` Tier 1 rule, the `lib/access.ts` exemption, and the two `EVENT_NAMES`. Traps:
- **A GET never unsubscribes.** The page asks; its button posts.
- **The one-click POST needs no sign-in**, and it gates itself by the token. `app/api` has no middleware.
- **A bad token gets one generic answer.** It never confirms whether an account exists.
- **Turning the switch back on moves `digest_through` to now**, so there's never a backlog.

**6 — `docs: tester notifications`**
Everything in spec §7: `emails/README.md`, the env files, the tester guide (through `lib/docNav.ts` if it's a new section), the privacy line, `CLAUDE.md`, and checklist section 2.27. Set the spec's Status to `Implemented on feat/tester-notifications`.

---

## Before calling the PR done

Four gates, then end to end on a preview deployment, with the migration applied and `UNSUBSCRIBE_SECRET` set and redeployed:

1. Tester A and builder B. B publishes a test case. A's sidebar shows **1**; at 360px, so does the Tests icon. A opens Available Test Cases: the badge goes at once, and stays gone on reload.
2. A person with both roles publishes their own test case. Their tester side shows **no** badge for it.
3. B closes and reopens it. No new badge (decision 1).
4. Call `/api/cron/daily` with the `CRON_SECRET` header. A tester with new test cases gets one email; call it again and nothing is sent. Copy each link from the email: absolute, on the preview's own host.
5. In Gmail: the sender line shows **Unsubscribe**. Use it, run the cron again, and no email arrives.
6. Signed out, open another tester's unsubscribe link. The page asks first, nothing changes until the button is pressed, and then that tester's Settings switch reads off.
7. A tampered token: one generic line on the page, a 400 from the API, and no write.
8. Settings → Account: the switch on a tester, absent on a builder.

## Out of scope

Everything in the spec's Out of scope section, in particular per-test-case emails, push or realtime notifications, and filtering the digest by skills.
