"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useInView, useReducedMotion } from "framer-motion"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Compass,
  ImageIcon,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  MessageSquare,
  MessageSquareText,
  Pause,
  Play,
  RotateCw,
  Settings,
  Star,
  Target,
  Telescope,
} from "lucide-react"
import { TEST_TEMPLATES } from "@/lib/testTemplates"
import { ENTRY_STATUSES, entryStatusLabel, type EntryStatus } from "@/lib/vocabulary"
import { PassRate, StatusPill, type SubmissionEntry } from "@/components/submissions/SubmissionBody"
import { Badge } from "@/components/ui/Badge"
import { Logo } from "@/components/Logo"

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

/*
 * One app window playing the whole loop, GitHub-style: the builder writes and
 * publishes a test case, a tester works through it, the builder reads what
 * came back. Every frame is a pure function of one clock, `t`, so a scene can
 * be jumped to, paused, or shown finished without any state to unwind.
 */

const SCENES = [
  { role: "Builder", step: "writes the test case", path: "My projects / New mission", icon: LayoutDashboard, ms: 9000 },
  { role: "Tester", step: "works through it", path: "Explore / Authentication Flow", icon: Compass, ms: 10000 },
  { role: "Builder", step: "reads the report", path: "Feedback / Authentication Flow", icon: MessageSquareText, ms: 9000 },
] as const

const STARTS = SCENES.map((_, i) => SCENES.slice(0, i).reduce((sum, s) => sum + s.ms, 0))
const TOTAL = STARTS[STARTS.length - 1] + SCENES[SCENES.length - 1].ms
const TICK = 50

function sceneAt(t: number) {
  let i = SCENES.length - 1
  while (t < STARTS[i]) i--
  return i
}

/** `text` typed from `from` ms at `cps` characters a second, as of `at`. */
function typed(text: string, at: number, from: number, cps: number) {
  const n = Math.floor(((at - from) * cps) / 1000)
  return { shown: text.slice(0, Math.max(0, n)), typing: n > 0 && n < text.length }
}

function Caret({ on }: { on: boolean }) {
  return on ? <span className="inline-block w-[2px] h-4 ml-px align-middle bg-ink animate-pulse" /> : null
}

function Toast({ children }: { children: React.ReactNode }) {
  return (
    <span className="th-fade-in inline-flex items-center gap-2 h-8 px-3 rounded-[8px] border border-success-ink font-mono text-[12px] text-ink">
      <CheckCircle2 size={14} aria-hidden="true" className="text-success-ink" />
      {children}
    </span>
  )
}

/** A control the scene "clicks": outlined, then filled with a hover tint once pressed. */
function MockButton({ pressed, children }: { pressed: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center h-8 px-3 rounded-[8px] border border-accent-ink font-mono text-[12px] font-medium text-ink transition-colors duration-150 ${
        pressed ? "bg-ink/[0.12]" : ""
      }`}
    >
      {children}
    </span>
  )
}

const STEP_GAP = 1100

function WriteScene({ at }: { at: number }) {
  const title = typed(TEMPLATE.name, at, 300, 24)
  const first = 1300
  const publish = first + TEMPLATE.steps.length * STEP_GAP + 300

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className={LABEL}>Mission</span>
        <p className="h-10 flex items-center bg-surface border border-ink-muted rounded-[8px] px-3 font-mono text-[14px] text-ink">
          {title.shown}
          <Caret on={title.typing || at < 300} />
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <span className={LABEL}>Test case · Process flow</span>
        <ol className="flex flex-col rounded-[8px] border border-line bg-surface overflow-hidden">
          {TEMPLATE.steps.map((step, i) => {
            const start = first + i * STEP_GAP
            if (at < start) return null
            const action = typed(step.action, at, start, 70)
            return (
              <li
                key={step.action}
                className={`flex gap-3 px-4 py-2 border-b border-line last:border-b-0 ${i > 2 ? "hidden sm:flex" : ""}`}
              >
                <span className="font-mono text-[12px] font-medium leading-5 text-accent-ink shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col min-w-0">
                  <p className="font-mono text-[12px] leading-5 text-ink">
                    {action.shown}
                    <Caret on={action.typing} />
                  </p>
                  {at >= start + 900 && (
                    <p className="th-fade-in font-mono text-[11px] leading-4 text-ink-muted truncate">
                      Expect: {step.expected_result}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <MockButton pressed={at >= publish}>Publish mission</MockButton>
        {at >= publish + 400 && <Toast>Published · 3 testers needed</Toast>}
      </div>
    </div>
  )
}

/** When each step gets its status, in scene time. */
const MARKED_AT = [800, 1500, 2200, 6400, 7000]
const ISSUE = "Verification email never sends on signup"
const REPRO = "1. Sign up. 2. Wait on the confirm screen. 3. Nothing arrives."

function TestScene({ at }: { at: number }) {
  const issue = typed(ISSUE, at, 2500, 30)
  const repro = typed(REPRO, at, 4000, 40)
  const submit = 8000

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {ENTRIES.map((entry, i) => {
          const marked = at >= MARKED_AT[i]
          return (
            <li key={entry.id} className="rounded-[8px] border border-line bg-surface px-4 py-2 flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex gap-3 min-w-0 flex-1">
                  <span className="font-mono text-[12px] font-medium leading-5 text-accent-ink shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="font-mono text-[12px] leading-5 text-ink truncate">{entry.step_action}</p>
                </div>
                <div className="flex gap-1 shrink-0 pl-8 sm:pl-0">
                  {ENTRY_STATUSES.map((s) => (
                    <span
                      key={s}
                      className={`h-6 px-2 inline-flex items-center rounded-[4px] border font-mono text-[11px] font-medium transition-colors duration-150 ${
                        marked && s === entry.status ? STATUS_ACTIVE[s] : "border-line text-ink-muted"
                      }`}
                    >
                      {entryStatusLabel(s)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Step 3 is typed out; 4 and 5 arrive filled — the point is made once. */}
              {i === 2 && marked && (
                <div className="th-fade-in flex flex-col gap-2 pl-8">
                  <p className="font-mono text-[12px] leading-5 text-ink border border-ink-muted rounded-[4px] px-2 py-1 min-h-8">
                    <span className="text-ink-muted">Issue: </span>
                    {issue.shown}
                    <Caret on={issue.typing} />
                  </p>
                  {at >= 3900 && (
                    <p className="font-mono text-[12px] leading-5 text-ink border border-ink-muted rounded-[4px] px-2 py-1 min-h-8">
                      <span className="text-ink-muted">Reproduce: </span>
                      {repro.shown}
                      <Caret on={repro.typing} />
                    </p>
                  )}
                </div>
              )}
              {i > 2 && marked && (
                <p className="th-fade-in pl-8 font-mono text-[12px] leading-5 text-ink-muted truncate">
                  Issue: {entry.issue_summary}
                </p>
              )}
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <MockButton pressed={at >= submit}>Submit report</MockButton>
        {at >= submit + 400 && <Toast>Report sent · +1 report earned</Toast>}
      </div>
    </div>
  )
}

function ReviewScene({ at }: { at: number }) {
  const rows = Math.min(ENTRIES.length, Math.max(0, Math.floor((at - 300) / 350) + 1))
  const summaryAt = 2400

  return (
    <div className="grid gap-4 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="font-mono text-[13px] font-medium text-ink">Tester 01</p>
          <Badge>Pending</Badge>
        </div>
        <PassRate entries={ENTRIES} />
        <ol className="flex flex-col gap-2">
          {ENTRIES.slice(0, rows).map((entry) => (
            <li key={entry.id} className="th-fade-in border-l-[3px] border-line pl-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12px] font-medium text-accent-ink">
                  {String(entry.step_index + 1).padStart(2, "0")}
                </span>
                <StatusPill status={entry.status} />
                <p className="font-mono text-[12px] leading-5 text-ink truncate">{entry.step_action}</p>
              </div>
              {entry.issue_summary && (
                <p className="font-mono text-[12px] leading-5 text-ink-muted truncate">Issue: {entry.issue_summary}</p>
              )}
            </li>
          ))}
        </ol>
      </div>

      {at >= summaryAt && (
        <div className="th-fade-in rounded-[8px] border border-line bg-surface p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[11px] text-accent-ink uppercase tracking-[0.8px]">AI summary</p>
            <Badge variant="negative">Frustrated</Badge>
          </div>
          {INSIGHTS.map((item, i) =>
            at >= summaryAt + 400 + i * 500 ? (
              <div key={item.title} className="th-fade-in flex items-start gap-2">
                {item.status === "pass" ? (
                  <CheckCircle2 size={14} aria-hidden="true" className="text-success-ink shrink-0 mt-1" />
                ) : (
                  <AlertTriangle size={14} aria-hidden="true" className="text-accent-ink shrink-0 mt-1" />
                )}
                <div className="min-w-0">
                  <p className="font-mono text-[12px] font-medium leading-5 text-ink">{item.title}</p>
                  <p className="font-mono text-[11px] leading-4 text-ink-muted">{item.description}</p>
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  )
}

const STAGES = [WriteScene, TestScene, ReviewScene]

/**
 * Loops, so it carries a pause control (WCAG 2.2.2). Someone who asked for
 * less motion gets no clock: each scene button shows that scene finished, and
 * the page opens on the report. The stage itself is aria-hidden — a
 * typewriter is noise to a screen reader — and the figure's label says the
 * same thing in one sentence.
 */
export function HeroDemo() {
  const still = useReducedMotion()
  const [t, setT] = useState(0)
  const [paused, setPaused] = useState(false)
  const running = !still && !paused

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setT((x) => (x + TICK) % TOTAL), TICK)
    return () => clearInterval(id)
  }, [running])

  // Reduced motion opens on the finished report rather than an empty form.
  const now = still && t === 0 ? TOTAL - 1 : t
  const scene = sceneAt(now)
  const local = now - STARTS[scene]
  const Stage = STAGES[scene]
  const jump = (i: number) => setT(still ? STARTS[i] + SCENES[i].ms - 1 : STARTS[i])

  return (
    <div className="relative">
      {/* Dark-only glow; see .th-glow in globals.css. */}
      <div aria-hidden="true" className="th-glow pointer-events-none absolute -inset-x-8 -top-16 -bottom-8" />

      <Window
        title={`twnhall · ${SCENES[scene].path}`}
        label="A builder writes and publishes a five-step test case, a tester marks each step pass, fail or blocked and describes the failure, and the builder reads the report with an AI summary."
        className="relative max-w-[1040px] mx-auto"
      >
        <div className="flex">
          <div aria-hidden="true" className="hidden sm:flex flex-col items-center gap-2 w-14 shrink-0 py-4 border-r border-line">
            {SCENES.map((s, i) => {
              const Icon = s.icon
              return (
                <span
                  key={i}
                  className={`w-10 h-10 rounded-[8px] flex items-center justify-center ${
                    i === scene ? "bg-ink/[0.06] text-accent-ink" : "text-ink-muted"
                  }`}
                >
                  <Icon size={18} />
                </span>
              )
            })}
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="h-12 px-5 flex items-center gap-3 border-b border-line">
              <Badge variant={SCENES[scene].role === "Tester" ? "role-tester" : "default"}>
                {SCENES[scene].role}
              </Badge>
              <span className="font-mono text-[12px] text-ink-muted truncate">{SCENES[scene].path}</span>
            </div>
            {/* Fixed height so scenes never move the page; the mask softens
                whatever a narrow screen has to clip. */}
            <div
              aria-hidden="true"
              className="h-[440px] sm:h-[460px] overflow-hidden p-5 [mask-image:linear-gradient(to_bottom,black_88%,transparent)]"
            >
              <div key={scene} className="th-fade-in">
                <Stage at={local} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-stretch border-t border-line">
          {SCENES.map((s, i) => {
            const active = i === scene
            const pct = active ? (still ? 100 : (local / s.ms) * 100) : 0
            return (
              <button
                key={i}
                type="button"
                onClick={() => jump(i)}
                aria-current={active ? "step" : undefined}
                className={`relative flex-1 min-w-0 h-12 px-3 sm:px-4 text-left font-mono text-[12px] border-r border-line transition-colors duration-150 hover:bg-ink/[0.06] ${FOCUS} ${
                  active ? "text-ink" : "text-ink-muted"
                }`}
              >
                <span aria-hidden="true" className="absolute left-0 top-0 border-t-2 border-accent-ink" style={{ width: `${pct}%` }} />
                <span className="text-accent-ink mr-2">{String(i + 1).padStart(2, "0")}</span>
                {s.role}
                <span className="hidden md:inline"> {s.step}</span>
              </button>
            )
          })}
          {!still && (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Play animation" : "Pause animation"}
              className={`w-12 h-12 shrink-0 flex items-center justify-center text-ink hover:bg-ink/[0.06] transition-colors duration-150 ${FOCUS}`}
            >
              {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
            </button>
          )}
        </div>
      </Window>
    </div>
  )
}

/* ── browser ─────────────────────────────────────────────────────────── */

/*
 * The app's own sidebar, as components/layout/Sidebar.tsx lists it. Copied
 * rather than imported: that file pulls in the sign-out server action, and a
 * marketing mock has no business bundling it. Keep the names in step.
 */
const APP_NAV = {
  builder: {
    heading: "My Work",
    links: [
      { name: "My Projects", icon: LayoutDashboard },
      { name: "My Missions", icon: Target },
      { name: "Feedback Received", icon: MessageSquare },
    ],
  },
  tester: {
    heading: "Tester",
    links: [
      { name: "Tester Home", icon: LayoutGrid },
      { name: "Available Missions", icon: Compass },
      { name: "Explore Projects", icon: Telescope },
    ],
  },
} as const

/**
 * A browser window with the signed-in app inside it: address bar, sidebar,
 * page. What makes a feature card read as the product rather than a widget.
 * The sidebar folds away below `md`, where the page needs the width.
 */
function Browser({
  url,
  account,
  active,
  label,
  children,
}: {
  url: string
  account: keyof typeof APP_NAV
  active: string
  label: string
  children: React.ReactNode
}) {
  const nav = APP_NAV[account]
  return (
    <figure
      aria-label={label}
      className="rounded-[12px] border border-line bg-surface-raised shadow-card overflow-hidden"
    >
      <div aria-hidden="true" className="h-12 px-4 flex items-center gap-4 border-b border-line bg-surface-raised">
        <div className="flex gap-2 shrink-0">
          <span className="w-3 h-3 rounded-full bg-line" />
          <span className="w-3 h-3 rounded-full bg-line" />
          <span className="w-3 h-3 rounded-full bg-line" />
        </div>
        <div className="flex-1 min-w-0 max-w-[360px] mx-auto h-8 px-3 flex items-center gap-2 rounded-[8px] border border-line bg-ink/[0.04] text-ink-muted">
          <Lock size={12} className="shrink-0" />
          <span className="flex-1 min-w-0 truncate text-center font-mono text-[12px]">{url}</span>
          <RotateCw size={12} className="shrink-0" />
        </div>
        <div className="w-[52px] shrink-0 hidden sm:block" />
      </div>

      {/* DM Sans inside the page, by request: the mocks read as a website
          here, not as the DM Mono app. The wordmark keeps Syne; the address
          bar above keeps mono, like a real one. */}
      <div className="flex [&_*:not(.font-syne)]:font-sans!">
        <div aria-hidden="true" className="hidden md:flex w-52 shrink-0 flex-col gap-6 p-4 border-r border-line bg-surface">
          <div className="flex items-center gap-2 px-2">
            <Logo size={20} />
            <span className="font-syne font-bold text-[14px] text-ink">Twnhall</span>
          </div>
          <div className="flex flex-col gap-1">
            <p className="px-2 mb-1 font-mono text-[10px] font-medium uppercase tracking-[1px] text-ink-muted">
              {nav.heading}
            </p>
            {nav.links.map(({ name, icon: Icon }) => (
              <span
                key={name}
                className={`h-8 px-2 flex items-center gap-2 rounded-[8px] font-mono text-[12px] ${
                  name === active ? "bg-ink/[0.06] text-ink" : "text-ink-muted"
                }`}
              >
                <Icon size={14} className={`shrink-0 ${name === active ? "text-accent-ink" : ""}`} />
                <span className="truncate">{name}</span>
              </span>
            ))}
          </div>
          <span
            className={`mt-auto h-8 px-2 flex items-center gap-2 rounded-[8px] font-mono text-[12px] ${
              active === "Settings" ? "bg-ink/[0.06] text-ink" : "text-ink-muted"
            }`}
          >
            <Settings size={14} className={`shrink-0 ${active === "Settings" ? "text-accent-ink" : ""}`} />
            Settings
          </span>
        </div>
        <div className="flex-1 min-w-0 bg-surface">{children}</div>
      </div>
    </figure>
  )
}

/* ── feature panels ─────────────────────────────────────────────────────── */

/** The real template library — the first four, with the one in use loaded below. */
function TemplateMock() {
  return (
    <Browser
      url="twnhall.com/dashboard/acme/mission/new"
      account="builder"
      active="My Missions"
      label={`The template picker: ${TEST_TEMPLATES.length} templates including Authentication Flow, Password Reset and Checkout, with Authentication Flow's steps loaded.`}
    >
      <div className="p-5 flex flex-col gap-3">
        <p className={LABEL}>{TEST_TEMPLATES.length} templates</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {TEST_TEMPLATES.slice(0, 4).map((t) => (
            <li
              key={t.id}
              className={`rounded-[8px] border bg-ink/[0.04] px-3 py-2 ${t.id === TEMPLATE.id ? "border-accent-ink" : "border-line"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[12px] font-medium leading-5 text-ink truncate">{t.name}</p>
                <span className="font-mono text-[11px] text-ink-muted shrink-0">{t.steps.length} steps</span>
              </div>
              <p className="font-mono text-[11px] leading-4 text-ink-muted truncate">{t.description}</p>
            </li>
          ))}
        </ul>
        <div className="rounded-[8px] border border-line bg-ink/[0.04] overflow-hidden">
          <TestCaseList />
        </div>
      </div>
    </Browser>
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
      <p className="bg-ink/[0.04] border border-ink-muted rounded-[8px] px-3 py-2 font-mono text-[13px] leading-5 text-ink">
        {value}
      </p>
    </div>
  )
}

function TestMock() {
  const entry = ENTRIES[2]
  return (
    <Browser url="twnhall.com/mission/auth-flow" account="tester" active="Available Missions" label="A tester marking step 3 as failed, with the issue and steps to reproduce filled in.">
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
                s === entry.status ? STATUS_ACTIVE[s] : "border-line text-ink-muted bg-ink/[0.04]"
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
    </Browser>
  )
}

function ReviewMock() {
  return (
    <Browser url="twnhall.com/dashboard/feedback" account="builder" active="Feedback Received" label="The builder's review: the pass rate, screenshots, approve or request changes, and a rating.">
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
    </Browser>
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

const SUMMARY_MS = 4600
const INSIGHT_GAP = 1300
const INSIGHT_FROM = 600

/**
 * The one feature that streams, the way the analysis does. `at` is how far in
 * it is; left out, it is finished. Untyped text is still laid out, invisibly,
 * so the window is its final height from the first frame.
 */
function SummaryMock({ at = SUMMARY_MS }: { at?: number }) {
  const done = at >= SUMMARY_MS - 100
  return (
    <Browser url="twnhall.com/dashboard/acme/mission/auth-flow" account="builder" active="My Missions" label="The AI summary: what failed first, what went untested, what worked, and an overall read of the session.">
      <div className="p-5 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4 flex-wrap min-h-6">
          <p className="font-mono text-[11px] text-accent-ink uppercase tracking-[0.8px]">AI generated</p>
          {done ? (
            <Badge variant="negative" className="th-fade-in">Frustrated</Badge>
          ) : (
            <span className="font-mono text-[12px] text-ink-muted">
              {at < INSIGHT_FROM ? "Reading the report…" : "Writing the summary…"}
            </span>
          )}
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {INSIGHTS.map((item, i) => {
            const start = INSIGHT_FROM + i * INSIGHT_GAP
            const text = typed(item.description, at, start + 200, 100)
            return (
              <div key={item.title} className={at >= start ? "th-fade-in" : "invisible"}>
                <div className="flex items-start gap-2 mb-2">
                  {item.status === "pass" ? (
                    <CheckCircle2 size={16} aria-hidden="true" className="text-success-ink shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={16} aria-hidden="true" className="text-accent-ink shrink-0 mt-0.5" />
                  )}
                  <p className="font-mono text-[13px] font-medium leading-5 text-ink">{item.title}</p>
                </div>
                <p className="font-mono text-[12px] leading-5 text-ink-muted">
                  {text.shown}
                  <Caret on={text.typing} />
                  <span className="invisible">{item.description.slice(text.shown.length)}</span>
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </Browser>
  )
}

/** Plays once, the first time it is scrolled to. Under five seconds, so no pause control. */
function StreamingSummary() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-120px" })
  const still = useReducedMotion()
  const [at, setAt] = useState(0)

  useEffect(() => {
    if (!inView || still) return
    const t0 = performance.now()
    const id = setInterval(() => {
      const elapsed = performance.now() - t0
      setAt(Math.min(elapsed, SUMMARY_MS))
      if (elapsed >= SUMMARY_MS) clearInterval(id)
    }, TICK)
    return () => clearInterval(id)
  }, [inView, still])

  return (
    <div ref={ref}>
      <SummaryMock at={still ? SUMMARY_MS : at} />
    </div>
  )
}

/** A slice of the real export's columns, named as app/api/export/feedback names them. */
function ExportMock() {
  const cols = ["Step", "Action", "Step status", "Issue summary"]
  return (
    <Browser url="twnhall.com/settings" account="builder" active="Settings" label="A CSV export with one row per step: the step number, the action, its status and the issue.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] font-mono text-[12px] leading-5 text-left">
          <thead>
            <tr className="border-b border-line bg-ink/[0.04]">
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
    </Browser>
  )
}

/* ── features ────────────────────────────────────────────────────────── */

const LINK =
  "inline-flex items-center gap-2 self-start font-mono text-[14px] text-accent-ink underline underline-offset-4 hover:no-underline rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"

const FEATURES: {
  title: string
  body: string
  link?: { href: string; label: string }
  Mock: () => React.ReactNode
}[] = [
  {
    title: "Start from a template.",
    body: `${TEST_TEMPLATES.length} ready-made test cases for the flows every product has: sign-up, password reset, checkout and more. Pick one, change what you need, publish.`,
    link: { href: "/guides/builder", label: "How to write a test case" },
    Mock: TemplateMock,
  },
  {
    title: "Every step, answered on its own terms.",
    body: "A pass is one click. A fail or a blocked step comes with the issue, how to reproduce it and screenshots, so nothing reaches you without something to act on.",
    link: { href: "/guides/tester", label: "How testers work" },
    Mock: TestMock,
  },
  {
    title: "Read it at a glance.",
    body: "How many steps passed sits at the top. Approve the report or ask for changes, and rate how useful it was.",
    Mock: ReviewMock,
  },
  {
    title: "AI reads it first.",
    body: "Every report gets a short summary that leads with what failed and why it matters, and an overall read of how the session went. The full log is one click away.",
    Mock: StreamingSummary,
  },
  {
    title: "Take it with you.",
    body: "Export every report on a project as a CSV, one row per step, for your tracker or a spreadsheet. Testers' email addresses never leave the app.",
    Mock: ExportMock,
  },
]

/**
 * Cursor-style feature cards: copy on one side, the product on a dotted stage
 * on the other, alternating. Only the AI summary moves — the hero has already
 * animated writing, testing and reviewing, and doing it again here would be
 * repetition, not explanation.
 */
export function Features() {
  return (
    <div className="flex flex-col gap-16 lg:gap-24">
      {FEATURES.map(({ title, body, link, Mock }, i) => (
        <article
          key={title}
          className="grid gap-8 lg:gap-12 grid-cols-[minmax(0,1fr)] lg:grid-cols-12 lg:items-center rounded-[16px] border border-line bg-surface-raised p-3 sm:p-6 lg:p-8"
        >
          <div className={`lg:col-span-4 flex flex-col gap-4 px-2 pt-4 sm:pt-0 lg:px-4 ${i % 2 ? "lg:order-2" : ""}`}>
            <h3 className="font-syne font-bold text-[24px] leading-8 text-ink">{title}</h3>
            <p className="font-sans text-[18px] leading-8 text-ink">{body}</p>
            {link && (
              <Link href={link.href} className={LINK}>
                {link.label}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
          </div>
          <div className={`lg:col-span-8 th-stage rounded-[12px] border border-line p-3 sm:p-8 lg:p-12 ${i % 2 ? "lg:order-1" : ""}`}>
            <Mock />
          </div>
        </article>
      ))}
    </div>
  )
}
