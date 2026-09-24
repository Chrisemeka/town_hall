import Link from "next/link"
import { Check } from "lucide-react"
import { otherPlan, planFor } from "@/lib/plans"
import type { PlanId } from "@/lib/vocabulary"
import { SettingsSection } from "@/components/settings/SettingsSection"

/**
 * Which plan this account is on, and what the other one includes.
 *
 * THERE IS NO CHECKOUT, and this section is closer to that danger than
 * /pricing is: it sits inside an account, so a control here reads as "change
 * my plan" rather than "read about plans". Upgrading opens a conversation —
 * the monetisation plan's Phase 2 — so the call to action is /contact and is
 * never a Subscribe or Upgrade button.
 *
 * It also shows no usage. No "3 of 5 reports used", no meter, no renewal date:
 * nothing counts any of that, and a meter reading zero would be a lie about a
 * limit that is not enforced. CLAUDE.md's Do Not Touch entry on the pricing
 * page's honesty applies here word for word.
 */
export function PlanSection({ planId }: { planId: PlanId }) {
  const current = planFor(planId)
  const other = otherPlan(planId)

  return (
    <SettingsSection
      title="Plan"
      description="What your account includes, and what the other tier does."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-[12px] border border-accent-ink p-6">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h3 className="font-syne font-bold text-[18px] text-ink">
              {current.name}
            </h3>
            {/* The current plan is named in words, not just outlined — colour
                and a border are never the only signal (Design.md §10). */}
            <span className="font-mono text-[12px] uppercase tracking-[0.5px] text-accent-ink">
              Your plan
            </span>
          </div>
          <p className="font-mono text-[14px] text-ink mt-1">{current.price}</p>
          <p className="font-sans text-[14px] leading-6 text-ink mt-3">
            {current.summary}
          </p>
          <ul className="mt-5 flex flex-col gap-2">
            {current.includes.map((line) => (
              <li key={line} className="flex gap-2 font-sans text-[14px] leading-6 text-ink">
                <Check size={14} aria-hidden="true" className="mt-1.5 shrink-0 text-accent-ink" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[12px] border border-line p-6">
          <h3 className="font-syne font-bold text-[18px] text-ink">{other.name}</h3>
          <p className="font-mono text-[14px] text-ink mt-1">{other.price}</p>
          <p className="font-sans text-[14px] leading-6 text-ink mt-3">
            {other.summary}
          </p>
          <ul className="mt-5 flex flex-col gap-2">
            {other.includes.map((line) => (
              <li key={line} className="flex gap-2 font-sans text-[14px] leading-6 text-ink">
                <Check size={14} aria-hidden="true" className="mt-1.5 shrink-0 text-ink-muted" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-line">
        <p className="font-sans text-[14px] leading-6 text-ink">
          {planId === "pro"
            ? "Need to change something about your plan? Tell us and we'll sort it."
            : "Hitting your limit, or want to skip the testing side? Get in touch — there's no checkout, we'd rather talk first."}
        </p>
        <Link
          href="/contact"
          className="mt-4 inline-flex h-11 px-6 items-center rounded-[8px] border border-ink-muted text-ink font-mono font-medium text-[14px] hover:bg-ink/[0.06] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
        >
          Get in touch
        </Link>
      </div>
    </SettingsSection>
  )
}
