# Twnhall — PDF Report: Readable by a Non-Technical Reader

**Paste this whole file into Claude Code at the root of the `townhall` repo.**

---

## Preamble

The PDF report works for technical readers. It was shown to several, who were fine with it themselves and predicted a non-technical reader would struggle with the terminology, the lack of context, and the structure.

This PR makes it readable by someone who has never heard of Twnhall, **without taking any detail away from the builder.**

One PR, four commits.

Before touching anything:

1. Read `CLAUDE.md` in full. It wins over this prompt on codebase conventions.
2. Read `lib/report.ts` and the document components under `app/api/export/report/`.
3. Read `ENTRY_STATUS_HINTS` and `TEST_CATEGORY_BLURBS` in `lib/vocabulary.ts` — **plain-language copy already exists there and is currently shown only to testers.** See §3.
4. Read `docs/TWNHALL_PDF_REPORT_PROMPT.md` for the original content design.
5. Read `TEST.md` §1 and `docs/specs/` for the spec format.

Write the spec into `docs/specs/SPEC-pdf-plain-language.md` first and **stop for approval before implementing.** All four gates before done: `npx tsc --noEmit`, `npm run lint` (no new `as any`), `npm run build`, `npm test`.

**Branch:** `feat/pdf-plain-language`
**Migration:** none

---

## 0 — The principle: layer it, do not inflate it

The two requests — explain everything, and keep it easy to read — conflict if applied uniformly. A document that explains every term everywhere is longer and harder, not easier.

**The document has two readers.** The builder, who is technical and already finds it fine. And whoever the builder forwards it to — a client, an investor, a manager — who may not be technical and may never have heard of Twnhall.

So:

| Pages | Reader | Language |
|---|---|---|
| **Opening + findings** | Anyone | Plain English, no jargon, self-explaining |
| **Step-by-step detail** | The builder and their team | Precise, complete, unchanged |

The non-technical reader stops after the findings and has what they need. The technical reader reads on and loses nothing.

**Do not delete or summarise away any existing detail.** The ask is to make the front readable, not the back shorter.

---

# 1 — Open by saying what this is

A non-technical reader opens this with no idea what Twnhall is, what a "mission" is, or where these words came from.

Add a short block near the top — **three or four sentences, not a page** — covering:

- What happened: real people were asked to use the product and report back
- How many people, and when
- What they were asked to do, in one sentence
- How to read what follows

Plain, concrete, no product marketing. Something in the shape of:

> Five people were asked to use Recipe Book on their own phones and answer a set of questions about it. None of them had seen it before. Below is what each person was asked, what they said, and where they agreed with each other.

The phrase *"as if they were looking at the screen"* from the feedback points at this: the reader needs to picture the activity before the results mean anything.

---

# 2 — Write findings as sentences, not as labels and counts

**This is the highest-value change in the PR.**

The summary currently reads like a data row:

> **Step 2 — "Say who you think this is built for"**
> **4 of 5 testers: Unclear**

That is precise and it is not a finding. A reader has to assemble the meaning themselves. Write the meaning out:

> **Four of the five people could not work out who this product is for.**
> They were asked to say who they thought it was built for after looking at the homepage.

Same data, same precision, no assembly required. The label and count can stay as a small secondary line for anyone scanning — but **the sentence leads.**

Do this for every finding in the summary. It costs almost no length and it is the difference between a report and a readout.

---

# 3 — Terminology: replace, or explain in place

## 3.1 — Plain-language copy already exists in the codebase

`ENTRY_STATUS_HINTS` in `lib/vocabulary.ts` already holds exactly what a legend needs:

```
pass:    "It did what the builder said it would."
fail:    "It ran, and did something else."
blocked: "You could not get to this step at all."
```

These were written for testers and have never appeared in the PDF. **Reuse them as the document's legend** rather than writing new copy. Same for the `ui_design` variants and `TEST_CATEGORY_BLURBS`.

## 3.2 — What to change, and what to leave

**Do not rename the status labels in the document.** They are what the tester actually chose, and renaming them makes the PDF disagree with the product. Instead: keep the label as a small badge, carry the meaning in the surrounding sentence, and put the legend near the front.

The terms that genuinely need replacing or explaining are the Twnhall-internal and testing-industry ones:

| Term | Problem | Suggested handling |
|---|---|---|
| **Mission** | Twnhall-internal; means nothing outside | Explain once in §1, then use "test" or the mission's own title |
| **Audit log** | Industry jargon | "What each person did, step by step" |
| **Test case** | Jargon | "What we asked them to try" |
| **Expected result** | Semi-technical | "What should have happened" |
| **Actual result** | Semi-technical | "What actually happened" |
| **AI sentiment** | Opaque, and it is a machine guess | Spell out, or drop from the document — see below |
| **Tester** | Fine, but ambiguous outside the context | Keep, defined in §1 |

**Report anything else you find** while reading the document components — this list came from reading the design, not from reading every string.

**On `ai_sentiment`:** it is a one-word machine judgement with no explanation attached. Either label it unmistakably — "Overall tone, summarised automatically" — or leave it out of the document. Say which you chose. An unexplained machine verdict in a document someone forwards is the kind of thing that gets quoted back wrongly.

## 3.3 — A glossary, at the back

One short page. Every term that survives §3.2, in a sentence each. Back of the document, referenced from the front — a reader who needs it will look, and a reader who does not is not slowed down by it.

---

# 4 — Show agreement visually

"Four of five" is a number a reader has to hold. A simple visual makes it instant.

**Five dots, four filled.** No chart library — `@react-pdf/renderer` draws rectangles and circles natively, and this needs nothing more.

Rules:

- **Never colour alone.** `DESIGN.md` §5.4 requires the label beside the colour, and it applies here: filled-versus-empty plus the written sentence, not red-versus-green.
- Must read in **greyscale** — this document gets printed.
- Scale with the panel size: five dots for five testers, three for three. Do not fake a fixed width.

Keep it to this one visual. A report that sprouts charts is a different problem from the one being fixed.

---

# 5 — Structure and flow

The feedback named structure and design. Concretely:

**Fewer, larger sections with plain headings.** "What we found" rather than "Summary of agreement counts". "What each person did" rather than "Per-step detail".

**A contents page**, for any document longer than about four pages — not only the all-missions case.

**Space over density.** The constraint on this document is not page count; it is whether someone reads past page one.

**One idea per block.** A step, its question, the answers, done. Do not run two steps together to save a page break.

The existing rules hold: repeat step headings across page breaks, never split a single answer, page numbers and a running footer, light theme always.

---

# 6 — What not to do

- **Do not remove detail.** The builder is the primary reader and was happy. The back half stays complete.
- **Do not add a second variant or a toggle.** Layering solves this inside one document; a variant picker adds a decision for every builder, every time, to fix something the ordering already fixes.
- **Do not explain the same term twice.** Once in §1 or the glossary, then use it.
- **Do not soften the findings.** Plain is not vague. "Four of five could not tell who it is for" is plainer *and* harder-hitting than "4 of 5: Unclear".

---

# 7 — Validate it with a real reader

**The feedback so far is technical people predicting how non-technical people would react.** It is a reasonable prediction and it is not an observation.

Before this PR is called done, **show the regenerated PDF to one person with no technical background** and ask them two questions:

1. What was being tested, and by whom?
2. What are the three things the builder should fix?

If they can answer both from the first two pages, it works. If they cannot, the fix is in the front of the document, not in the detail.

Note the answers in the spec. This is the only test here that measures the actual goal.

---

## 8 — Tests

- The opening block renders on every report, including a single-mission one.
- Each finding renders as a sentence, with the count secondary.
- The legend uses `ENTRY_STATUS_HINTS` — **assert it is sourced from there**, so the two cannot drift.
- `ui_design` missions get the design-category hints, not the functional ones.
- The agreement visual scales with panel size and carries a text label.
- Glossary renders and every term in it appears in the document.
- All existing PDF tests still pass — **especially the one asserting no tester name, email or id appears.**

## 9 — Before calling the PR done

Four gates, then:

1. Generate a five-tester report and read it **on paper or at full page height**, not scrolling in a viewer.
2. The real-reader check in §7.
3. Print in greyscale and confirm the agreement visual still reads.
4. `pdfimages -list` to confirm screenshots are still embedding — the fix for that landed recently and this PR touches the same document.

## 10 — Documentation

- **`CLAUDE.md`** — the report is layered for two readers, plain at the front and complete at the back; the legend is sourced from `ENTRY_STATUS_HINTS` and never duplicated.
- **`TownHall_Checklist (1).xlsx`** — QA rows for the opening block, findings as sentences, the legend, and the greyscale visual.

## Out of scope

Translating the product UI into plainer language — this is the document only. Charts beyond the one agreement visual. Any change to what data the report contains.
