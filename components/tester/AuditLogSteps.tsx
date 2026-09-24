"use client"

import {
  ENTRY_STATUSES,
  ENTRY_STATUS_HINTS,
  entryStatusLabel,
  type EntryStatus,
} from "@/lib/vocabulary"
import { InfoTip } from "@/components/ui/InfoTip"
import { ENTRY_TEXT_MAX, ENTRY_TEXT_MIN } from "@/lib/validation/schemas"
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
  issue_summary: string
  steps_to_reproduce: string
}

/** A blank log for a mission's steps. */
export function draftFor(steps: TestStep[]): DraftEntry[] {
  return steps.map((step) => ({
    step_id: step.id,
    // The builder's wording, snapshotted and shown back verbatim. It is a
    // label, not a field: it used to be prefilled into an editable box and ten
    // of the first eleven testers submitted it unchanged.
    step_action: step.action,
    step_expected: step.expected_result,
    status: "",
    actual_result: "",
    issue_summary: "",
    steps_to_reproduce: "",
  }))
}

/** The tester-filled fields, in the order the card renders them. */
export type EntryField =
  | "status"
  | "actual_result"
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
  // ENTRY_TEXT_MIN rather than "not blank", because auditEntrySchema is the
  // authority and that is what it asks for. Checking only for non-empty let a
  // two-character answer through the form and into a server rejection the
  // tester never sees clearly.
  const given = (v: string) => v.trim().length >= ENTRY_TEXT_MIN

  for (const [index, e] of entries.entries()) {
    if (e.status === "") return { index, field: "status" }
    // A pass is complete here — its status is the whole answer, and what it
    // confirms is the builder's step_expected, already on the row.
    // Everything below mirrors auditEntrySchema's refines. These two
    // definitions of "complete" drifting apart is the failure this file is
    // most exposed to, and components/tester/__tests__ crosses them directly.
    if (e.status !== "pass") {
      if (!given(e.actual_result)) return { index, field: "actual_result" }
      if (!given(e.issue_summary)) return { index, field: "issue_summary" }
      if (!given(e.steps_to_reproduce)) return { index, field: "steps_to_reproduce" }
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
            "bg-surface-raised border rounded-[12px] p-5 flex flex-col gap-4",
            // Never colour alone — Design.md §5.4. The message above the submit
            // button names this step by number; the border is how the tester
            // finds it once they have been scrolled to it.
            errorIndex === index ? "border-danger-ink" : "border-line",
          ].join(" ")}
        >
          {/*
            The builder's instruction, verbatim and never collapsed. This is the
            anti-miscommunication mechanism — a tester who cannot see what they
            were asked is the failure this whole feature exists to prevent — so
            it sits in its own darker panel, visually distinct from the fields
            below that are the tester's to fill in.
          */}
          <div className="bg-surface border border-line rounded-[8px] p-4">
            <p className="font-mono text-[11px] font-medium text-accent-ink uppercase tracking-[1px] mb-3">
              Step {String(index + 1).padStart(2, "0")}
            </p>
            <p className="font-mono text-[11px] text-ink-muted uppercase tracking-[0.5px] mb-1">Do</p>
            <p className="font-mono text-[14px] leading-5 text-ink mb-3 break-words">
              {entry.step_action}
            </p>
            <p className="font-mono text-[11px] text-ink-muted uppercase tracking-[0.5px] mb-1">
              Builder expects
            </p>
            <p className="font-mono text-[14px] leading-5 text-ink-muted break-words">
              {entry.step_expected}
            </p>
          </div>

          {/* Status. Text-labelled, never colour alone — Design.md §5.4. */}
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[11px] text-ink-muted uppercase tracking-[0.5px] flex items-center gap-2">
              How did it go?
              {/* Per step rather than once at the top: the choice is made per
                  step, and the icon costs no vertical space on a form that is
                  already several screens tall. */}
              <InfoTip label="What do Pass, Fail and Blocked mean?">
                <span className="flex flex-col gap-2 normal-case tracking-normal">
                  {ENTRY_STATUSES.map((s) => (
                    <span key={s} className="font-mono text-[12px] leading-5 text-ink-muted">
                      <span className={STATUS_HINT_TONE[s]}>{entryStatusLabel(s)}</span>
                      {" — "}
                      {ENTRY_STATUS_HINTS[s]}
                    </span>
                  ))}
                </span>
              </InfoTip>
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
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised",
                      active
                        ? STATUS_ACTIVE[status]
                        : "border-line text-ink-muted bg-surface hover:border-ink-muted hover:text-ink",
                    ].join(" ")}
                  >
                    {entryStatusLabel(status)}
                  </button>
                )
              })}
            </div>
          </div>

          {/*
            Everything below is asked of a failure and of a blocked step, and of
            neither a pass nor an unanswered one.

            A pass has already said what happened — it happened as expected —
            and has no issue and nothing to reproduce; asking anyway is how the
            data becomes "N/A". Blocked is the case this used to get wrong: it
            collected none of this, so the one status meaning "something stopped
            me" reached the builder with nothing to act on. What stopped the
            tester is the whole report.

            Mirrors auditEntrySchema, which is the authority. If these disagree
            the form refuses valid work or sends work the server rejects.
          */}
          {entry.status !== "" && entry.status !== "pass" && (
            <>
              <Field
                name={entryFieldName(index, "actual_result")}
                label="What actually happened"
                value={entry.actual_result}
                onChange={(v) => edit(index, { actual_result: v })}
                placeholder={
                  entry.status === "blocked"
                    ? "Could not reach this step — step 2 never completed"
                    : "The form submitted but nothing appeared to happen"
                }
              />
              <Field
                name={entryFieldName(index, "issue_summary")}
                label="Summary of the issue"
                value={entry.issue_summary}
                onChange={(v) => edit(index, { issue_summary: v })}
                placeholder={
                  entry.status === "blocked"
                    ? "Blocked by the broken sign-up on step 2"
                    : "Submit button does nothing on the first click"
                }
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

/** The tooltip's labels, toned to match the buttons they describe. */
const STATUS_HINT_TONE: Record<EntryStatus, string> = {
  pass: "text-success-ink",
  fail: "text-danger-ink",
  blocked: "text-info-ink",
}

const STATUS_ACTIVE: Record<EntryStatus, string> = {
  pass: "border-success-ink text-success-ink bg-mint/10",
  fail: "border-danger-ink text-danger-ink bg-ember/10",
  blocked: "border-info-ink text-info-ink bg-sky/10",
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
      <span className="font-mono text-[11px] text-ink-muted uppercase tracking-[0.5px]">{label}</span>
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
        className="w-full bg-surface border border-line rounded-[8px] px-3 py-2 font-mono text-[13px] leading-5 text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent-ink focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised transition-colors duration-150 resize-none"
      />
      {helper && <span className="font-mono text-[11px] text-ink-muted">{helper}</span>}
    </label>
  )
}
