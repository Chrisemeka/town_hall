import { MissionChips, TestCaseView } from "@/components/missions/TestCaseView"

/**
 * The top of the tester's mission page — title, project card, notes, chips and
 * test steps.
 *
 * Lifted verbatim out of app/(tester)/mission/[id]/page.tsx so the builder's
 * preview renders the tester's own markup rather than a copy of it. A preview
 * with its own version of this drifts, and a preview that lies is worse than
 * none. Change what testers see here, and the preview follows.
 */
export function MissionBrief({
  title,
  project,
  notes,
  category,
  deviceTarget,
  steps,
}: {
  title: string
  project: { name: string; app_url: string | null; description: string | null } | null
  notes: string | null
  category: string | null
  deviceTarget: string | null
  /** Raw — TestCaseView parses it. */
  steps: unknown
}) {
  return (
    <>
      {/* Mission title */}
      <h2 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-ink mb-6">
        {title}
      </h2>

      {/* Project context card */}
      <div
        id="tour-mission-project"
        className="mb-8 border border-line"
        style={{ background: "var(--color-surface-raised)", borderRadius: 12, padding: "20px 24px" }}
      >
        <h5 className="font-syne font-bold text-[18px] text-ink mb-1">
          {project?.name}
        </h5>
        {project?.app_url && (
          <a
            href={project.app_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[13px] text-info-ink hover:underline block mb-2 truncate"
          >
            {project.app_url.replace(/^https?:\/\//, "")}
          </a>
        )}
        {project?.description && (
          <p className="font-mono text-[14px] text-ink-muted leading-5">
            {project.description}
          </p>
        )}
      </div>

      <div className="mb-8">
        {/* Optional since 20260907_01. Omitted rather than empty-stated: the
            test case is directly below, so an absent notes block is a missing
            block, not a screen with nothing on it (Design.md §8). */}
        {notes && (
          <div className="mb-6">
            <p
              className="font-mono text-[11px] font-medium uppercase text-accent-ink mb-3"
              style={{ letterSpacing: "1px" }}
            >
              Notes from the Builder
            </p>
            <div
              style={{
                background: "rgba(232,255,71,0.05)",
                borderLeft: "3px solid var(--color-accent-ink)",
                borderRadius: "0 8px 8px 0",
                padding: "16px 20px",
              }}
            >
              <p className="font-mono text-[16px] text-ink leading-6 whitespace-pre-wrap">
                {notes}
              </p>
            </div>
          </div>
        )}

        <MissionChips category={category} deviceTarget={deviceTarget} />

        {/* The tour's first step anchors here rather than on the notes above,
            which a mission need not have. */}
        <div id="tour-mission-testcase">
          <p className="font-mono text-[12px] text-accent-ink uppercase tracking-[1px] mt-6 mb-3">
            Test steps
          </p>
          <TestCaseView steps={steps} />
        </div>
      </div>
    </>
  )
}
