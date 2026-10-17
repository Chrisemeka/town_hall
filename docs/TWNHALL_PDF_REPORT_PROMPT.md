# Twnhall — Downloadable PDF Report: Implementation Prompt for Claude Code

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

**This supersedes `docs/TWNHALL_SHAREABLE_REPORT_PROMPT.md`.** That one specced a print-styled route behind a Pro gate with two variants. The requirements changed: a real downloadable file, free to everyone for now, one document that is both detailed and readable. Delete or mark that file superseded as part of this work.

---

## Preamble

A builder picks a project and a mission — or all missions — and downloads a PDF of the results.

One PR, three commits.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions.
2. Read `components/settings/ExportPanel.tsx` and `app/api/export/feedback/route.ts` — **the selection UI and the route shape are being matched, deliberately.**
3. Read `lib/testerNumbers.ts` and its tests.
4. Read `lib/rateLimit.ts`, `lib/review.ts`, `components/submissions/SubmissionBody.tsx`.
5. Read `DESIGN.md` §5, `TEST.md` §1, and `docs/specs/` for the spec format.

Write the spec into `docs/specs/SPEC-pdf-report.md` first and **stop for approval before implementing.** All four gates before done: `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test`.

**Branch:** `feat/pdf-report`
**Migration:** none

---

# 1 — Free for everyone, and the pricing page stays honest

**No `plan_id` check.** Every builder gets this, so it can be tested properly.

Leave a clearly marked place where the gate would go, with a `ponytail:` note naming `lib/allowance.ts` as where plan resolution lives.

**Do not add "Shareable formatted report" back to Pro's `includes` in `lib/plans.ts`.** PR 1 of the tier work removed it because it did not exist. Listing it as a Pro feature while it is free to everyone would be a different kind of false. It goes back on the pricing page when, and only when, it is actually gated.

---

# 2 — Selection: match the CSV exactly

`ExportPanel` already solves this, and the PDF control should feel like the same feature rather than a second one:

```
export type ExportProject = { id: string; name: string; missions: { id: string; title: string }[] }
```

A project select, then a mission select where `""` means every mission. Only projects and missions that actually have reports are offered.

**Reuse `ExportProject` and the data that feeds it.** If the panel needs restructuring so both exports share one loader, do that rather than writing a second query that drifts.

**Put the PDF control next to the CSV one**, in the same section. Two buttons, one selection. Not a separate panel elsewhere.

Note how the CSV splits: one mission is a CSV, all missions is an Excel workbook with a sheet each. **The PDF does not split.** All missions is one document with a section per mission — which is better than the workbook case, since a PDF can carry a cover and an overall summary that a workbook cannot.

---

# 3 — Generation: @react-pdf/renderer, with verification first

The repo has no PDF tooling. Three options were weighed:

| Approach | Verdict |
|---|---|
| Headless Chromium (`@sparticuz/chromium`) | Best fidelity, but serverless bundle limits, multi-second cold starts, and a dependency that breaks on Next and Vercel upgrades. Against a $66–76 fixed cost it may force a larger plan. |
| `pdf-lib` / `pdfkit` | Layout by coordinate. With variable-length tester prose and screenshots, slow to build and worse to change. |
| **`@react-pdf/renderer`** | **Chosen.** Declarative React components, flows text, handles page breaks and repeating headers, no browser, works in a serverless function. |

**Verify React 19 and Next 16 compatibility before committing to it.** This is the one thing that could sink the choice. Check the package's peer dependencies and build a trivial document end to end *first*. If it does not work, stop and report rather than fighting it — the fallback is a print-styled route with browser "Save as PDF", which is a worse user experience but a working one, and that trade is the user's to make, not yours.

**Nothing here reuses the web components.** The earlier spec required composing the tester's own components, because that document was a mirror of the tester's view. This one is a report with its own layout, so it has its own component tree. Say so in the spec so the two rules do not get confused later.

---

# 4 — The route

`app/api/export/report` or similar, beside the CSV route.

**It is an API route, so `middleware.ts` does not gate it.** Everything the CSV route does for itself, this does too — read it and match:

- Authenticate, and prove project ownership from the submission data, never from the request
- Rate limit — **add a new rule rather than reusing `export:account`.** Rendering a thirty-page document with images is far heavier than streaming a CSV. Something like `export:pdf:account` at a tighter limit; pick a number and justify it.
- Correct `Content-Type` and a `Content-Disposition` filename that includes the project and mission, so a builder with four of these in Downloads can tell them apart.

**Cap the work.** A function timeout halfway through a large render produces a broken download with no explanation. Set a maximum number of reports and images per document, and when it is exceeded return a clear message telling the builder to pick a single mission. Say what caps you chose.

---

# 5 — Content: detailed *and* readable, which means ordering

"As detailed as possible" and "easy to read" pull against each other. The resolution is not less detail — it is **summary first, detail after.** A reader who wants the answer gets it on page one; a reader who wants evidence reads on.

## 5.1 — Cover

Project name, mission title (or "All missions"), generation date, Twnhall mark. Then the shape of the evidence: how many testers, how many reports, the date range they were filed in.

## 5.2 — Summary — and agreement is the headline

**This is the part that makes the document worth reading, and nothing in the product currently computes it.**

With five testers on one mission, **the number who independently hit the same step is the finding.** Four of five reporting step 2 unclear is a real problem. One of five is noise. Lead with it, ordered by agreement descending:

> **Step 2 — "Say who you think this is built for"**
> **4 of 5 testers: Unclear**

Then, underneath: the overall status mix across the mission, the average rating the builder gave, and the test case itself so a reader who was not there knows what was asked.

A builder should be able to read page one and know what to fix, in order.

## 5.3 — Detail, organised **by step, not by tester**

This is the most important structural decision in the document.

Organised by tester, a builder reads one person's whole report, then the next, flipping back and forth to compare answers to the same step. **Organised by step, all five answers to step 2 sit together** — which is exactly how you judge whether something is a real problem.

It also matches the CSV, which is already one row per step.

For each step, in order:

- The step as the tester saw it — `step_action` and `step_expected`, **snapshotted on the report**, not re-read from the mission. A mission edited after submission must not change what the report says a tester was asked.
- Each tester's answer: status, what they saw (`actual_result`), and where present the issue summary and steps to reproduce.
- **Status labels follow the mission's category** — Clear / Unclear / Couldn't tell for `ui_design`, Pass / Fail / Blocked otherwise. The label maps are in `lib/vocabulary.ts`; use them rather than hard-coding strings.

## 5.4 — Per-tester closing section

`tester_comment` is the tester's overall note and does not belong to any step. Collect these at the end, one short block per tester, after the step-by-step detail.

Include the AI summary where present, **clearly marked as machine-generated.** The builder can judge it; an unlabelled paragraph of model output in a document they may forward is not acceptable.

## 5.5 — Testers are numbered, always

**`testerLabel()` from `lib/testerNumbers.ts`. No name, no email, no id, anywhere in the document, ever.**

That helper exists and is tested precisely so this work does not reinvent it. The numbering is stable within a mission so "Tester 2" on page 3 is the same person as "Tester 2" on page 9 — a reader following one person's path through the test is a thing that happens.

A PDF cannot be unshared. This rule does not bend.

## 5.6 — Screenshots

A checkbox beside the mission select. Given the ask is for detail, **default it on**, with the file size noted beside it.

- Constrain max height so one screenshot cannot take a whole page.
- A missing or failed image degrades to a caption, never a broken-image box in a document someone is about to send.
- Fetching images server-side is what will dominate render time — count them against the §4 cap.

---

# 6 — Readability in a PDF specifically

Things that are free on a web page and have to be done deliberately here:

- **Repeat the step heading on a page break.** A tester's answer stranded on page 7 with no heading is unreadable.
- **Never split a single tester's answer across pages** where it can be avoided.
- **Page numbers and a running footer** with the project and mission.
- **A contents page** when the document covers all missions.
- **Light theme always.** Twnhall's cookie-driven dark mode has nothing to do with a printed document, and a dark PDF is ink-soaked and looks broken.
- Generous type. This is read at A4, not on a phone.

---

# 7 — Tests

- A one-mission PDF generates and contains the mission title, every step, and every report.
- **No tester name, email or id appears in the output.** Assert on absence directly — extract the text and search it. This is the one that silently regresses.
- Agreement counts are correct, including one tester only, and an even split.
- Step labels follow category: `ui_design` renders Clear / Unclear / Couldn't tell.
- Steps come from the report snapshot — editing the mission afterwards does not change an existing report's rendering.
- Screenshots off produces no images; a broken image URL produces a caption.
- All-missions produces one document with a section per mission.
- A builder who does not own the project gets nothing from the route.
- Exceeding the cap returns a clear message, not a truncated file.

---

# 8 — Before calling the PR done

Four gates, then **open the actual PDF**:

1. Generate for a mission with five testers and long written answers — the realistic case, not a two-line one.
2. Check page breaks: no step heading orphaned, no answer split mid-sentence, footers and page numbers on every page.
3. Generate with screenshots on and confirm one image does not fill a page.
4. **Read page one as if you had not seen Twnhall.** If it does not tell you what to fix and in what order, the content is wrong even if the code is right.
5. Search the text for a tester's real name. Find nothing.

## 9 — Documentation

- **`CLAUDE.md`** — the PDF route, that it is free for now with the gate point marked, tester numbering is mandatory on every exported surface, and that the report has its own component tree rather than reusing the tester view.
- **`docs/TWNHALL_SHAREABLE_REPORT_PROMPT.md`** — mark superseded by this one.
- **`TownHall_Checklist (1).xlsx`** — QA rows for single and all-mission generation, the screenshot toggle, anonymity in the output text, and the cap message.

## Out of scope

Plan gating. Hosted or link-based sharing — this is a file the builder downloads, nothing is published. Emailed or scheduled reports. Cross-project roll-ups. Letting the builder edit the document before export.
