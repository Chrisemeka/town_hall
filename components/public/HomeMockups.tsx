"use client"

import { useEffect, useState } from "react"
import { useReducedMotion } from "framer-motion"
import { AlertTriangle, CheckCircle2, ImageIcon, Pause, Play, Plus, Star } from "lucide-react"
import { TEST_TEMPLATES } from "@/lib/testTemplates"
import { ENTRY_STATUSES, entryStatusLabel, type EntryStatus } from "@/lib/vocabulary"
import { PassRate, SubmissionBody, type SubmissionEntry } from "@/components/submissions/SubmissionBody"
import { Badge } from "@/components/ui/Badge"

/*
 * The homepage's product windows. Drawn in JSX from the semantic tokens rather
 * than shipped as screenshots or video, so they follow the theme and cannot go
 * stale against the app: the test case is the real auth-flow template, and the
 * report renders through the real SubmissionBody.
 *
 * The answers are written for this page — nobody's real report is on the
 * marketing site — but shaped by auditEntrySchema: a pass owes nothing but its
 * status, a fail and a blocked step owe an issue summary and steps to
 * reproduce.
 */

export const TEMPLATE = TEST_TEMPLATES.find((t) => t.id === "auth-flow")!

const ANSWERS: Pick<SubmissionEntry, "status" | "issue_summary" | "steps_to_reproduce">[] = [
  { status: "pass", issue_summary: "", steps_to_reproduce: "" },
  { status: "pass", issue_summary: "", steps_to_reproduce: "" },
  {
    status: "fail",
    issue_summary: "Verification email never sends on signup",
    steps_to_reproduce:
      "1. Sign up with a new address. 2. Wait on the confirm screen. 3. Nothing arrives, and Resend does nothing either.",
  },
  {
    status: "blocked",
    issue_summary: "Cannot reach the signed-in app at all",
    steps_to_reproduce: "1. Finish step 2. 2. Sign out. 3. Sign in with the same details.",
  },
  {
    status: "blocked",
    issue_summary: "Blocked by the same missing email as step 3",
    steps_to_reproduce: "1. As step 4 — sign-in is refused before a wrong password can be tried.",
  },
]

const ENTRIES: SubmissionEntry[] = TEMPLATE.steps.map((step, i) => ({
  id: `example-${i}`,
  step_index: i,
  step_action: step.action,
  step_expected: step.expected_result,
  actual_result: "",
  expected_result: "",
  ...ANSWERS[i],
}))

/* ── chrome ──────────────────────────────────────────────────────────── */

/** An app window. The dots are neutral on purpose — colour here would read as status. */
export function Window({
  title,
  label,
  className = "",
  children,
}: {
  title: string
  /** What a screen reader hears in place of the picture. */
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <figure
      aria-label={label}
      className={`rounded-[12px] border border-line bg-surface-raised shadow-card overflow-hidden ${className}`}
    >
      <div className="h-10 px-4 flex items-center gap-2 border-b border-line" aria-hidden="true">
        <span className="w-3 h-3 rounded-full bg-line" />
        <span className="w-3 h-3 rounded-full bg-line" />
        <span className="w-3 h-3 rounded-full bg-line" />
        <span className="ml-2 font-mono text-[12px] text-ink-muted truncate">{title}</span>
      </div>
      {children}
    </figure>
  )
}

const LABEL = "font-mono text-[11px] text-ink-muted uppercase tracking-[0.5px]"
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"

/** The builder's side: the test case as written. */
function TestCaseList() {
  return (
    <ol className="flex flex-col">
      {TEMPLATE.steps.map((step, i) => (
        <li key={step.action} className="flex gap-4 px-5 py-4 border-b border-line last:border-b-0">
          <span className="font-mono text-[12px] font-medium leading-5 text-accent-ink shrink-0">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="flex flex-col gap-1 min-w-0">
            <p className="font-mono text-[13px] leading-5 text-ink">{step.action}</p>
            <p className="font-mono text-[12px] leading-5 text-ink-muted">Expect: {step.expected_result}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

/* ── hero ────────────────────────────────────────────────────────────── */

const STEP_MS = 1400
const HOLD_MS = 3600

/**
 * The test case behind, the report filling in step by step in front.
 *
 * It loops, so it carries a pause control (WCAG 2.2.2: anything moving for
 * more than five seconds). Someone who asked for less motion gets the finished
 * report and no control, since nothing moves. It starts on the finished frame
 * and holds it, so the server render and the first paint agree and nothing
 * jumps when the loop begins.
 */
export function HeroDemo() {
  const still = useReducedMotion()
  const [shown, setShown] = useState(ENTRIES.length)
  const [paused, setPaused] = useState(false)
  const running = !still && !paused

  useEffect(() => {
    if (!running) return
    const done = shown >= ENTRIES.length
    const t = setTimeout(() => setShown(done ? 1 : shown + 1), done ? HOLD_MS : STEP_MS)
    return () => clearTimeout(t)
  }, [running, shown])

  const visible = still ? ENTRIES : ENTRIES.slice(0, shown)

  return (
    <div className="relative">
      {/* Dark-only glow; see .th-glow in globals.css. */}
      <div aria-hidden="true" className="th-glow pointer-events-none absolute -inset-x-8 -top-16 -bottom-8" />

      <div className="relative grid lg:grid-cols-12">
        <Window
          title="Authentication Flow — test case"
          label="The builder's test case: five steps, each with what should happen."
          className="hidden lg:block lg:row-start-1 lg:col-start-1 lg:col-span-7 self-start"
        >
          <TestCaseList />
        </Window>

        <Window
          title="Report from Tester 01"
          label="A tester's report on the same five steps: two passed, one failed, two blocked, each problem with an issue and steps to reproduce."
          className="lg:row-start-1 lg:col-start-6 lg:col-span-7 lg:mt-16 z-10"
        >
          {/* Both copies share one grid cell: the full report, invisible,
              holds the height so the page does not move as steps arrive. */}
          <div className="grid p-5 lg:p-6">
            <div aria-hidden="true" className="invisible [grid-area:1/1]">
              <SubmissionBody entries={ENTRIES} comment={null} />
            </div>
            <div className="[grid-area:1/1] motion-safe:[&_li:last-child]:animate-[th-fade-in_300ms_ease-out_both]">
              <SubmissionBody entries={visible} comment={null} />
            </div>
          </div>
        </Window>
      </div>

      {!still && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          className={`relative z-10 mt-4 ml-auto flex h-11 px-4 items-center gap-2 rounded-[8px] border border-ink-muted font-mono text-[13px] text-ink hover:bg-ink/[0.06] transition-colors duration-150 ${FOCUS}`}
        >
          {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
          {paused ? "Play animation" : "Pause animation"}
        </button>
      )}
    </div>
  )
}

/* ── tour panels ─────────────────────────────────────────────────────── */

function WriteMock() {
  return (
    <Window title="New mission" label="The mission form: a category, a template, and the test steps.">
      <div className="p-5 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <span className="font-mono text-[12px] font-medium text-ink border border-ink-muted rounded-[4px] px-2 py-0.5">
            Process flow
          </span>
          <span className="font-mono text-[12px] text-ink-muted border border-line rounded-[4px] px-2 py-0.5">
            Template: {TEMPLATE.name}
          </span>
        </div>
        <div className="rounded-[8px] border border-line bg-surface overflow-hidden">
          <TestCaseList />
        </div>
        <span className="self-start inline-flex items-center gap-2 h-10 px-4 rounded-[8px] border border-line font-mono text-[13px] text-ink-muted">
          <Plus size={14} aria-hidden="true" />
          Add step
        </span>
      </div>
    </Window>
  )
}

const STATUS_ACTIVE: Record<EntryStatus, string> = {
  pass: "border-success-ink text-success-ink bg-mint/10",
  fail: "border-danger-ink text-danger-ink bg-ember/10",
  blocked: "border-info-ink text-info-ink bg-sky/10",
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[12px] text-ink">{label}</span>
      <p className="bg-surface border border-ink-muted rounded-[8px] px-3 py-2 font-mono text-[13px] leading-5 text-ink">
        {value}
      </p>
    </div>
  )
}

function TestMock() {
  const entry = ENTRIES[2]
  return (
    <Window title="Mission — Authentication Flow" label="A tester marking step 3 as failed, with the issue and steps to reproduce filled in.">
      <div className="p-5 flex flex-col gap-4">
        <p className={LABEL}>Step 3 of {ENTRIES.length}</p>
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[14px] leading-5 text-ink">{entry.step_action}</p>
          <p className="font-mono text-[12px] leading-5 text-ink-muted">Expected: {entry.step_expected}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ENTRY_STATUSES.map((s) => (
            <span
              key={s}
              className={`h-10 px-4 inline-flex items-center rounded-[8px] border font-mono text-[13px] font-medium ${
                s === entry.status ? STATUS_ACTIVE[s] : "border-line text-ink-muted bg-surface"
              }`}
            >
              {entryStatusLabel(s)}
            </span>
          ))}
        </div>
        <Field label="Summary of the issue" value={entry.issue_summary} />
        <Field label="Steps to reproduce" value={entry.steps_to_reproduce} />
        <div className="flex gap-2" aria-hidden="true">
          {[0, 1].map((i) => (
            <span key={i} className="w-16 h-12 rounded-[8px] bg-ink/[0.06] flex items-center justify-center text-ink-muted">
              <ImageIcon size={16} />
            </span>
          ))}
        </div>
      </div>
    </Window>
  )
}

function ReviewMock() {
  return (
    <Window title="Feedback — Authentication Flow" label="The builder's review: the pass rate, screenshots, approve or request changes, and a rating.">
      <div className="p-5 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="font-mono text-[13px] font-medium text-ink">Tester 01</p>
          <Badge>Pending</Badge>
        </div>
        <PassRate entries={ENTRIES} />
        <div className="flex gap-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-20 h-14 rounded-[8px] bg-ink/[0.06] flex items-center justify-center text-ink-muted">
              <ImageIcon size={16} />
            </span>
          ))}
        </div>
        <div className="pt-4 border-t border-line flex flex-col gap-3">
          <div className="flex items-center gap-1" aria-label="Rated 4 of 5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star
                key={i}
                size={16}
                aria-hidden="true"
                className={i < 4 ? "text-accent-ink fill-current" : "text-ink-muted"}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="h-10 px-4 inline-flex items-center rounded-[8px] border border-success-ink text-success-ink font-mono text-[13px] font-medium">
              Approve
            </span>
            <span className="h-10 px-4 inline-flex items-center rounded-[8px] border border-ink-muted text-ink font-mono text-[13px]">
              Request changes
            </span>
          </div>
        </div>
      </div>
    </Window>
  )
}

const INSIGHTS: { status: "pass" | "warn" | "fail"; title: string; description: string }[] = [
  {
    status: "fail",
    title: "Verification email never arrives",
    description: "Step 3 failed: no email after sign-up or resend, and it blocks everything after it.",
  },
  {
    status: "warn",
    title: "Sign-in is untested",
    description: "Steps 4 and 5 were blocked by the same missing email, so sign-in is unknown.",
  },
  {
    status: "pass",
    title: "The sign-up form works",
    description: "The form appears and accepts valid details as expected.",
  },
]

function SummaryMock() {
  return (
    <Window title="Test report" label="The AI summary: what failed first, what went untested, what worked, and an overall read of the session.">
      <div className="p-5 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="font-mono text-[11px] text-accent-ink uppercase tracking-[0.8px]">AI generated</p>
          <Badge variant="negative">Frustrated</Badge>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {INSIGHTS.map((item) => (
            <div key={item.title}>
              <div className="flex items-start gap-2 mb-2">
                {item.status === "pass" ? (
                  <CheckCircle2 size={16} aria-hidden="true" className="text-success-ink shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={16} aria-hidden="true" className="text-accent-ink shrink-0 mt-0.5" />
                )}
                <p className="font-mono text-[13px] font-medium leading-5 text-ink">{item.title}</p>
              </div>
              <p className="font-mono text-[12px] leading-5 text-ink-muted">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </Window>
  )
}

/** A slice of the real export's columns, named as app/api/export/feedback names them. */
function ExportMock() {
  const cols = ["Step", "Action", "Step status", "Issue summary"]
  return (
    <Window title="twnhall-feedback.csv" label="A CSV export with one row per step: the step number, the action, its status and the issue.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] font-mono text-[12px] leading-5 text-left">
          <thead>
            <tr className="border-b border-line">
              {cols.map((c) => (
                <th key={c} scope="col" className="px-4 py-2 font-medium text-ink-muted whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ENTRIES.map((e) => (
              <tr key={e.id} className="border-b border-line last:border-b-0">
                <td className="px-4 py-2 text-ink">{e.step_index + 1}</td>
                <td className="px-4 py-2 text-ink">{e.step_action}</td>
                <td className="px-4 py-2 text-ink">{e.status}</td>
                <td className="px-4 py-2 text-ink-muted">{e.issue_summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Window>
  )
}

/* ── tour ────────────────────────────────────────────────────────────── */

const TABS = [
  {
    id: "write",
    label: "Write",
    title: "Write the test case.",
    body: "Pick a template or start blank. Each step is one thing to do and what should happen when you do it. That is the whole brief, so nobody has to guess what you wanted checked.",
    mock: WriteMock,
  },
  {
    id: "test",
    label: "Test",
    title: "A tester works through it.",
    body: "Every step is marked pass, fail or blocked. A pass is one click. A fail or a blocked step asks for the issue and how to reproduce it, with screenshots, so nothing reaches you without something to act on.",
    mock: TestMock,
  },
  {
    id: "review",
    label: "Review",
    title: "You review the report.",
    body: "See at a glance how many steps passed, then read the ones that did not. Approve the report or ask for changes, and rate how useful it was.",
    mock: ReviewMock,
  },
  {
    id: "summarise",
    label: "Summarise",
    title: "AI reads it first.",
    body: "Every report gets a short summary that leads with what failed and why it matters, and an overall read of how the session went. The full log is always one click away.",
    mock: SummaryMock,
  },
  {
    id: "export",
    label: "Export",
    title: "Take it with you.",
    body: "Download every report on a project as a CSV, one row per step, ready for your tracker or a spreadsheet. Testers' email addresses never leave the app.",
    mock: ExportMock,
  },
] as const

/**
 * The WAI-ARIA tabs pattern: roving tabindex, arrows move and select,
 * Home/End jump. Selection follows focus — panels are cheap to swap.
 */
export function Tour() {
  const [active, setActive] = useState(0)
  const tab = TABS[active]
  const Mock = tab.mock

  const go = (i: number) => {
    const next = (i + TABS.length) % TABS.length
    setActive(next)
    document.getElementById(`tour-tab-${TABS[next].id}`)?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const to =
      e.key === "ArrowRight" ? active + 1
      : e.key === "ArrowLeft" ? active - 1
      : e.key === "Home" ? 0
      : e.key === "End" ? TABS.length - 1
      : null
    if (to === null) return
    e.preventDefault()
    go(to)
  }

  return (
    <div className="flex flex-col gap-10">
      <div
        role="tablist"
        aria-label="How Twnhall works"
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {TABS.map((t, i) => {
          const selected = i === active
          return (
            <button
              key={t.id}
              id={`tour-tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`tour-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              className={`shrink-0 h-12 px-4 -mb-px border-b-2 font-mono text-[14px] transition-colors duration-150 rounded-t-[4px] ${FOCUS} ${
                selected
                  ? "border-accent-ink text-ink font-medium"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              <span className="text-accent-ink mr-2">{String(i + 1).padStart(2, "0")}</span>
              {t.label}
            </button>
          )
        })}
      </div>

      <div
        key={tab.id}
        id={`tour-panel-${tab.id}`}
        role="tabpanel"
        aria-labelledby={`tour-tab-${tab.id}`}
        tabIndex={0}
        className={`th-fade-in grid gap-8 lg:gap-16 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:items-start rounded-[4px] ${FOCUS}`}
      >
        <div className="flex flex-col gap-4 lg:pt-8">
          <h3 className="font-syne font-bold text-[28px] leading-9 text-ink">{tab.title}</h3>
          <p className="font-sans text-[16px] leading-8 text-ink">{tab.body}</p>
        </div>
        <Mock />
      </div>
    </div>
  )
}
