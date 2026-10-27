import Link from "next/link"
import type { Metadata } from "next"
import { Check } from "lucide-react"
import { PlusMorphIcon } from "@/components/ui/PlusMorphIcon"
import {
  BTN_SECONDARY,
  H1,
  H2,
  H3,
  LINK_INLINE,
  META,
  P,
  P_SMALL,
} from "@/components/public/prose"
import { PLANS, SIGNUP_GRANT, priceLine, type Plan } from "@/lib/plans"
import { PLAN_IDS, type PlanId } from "@/lib/vocabulary"
import { Reveal } from "@/components/public/Reveal"

export const metadata: Metadata = {
  title: "Pricing — Twnhall",
  description:
    `Community is free: three tester reports to start, and one more for every report you write. Starter is ${priceLine(PLANS.starter)} for five a month; Pro is ${priceLine(PLANS.pro)} for ten.`,
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
 *   2. The paid calls to action are /contact, worded as a conversation. Never
 *      "Subscribe" or "Upgrade" — a dead checkout is worse than an honest one.
 *   3. Nothing unshipped is listed. A pricing table is a promise.
 *
 * Use the plan's vocabulary exactly: tester report, testers per mission, active
 * missions. Do not substitute "session", "credit" or "feedback".
 *
 * No tier is featured and none is "best value": Starter and Pro cost the same
 * per report, deliberately (compensation doc §7.3), so a badge would be false.
 * Prices are lib/plans.ts's, as written — nothing here converts a currency.
 */

const TIERS = PLAN_IDS.map((id) => PLANS[id])
const { starter: STARTER, pro: PRO } = PLANS

/** The comparison, one value per tier in PLAN_IDS order. Row order is the
 *  plan's. The numeric rows come from lib/plans.ts; the rest is copy. */
const ROWS: { label: string; values: string[]; emphasis?: boolean }[] = [
  { label: "Projects", values: TIERS.map(() => "Unlimited") },
  {
    label: "Tester reports",
    values: TIERS.map((t) => (t.monthlyReports ? `${t.monthlyReports} a month` : `${SIGNUP_GRANT} to start`)),
    emphasis: true,
  },
  {
    label: "Earn extra reports by testing",
    values: TIERS.map((t) => (t.id === "community" ? "+1 per report you complete" : "Same")),
  },
  { label: "Testers per test case", values: TIERS.map((t) => `Up to ${t.testersPerMission}`) },
  { label: "Active test cases at once", values: TIERS.map((t) => String(t.activeMissions)) },
  { label: "AI insights", values: TIERS.map((t) => (t.id === "community" ? "3 / month" : "Unlimited")) },
  { label: "CSV export", values: TIERS.map(() => "Included") },
]

/** Each card's call to action. Paid tiers open a conversation — see 2. above. */
const CTA: Record<PlanId, { href: string; label: string }> = {
  community: { href: "/signup", label: "Start testing" },
  starter: { href: "/contact", label: "Ask about Starter" },
  pro: { href: "/contact", label: "Ask about Pro" },
}

/** Every answer here is something the product does today — see CLAUDE.md,
 *  "The report allowance is a ledger". */
const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "What is a tester report?",
    a: "A real person tests your product and sends you a structured report — what they did, what broke, with screenshots. Every tier gets the same report: the full audit log, step by step.",
  },
  {
    q: "What do testers per test case and active test cases mean?",
    a: "Testers per test case is how many people you can put on any one test. Active test cases is how many tests you can have open at the same time.",
  },
  {
    q: "How do I earn extra reports?",
    a: "Test someone else's product. Every report you write as a tester adds one to your own balance, on every plan. That is the whole idea: test reports you earn, or test reports you buy.",
  },
  {
    q: "What happens if I run low on reports?",
    a: "Your test case still opens, with as many testers as your balance covers, and we tell you so beside the publish button. Only an empty balance keeps a test case in draft. Testers are never turned away mid-report.",
  },
  {
    q: "What is the difference between Starter and Pro?",
    a: `Size, nothing else. Starter's ${STARTER.monthlyReports} reports a month are one full round — five testers on one test case. Pro's ${PRO.monthlyReports} are two: test, fix, then test the fix. A report costs the same on either, so pick the one that matches how often you ship.`,
  },
  {
    q: "Do unused monthly reports roll over?",
    a: `No. Starter's ${STARTER.monthlyReports} and Pro's ${PRO.monthlyReports} arrive each calendar month and expire with it. Reports from a test case you close early go back to the month they came from. Reports you earn by testing do not expire.`,
  },
  {
    q: "How do I pay for Starter or Pro?",
    a: (
      <>
        There is no checkout. Both start as a conversation — we are a small
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
        create another test case. The honest caveat — this holds for qualitative
        usability testing, which is what Twnhall does, not for quantitative
        work like A/B or load testing.
      </>
    ),
  },
]

function PlanCard({ plan, step }: { plan: Plan; step: number }) {
  // Naira is the figure; the dollar rides in the note. Both as written in
  // lib/plans.ts — never converted here.
  const amount = plan.price?.naira ?? "Free"
  const note = plan.price ? `/ month · ${plan.price.dollars}` : "forever"
  return (
    // Cheapest first, each a beat after the last.
    <Reveal step={step} className="flex flex-col rounded-[12px] border border-line bg-surface-raised p-5 medium:p-6 lg:p-8">
      <h3 className={H3}>{plan.name}</h3>
      {/* The min height only aligns the three cards side by side, from 1024px. */}
      <p className={`${P_SMALL} mt-2 lg:min-h-[96px]`}>{plan.summary}</p>
      <p className="mt-6 font-syne font-bold text-[40px] leading-[48px] text-ink">
        {amount}
        <span className="font-mono font-normal text-[14px] text-ink-muted">
          {" "}
          {note}
        </span>
      </p>
      <div className="mt-6">
        {/* The header's Get started is the page's one Voltage fill. */}
        <Link href={CTA[plan.id].href} className={`${BTN_SECONDARY} w-full`}>
          {CTA[plan.id].label}
        </Link>
      </div>
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
    </Reveal>
  )
}

export default function PricingPage() {
  return (
    <div className="flex-1 w-full max-w-[1200px] mx-auto px-4 medium:px-6 lg:px-8 pt-16 pb-10 medium:pt-20 medium:pb-16 lg:py-24">
      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-4 text-center mb-10 medium:mb-16">
        <Reveal>
          <h1 className={H1}>
            Test reports you earn, or test reports you buy.
          </h1>
        </Reveal>
        <Reveal step={1}>
        <p className={`${P} max-w-2xl`}>
          Test someone else&apos;s product and you earn a report on your own.
          Community is free and always will be. Starter and Pro are for
          builders who would rather buy their reports than earn them — one
          round of testing a month, or two.
        </p>
        </Reveal>
      </div>

      {/* ─── The three tiers ───────────────────────────────────────────── */}
      <section aria-labelledby="tiers-heading" className="mb-16 medium:mb-24">
        <h2 id="tiers-heading" className="sr-only">
          Plans
        </h2>
        {/* Stacked until 1024px, at a readable width rather than the full
            tablet line; three across at 840 left each card ~250px. Cheapest
            first, so on a phone the free tier is the first thing you read. */}
        <div className="grid gap-6 max-w-[560px] mx-auto lg:max-w-none lg:grid-cols-3">
          {TIERS.map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} step={i} />
          ))}
        </div>
        <Reveal step={3}>
          <p className={`${META} mt-6 text-center`}>
            There is no checkout. Starter and Pro start as a conversation.
          </p>
        </Reveal>
      </section>

      {/* ─── The comparison ────────────────────────────────────────────── */}
      <Reveal as="section" aria-labelledby="compare-heading" className="mb-16 medium:mb-24 max-w-[880px] mx-auto">
        <h2 id="compare-heading" className={`${H2} mb-8`}>
          Compare plans
        </h2>
        {/* Below 840px a four-column table either scrolls or wraps a value to
            four lines, so each row becomes a block: the feature, then one line
            per plan. Both render from ROWS, and display:none keeps the hidden
            copy out of the accessibility tree, as the footer does. */}
        <ul aria-label="Community, Starter and Pro compared, feature by feature" className="expanded:hidden border-t border-line">
          {ROWS.map(({ label, values, emphasis }) => (
            <li key={label} className="flex flex-col gap-3 py-4 border-b border-line">
              <p className={`font-sans text-[14px] leading-6 text-ink ${emphasis ? "font-medium" : ""}`}>{label}</p>
              <dl className="flex flex-col gap-2">
                {TIERS.map((plan, i) => (
                  <div key={plan.id} className="flex items-baseline justify-between gap-4">
                    <dt className={`${META} uppercase`}>{plan.name}</dt>
                    <dd className="font-mono text-[14px] text-ink text-right">{values[i]}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
        {/* From 840px the table fits its min width; overflow-x-auto stays as
            a guard so the page body never scrolls sideways. */}
        <div className="hidden expanded:block overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <caption className="sr-only">
              Community, Starter and Pro compared, feature by feature
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-4 pr-4 font-mono text-[12px] font-medium uppercase tracking-[1px] text-ink-muted">
                  Feature
                </th>
                {TIERS.map((plan) => (
                  <th key={plan.id} scope="col" className="py-4 px-4 last:pr-0 font-mono text-[14px] font-medium text-ink">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(({ label, values, emphasis }) => (
                <tr key={label} className="border-b border-line">
                  <th
                    scope="row"
                    className={`py-4 pr-4 font-sans text-[14px] leading-6 text-ink ${emphasis ? "font-medium" : "font-normal"}`}
                  >
                    {label}
                  </th>
                  {values.map((value, i) => (
                    <td key={TIERS[i].id} className="py-4 px-4 last:pr-0 font-mono text-[14px] text-ink">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      {/* ─── FAQ ───────────────────────────────────────────────────────── */}
      <Reveal as="section" aria-labelledby="faq-heading" className="mb-16 medium:mb-24 max-w-[880px] mx-auto">
        <h2 id="faq-heading" className={`${H2} mb-8`}>
          Questions and answers
        </h2>
        {/* ponytail: native <details> — keyboard and screen reader support
            for free, no client JS. The motion is CSS (.th-accordion,
            .th-plus); `name` makes them one group, so opening a question
            closes the last, as GitHub's does. */}
        <div className="border-t border-line">
          {FAQ.map(({ q, a }) => (
            <details key={q} name="pricing-faq" className="th-accordion group border-b border-line">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 medium:py-6 font-mono font-medium text-[16px] text-ink rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink [&::-webkit-details-marker]:hidden">
                {q}
                <PlusMorphIcon className="shrink-0 text-ink-muted" />
              </summary>
              <p className={`${P} pb-6 max-w-2xl`}>{a}</p>
            </details>
          ))}
        </div>
      </Reveal>

      {/* ─── Close ─────────────────────────────────────────────────────── */}
      <Reveal
        as="section"
        aria-labelledby="close-heading"
        className="flex flex-col items-center gap-6 rounded-[12px] border border-line bg-surface-raised px-5 py-10 medium:px-6 medium:py-16 text-center max-w-[880px] mx-auto"
      >
        <h2 id="close-heading" className={H2}>
          Ship it to five real people.
        </h2>
        <p className={`${P} max-w-xl`}>
          Start free with {SIGNUP_GRANT} tester reports. Earn more by testing.
        </p>
        {/* Full-width stacked buttons on compact, a wrapping row from 600px. */}
        <div className="flex flex-col self-stretch gap-4 medium:flex-row medium:flex-wrap medium:justify-center medium:self-auto">
          <Link href="/signup" className={`${BTN_SECONDARY} w-full medium:w-auto`}>
            Create an account
          </Link>
          <Link href="/guides/builder" className={`${BTN_SECONDARY} w-full medium:w-auto`}>
            Read the builder guide
          </Link>
        </div>
      </Reveal>
    </div>
  )
}
