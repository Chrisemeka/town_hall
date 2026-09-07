"use client"

import { ENTRY_STATUSES, entryStatusLabel, type EntryStatus } from "@/lib/vocabulary"
import { ENTRY_TEXT_MAX } from "@/lib/validation/schemas"
import type { TestStep } from "@/lib/validation/schemas"

/**
 * One draft answer per step. `status` starts empty rather than defaulting to
 * "pass": a pre-ticked pass is an answer the tester did not give, and it is the
 * answer they are most likely to leave alone.
 */
export type DraftEntry = {
  step_id: string
  step_action: string
  step_expected: string
  status: EntryStatus | ""
  actual_result: string
  expected_result: string
  issue_summary: string
  steps_to_reproduce: string
}

/** A blank log for a mission's steps, with expected_result seeded from the step. */
export function draftFor(steps: TestStep[]): DraftEntry[] {
  return steps.map((step) => ({
    step_id: step.id,
    step_action: step.action,
    step_expected: step.expected_result,
    status: "",
    // Prefilled and editable. It makes the common case one click, and a tester
    // who disagrees about what should have happened is exactly the signal the
    // builder wants — so it has to be a field, not a label.
    expected_result: step.expected_result,
    actual_result: "",
    issue_summary: "",
    steps_to_reproduce: "",
  }))
}

/** The tester-filled fields, in the order the card renders them. */
export type EntryField =
  | "status"
  | "actual_result"
  | "expected_result"
  | "issue_summary"
  | "steps_to_reproduce"

/** Which field on which entry is the first thing still missing. */
export type Incomplete = { index: number; field: EntryField }

/** The name a field answers to, for the focus hook to resolve against. */
export const entryFieldName = (index: number, field: EntryField) =>
  `entries.${index}.${field}`

/**
 * The first thing still missing, in rendered order, or null when the log is
 * ready to send.
 *
 * One function rather than a boolean plus a separate search: those would be two
 * definitions of "complete" and they would drift, which shows up as a form that
 * either refuses a valid submission or sends one the server then rejects.
 * draftIsComplete is now this asking whether it found anything.
 */
export function firstIncompleteEntry(entries: DraftEntry[]): Incomplete | null {
  for (const [index, e] of entries.entries()) {
    if (e.status === "") return { index, field: "status" }
    if (!e.actual_result.trim()) return { index, field: "actual_result" }
    if (!e.expected_result.trim()) return { index, field: "expected_result" }
    if (e.status === "fail") {
      if (!e.issue_summary.trim()) return { index, field: "issue_summary" }
      if (!e.steps_to_reproduce.trim()) return { index, field: "steps_to_reproduce" }
    }
  }
  return null
}

/** Whether every step has been answered well enough to submit. */
export function draftIsComplete(entries: DraftEntry[]): boolean {
  return firstIncompleteEntry(entries) === null
}

export function AuditLogSteps({
  entries,
  onChange,
  errorIndex,
}: {
  entries: DraftEntry[]
  onChange: (next: DraftEntry[]) => void
  /** The step the submit attempt stopped on, marked so it is findable by eye. */
  errorIndex?: number
}) {
  function edit(index: number, patch: Partial<DraftEntry>) {
    onChange(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)))
  }

  return (
    <div className="flex flex-col gap-5">
      {entries.map((entry, index) => (
        <div
          key={entry.step_id}
          className={[
            "bg-graphite border rounded-[12px] p-5 flex flex-col gap-4",
            // Never colour alone — Design.md §5.4. The message above the submit
            // button names this step by number; the border is how the tester
            // finds it once they have been scrolled to it.
            errorIndex === index ? "border-ember" : "border-iron",
          ].join(" ")}
        >
          {/*
            The builder's instruction, verbatim and never collapsed. This is the
            anti-miscommunication mechanism — a tester who cannot see what they
            were asked is the failure this whole feature exists to prevent — so
            it sits in its own darker panel, visually distinct from the fields
            below that are the tester's to fill in.
          */}
          <div className="bg-obsidian border border-iron rounded-[8px] p-4">
            <p className="font-mono text-[11px] font-medium text-voltage uppercase tracking-[1px] mb-3">
              Step {String(index + 1).padStart(2, "0")}
            </p>
            <p className="font-mono text-[11px] text-ash uppercase tracking-[0.5px] mb-1">Do</p>
            <p className="font-mono text-[14px] leading-5 text-chalk mb-3 break-words">
              {entry.step_action}
            </p>
            <p className="font-mono text-[11px] text-ash uppercase tracking-[0.5px] mb-1">
              Builder expects
            </p>
            <p className="font-mono text-[14px] leading-5 text-ash break-words">
              {entry.step_expected}
            </p>
          </div>

          {/* Status. Text-labelled, never colour alone — Design.md §5.4. */}
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[11px] text-ash uppercase tracking-[0.5px]">
              How did it go?
            </span>
            <div className="flex flex-wrap gap-2">
              {ENTRY_STATUSES.map((status, i) => {
                const active = entry.status === status
                return (
                  <button
                    key={status}
                    // A button group has no name to resolve, so the first one
                    // answers for the group.
                    id={i === 0 ? entryFieldName(index, "status") : undefined}
                    type="button"
                    aria-pressed={active}
                    onClick={() => edit(index, { status })}
                    className={[
                      "h-10 px-4 rounded-[8px] border font-mono text-[13px] font-medium transition-colors duration-150",
                      active
                        ? STATUS_ACTIVE[status]
                        : "border-iron text-ash bg-obsidian hover:border-ash hover:text-chalk",
                    ].join(" ")}
                  >
                    {entryStatusLabel(status)}
                  </button>
                )
              })}
            </div>
          </div>

          <Field
            name={entryFieldName(index, "actual_result")}
            label="What actually happened"
            value={entry.actual_result}
            onChange={(v) => edit(index, { actual_result: v })}
            placeholder="The form submitted but nothing appeared to happen"
          />

          <Field
            name={entryFieldName(index, "expected_result")}
            label="What you expected"
            value={entry.expected_result}
            onChange={(v) => edit(index, { expected_result: v })}
            placeholder="A confirmation message"
            helper="Prefilled from the builder — change it if you expected something else."
          />

          {/* Only for a failure: a passing step has no issue and nothing to
              reproduce, and asking anyway is how the data becomes "N/A". */}
          {entry.status === "fail" && (
            <>
              <Field
                name={entryFieldName(index, "issue_summary")}
                label="Summary of the issue"
                value={entry.issue_summary}
                onChange={(v) => edit(index, { issue_summary: v })}
                placeholder="Submit button does nothing on the first click"
              />
              <Field
                name={entryFieldName(index, "steps_to_reproduce")}
                label="Steps to reproduce"
                value={entry.steps_to_reproduce}
                onChange={(v) => edit(index, { steps_to_reproduce: v })}
                placeholder="1. Open the form  2. Fill every field  3. Click Submit"
              />
            </>
          )}
        </div>
      ))}
    </div>
  )
}

const STATUS_ACTIVE: Record<EntryStatus, string> = {
  pass: "border-[#3FFFA2] text-[#3FFFA2] bg-[rgba(63,255,162,0.1)]",
  fail: "border-ember text-ember bg-ember/10",
  blocked: "border-sky text-sky bg-sky/10",
}

function Field({
  name,
  label,
  value,
  onChange,
  placeholder,
  helper,
}: {
  /** entries.<index>.<field> — what the focus hook resolves against. */
  name: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  helper?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] text-ash uppercase tracking-[0.5px]">{label}</span>
      <textarea
        id={name}
        // Not submitted — the whole log goes as one JSON field. The name exists
        // so an incomplete step can be found and focused.
        name={name}
        value={value}
        rows={2}
        maxLength={ENTRY_TEXT_MAX}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-obsidian border border-iron rounded-[8px] px-3 py-2 font-mono text-[13px] leading-5 text-chalk placeholder:text-ash focus:outline-none focus:border-voltage focus-visible:ring-2 focus-visible:ring-voltage focus-visible:ring-offset-2 focus-visible:ring-offset-graphite transition-colors duration-150 resize-none"
      />
      {helper && <span className="font-mono text-[11px] text-ash">{helper}</span>}
    </label>
  )
}
