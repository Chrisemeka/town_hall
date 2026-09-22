# SPEC: Public Pages

**Status:** Awaiting approval
**Branch:** `feat/public-pages`
**Base:** `main` with `feat/public-theme` merged
**Depends on:** `feat/public-theme` (PR 1) — every page is built on its tokens and shell
**Blocks:** `feat/email-password-auth` (PR 3) — the footer's "Get started" entry
**Source:** `docs/TWNHALL_UI_REVAMP_STAGE1_PROMPT.md` — PR 2
**Migration:** none

## Summary

Six public pages on PR 1's shell: `/pricing`, `/guides`, `/guides/builder`,
`/guides/tester`, `/about`, `/contact`. A permanent redirect from `/guidelines`.
The header nav and the footer's missing columns fill in, and the mobile sheet
PR 1 deferred arrives with the links that justify it. Correct in both themes,
responsive to 360px.

## Why

PR 1 built a shell with an empty nav. These are the pages that go in it, and
three of them carry real weight rather than marketing filler:

- **`/pricing`** is Phase 2 of the monetisation plan — ration honestly, no
  paywall, the upgrade button opens a conversation.
- **The guides** replace `/guidelines`, which predates the v2 testing model and
  describes a product that no longer exists. It is currently linked from the
  app sidebar as "How it works", so the stale page is being actively served to
  users mid-task.
- **`/contact`** is the only route the Pro conversation runs through.

## Non-goals

- **No checkout, no Stripe, no Paystack, no price IDs.** Phase 3 in the plan,
  gated on builders asking to pay. `CLAUDE.md`'s Do Not Touch entry on payments
  stands: this PR adds a page that *describes* tiers, not a payment surface.
- **No tier enforcement.** See §1. Nothing in this PR reads or writes a limit.
- **No `testers_needed` field on the mission form.** See §3.2.
- **No account-aware pricing.** No "your current plan" badge, no usage meter,
  no upgrade state. There is nothing to read it from.
- **No port of `/guidelines` content.** Written from scratch against the code.
- **No dashboard theming, no ≤480px work outside these pages.** Logged debt.

## §1 — The honesty problem, settled before any copy is written

**The pricing page describes limits that no code enforces.** There is no report
counter, no per-mission tester ceiling, no active-mission limit. Tier
enforcement is item 3 in the plan's build order and is not built.

That is not a blocker — it is exactly Phase 2, which the plan describes as
"ration honestly … still no payment — the upgrade button opens a conversation."
But it binds the copy in three ways, and every one of them is a way to
accidentally lie:

1. **The page describes the shape of the offer, never the state of an account.**
   No "You're on Community", no "3 of 5 reports used", no upgrade button that
   implies a switch exists to flip. Present tense about what a tier *is*, never
   about what the reader currently *has*.
2. **The Pro CTA is `/contact`, worded as a conversation.** "Hitting your limit?
   Get in touch." Never "Subscribe", "Upgrade", "Start free trial", "Choose
   plan" — every one of those is a button promising a transaction that does not
   exist. The brief is explicit: *a dead checkout is worse than an honest one*.
3. **No feature is listed that has not shipped.** The plan's tier table includes
   a "Video feedback — later, once built" row. It does not go on the page. A
   pricing table is a promise, and "later" on a promise is how a roadmap gets
   sold as a product.

If tier enforcement ships later and the numbers change, this page changes with
it. It is marketing copy about a working position, not a contract.

## §2 — `/pricing`

Content from `docs/Twnhall_Monetisation_Plan_v4.docx`. Use its vocabulary
exactly — §2 of the plan says getting the words right matters more than it
looks, and that if the page needs a worked example the pricing is too
complicated.

### 2.1 — The three terms, with their glosses

Each term appears with its one-line gloss the first time it is used. The plan's
§2 wording, near-verbatim:

| Term | Gloss on the page |
|---|---|
| **Tester report** | "A real person tests your product and sends you a structured report — what they did, what broke, with screenshots." |
| **Testers per mission** | "Up to 5 testers on any one test." |
| **Active missions** | "Run up to 2 tests at the same time." |

"Tester report" is the metered unit and the page's central noun. It names the
human, which is the differentiator against bot-based tools. Do not silently
substitute "session", "credit", "test" or "feedback" anywhere on the page.

### 2.2 — The table

| | Community — Free | Pro — $19/mo · ₦10–12k |
|---|---|---|
| Projects | Unlimited | Unlimited |
| **Tester reports per month** | **5** | **20** |
| Earn extra reports by testing | +1 per report you complete | Same |
| Testers per mission | Up to 5 | Up to 8 |
| Active missions at once | 2 | 5 |
| AI insights | 3/month | Unlimited |
| CSV export | ✓ | ✓ |
| Shareable report | — | ✓ |
| Priority in the tester queue | — | ✓ |

Two rows from the plan's table are deliberately not here:

- **"Full audit-log feedback + screenshots — Yes / Yes."** Identical on both
  tiers, so it is not a differentiator and reads as filler in a comparison
  column. It is the product's core value, so it goes *above* the table as
  prose, not inside it as a tick.
- **"Video feedback — / Later, once built."** §1.3.

The naira figure ships as the range "₦10–12k", not a computed number. The plan
flags that its ₦1,400/$1 rate is from July and asks for a check; a range does
not go stale the way a precise figure does.

**Design:** two cards side by side on ≥768px, stacked below, `surface-raised`
on `surface`. Pro carries the one Voltage element on the page — per
`DESIGN.md` §7.5, "Most Popular"-style tags are one of only two permitted
attention-grabbing extras. Every tick or dash is paired with a text label or a
row header, never colour alone (`DESIGN.md` §10). The comparison is a real
`<table>` with `<th scope>` — a grid of divs is unreadable to a screen reader
going cell by cell.

### 2.3 — The five-tester note

A short block below the table, framed as **methodology, not rationing** — the
plan's §5 framing, which is also what the mission form should say:

> Up to 5 testers per mission. Research shows 5 people find around 85% of
> usability problems — beyond that you are paying to rediscover the same
> issues. Testing a different flow? Create another mission.

Attribute it to the Nielsen Norman Group. **Carry the caveat** the plan gives:
it holds for qualitative usability testing, which is what Twnhall does, and not
for quantitative work — task success rates, A/B tests, load testing. Stating the
limit is what makes the claim credible rather than a number borrowed to justify
a cap.

External link to the NN/g article: `target="_blank" rel="noopener noreferrer"`
per `DESIGN.md` §10.

### 2.4 — The CTA

One per card:

- **Community:** "Start testing" → `signInWithGoogle`, the same action the
  header uses. Secondary variant — the header's sign-in is already the page's
  Voltage fill and `DESIGN.md` allows one per viewport.
- **Pro:** "Hitting your limit? Get in touch" → `/contact`.

No checkout. No pricing toggle (monthly/annual) — there is one price and a
toggle implies a billing system.

## §3 — `/guides/builder` and `/guides/tester`

**Written from scratch. The source of truth is the code, not `/guidelines`.**
A guide that contradicts the form is worse than no guide, so every rule below
is cited to the file that enforces it, and every number is the constant's real
value.

### 3.1 — The rules the guides must state correctly

| Claim | Enforced by | Value |
|---|---|---|
| Project summary | `projectSchema`, `lib/sentences.ts` | ≤200 chars **and** ≤2 sentences |
| Project category | `PROJECT_CATEGORIES` | 14 values, "Other" last |
| Test categories | `TEST_CATEGORIES` + `TEST_CATEGORY_BLURBS` | Process Flow, Component, UI Design — use the blurbs verbatim |
| Device target | `DEVICE_TARGETS` | Mobile / Desktop / **Mobile & Desktop** — "both" is its own answer, not the union |
| Step action / expected | `STEP_ACTION_MAX` / `STEP_EXPECTED_MAX` | 200 chars each |
| Step statuses | `ENTRY_STATUSES` + `ENTRY_STATUS_HINTS` | pass / fail / blocked — use the hints verbatim |
| **What a pass owes** | `auditEntrySchema` | **nothing but its status** |
| **What a fail owes** | `auditEntrySchema` | `actual_result`, `issue_summary`, `steps_to_reproduce` |
| **What a blocked step owes** | `auditEntrySchema` | **the same three.** Blocked is not a lighter failure |
| Each of those fields | `ENTRY_TEXT_MAX` | ≤500 chars |
| Screenshots | `AuditLogForm`, `screenshotSchema` | **at least one required**, up to 10, PNG/JPG/WEBP, ≤5 MB each |
| Free-text comment | `submissionSchema` | optional, ≤2000 chars |
| Review outcome | `lib/review.ts` | pending → approved **or** needs changes; a 1–5 rating is required on both |
| Expected result | — | **no longer collected from testers.** Do not describe it as a field |

`auditEntrySchema` and `firstIncompleteEntry` are the pair `CLAUDE.md` says
move together. **The guides become a third place that states the same rule** —
in prose, for a human. If the schema changes, the guide is now part of what
changes with it. §7 puts a test behind that so it is not left to memory.

### 3.2 — The thing the builder guide must not say

**The mission form does not ask how many testers you want.** `missions.testers_needed`
exists in the schema and is read by `app/(tester)/tester/page.tsx`, but neither
`createMission` nor `updateMission` writes it — it is unused since the load-test
migration, exactly as the plan's §5 notes.

So the builder guide explains the five-tester rule as **methodology and mission
sizing** — one mission per flow, scope a mission to what five people can
usefully cover — and never as a number the builder picks. The brief asks the
guide to cover "how many testers to ask for and why"; the honest version of
that section is the *why*, because the *how many* has no control behind it yet.

Adding the field is tier-enforcement work (plan build-order item 3), not this PR.

### 3.3 — Builder guide outline

1. **What Twnhall is for you** — you get structured reports from real people;
   you pay for them by testing other people's work.
2. **Create a project** — name, URL, category, and the two-sentence summary,
   with the real limit and why it is two sentences.
3. **Choose what kind of test you need** — the three categories with their
   blurbs, and what each is good at.
4. **Write the test case** — from a template (the 12 in `lib/testTemplates.ts`,
   grouped by category) or from scratch. One action + one expected result per
   step, 200 characters each. What makes a step testable.
5. **Notes for testers** — optional, and genuinely optional: it is notes, not
   the brief. The test case is the brief.
6. **Device target** — three answers, and that "Mobile & Desktop" is a choice
   rather than indecision.
7. **How many testers, and why five** — §2.3's methodology, per §3.2.
8. **Reading an audit log** — one row per step; what pass, fail and blocked each
   mean and what a tester owes on each; why a blocked step is the most urgent
   thing in a report, not the least.
9. **Review and rate** — approve or request changes, both with a 1–5 rating,
   and what the rating is for.

### 3.4 — Tester guide outline

1. **What a mission is** — one project, one thing to test, a test case to work
   through.
2. **Read the test case first** — ordered steps, each an action and what should
   happen. Open the project in another tab.
3. **Fill the log as you go** — a row per step, not a write-up at the end.
4. **Pass, fail or blocked** — the three hints verbatim, then the distinction
   spelled out: blocked means you could not get there, and marking it Fail
   reports a bug in a feature nobody reached.
5. **What each field wants** —
   - *What actually happened* — what you saw, not what you think caused it.
   - *Summary of the issue* — one line a builder can scan in a list.
   - *Steps to reproduce* — numbered, from a known starting point.
   Each ≤500 characters, and **all three are required on a fail and on a
   blocked step.** A pass needs none of them.
6. **Screenshots** — at least one, up to 10, PNG/JPG/WEBP under 5 MB. Shoot the
   failure, not the homepage. The form compresses before upload.
7. **Anything else** — the optional comment, and what belongs in it.
8. **What gets rated well** — specific, reproducible, screenshot-backed,
   honest about what you could not do. The builder rates every submission 1–5.

### 3.5 — `/guides` index

Two cards, one per guide, each with a sentence on who it is for. Nothing else —
it exists so the nav and footer have a single destination and so
`/guidelines` has somewhere to land.

## §4 — `/about` and `/contact`

**`/about`** — short. What Twnhall is, who it is for, the reciprocal model
(you earn feedback by giving it), the trained tester cohort, Nigerian-built. No
team page, no timeline, no metrics. One screen.

**`/contact`** — no form, no backend. The page names the two reasons someone
writes and gives a `mailto:` for each with a prefilled subject, plus the plain
address as text for anyone without a mail client configured:

- "Hitting your report limit?" → `mailto:twnhallhq@gmail.com?subject=Twnhall%20Pro`
- Anything else → `mailto:twnhallhq@gmail.com`

Decided over a form: a public unauthenticated form is a spam magnet, there is
no bot check anywhere in the repo, and the Turnstile the reference uses is
explicitly skipped in PR 3. A mailto has no spam surface and no server action
to secure. **If the Pro conversation volume ever makes the mailto's drop-off
matter, that is the moment to build the form** — schema, server action, Resend,
rate limit.

`twnhallhq@gmail.com` is the address already in the live footer, so it is not a
new claim about what is monitored.

> **Blocked on one input:** the X/Twitter handle. The old landing footer carried
> `<Link href="#">X (Twitter)</Link>` — a dead link, deleted in PR 1. It ships
> on `/contact` and in the footer **only** with a real handle; without one it is
> omitted, per the rule that a link to nothing is worse than a missing link.
> Nothing else in this PR depends on it.

## §5 — Shell, nav and footer

PR 1 shipped the header nav empty and the footer at three columns. This PR
fills both — one-line additions to the arrays, in the PR that creates the
destinations, exactly as PR 1 said.

**Header nav:** Pricing, Guides, About.

**Footer**, now four columns:

| Brand | Product | Guides | Company & legal |
|---|---|---|---|
| Logo, tagline, "Made in Nigeria 🇳🇬" | Pricing, About | For builders, For testers | Contact, Privacy policy, Terms of service, Sign in |

"Get started" waits for PR 3's `/signup`. `lg:grid-cols-3` becomes
`lg:grid-cols-4`.

**Mobile sheet** — the piece PR 1 deferred, now that there are links to put in
it. Hamburger below 768px, `aria-expanded` + `aria-controls`, focus moved into
the panel on open and returned to the trigger on close, `Esc` closes, focus
trapped while open, tap targets ≥44×44px. The theme toggle and the sign-in CTA
stay in the bar at all widths — they do not move into the sheet.

## §6 — Routing

### 6.1 — `lib/access.ts`

**The brief says "add them to the public list". There is no public list.**
`accessFor()` allows any path not claimed by `BUILDER_PREFIXES` or
`TESTER_PREFIXES` — the new pages are already permitted, by construction, for a
builder, a tester and a signed-out visitor alike. Adding a list of routes whose
only effect is to reach the same answer twice is a second source of truth for
no behaviour.

So the change here is **one string**: `/guidelines` → `/guides` in
`SHARED_PREFIXES`. It is listed there because the app sidebar links it from
inside the product, and that stays true of `/guides`.

What actually pins the new routes is a test, not a list — §7.

### 6.2 — `middleware.ts`

**No change expected, and this must be verified rather than assumed.**
`protectedPrefixes` does not match any new path, so anonymous visitors are fine.
The authenticated bounce is `pathname === '/'` exactly, so it does not reach
`/pricing` or the guides. The verification gate runs only on `isRoleScoped`
paths, which these are not.

The risk the brief names — a logged-in user bounced off the marketing pages —
is therefore already absent. §7 adds the assertion that keeps it absent.

### 6.3 — The `/guidelines` redirect

Permanent (308) via `redirects()` in `next.config.ts` — the native Next.js
mechanism, no middleware branch, no page that renders a client redirect.

`app/guidelines/` is **deleted**. Leaving the page in place with a redirect in
front of it means two answers to the same URL depending on which layer runs.

Three in-app links point at it and are updated to `/guides` **directly**, not
left to the redirect:

- `components/layout/Sidebar.tsx` × 2 — the "How it works" nav item, desktop and
  mobile. This is the one that matters: it is served to signed-in users mid-task.
- `components/TermsAcceptForm.tsx` — the guidelines link on the terms gate.
- `components/public/PublicFooter.tsx` — PR 1's placeholder entry.

### 6.4 — `app/sitemap.js` and `app/robots.js`

Sitemap: `/guidelines` out, the six new pages in. Priorities — `/pricing` 0.8,
the guides 0.7, `/about` and `/contact` 0.5, legal stays 0.3.

Robots: no change needed; the new pages are all crawlable and none of the
`disallow` prefixes match. Confirm rather than assume.

## §7 — Tests

Per `TEST.md` §1's pattern — pure-logic scripts for pure logic, Vitest for
actions. **This PR adds no server action**, so it adds no Vitest file. Two
things get pinned:

**`scripts/access.test.mts` — extended.** The existing `/guidelines` entries in
its three shared-surface loops become `/guides`, and one new block asserts every
public marketing path is allowed for `builder`, `tester` and `null`:

```
/pricing  /guides  /guides/builder  /guides/tester  /about  /contact
```

That is the regression guard for §6.1 and §6.2 together: if someone later adds
`/guides` to a role prefix, or widens `protectedPrefixes`, this fails.

**`scripts/guides.test.mts` — new.** The guides restate rules the schemas
enforce, and prose drifts silently where a type would not. It asserts the
guide pages' source contains the values it must:

- the real numbers — 200, 500, 2000, 10, 5 MB, 1–5 — appear in the guide source
- every `ENTRY_STATUS_HINTS` string appears verbatim in the tester guide
- every `TEST_CATEGORY_BLURBS` string appears verbatim in the builder guide
- the tester guide names all three fields a fail and a blocked step owe
- neither guide contains the string "expected result" as a field the tester
  fills — the one claim most likely to be written from memory of the old form

It is a string-containment test over a source file, which is a blunt instrument
and will need touching if the copy is reworded. That is the point: it makes
rewording the copy notice that it is restating a schema.

## Acceptance criteria

1. Six pages render at `/pricing`, `/guides`, `/guides/builder`,
   `/guides/tester`, `/about`, `/contact`, inside the `(public)` group.
2. Every page is correct in both themes at 360px, 768px and 1440px, with no
   horizontal scroll at 360px.
3. `/pricing` matches §2.2's table exactly; the three terms carry their glosses;
   the five-tester note carries the NN/g attribution **and** the qualitative
   caveat.
4. `/pricing` contains no checkout, no "Subscribe"/"Upgrade"/"Start trial"
   control, no account state, and no unshipped feature. The Pro CTA goes to
   `/contact`.
5. The pricing comparison is a semantic `<table>` with `<th scope>`, and no
   cell conveys state by colour alone.
6. Both guides are correct against §3.1's table — every number matches its
   constant, every status hint and category blurb is the vocabulary's own
   wording.
7. Neither guide describes an expected-result field the tester fills.
8. The builder guide does not describe choosing a tester count (§3.2).
9. `/guidelines` returns a permanent redirect to `/guides`; `app/guidelines/`
   no longer exists; the sidebar, terms gate and footer link `/guides` directly.
10. A signed-in builder and a signed-in tester can both reach all six pages —
    verified in a running app, not only in `accessFor()`.
11. A signed-out visitor can reach all six.
12. Header nav and the four-column footer link only pages that exist. No
    `href="#"`. The X/Twitter link ships only with a real handle.
13. The mobile sheet opens, traps focus, closes on `Esc`, returns focus to the
    trigger, and its tap targets are ≥44×44px.
14. `app/sitemap.js` lists the six new pages and no longer lists `/guidelines`.
15. `scripts/access.test.mts` covers all six paths for builder, tester and null.
16. `scripts/guides.test.mts` passes and is wired into `npm test`.
17. `npx tsc --noEmit` — zero errors.
18. `npm run lint` — passes, no new `as any`.
19. `npm run build` — succeeds.
20. `DESIGN.md` records the pricing-table pattern; `CLAUDE.md`'s folder layout
    lists the new routes.

## Manual test plan

**After the redirect commit**
- `curl -I /guidelines` → 308 with `location: /guides`.
- Sign in, open the sidebar, click "How it works" → lands on `/guides` with no
  intermediate hop in the network panel.

**After the pricing commit**
- Read the page against `Twnhall_Monetisation_Plan_v4.docx` §2 and §3 side by
  side. Every number and every term.
- Search the rendered page for "subscribe", "upgrade", "trial", "billing",
  "card" — expect none.
- Screen reader through the comparison table: each cell announces its row and
  column.

**After the guides commit**
- Open `/guides/tester` beside the real audit log form on a live mission. Mark a
  step blocked. The guide's account of what the form now demands must match what
  the form demands.
- Same for `/guides/builder` beside the new-mission form.

**After the shell commit**
- Every header and footer link, clicked.
- 360px: hamburger opens, `Tab` stays inside the panel, `Esc` closes, focus
  returns to the hamburger.
- Signed in as a builder, then as a tester: visit all six pages. No redirect.

## Commit sequence

1. `feat(public): add the pricing page`
2. `feat(public): add the builder and tester guides`
3. `feat(public): add the guides index, about and contact pages`
4. `refactor: redirect /guidelines to /guides and repoint the app links`
5. `feat(public): fill the header nav, footer columns and mobile sheet`
6. `chore: add the public pages to the sitemap`
7. `test(public): cover the public routes and pin the guides to the schemas`
8. `docs: record the public pages and the pricing-table pattern`

## Open questions

**One, and it blocks a single link.** The X/Twitter handle (§4). Everything
else in this PR is unblocked; the link is omitted if no handle arrives.
