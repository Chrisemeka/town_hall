// The PDF report's content: every number, grouping and order, and nothing
// about how it looks.
//
// Pure — components/report/ReportDocument.tsx renders what this returns and
// does no arithmetic of its own, so everything worth testing is here.
//
// Two rules carry the document:
//   - Agreement is the headline. With five testers on a mission, how many
//     independently hit the same step IS the finding, so the summary lists
//     steps by how many testers reported a problem, most first.
//   - Detail is organised by step, not by tester — every answer to step 2 sits
//     together, which is how a builder judges whether it is a real problem.
//
// Testers are "Tester N" through testerNumbers() and nothing else. The rows
// this takes carry no tester id (lib/exportDb.ts never selects one).
//
// Two readers, layered: the builder, and whoever they forward it to. The front
// (opening, legend, findings as sentences) is plain English for the second;
// the detail after it stays complete and precise for the first. Nothing is
// cut to make the front plain. The builder's ratings of the reports are left
// out entirely — they describe the testers' work, and a forwarded reader
// takes them as a rating of the product.

import type { FeedbackEntry, FeedbackRow } from "@/lib/exportDb"
import { testerLabel, testerNumbers } from "@/lib/testerNumbers"
import { screenshotList } from "@/lib/utils/screenshots"
import type { ScreenshotFailure, ScreenshotResult } from "@/lib/reportImages"
import { STATUS_LABEL, toStatus } from "@/lib/review"
import {
  deviceTargetLabel,
  entryStatusCopy,
  ENTRY_STATUSES,
  isDesignCategory,
  TEST_CATEGORY_BLURBS,
  testCategoryLabel,
  type EntryStatus,
  type TestCategory,
} from "@/lib/vocabulary"

/** Most reports one document renders. Past it, the builder picks one mission. */
export const REPORT_CAP = 60
/** Most screenshots one document fetches — image fetches dominate render time. */
export const SCREENSHOT_CAP = 40

export type ReportAnswer = {
  tester: string
  status: string
  label: string
  actual: string
  issue: string
  reproduce: string
  /** This report's own wording, when it differs from the step heading. */
  askedAs: { action: string; expected: string } | null
}

export type ReportStep = {
  /** 1-based, as a reader counts. */
  number: number
  action: string
  expected: string
  answers: ReportAnswer[]
  /** Answers that did not pass. */
  problems: number
  /** "4 of 5 testers: Unclear" — the agreement line, secondary to the sentence. */
  headline: string
  /** "Four of the five people could not get to this step at all." — the finding. */
  sentence: string
}

export type ReportTester = {
  tester: string
  status: string
  comment: string
  /** Filed before step-by-step reports: the comment is all there is. */
  legacy: boolean
  aiSummary: string
  screenshots: string[]
}

export type ReportMission = {
  id: string
  title: string
  category: string
  /** TEST_CATEGORY_BLURBS' line for the category, or "". */
  blurb: string
  device: string
  reports: number
  /** Step order. */
  steps: ReportStep[]
  /** Steps with a problem, most-agreed first. */
  fixFirst: ReportStep[]
  /** Step numbers nobody reported a problem on. */
  clean: number[]
  /** "Nobody reported a problem on steps 1 and 3." — null unless some steps had one. */
  cleanLine: string | null
  mix: string
  testers: ReportTester[]
}

export type ReportModel = {
  /** Every mission in the project: a contents page and a section each. */
  allMissions: boolean
  project: string
  scope: string
  generated: string
  evidence: string
  /** What happened, for a reader who has never heard of Twnhall. */
  opening: string[]
  /** The statuses as testers were shown them — one set per kind of test present. */
  legends: ReportLegend[]
  /** The back half's terms, only those this document contains. */
  glossary: { term: string; definition: string }[]
  missions: ReportMission[]
}

export type ReportLegend = { intro: string; entries: { label: string; hint: string }[] }

/** "2 Oct 2026", in the product's timezone (the same one monthOf() uses). */
export function reportDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Lagos",
  })
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]
/** A count as a reader says it: words to ten, digits after. */
const word = (n: number) => WORDS[n] ?? String(n)
const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
/** "1", "1 and 3", "1, 3 and 4". */
const list = (items: (string | number)[]) =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`

const isProblem = (status: string) => status === "fail" || status === "blocked"

/** A stored status as this mission's category says it — Unclear, not Fail, on ui_design. */
function statusLabel(status: string, category: string | null | undefined): string {
  return (ENTRY_STATUSES as readonly string[]).includes(status)
    ? entryStatusCopy(status as EntryStatus, category).label
    : status
}

/**
 * The agreement line. M is the reports that answered THIS step — a legacy
 * report has no entries and never counts against one.
 */
export function agreementHeadline(statuses: string[], category: string | null | undefined): string {
  const fail = statuses.filter((s) => s === "fail").length
  const blocked = statuses.filter((s) => s === "blocked").length
  const of = `${fail + blocked} of ${plural(statuses.length, "tester")}`
  if (fail + blocked === 0) return `${of}: no problems`
  if (fail && blocked) {
    return `${of} hit a problem — ${fail} ${statusLabel("fail", category)}, ${blocked} ${statusLabel("blocked", category)}`
  }
  return `${of}: ${statusLabel(fail ? "fail" : "blocked", category)}`
}

/**
 * The finding, as a sentence — what the agreement line means, written out.
 * Built from the counts and the category, never from the step's wording: the
 * step follows it as "They were asked to…", so nothing is paraphrased.
 */
export function findingSentence(statuses: string[], category: string | null | undefined): string {
  const fail = statuses.filter((s) => s === "fail").length
  const blocked = statuses.filter((s) => s === "blocked").length
  const n = fail + blocked
  const m = statuses.length
  if (n === 0) return "Nobody reported a problem here."
  const who =
    n < m ? `${capital(word(n))} of the ${word(m)} people` : m === 1 ? "The one person who tried this" : `All ${word(m)} people`
  const design = isDesignCategory(category)
  if (fail && blocked) {
    return design
      ? `${who} ran into a problem here: ${word(fail)} said it did not come across as meant, ${word(blocked)} could not judge it.`
      : `${who} ran into a problem here: ${word(fail)} found it did not work, ${word(blocked)} could not get to it.`
  }
  if (fail) {
    return design
      ? `${who} said this did not come across the way it was meant to.`
      : `${who} found this step did not work the way it should.`
  }
  return design
    ? `${who} could not judge this — it did not load, or was not there.`
    : `${who} could not get to this step at all.`
}

/**
 * The statuses as the tester saw them while choosing, from entryStatusCopy() —
 * so ENTRY_STATUS_HINTS and the design copy are quoted, never retyped. The
 * hints say "you" to the tester; the intro says so, which keeps them true here.
 */
export function legendsFor(categories: (string | null | undefined)[]): ReportLegend[] {
  // Functional first, always: the second intro is written for the design set.
  const kinds = [null, "ui_design"].filter((k) => categories.some((c) => isDesignCategory(c) === (k !== null)))
  return kinds.map((category, i) => ({
    intro:
      i === 0
        ? "After each step, each person picked one of these. The line beside each is what they were shown when choosing."
        : "Tests of how something looks and reads use these instead.",
    entries: ENTRY_STATUSES.map((s) => entryStatusCopy(s, category)),
  }))
}

const answered = (m: ReportMission, has: (a: ReportAnswer) => unknown) => m.steps.some((s) => s.answers.some(has))

// The back half's words, explained once. Statuses are not here: the legend at
// the front already explains them.
const GLOSSARY: { term: string; definition: string; present: (m: ReportMission) => boolean }[] = [
  { term: "Step", definition: "One thing each person was asked to try, in the order the builder set.", present: (m) => m.steps.length > 0 },
  { term: "Expected", definition: "What the builder said should happen at that step.", present: (m) => m.steps.length > 0 },
  { term: "Asked as", definition: "The step was worded differently when this person answered it; this is the wording they saw.", present: (m) => answered(m, (a) => a.askedAs) },
  { term: "What they saw", definition: "The person's own description of what happened.", present: (m) => answered(m, (a) => a.actual) },
  { term: "Issue", definition: "The problem, in the person's own words.", present: (m) => answered(m, (a) => a.issue) },
  { term: "Steps to reproduce", definition: "What to do to make the problem happen again.", present: (m) => answered(m, (a) => a.reproduce) },
  { term: "Anything else", definition: "The person's closing notes, outside the steps.", present: (m) => m.testers.some((t) => t.comment) },
  { term: STATUS_LABEL.approved, definition: "The builder has read and accepted this report.", present: (m) => m.testers.some((t) => t.status === STATUS_LABEL.approved) },
  { term: STATUS_LABEL.pending, definition: "The builder has not read this report yet.", present: (m) => m.testers.some((t) => t.status === STATUS_LABEL.pending) },
  { term: STATUS_LABEL.changes_requested, definition: "An older review state: the builder asked for more detail.", present: (m) => m.testers.some((t) => t.status === STATUS_LABEL.changes_requested) },
  { term: "Filed before step-by-step reports", definition: "An older report: the person wrote notes rather than answering step by step.", present: (m) => m.testers.some((t) => t.legacy) },
  { term: "AI-generated summary", definition: "A short summary written by software from the person's report, not by the person. It can be wrong.", present: (m) => m.testers.some((t) => t.aiSummary) },
]

/** What the document says in place of a screenshot it could not include. */
export function screenshotCaption(reason: ScreenshotFailure): string {
  switch (reason) {
    case "foreign":
      return "Screenshot left out — not stored by Twnhall."
    case "unavailable":
    case "network":
      return "Screenshot could not be loaded."
    case "format":
      return "Screenshot format not supported in PDF."
  }
}

/** How many screenshots failed, of how many — null when none did, or they were off. */
export function screenshotsMissing(
  images: Map<string, ScreenshotResult> | null,
): { failed: number; total: number } | null {
  if (!images) return null
  const failed = [...images.values()].filter((r) => "failed" in r).length
  return failed ? { failed, total: images.size } : null
}

/** The cover's line when screenshots were left out — so nobody finds out by reading. */
export function screenshotNote(images: Map<string, ScreenshotResult> | null): string | null {
  const m = screenshotsMissing(images)
  return m ? `${m.failed} of ${plural(m.total, "screenshot")} couldn't be included — each is marked where it would appear.` : null
}

/**
 * The refusal when a document would be too big to render inside the function's
 * time, or null when it fits. A refusal, never a truncated file.
 */
export function reportCapMessage(reports: number, screenshots: number, oneMission: boolean): string | null {
  if (reports > REPORT_CAP) {
    return oneMission
      ? "This mission has more reports than one PDF holds — use the CSV export instead."
      : "That's too much for one PDF — choose a single mission."
  }
  if (screenshots > SCREENSHOT_CAP) {
    return oneMission
      ? "That's too many screenshots for one PDF — turn off screenshots and try again."
      : "That's too much for one PDF — choose a single mission, or turn off screenshots."
  }
  return null
}

const text = (v: string | null | undefined) => v?.trim() ?? ""
const same = (a: string, b: string) => a.trim().replace(/\s+/g, " ") === b.trim().replace(/\s+/g, " ")

function missionSection(rows: FeedbackRow[]): ReportMission {
  const m = rows[0].missions
  const category = m?.category ?? null
  // Over every report on the mission — the export never narrows within one —
  // so Tester 2 here is Tester 2 on the mission page and in the CSV.
  const numbers = testerNumbers(rows)
  const byNumber = [...rows].sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0))

  // Steps keyed by step_id, which correlates across reports; older entries
  // without one fall back to their position.
  const groups = new Map<string, { entry: FeedbackEntry; row: FeedbackRow }[]>()
  for (const row of byNumber) {
    for (const entry of row.test_result_entries ?? []) {
      const key = entry.step_id || `#${entry.step_index}`
      groups.set(key, [...(groups.get(key) ?? []), { entry, row }])
    }
  }

  const steps: ReportStep[] = [...groups.values()]
    .map((answers) => {
      // The heading is the newest report's snapshot, never missions.test_steps:
      // a mission edited after submission must not change what a tester was asked.
      const latest = answers.reduce((a, b) => (b.row.created_at > a.row.created_at ? b : a)).entry
      const statuses = answers.map((a) => a.entry.status)
      return {
        number: latest.step_index + 1,
        action: latest.step_action,
        expected: latest.step_expected,
        problems: statuses.filter(isProblem).length,
        headline: agreementHeadline(statuses, category),
        sentence: findingSentence(statuses, category),
        answers: answers.map(({ entry, row }) => ({
          tester: testerLabel(numbers.get(row.id)),
          status: entry.status,
          label: statusLabel(entry.status, category),
          actual: text(entry.actual_result),
          issue: text(entry.issue_summary),
          reproduce: text(entry.steps_to_reproduce),
          askedAs:
            same(entry.step_action, latest.step_action) && same(entry.step_expected, latest.step_expected)
              ? null
              : { action: entry.step_action, expected: entry.step_expected },
        })),
      }
    })
    .sort((a, b) => a.number - b.number)

  const answers = steps.flatMap((s) => s.answers)
  const mix = answers.length
    ? `Across ${plural(answers.length, "answer")}: ` +
      ENTRY_STATUSES.map((s) => [answers.filter((a) => a.status === s).length, statusLabel(s, category)] as const)
        .filter(([n]) => n > 0)
        .map(([n, label]) => `${n} ${label}`)
        .join(" · ")
    : "No step-by-step answers."

  const fixFirst = steps.filter((s) => s.problems > 0).sort((a, b) => b.problems - a.problems || a.number - b.number)
  const clean = steps.filter((s) => s.problems === 0).map((s) => s.number)

  return {
    id: rows[0].mission_id,
    title: m?.title ?? "Mission",
    category: category ? testCategoryLabel(category) : "",
    blurb: TEST_CATEGORY_BLURBS[category as TestCategory] ?? "",
    device: m?.device_target ? deviceTargetLabel(m.device_target) : "",
    reports: rows.length,
    steps,
    fixFirst,
    clean,
    cleanLine:
      fixFirst.length && clean.length
        ? `Nobody reported a problem on ${clean.length === 1 ? "step" : "steps"} ${list(clean)}.`
        : null,
    mix,
    testers: byNumber.map((r) => ({
      tester: testerLabel(numbers.get(r.id)),
      status: STATUS_LABEL[toStatus(r.status)],
      comment: text(r.tester_comment),
      legacy: (r.test_result_entries ?? []).length === 0,
      aiSummary: text(r.ai_summary),
      screenshots: screenshotList(r),
    })),
  }
}

/** The whole document's content, from the rows loadFeedback() returned. */
export function buildReport(rows: FeedbackRow[], oneMission: boolean, now = new Date()): ReportModel {
  const byMission = new Map<string, FeedbackRow[]>()
  for (const r of rows) byMission.set(r.mission_id, [...(byMission.get(r.mission_id) ?? []), r])
  // Oldest mission first — the order they were run, as the workbook does.
  const groups = [...byMission.values()].sort((a, b) =>
    (a[0].missions?.created_at ?? "") < (b[0].missions?.created_at ?? "") ? -1 : 1,
  )
  const missions = groups.map(missionSection)

  const dates = rows.map((r) => r.created_at).sort()
  const first = reportDate(dates[0])
  const last = reportDate(dates[dates.length - 1])
  const filed = first === last ? `filed ${first}` : `filed ${first} – ${last}`
  const when = first === last ? `on ${first}` : `between ${first} and ${last}`
  // One report per tester per mission, so on one mission reports are people.
  // Across missions they are not, and without tester ids (never selected) the
  // document does not pretend to know how many people that is.
  const evidence = oneMission
    ? `${plural(rows.length, "tester")} · ${filed}`
    : `${plural(rows.length, "report")} across ${plural(missions.length, "test")} · ${filed}`

  const project = rows[0].missions?.projects?.name ?? "Project"
  // "Mission" is said here once; the document says "test" everywhere else.
  const named =
    "On Twnhall, the service that ran this, a test like this is called a mission, and each person is a tester — called Tester 1, Tester 2 and so on, without their names."
  const DEVICE: Record<string, string> = { mobile: " on a phone", desktop: " on a computer", both: " on a phone or a computer" }
  const device = (oneMission && DEVICE[rows[0].missions?.device_target ?? ""]) || ""
  const opening = oneMission
    ? [
        `${capital(word(rows.length))} ${rows.length === 1 ? "person was" : "people were"} asked to try ${project}${device} and answer a set of questions about it, ${when}.`,
        missions[0].steps.length
          ? "Each person was given the same list of steps to try, and after each step said how it went."
          : "Each person wrote notes on what they found.",
        "Below, first, is where they agreed; after that, what each person said at every step.",
        named,
      ]
    : [
        `In ${word(missions.length)} separate ${missions.length === 1 ? "test" : "tests"}, people were asked to try ${project} and answer a set of questions about it, ${when} — ${plural(rows.length, "report")} in all.`,
        "In each test everyone was given the same list of steps to try, and after each step said how it went.",
        "Each test below starts with where people agreed; after that comes what each person said at every step.",
        named,
      ]

  return {
    allMissions: !oneMission,
    project,
    scope: oneMission ? missions[0].title : "All tests",
    generated: `Generated ${reportDate(now)}`,
    evidence,
    opening,
    legends: legendsFor(groups.map((g) => g[0].missions?.category)),
    glossary: GLOSSARY.filter((g) => missions.some(g.present)).map(({ term, definition }) => ({ term, definition })),
    missions,
  }
}
