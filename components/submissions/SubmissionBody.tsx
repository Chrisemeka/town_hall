import { entryStatusLabel } from "@/lib/vocabulary"
import type { TestResultEntryRow } from "@/lib/types/db"

/** Just the fields any surface needs to render one entry. */
export type SubmissionEntry = Pick<
  TestResultEntryRow,
  | "id"
  | "step_index"
  | "step_action"
  | "step_expected"
  | "status"
  | "issue_summary"
  | "steps_to_reproduce"
  | "actual_result"
  | "expected_result"
>

/**
 * One submission's body, for every surface that shows one.
 *
 * Written once and branched here rather than conditionally in each of the eight
 * places that render a submission. A builder scrolling their feedback sees the
 * old shape and the new one interleaved by date, and that has to look
 * deliberate — eight independent conditionals is how it stops doing.
 *
 * Legacy submissions — the 24 that predate the audit log — carry a comment and
 * no entries. They are not second-class here: they render as what they are,
 * without empty audit scaffolding around them.
 */
export function SubmissionBody({
  entries,
  comment,
}: {
  entries?: SubmissionEntry[] | null
  comment: string | null
}) {
  const log = entries ?? []

  if (log.length === 0) {
    return comment?.trim() ? (
      <p className="font-mono text-[14px] leading-6 text-ash whitespace-pre-wrap break-words">
        {comment}
      </p>
    ) : (
      <p className="font-mono text-[13px] text-ash italic">No written feedback.</p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PassRate entries={log} />

      <ol className="flex flex-col gap-3">
        {[...log]
          .sort((a, b) => a.step_index - b.step_index)
          .map((entry) => (
            <li key={entry.id} className="border-l-[3px] border-iron pl-4">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-mono text-[12px] font-medium text-voltage">
                  {String(entry.step_index + 1).padStart(2, "0")}
                </span>
                <StatusPill status={entry.status} />
              </div>

              <p className="font-mono text-[13px] leading-5 text-chalk break-words mb-2">
                {entry.step_action}
              </p>

              {/* The builder's own wording, snapshotted at submission time.
                  This was reading expected_result — the tester's copy of the
                  same sentence — until the form stopped asking for it. */}
              <Row label="Expected" value={entry.step_expected} />
              {/* Only entries written before 20260908_01, and only the ones
                  where the tester actually disagreed. Dropping the field must
                  not silently delete what it did collect. */}
              {testerDisagreed(entry) && (
                <Row label="Tester expected" value={entry.expected_result} />
              )}
              {/* Empty on a passing step since 20260907_01 — the same guard the
                  two rows below have always had. Every row written before that
                  carries a value and renders unchanged. */}
              {entry.actual_result && <Row label="Actual" value={entry.actual_result} />}
              {entry.issue_summary && <Row label="Issue" value={entry.issue_summary} />}
              {entry.steps_to_reproduce && (
                <Row label="Reproduce" value={entry.steps_to_reproduce} />
              )}
            </li>
          ))}
      </ol>

      {comment?.trim() && (
        <div className="pt-3 border-t border-iron">
          <p className="font-mono text-[11px] text-ash uppercase tracking-[0.5px] mb-1">
            Anything else
          </p>
          <p className="font-mono text-[14px] leading-6 text-ash whitespace-pre-wrap break-words">
            {comment}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * "3 of 5 steps passed", above the log rather than inside it.
 *
 * The single most useful thing the structure buys a builder, so it must not
 * require expanding anything to see.
 */
export function PassRate({ entries }: { entries: SubmissionEntry[] }) {
  const passed = entries.filter((e) => e.status === "pass").length
  const failed = entries.filter((e) => e.status === "fail").length
  const blocked = entries.filter((e) => e.status === "blocked").length

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span
        className={[
          "font-mono text-[13px] font-medium",
          failed > 0 ? "text-ember" : "text-chalk",
        ].join(" ")}
      >
        {passed} of {entries.length} steps passed
      </span>
      {failed > 0 && <StatusPill status="fail" count={failed} />}
      {blocked > 0 && <StatusPill status="blocked" count={blocked} />}
    </div>
  )
}

/** Colour is paired with the label every time — Design.md §5.4. */
function StatusPill({ status, count }: { status: string; count?: number }) {
  const tone =
    status === "pass"
      ? "text-[#3FFFA2] bg-[rgba(63,255,162,0.12)] border-[rgba(63,255,162,0.3)]"
      : status === "fail"
        ? "text-ember bg-ember/10 border-ember/30"
        : "text-sky bg-sky/10 border-sky/30"

  return (
    <span
      className={`inline-block font-mono text-[11px] font-medium tracking-[0.5px] rounded-[4px] px-2 py-0.5 border ${tone}`}
    >
      {count !== undefined ? `${count} ` : ""}
      {entryStatusLabel(status)}
    </span>
  )
}

/**
 * Whether this entry's tester wrote their own expectation rather than sending
 * back the builder's. True for one of the eleven entries that predate
 * 20260908_01, and never for anything written after it.
 */
function testerDisagreed(entry: SubmissionEntry): boolean {
  const norm = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase()
  return !!entry.expected_result && norm(entry.expected_result) !== norm(entry.step_expected)
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="font-mono text-[13px] leading-5 text-ash break-words">
      <span className="text-ash/70">{label}: </span>
      {value}
    </p>
  )
}
