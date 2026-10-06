# Twnhall — Shareable Report (PDF): Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

One PR. It gives a Pro builder a printable, shareable version of a mission's results.

**Base:** `main`, after `feat/report-allowance` (PR 2 of the allowance work) has merged. That dependency is real: this feature is Pro-only, which means reading `accounts.plan_id` to decide who gets it, and that is tier enforcement — it does not exist before PR 2.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions.
2. Read `DESIGN.md` §5 and §8.
3. Read `TEST.md` §1.
4. Read `lib/csv.ts` and `app/api/export/feedback/route.ts` — same problem, different output: the builder's data leaving the product.
5. Read `lib/allowance.ts` and however PR 2 ended up resolving a plan.
6. Read `docs/specs/` and match that spec format.

Write the spec into `docs/specs/SPEC-shareable-report.md` first and **stop for approval before implementing.** All four gates before done: `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test`.

**Branch:** `feat/shareable-report`
**Migration:** none
**Risk:** low technically, medium editorially — this document leaves the company

---

## 1 — What this is, and what it is not

**It is a PDF the builder saves and sends.** Not a hosted link.

There is **no public URL, no share token, no revocation, and no unauthenticated route.** Those were considered and rejected: the builder wanted a document, and a document removes an entire class of problem — link guessing, leaked endpoints, what happens to an old link on downgrade.

What leaves the product is a file the builder downloaded. Everything the app serves stays behind the existing auth gate.

## 2 — How it is generated: a print route, not a PDF library

The repo has **no PDF tooling** — 29 dependencies, none relevant. So this is a new-capability decision, and the answer is to add no dependency at all.

Build a **chrome-less, print-styled page route**. The builder opens it and uses the browser's "Save as PDF".

Three options were weighed:

| Approach | Why not |
|---|---|
| Server-side library (pdf-lib, pdfkit) | You lay the document out by coordinate — manual wrapping, manual page breaks. With variable-length tester prose and screenshots it is slow to build and worse to change. |
| Headless Chromium (`@sparticuz/chromium`) | Best output, but on Vercel it means serverless bundle limits, multi-second cold starts, and a dependency that breaks on Next and Vercel upgrades. Against a $66/month fixed-cost budget it may also force a larger plan. |
| **Print route + browser print** | **Chosen.** No dependency, no infrastructure, no cost. |

**The decisive point: this work is not wasted if you later move to headless Chromium.** Chromium renders the same HTML with the same print stylesheet. The layout is built once and serves both paths. Note that in the spec so the next person does not treat the print route as a throwaway.

The route is also independently useful — a builder can open it and read a clean version without printing.

## 3 — The route

A **page route, not an API route.** `app/api/` is excluded from `middleware.ts`'s matcher; a page route gets the gate for free and this must be gated.

**It is authenticated and ownership-checked.** Use `requireProjectOwner()` per `CLAUDE.md`. Someone who is not the owner gets nothing — the printable view is not a back door to another builder's results.

Two things it must carry, as query params or path segments — your call, say which and why:

- **variant:** `full` or `summary` (§4)
- **screenshots:** on or off (§5)

Reached from the mission's results page with a small export control that sets both, then opens the print view.

### Two rendering traps

**Force the light theme.** The app has a cookie-driven dark mode. A builder printing in dark mode gets an ink-soaked document that looks broken. The print route renders light regardless of the theme cookie, and the semantic tokens must not be allowed to resolve dark here.

**No app chrome.** No sidebar, no nav, no theme toggle, no footer. Use `@page` margins, `break-inside: avoid` on each step block, and check that a step's content does not split across a page boundary mid-sentence.

## 4 — Two variants, not a report builder

The builder chooses who the document is for. **Offer exactly two presets. Do not build a configurator** — a screen of checkboxes produces worse documents than two well-made ones, and it is scope this PR does not have.

Label them by use, and name them by what they are:

| Preset | Picker label | Contains |
|---|---|---|
| **Full report** | "For your team, to work from" | Mission brief, every step, every tester's status and written answer, issue summaries and repro steps, per-report AI summary (labelled) |
| **Summary** | "For someone outside your team" | Mission title, tester count, date range, agreement counts per step, the issue summaries only. No raw prose dump, no AI text. |

### The summary must lead with agreement

This is the part that makes the feature worth paying for, and nothing in the product currently computes it.

With a five-person panel, **the number of testers who independently hit the same step is the finding.** Four of five reporting step 2 unclear is a real problem. One of five is noise. Lead the summary with that:

> **Step 2 — "Say who you think this is built for"**
> 4 of 5 testers: Unclear

Then the issue summaries under it, ordered by agreement descending. A reader outside the team should be able to take the first page and know what to fix, in order.

The raw data is already free — both tiers have CSV export. **What Pro is selling is the reading of it.** If the summary is just the CSV with nicer fonts, the feature has not earned its line on the pricing page.

### AI text does not go outside

The per-report `ai_summary` appears in the **full** report, clearly labelled as machine-generated, where the builder can sanity-check it before sending.

It does **not** appear in the summary variant. That document goes to investors and clients under the builder's name, and unreviewed model output is not something to put there by default.

## 5 — Screenshots are opt-in

A checkbox at export time, defaulting to **off**.

They are the most useful content and the most sensitive — a builder sharing results with an investor may not want their unreleased interface in a file they cannot recall. They also dominate file size.

When on: constrain max height so one screenshot cannot take a whole page, and make sure a missing or failed image degrades to a caption rather than a broken-image icon in a document someone is about to email.

## 6 — Testers appear as Tester 1, 2, 3

**Never a name, an email, a user id, or any other identifier, in either variant.**

A PDF cannot be revoked. A tester wrote "the checkout is confusing" expecting one builder to read it; that file can now travel anywhere, forever. Under the cohort model these are people being paid, whose ratings decide whether they keep getting work.

**Numbering rule: order by first submission time within the mission, number from 1.** Deterministic, stable across re-exports, and needs no stored mapping. Tester 2 on page 1 must be the same person as Tester 2 on page 4 — a reader tracking one person's path through the test is the point.

Cross-mission consistency is explicitly **not** required. The anonymisation protects the external reader's view, not the builder's — the builder still sees real names in the dashboard and the CSV, and that does not change.

## 7 — Escaping, and what `lib/csv.ts` already knows

Every field here is user-controlled: mission titles and test steps from the builder, `actual_result`, `issue_summary`, `steps_to_reproduce` and `notes` from testers.

CSV injection does not apply to HTML, but the HTML equivalent does. React escapes by default — **so the rule is simply that nothing in this route uses `dangerouslySetInnerHTML`**, for any reason, including "to render line breaks". Use CSS `white-space: pre-wrap` for that.

Say in the spec that you checked, and name anywhere you were tempted.

## 8 — Pro only, and what Community sees

Gate on the plan resolved the way PR 2 resolves it. Do not read `plan_id` directly in the page if PR 2 produced a helper — one definition, per `CLAUDE.md`.

Community builders see the control, disabled, with one line saying it is a Pro feature and the contact route from `lib/contact.ts`. **Not hidden** — a feature nobody can see is a feature nobody upgrades for. Not a dead end either: the line says what to do.

## 9 — Put the line back on the pricing page

PR 1 of the tier work removed "Shareable formatted report" from Pro's `includes` in `lib/plans.ts`, because the pricing page should not list what does not exist.

**This PR adds it back**, in the same commit that makes it real. Check the wording matches what actually shipped — if the output is a PDF the builder saves, say so, rather than leaving a phrase that suggests a link.

## 10 — Tests

- Ownership: a builder who does not own the project gets nothing from the route.
- Plan: a Community account cannot reach the print view; the control renders disabled with the contact route.
- **Tester numbering is stable across two exports of the same mission**, and no name, email or id appears in either variant's rendered output. Assert on the absence directly — this is the one that matters.
- Agreement counts are correct, including the case where one tester filed and the case where testers disagree evenly.
- `summary` contains no `ai_summary` text; `full` contains it, labelled.
- `screenshots=off` renders no image elements at all.
- A missing screenshot URL degrades to a caption.
- The route renders light-themed with the dark-mode cookie set.
- No `dangerouslySetInnerHTML` anywhere in the route or its components.

## 11 — Before calling it done

Four gates, then actually print it:

1. Save as PDF from Chrome **and** one other browser. Check page breaks, that no step splits mid-sentence, and that nothing is clipped at the margin.
2. Print a mission with five testers and long written answers — the realistic case, not a two-line one.
3. Print with screenshots on and confirm one image does not take a whole page.
4. Read the summary variant as if you were an investor who has never seen Twnhall. If the first page does not say what to fix and in what order, the content is wrong even if the code is right.

## 12 — Documentation

- **`CLAUDE.md`** — the print route, that it is authenticated and ownership-checked, the light-theme rule, the tester-anonymisation rule and why a PDF cannot be revoked.
- **`TownHall_Checklist (1).xlsx`** — QA rows for both variants, the screenshot toggle, the Community disabled state, and a print-and-inspect row.

## Out of scope

Any hosted or link-based sharing. Headless Chromium. Scheduled or emailed reports. Cross-mission or project-level roll-ups. Letting the builder edit the document before export — if they want that, they have the PDF.
