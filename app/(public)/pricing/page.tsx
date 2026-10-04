import Link from "next/link"
import type { Metadata } from "next"
import { Check, Plus } from "lucide-react"
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  H2,
  H3,
  LINK_INLINE,
  META,
  P,
  P_SMALL,
} from "@/components/public/prose"
import { PLANS, SIGNUP_GRANT, type Plan } from "@/lib/plans"

export const metadata: Metadata = {
  title: "Pricing — Twnhall",
  description:
    "Community is free: three tester reports to start, and one more for every report you write. Pro is $19/month for ten a month.",
}

/*
 * Layout after cursor.com/pricing: centred hero, plan cards with a checked
 * "Includes" list, the comparison, a FAQ, a closing call to action.
 *
 * Content is from docs/Twnhall_Monetisation_Plan_v4.docx §2 and §5, with the
 * tiers from docs/Twnhall_Cohort_Compensation_Model.md §7 and §8. The card
 * lists and table numbers are read from lib/plans.ts, the same source
 * /settings renders.
 *
 * The report, tester-per-mission and active-mission numbers are enforced at
 * publish (lib/allowance.ts). There is still no payment, and that binds this
 * page in three ways:
 *
 *   1. It describes the shape of the offer, never the state of an account.
 *      No "you're on Community", no usage meter — and no monthly/yearly
 *      toggle, which Cursor has and we cannot honour.
 *   2. The Pro call to action is /contact, worded as a conversation. Never
 *      "Subscribe" or "Upgrade" — a dead checkout is worse than an honest one.
 *   3. Nothing unshipped is listed. A pricing table is a promise.
 *
 * Use the plan's vocabulary exactly: tester report, testers per mission, active
 * missions. Do not substitute "session", "credit" or "feedback".
 */

const { community: COMMUNITY, pro: PRO } = PLANS

/** The comparison. Row order is the plan's. The numeric rows come from
 *  lib/plans.ts; the rest is copy. */
const ROWS: { label: string; community: string; pro: string; emphasis?: boolean }[] = [
  { label: "Projects", community: "Unlimited", pro: "Unlimited" },
  {
    label: "Tester reports",
    community: `${SIGNUP_GRANT} to start`,
    pro: `${PRO.monthlyReports} a month`,
    emphasis: true,
  },
  {
    label: "Earn extra reports by testing",
    community: "+1 per report you complete",
    pro: "Same",
  },
  {
    label: "Testers per mission",
    community: `Up to ${COMMUNITY.testersPerMission}`,
    pro: `Up to ${PRO.testersPerMission}`,
  },
  {
    label: "Active missions at once",
    community: String(COMMUNITY.activeMissions),
    pro: String(PRO.activeMissions),
  },
  { label: "AI insights", community: "3 / month", pro: "Unlimited" },
  { label: "CSV export", community: "Included", pro: "Included" },
]

/** Every answer here is something the product does today — see CLAUDE.md,
 *  "The report allowance is a ledger". */
const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "What is a tester report?",
    a: "A real person tests your product and sends you a structured report — what they did, what broke, with screenshots. Every tier gets the same report: the full audit log, step by step.",
  },
  {
    q: "What do testers per mission and active missions mean?",
    a: "Testers per mission is how many people you can put on any one test. Active missions is how many tests you can have open at the same time.",
  },
  {
    q: "How do I earn extra reports?",
    a: "Test someone else's product. Every report you write as a tester adds one to your own balance, on either plan. That is the whole idea: feedback you earn, or feedback you buy.",
  },
  {
    q: "What happens if I run low on reports?",
    a: "Your mission still opens, with as many testers as your balance covers, and we tell you so beside the publish button. Only an empty balance keeps a mission in draft. Testers are never turned away mid-report.",
  },
  {
    q: "Do unused Pro reports roll over?",
    a: "No. Pro's ten arrive each calendar month and expire with it. Reports from a mission you close early go back to the month they came from. Reports you earn by testing do not expire.",
  },
  {
    q: "How do I pay for Pro?",
    a: (
      <>
        There is no checkout. Pro starts as a conversation — we are a small
        cohort and we would rather talk to you first.{" "}
        <Link href="/contact" className={LINK_INLINE}>
          Get in touch
        </Link>
        .
      </>
    ),
  },
  {
    q: "Why five testers, and not fifty?",
    a: (
      <>
        Five people find around 85% of the usability problems in what
        they&apos;re testing; past that you are paying to rediscover the same
        issues. The finding is the{" "}
        <a
          href="https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/"
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_INLINE}
        >
          Nielsen Norman Group&apos;s
        </a>
        . So the cap is a method, not a ration: testing a different flow,
        create another mission. The honest caveat — this holds for qualitative
        usability testing, which is what Twnhall does, not for quantitative
        work like A/B or load testing.
      </>
    ),
  },
]

function PlanCard({
  plan,
  priceNote,
  cta,
}: {
  plan: Plan
  priceNote: string
  cta: React.ReactNode
}) {
  // "$19/month · ₦10–12k" → "$19"; the note beside it carries the rest.
  const amount = plan.price.split(/[/ ]/)[0]
  return (
    <div className="flex flex-col rounded-[12px] border border-line bg-surface-raised p-8">
      <h3 className={H3}>{plan.name}</h3>
      <p className={`${P_SMALL} mt-2 min-h-[56px]`}>{plan.summary}</p>
      <p className="mt-6 font-syne font-bold text-[40px] leading-[48px] text-ink">
        {amount}
        <span className="font-mono font-normal text-[14px] text-ink-muted">
          {" "}
          {priceNote}
        </span>
      </p>
      <div className="mt-6 [&>*]:w-full">{cta}</div>
      <div className="mt-8 border-t border-line pt-6">
        <p className={`${META} mb-4`}>Includes</p>
        <ul className="flex flex-col gap-3">
          {plan.includes.map((line) => (
            <li key={line} className="flex gap-3 font-sans text-[14px] leading-6 text-ink">
              <Check aria-hidden size={16} className="mt-1 shrink-0 text-accent-ink" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function PricingPage() {
  return (
    <div className="flex-1 w-full max-w-[1200px] mx-auto px-6 lg:px-8 py-16 lg:py-24">
      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-4 text-center mb-16">
        <h1 className="font-syne font-bold text-[40px] leading-[48px] lg:text-[56px] lg:leading-[60px] tracking-[-0.5px] text-ink">
          Feedback you earn, or feedback you buy.
        </h1>
        <p className={`${P} max-w-2xl`}>
          Test someone else&apos;s product and you earn a report on your own.
          Community is free and always will be. Pro is for builders with no one
          on the team to spare for testing.
        </p>
      </div>

      {/* ─── The two tiers ─────────────────────────────────────────────── */}
      <section aria-labelledby="tiers-heading" className="mb-24">
        <h2 id="tiers-heading" className="sr-only">
          Plans
        </h2>
        <div className="grid gap-6 md:grid-cols-2 max-w-[880px] mx-auto">
          <PlanCard
            plan={COMMUNITY}
            priceNote="forever"
            cta={
              <Link href="/signup" className={BTN_SECONDARY}>
                Start testing
              </Link>
            }
          />
          <PlanCard
            plan={PRO}
            priceNote="/ month"
            cta={
              <Link href="/contact" className={BTN_PRIMARY}>
                Hitting your limit? Get in touch
              </Link>
            }
          />
        </div>
        <p className={`${META} mt-6 text-center`}>
          There is no checkout. Pro starts as a conversation.
        </p>
      </section>

      {/* ─── The comparison ────────────────────────────────────────────── */}
      <section aria-labelledby="compare-heading" className="mb-24 max-w-[880px] mx-auto">
        <h2 id="compare-heading" className={`${H2} mb-8`}>
          Compare plans
        </h2>
        {/* Wide tables get their own scroll container so the page body never
            scrolls horizontally at 360px. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <caption className="sr-only">
              Community and Pro compared, feature by feature
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-4 pr-4 font-mono text-[12px] font-medium uppercase tracking-[1px] text-ink-muted">
                  Feature
                </th>
                <th scope="col" className="py-4 px-4 font-mono text-[14px] font-medium text-ink">
                  Community
                </th>
                <th scope="col" className="py-4 pl-4 font-mono text-[14px] font-medium text-ink">
                  Pro
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(({ label, community, pro, emphasis }) => (
                <tr key={label} className="border-b border-line">
                  <th
                    scope="row"
                    className={`py-4 pr-4 font-sans text-[14px] leading-6 text-ink ${emphasis ? "font-medium" : "font-normal"}`}
                  >
                    {label}
                  </th>
                  <td className="py-4 px-4 font-mono text-[14px] text-ink">
                    {community}
                  </td>
                  <td className="py-4 pl-4 font-mono text-[14px] text-ink">
                    {pro}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── FAQ ───────────────────────────────────────────────────────── */}
      <section aria-labelledby="faq-heading" className="mb-24 max-w-[880px] mx-auto">
        <h2 id="faq-heading" className={`${H2} mb-8`}>
          Questions and answers
        </h2>
        {/* ponytail: native <details> — keyboard and screen reader support
            for free, no client JS. */}
        <div className="border-t border-line">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-6 font-mono font-medium text-[16px] text-ink rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink [&::-webkit-details-marker]:hidden">
                {q}
                <Plus
                  aria-hidden
                  size={16}
                  className="shrink-0 text-ink-muted transition-transform duration-150 group-open:rotate-45"
                />
              </summary>
              <p className={`${P} pb-6 max-w-2xl`}>{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ─── Close ─────────────────────────────────────────────────────── */}
      <section
        aria-labelledby="close-heading"
        className="flex flex-col items-center gap-6 rounded-[12px] border border-line bg-surface-raised px-6 py-16 text-center max-w-[880px] mx-auto"
      >
        <h2 id="close-heading" className={H2}>
          Ship it to five real people.
        </h2>
        <p className={`${P} max-w-xl`}>
          Start free with {SIGNUP_GRANT} tester reports. Earn more by testing.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/signup" className={BTN_SECONDARY}>
            Create an account
          </Link>
          <Link href="/guides/builder" className={BTN_SECONDARY}>
            Read the builder guide
          </Link>
        </div>
      </section>
    </div>
  )
}
