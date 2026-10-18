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

import type { FeedbackEntry, FeedbackRow } from "@/lib/exportDb"
import { testerLabel, testerNumbers } from "@/lib/testerNumbers"
import { screenshotList } from "@/lib/utils/screenshots"
import type { ScreenshotFailure, ScreenshotResult } from "@/lib/reportImages"
import { STATUS_LABEL, toStatus } from "@/lib/review"
import {
  deviceTargetLabel,
  entryStatusCopy,
  ENTRY_STATUSES,
  testCategoryLabel,
  type EntryStatus,
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
  /** "4 of 5 testers: Unclear" — the agreement line. */
  headline: string
}

export type ReportTester = {
  tester: string
  status: string
  rating: number | null
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
  device: string
  reports: number
  /** Step order. */
  steps: ReportStep[]
  /** Steps with a problem, most-agreed first. */
  fixFirst: ReportStep[]
  /** Step numbers nobody reported a problem on. */
  clean: number[]
  mix: string
  rating: string
  testers: ReportTester[]
}

export type ReportModel = {
  /** Every mission in the project: a contents page and a section each. */
  allMissions: boolean
  project: string
  scope: string
  generated: string
  evidence: string
  missions: ReportMission[]
}

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

  const rated = rows.filter((r) => toStatus(r.status) === "approved" && r.rating != null)
  const rating = rated.length
    ? `Average rating ${(rated.reduce((n, r) => n + (r.rating ?? 0), 0) / rated.length).toFixed(1)} / 5 from ${plural(rated.length, "reviewed report")}`
    : "Not yet rated"

  return {
    id: rows[0].mission_id,
    title: m?.title ?? "Mission",
    category: category ? testCategoryLabel(category) : "",
    device: m?.device_target ? deviceTargetLabel(m.device_target) : "",
    reports: rows.length,
    steps,
    fixFirst: steps.filter((s) => s.problems > 0).sort((a, b) => b.problems - a.problems || a.number - b.number),
    clean: steps.filter((s) => s.problems === 0).map((s) => s.number),
    mix,
    rating,
    testers: byNumber.map((r) => ({
      tester: testerLabel(numbers.get(r.id)),
      status: STATUS_LABEL[toStatus(r.status)],
      rating: r.rating,
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
  const missions = [...byMission.values()]
    .sort((a, b) => ((a[0].missions?.created_at ?? "") < (b[0].missions?.created_at ?? "") ? -1 : 1))
    .map(missionSection)

  const dates = rows.map((r) => r.created_at).sort()
  const first = reportDate(dates[0])
  const last = reportDate(dates[dates.length - 1])
  const filed = first === last ? `filed ${first}` : `filed ${first} – ${last}`
  // One report per tester per mission, so on one mission reports are people.
  // Across missions they are not, and without tester ids (never selected) the
  // document does not pretend to know how many people that is.
  const evidence = oneMission
    ? `${plural(rows.length, "tester")} · ${filed}`
    : `${plural(rows.length, "report")} across ${plural(missions.length, "mission")} · ${filed}`

  return {
    allMissions: !oneMission,
    project: rows[0].missions?.projects?.name ?? "Project",
    scope: oneMission ? missions[0].title : "All missions",
    generated: `Generated ${reportDate(now)}`,
    evidence,
    missions,
  }
}
