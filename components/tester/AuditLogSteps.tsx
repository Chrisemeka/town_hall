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

/** Whether every step has been answered well enough to submit. */
export function draftIsComplete(entries: DraftEntry[]): boolean {
  return entries.every(
    (e) =>
      e.status !== "" &&
      e.actual_result.trim().length > 0 &&
      e.expected_result.trim().length > 0 &&
      (e.status !== "fail" ||
        (e.issue_summary.trim().length > 0 && e.steps_to_reproduce.trim().length > 0)),
  )
}

export function AuditLogSteps({
  entries,
  onChange,
}: {
  entries: DraftEntry[]
  onChange: (next: DraftEntry[]) => void
}) {
  function edit(index: number, patch: Partial<DraftEntry>) {
    onChange(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)))
  }

  return (
    <div className="flex flex-col gap-5">
      {entries.map((entry, index) => (
        <div
          key={entry.step_id}
          className="bg-graphite border border-iron rounded-[12px] p-5 flex flex-col gap-4"
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
              {ENTRY_STATUSES.map((status) => {
                const active = entry.status === status
                return (
                  <button
                    key={status}
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
            label="What actually happened"
            value={entry.actual_result}
            onChange={(v) => edit(index, { actual_result: v })}
            placeholder="The form submitted but nothing appeared to happen"
          />

          <Field
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
                label="Summary of the issue"
                value={entry.issue_summary}
                onChange={(v) => edit(index, { issue_summary: v })}
                placeholder="Submit button does nothing on the first click"
              />
              <Field
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
  label,
  value,
  onChange,
  placeholder,
  helper,
}: {
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
        value={value}
        rows={2}
        maxLength={ENTRY_TEXT_MAX}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-obsidian border border-iron rounded-[8px] px-3 py-2 font-mono text-[13px] leading-5 text-chalk placeholder:text-ash focus:outline-none focus:border-voltage transition-colors duration-150 resize-none"
      />
      {helper && <span className="font-mono text-[11px] text-ash">{helper}</span>}
    </label>
  )
}
