# SPEC: PDF Report — Readable by a Non-Technical Reader

**Status:** Approved 2026-10-22 — recommendations 1, 2 and 4 as written; 3 changed: ratings removed from the PDF entirely (§3.3). Implemented.
**Branch:** `feat/pdf-plain-language`
**Source:** `docs/TWNHALL_PDF_PLAIN_LANGUAGE_PROMPT.md`
**Migration:** none
**New dependency:** none
**Risk:** low — copy and layout in one document; no data, query or route change

## Summary

Layer the report for two readers. Pages one–two (opening, legend, findings)
are plain English for whoever the builder forwards it to. Everything after
(step-by-step detail, each tester, screenshots) stays as complete as today,
for the builder. Nothing is removed except the builder's ratings (§3.3), by decision.

Four commits: model (`lib/report.ts`) → document
(`components/report/ReportDocument.tsx`) → tests → docs.

## §0 — Read before writing this

- **The document is `components/report/ReportDocument.tsx`**, not under
  `app/api/export/report/` as the prompt says; the route only renders it.
  All content arithmetic is `lib/report.ts` and stays there — the document
  computes nothing (CLAUDE.md).
- **`ai_sentiment` is not in the PDF today.** `loadFeedback()` selects it, but
  neither `lib/report.ts` nor the document reads it. **Decision: keep it
  out.** It is not added, and nothing about the selection changes (the prompt
  puts "what data the report contains" out of scope). The AI *summary* is in,
  and already labelled "AI-generated summary — written by a model from this
  tester's report, not by the tester". That label stays.
- **`ENTRY_STATUS_HINTS` is written to the tester, in the second person**
  ("You could not get to this step at all."). Put in a legend as-is, "you"
  would mean the reader. See §3 for how the legend quotes it rather than
  rewording it.
- **Things the prompt's example says that the product cannot know:**
  - *"None of them had seen it before"* — nothing records that. Left out.
  - *"on their own phones"* — `device_target` is what the builder asked for,
    not what a tester used. The opening says "asked to try it on a phone".
  - *"Four of the five people could not work out who this product is for"* —
    that sentence paraphrases the step's wording, which needs a human or a
    model. The findings are built from templates (§2): the sentence says what
    happened in plain words, and the step's own wording follows as "They were
    asked to…". No AI call is added to the export.

## §1 — Opening block

Page one, under the project name and before anything else. Three or four
sentences, built in `lib/report.ts` as `opening: string[]`.

**One mission**, e.g. five testers, `ui_design`, mobile:

> Five people were asked to try Recipe Book on a phone and answer a set of
> questions about it, between 2 Oct and 6 Oct 2026. Each was given the same
> list of steps to try, and after each one said whether it went the way the
> builder expected. Below, first, is where they agreed; after that, what each
> person said at every step. On Twnhall, the service that ran this, a test
> like this is called a mission, and each person is a tester — called Tester
> 1, Tester 2 and so on, without their names.

**Every mission:** the same shape, with "In 3 separate tests, people were
asked to try Recipe Book…" and the report count. It cannot count people
across missions (no tester ids are selected — today's cover says the same).

"Mission" is explained here, once. Everywhere else the document says "test"
or uses the mission's title (§3.2).

## §2 — Findings as sentences — the main change

Each step with a problem leads with a sentence; the step's wording and the
existing count follow, smaller.

```
●●●●○  4 of 5 testers: Unclear                      ← secondary, as today
Four of the five people said this did not come across the way it was meant to.
They were asked to: Say who you think this is built for
What should have happened: It's obvious this is for home cooks
```

Sentences, by category and status (`findingSentence()` in `lib/report.ts`):

| | Functional (`process_flow`, `component`, null) | `ui_design` |
|---|---|---|
| fail | …found this step did not work the way it should. | …said this did not come across the way it was meant to. |
| blocked | …could not get to this step at all. | …could not judge this — it did not load, or was not there. |
| both | …ran into a problem here: 2 found it did not work, 1 could not get to it. | …same shape, design wording |

Counts in words up to ten ("Four of the five people"), digits after. "All
five people" when every answer is a problem; "The one person who tried this"
for one of one. The **existing `headline` string is kept unchanged** as the
secondary line — the builder's scanning line, and the string every current
test asserts.

The section is renamed "What we found". "No problems reported on steps 1,
3" becomes "Nobody reported a problem on steps 1 and 3."

## §3 — Terminology

### 3.1 Legend, sourced from `entryStatusCopy()`

Page one, between the opening and the findings, headed "How each step was
answered". Labels and hints both come from `entryStatusCopy(status,
category)` — which is `ENTRY_STATUS_HINTS` for functional missions and the
design copy for `ui_design` — never retyped:

> After each step, each person picked one of these. The line beside each is
> what they were shown when choosing.
>
> **Blocked** — "You could not get to this step at all."

Quoted, and introduced as what the tester saw, so the "you" reads correctly
and the copy is not reworded. **Recommendation: this, rather than a rewritten
third-person copy**, because a second copy is exactly the drift the prompt
wants prevented. An all-missions document that holds both kinds lists both
sets, the second introduced as "Tests of how something looks and reads use
these instead".

`TEST_CATEGORY_BLURBS` appears on the meta line: "UI Design Testing — How it
reads and feels — clarity, hierarchy, polish."

### 3.2 Changes, front half only

| Today | Becomes | Where |
|---|---|---|
| "What to fix first" | "What we found" | summary heading |
| "The test case" | "What we asked them to try" | summary |
| "Expected:" | "What should have happened:" | summary + findings |
| "Contents" (all missions) | "In this report" | cover |
| "Top issue: Step 2, 4 of 5 testers: Unclear" | the finding sentence | contents |
| "N reports" | "N people" (one mission) / unchanged across missions | cover |
| "Step by step" | "What each person did, step by step" | section heading |
| "Each tester" | "Each person's notes and screenshots" | section heading |

**Left alone, deliberately — the back half is the builder's:** "Expected:"
under each step heading, "Issue", "Steps to reproduce", "What they saw",
"Asked as", "Approved"/"Pending", status badges. These go in the glossary.

### 3.3 Other things found while reading every string

- **Ratings are removed from the PDF entirely — decision at approval.** "Average
  rating 4.2 / 5 from 3 reviewed reports" read as a rating *of the product*; it
  is the builder's rating of the testers' reports, and a forwarded reader has
  no use for it either way. The page-one average and the per-tester "Rated
  N / 5" are both gone, and `rating` is out of the model, so nothing can render
  it. `loadFeedback()` still selects the column — the CSV/XLSX use it.
- "Approved"/"Pending" beside each tester is the builder's review state, not
  a verdict on the product — glossary.
- "Filed before step-by-step reports" — glossary ("An older report: the person
  wrote notes rather than answering step by step.").
- The mix line ("Across 25 answers: 10 Clear · 12 Unclear · 3 Couldn't tell")
  is plain enough; stays.

### 3.4 Glossary

Last page, "What the words mean", one sentence each. Built in `lib/report.ts`
as `glossary` from a static list, **filtered to the terms the document
actually contains** — so the test "every glossary term appears in the
document" holds for every report and a reader never looks up a word that is
not there. Candidates: Step, Expected, What they saw, Issue, Steps to
reproduce, Asked as, Approved, Pending, Report rated, AI-generated summary,
Filed before step-by-step reports. Statuses are not repeated — the legend
covers them (prompt §6: never explain twice). Referenced from page one in "In
this report".

## §4 — Agreement visual

Beside each finding: one dot per answer to that step, filled for a problem,
outline for not, drawn with react-pdf `View`s (`borderRadius`, `borderWidth`)
— no chart, no SVG. Ink-filled vs. hollow, both in `C.ink`: reads identically
in greyscale and carries no meaning in colour. Always beside the written
count. Row wraps (`flexWrap`), so a 30-tester mission is 30 dots on two lines
rather than a squeezed bar. Front only — the step headings in the detail keep
their text line.

## §5 — Structure

1. **Page 1:** project · test title · meta · opening (§1) · "What we found"
   (§2) · the clean-steps line · mix line · "What we asked them to try".
   Then the legend (§3.1) and "In this report" (§5.1), which may run to page 2.
   *Changed in implementation:* the first render put the legend and contents
   above the findings, and "What we found" was stranded at the foot of page
   one with every finding on page two. Findings now come straight after the
   opening — a reader who stops at page one has read them — and every front
   heading carries `minPresenceAhead`.
2. **Detail:** unchanged in content, renamed heading.
3. **Each person's notes:** unchanged but for the ratings (§3.3).
4. **Glossary:** its own page.

### 5.1 "In this report" — on every document

The prompt asks for a contents page above ~4 pages. Every report with steps
already exceeds that once screenshots are on, so it is unconditional: a short
list on page one, not its own page. **Links, not page numbers** — react-pdf
cannot know a later page number when rendering an earlier one; it does
support internal links (`<Link src="#id">` to a `View id`). Each entry
clicks through in a viewer and still reads as a list on paper.

All missions: the list is one entry per test (title, its top finding as a
sentence, people count), then the glossary.

### 5.2 Rules kept

Step headings with `minPresenceAhead`, answers `wrap={false}`, one `<Page>`
per section, footer and page numbers, light only, no `lineHeight`. All four
react-pdf traps in CLAUDE.md stay respected.

## §6 — Not doing

- No variant or toggle. No second chart. No AI call. No change to the route,
  `loadFeedback()`, the caps or the CSV/XLSX. No change to the in-app
  vocabulary.

## §7 — Real-reader check

**I cannot run this.** Before merge, show the regenerated five-tester PDF to
one person with no technical background and ask: (1) what was being tested,
and by whom? (2) what are the three things the builder should fix? Record
their answers here:

- Reader: _
- Q1: _
- Q2: _

## §8 — Tests

`lib/__tests__/report.test.ts`:
- `opening` is present on a one-mission and an all-missions model, names the
  project, the people count and the date range, and contains "mission" once.
- `findingSentence` for each row of the §2 table; numbers in words; "All";
  one of one.
- Legend entries **equal** `entryStatusCopy(s, category)` for every status —
  and for `process_flow` equal `ENTRY_STATUS_HINTS[s]` by reference to the
  constant, so the two cannot drift; `ui_design` gets the design hints and
  none of the functional ones.
- An all-missions legend lists the functional set first whatever the
  mission order — found in the greyscale read, where the design mission came
  first and "use these instead" sat above Pass / Fail.
- Glossary holds only terms present (a report with no "Asked as" has no "Asked
  as" entry).

`components/report/__tests__/reportDocument.test.ts` (real PDF, read back):
- Opening renders on a one-mission report and an all-missions report.
- Each finding's sentence appears, and appears **before** its count line in
  the text order.
- Legend text matches `ENTRY_STATUS_HINTS` (functional) / design hints
  (`ui_design`).
- Agreement dots: a 5-tester step draws 5 dots, a 3-tester step 3 — counted
  from the model (`step.answers.length`) and the written "N of M" line beside
  it. (Dots are not text; asserting on drawn circles in the PDF stream is
  brittle, so the count is asserted through the model and the label through
  the PDF.)
- Every glossary term appears in the document outside the glossary page.
- Existing tests stay, especially the no-name/email/id one.

## §9 — Before done

Four gates, then: `pdfimages -list` on a report with screenshots on —
poppler is not installed on the dev machine, so this is yours; the
`/Subtype /Image` assertion in `reportDocument.test.ts` still passes.
A greyscale render (PyMuPDF, `csGRAY`) of pages one and two of the
five-tester fixture was read at full page height: the dots read as filled vs.
hollow, and the all-missions legend bug in §8 was found that way. A real
greyscale print is still yours.

## §10 — Docs

- `CLAUDE.md`, in the PDF report paragraph: two readers, plain at the front,
  complete at the back; the legend comes from `entryStatusCopy()` /
  `ENTRY_STATUS_HINTS` and is never retyped; the rating describes the
  reports, not the product.
- `TownHall_Checklist (1).xlsx`: QA rows for the opening, findings as
  sentences, the legend, the greyscale dots.

## Decisions (approved 2026-10-22)

1. **Legend quotes the tester-facing hints verbatim** (§3.1) — recommended —
   vs. a separate third-person copy.
2. **Finding sentences are templates, not paraphrases** (§0, §2) —
   recommended; the alternative is an AI call per export.
3. ~~Rating line moves off page one~~ — **ratings removed entirely** (§3.3).
4. **"In this report" on every document, with links not page numbers** (§5.1).
