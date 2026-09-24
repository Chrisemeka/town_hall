import { storedTestStepsSchema } from "@/lib/validation/schemas"
import { deviceTargetLabel, testCategoryLabel } from "@/lib/vocabulary"

/**
 * Read-only rendering of a mission's test case, shared by the tester and
 * builder detail pages and the admin console.
 *
 * Takes the raw jsonb rather than a parsed array on purpose. Every caller reads
 * it straight off a `missions` row where nothing constrains its shape — rows
 * predating the schema, or edited by hand — so the parse belongs here, once,
 * instead of in each of the three pages.
 */
export function TestCaseView({ steps }: { steps: unknown }) {
  // storedTestStepsSchema, not the write schema: an empty array is a normal
  // stored state here, and the 1..15 bounds are a rule about saving.
  const parsed = storedTestStepsSchema.safeParse(steps)

  // Two different nothings, deliberately not merged: a mission with no steps is
  // the normal state for everything written before test cases existed, while a
  // mission whose steps will not parse is a fault worth naming rather than
  // rendering as emptiness.
  if (!parsed.success) {
    return (
      <p className="font-mono text-[13px] text-ink-muted italic">
        This test case could not be read. Ask the builder to re-save the mission.
      </p>
    )
  }

  if (parsed.data.length === 0) {
    return (
      <p className="font-mono text-[13px] text-ink-muted italic">
        No steps yet — follow the brief above.
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-3">
      {parsed.data.map((step, index) => (
        <li
          key={step.id}
          className="bg-surface border border-line rounded-[12px] p-4 flex gap-4"
        >
          <span className="font-mono text-[12px] font-medium text-accent-ink shrink-0 pt-0.5">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="flex flex-col gap-2 min-w-0">
            <div>
              <p className="font-mono text-[11px] text-ink-muted uppercase tracking-[0.5px] mb-1">
                Do
              </p>
              <p className="font-mono text-[14px] leading-5 text-ink break-words">
                {step.action}
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] text-ink-muted uppercase tracking-[0.5px] mb-1">
                Expect
              </p>
              <p className="font-mono text-[14px] leading-5 text-ink-muted break-words">
                {step.expected_result}
              </p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

/**
 * Category and device chips for a mission.
 *
 * Per Design.md §5.4 the colour never carries the meaning on its own — each
 * chip is its own label. A mission with no category renders no chip at all
 * rather than an "Uncategorised" one: unlike a project, having no category is
 * the norm for missions written before this existed, and labelling thirteen of
 * sixteen cards as uncategorised would be noise, not information.
 */
export function MissionChips({
  category,
  deviceTarget,
  className = "",
}: {
  category: string | null
  deviceTarget?: string | null
  className?: string
}) {
  if (!category && !deviceTarget) return null

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {category && <Chip>{testCategoryLabel(category)}</Chip>}
      {deviceTarget && <Chip>{deviceTargetLabel(deviceTarget)}</Chip>}
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block font-mono text-[12px] font-medium tracking-[0.5px] text-ink bg-surface border border-line rounded-[4px] px-2 py-0.5">
      {children}
    </span>
  )
}
