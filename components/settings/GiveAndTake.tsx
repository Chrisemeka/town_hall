import Link from "next/link"
import {
  formatRating,
  formatRatio,
  ratioCaption,
  type Reciprocity,
} from "@/lib/reciprocity"
import { Metric, SettingsSection } from "@/components/settings/SettingsSection"

/**
 * What this person has given and what they have taken.
 *
 * Called "Give and take" rather than "Reciprocity" — the second is a word
 * people have to translate, and this section is about a mechanic they already
 * understand: you test for someone, someone tests for you.
 *
 * Everything here is counted from `test_results` as it stands. There is no
 * monthly budget and no earned-report balance, because neither is enforced
 * anywhere — and a number that looks like an allowance, on a page with a plan
 * section next to it, will be read as one.
 */
export function GiveAndTake({
  stats,
  hasTesterAccount,
}: {
  stats: Reciprocity
  hasTesterAccount: boolean
}) {
  // Somebody who has never had a tester account is not a tester with a score
  // of nothing. A prompt, not a wall of zeros.
  if (!hasTesterAccount) {
    return (
      <SettingsSection
        title="Give and take"
        description="Twnhall runs on reciprocity: test someone else's product and you earn a report on your own."
      >
        <p className="font-sans text-[14px] leading-6 text-ink">
          You don&apos;t have a tester account yet, so there&apos;s nothing to
          count. Adding one is how you earn reports on your own work.
        </p>
        <p className="font-mono text-[13px] text-ink-muted mt-4">
          The control for that is in the Account tab.
        </p>
      </SettingsSection>
    )
  }

  // A brand-new account. Design.md §8: say what would fill this in.
  if (stats.empty) {
    return (
      <SettingsSection
        title="Give and take"
        description="What you've tested for others, and what's come back on your own work."
      >
        <div className="py-8 text-center">
          <p className="font-syne font-bold text-[20px] leading-7 text-ink">
            Nothing counted yet.
          </p>
          <p className="font-sans text-[14px] leading-6 text-ink mt-2 max-w-md mx-auto">
            Pick up a mission and file a report, and this fills in.
          </p>
          <Link
            href="/explore/missions"
            className="mt-6 inline-flex h-11 px-6 items-center rounded-[8px] border border-ink-muted text-ink font-mono font-medium text-[14px] hover:bg-ink/[0.06] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
          >
            Browse missions
          </Link>
        </div>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection
      title="Give and take"
      description="What you've tested for others, and what's come back on your own work."
    >
      {/* Two columns at 360px would put a long label beside its own figure.
          One column until there is room for two. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Metric value={String(stats.given)} label="Reports written" />
        <Metric value={String(stats.received)} label="Reports received" />
        <Metric
          value={formatRatio(stats.ratio)}
          label="Give / take"
          hint={ratioCaption(stats)}
        />
        <Metric value={formatRating(stats.rating)} label="Average rating" />
        <Metric
          value={String(stats.approved)}
          label="Approved"
          hint={`of ${stats.given} you wrote`}
        />
      </div>
    </SettingsSection>
  )
}
