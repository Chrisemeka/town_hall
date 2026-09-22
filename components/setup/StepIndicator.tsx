import { Check } from "lucide-react"
import type { SetupBar } from "@/lib/setup"

/**
 * Where the user is in the setup chain.
 *
 * Two presentations of the same data, because six pills do not fit a 360px
 * screen and a tester's bar is six stages long. Pills from 640px up; a single
 * "Step 3 of 6 · Identity" line below it. Both render from the same SetupBar,
 * so they cannot disagree.
 *
 * The list is an <ol> with aria-current="step" on the live one, which is what
 * a screen reader needs; the compact line says the same thing in words, so the
 * narrow view is not a downgrade in what is announced.
 */
export function StepIndicator({ bar }: { bar: SetupBar }) {
  const { stages, unresolved } = bar
  const currentIndex = stages.findIndex((s) => s.status === "current")
  const current = stages[currentIndex]

  // An unresolved tail means the total is not knowable yet — the profile
  // portion is three stages for a builder and four for a tester, and the role
  // does not exist until the picker is answered. Saying "of 6" here would be
  // a guess that is wrong half the time.
  const total = unresolved ? null : stages.length

  return (
    <div className="mb-8">
      {/* Compact, below 640px. */}
      <p className="sm:hidden font-mono text-[12px] text-ink-muted">
        {current ? (
          <>
            <span className="text-ink">
              Step {currentIndex + 1}
              {total ? ` of ${total}` : ""}
            </span>
            {" · "}
            {current.label}
          </>
        ) : null}
      </p>

      {/* Pills, from 640px up. */}
      <ol className="hidden sm:flex flex-wrap items-center gap-2">
        {stages.map((stage) => (
          <li key={stage.id}>
            <span
              aria-current={stage.status === "current" ? "step" : undefined}
              className={[
                "h-8 px-3 inline-flex items-center gap-2 rounded-[8px] border font-mono text-[12px] font-medium",
                stage.status === "current"
                  ? "border-accent-ink text-accent-ink bg-accent-ink/[0.08]"
                  : stage.status === "done"
                    ? "border-line text-ink"
                    : "border-line text-ink-muted",
              ].join(" ")}
            >
              {stage.status === "done" && (
                <Check size={12} aria-hidden="true" className="shrink-0" />
              )}
              {stage.label}
              {/* Colour is never the only signal (Design.md §10): a completed
                  stage carries a tick, and the live one is named in words for
                  anyone who cannot see either. */}
              {stage.status === "current" && <span className="sr-only">(current step)</span>}
              {stage.status === "done" && <span className="sr-only">(completed)</span>}
            </span>
          </li>
        ))}

        {unresolved && (
          <li>
            <span className="h-8 px-3 inline-flex items-center rounded-[8px] font-mono text-[12px] text-ink-muted">
              {/* Not a stage — a marker that more exist and cannot be named
                  yet. Announced, so it is not just an ellipsis nobody hears. */}
              <span aria-hidden="true">…</span>
              <span className="sr-only">More steps once you pick a role</span>
            </span>
          </li>
        )}
      </ol>
    </div>
  )
}
