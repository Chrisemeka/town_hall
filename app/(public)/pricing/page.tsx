import Link from "next/link"
import type { Metadata } from "next"
import { signInWithGoogle } from "@/actions/auth"
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  EYEBROW,
  H3,
  LINK_INLINE,
  META,
  P,
  PageHeader,
} from "@/components/public/prose"

export const metadata: Metadata = {
  title: "Pricing — Twnhall",
  description:
    "Community is free: five tester reports a month, and more when you test for others. Pro is $19/month for twenty.",
}

/*
 * Content is from docs/Twnhall_Monetisation_Plan_v4.docx §2, §3 and §5.
 *
 * NOTHING ON THIS PAGE IS ENFORCED IN CODE YET. There is no report counter, no
 * per-mission tester ceiling and no active-mission limit — tier enforcement is
 * item 3 in the plan's build order and is not built. That is deliberate (it is
 * the plan's Phase 2: ration honestly, no payment, the upgrade button opens a
 * conversation) and it binds this page in three ways:
 *
 *   1. It describes the shape of the offer, never the state of an account.
 *      No "you're on Community", no usage meter, no upgrade toggle.
 *   2. The Pro call to action is /contact, worded as a conversation. Never
 *      "Subscribe" or "Upgrade" — a dead checkout is worse than an honest one.
 *   3. Nothing unshipped is listed. The plan's tier table has a "Video feedback
 *      — later, once built" row; a pricing table is a promise, so it is not on
 *      the page.
 *
 * Use the plan's vocabulary exactly: tester report, testers per mission, active
 * missions. Do not substitute "session", "credit" or "feedback".
 */

const TERMS = [
  {
    term: "Tester report",
    gloss:
      "A real person tests your product and sends you a structured report — what they did, what broke, with screenshots.",
  },
  {
    term: "Testers per mission",
    gloss: "How many testers you can put on any one test.",
  },
  {
    term: "Active missions",
    gloss: "How many tests you have open at the same time.",
  },
]

/** The comparison. Row order is the plan's. A dash renders as "—" with the row
 *  header carrying the meaning, so no cell states anything by colour alone. */
const ROWS: { label: string; community: string; pro: string; emphasis?: boolean }[] = [
  { label: "Projects", community: "Unlimited", pro: "Unlimited" },
  {
    label: "Tester reports per month",
    community: "5",
    pro: "20",
    emphasis: true,
  },
  {
    label: "Earn extra reports by testing",
    community: "+1 per report you complete",
    pro: "Same",
  },
  { label: "Testers per mission", community: "Up to 5", pro: "Up to 8" },
  { label: "Active missions at once", community: "2", pro: "5" },
  { label: "AI insights", community: "3 / month", pro: "Unlimited" },
  { label: "CSV export", community: "Included", pro: "Included" },
  { label: "Shareable report", community: "—", pro: "Included" },
  { label: "Priority in the tester queue", community: "—", pro: "Included" },
]

export default function PricingPage() {
  return (
    <div className="flex-1 w-full max-w-[1200px] mx-auto px-6 lg:px-8 py-16 lg:py-24">
      <PageHeader
        eyebrow="Pricing"
        title="Feedback you earn, or feedback you buy."
        lede="Twnhall runs on reciprocity: test someone else's product and you earn a report on your own. Community is free and always will be. Pro is for builders who would rather not test — usually because there is no one on the team to do it."
      />

      <p className={`${P} max-w-2xl mb-16`}>
        Both tiers get the same thing when a report arrives: the full audit log,
        step by step, with the tester&apos;s screenshots attached. The difference
        is how many you get and how fast.
      </p>

      {/* ─── The three words the rest of the page uses ─────────────────── */}
      <section aria-labelledby="terms-heading" className="mb-16">
        <h2 id="terms-heading" className={`${EYEBROW} mb-6`}>
          What the numbers mean
        </h2>
        <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TERMS.map(({ term, gloss }) => (
            <div
              key={term}
              className="flex flex-col gap-2 rounded-[12px] border border-line bg-surface-raised p-6"
            >
              <dt className="font-mono font-medium text-[14px] text-ink">
                {term}
              </dt>
              <dd className="font-sans text-[14px] leading-6 text-ink">
                {gloss}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ─── The two tiers ─────────────────────────────────────────────── */}
      <section aria-labelledby="tiers-heading" className="mb-12">
        <h2 id="tiers-heading" className="sr-only">
          Plans
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-[12px] border border-line bg-surface-raised p-8">
            <h3 className={H3}>Community</h3>
            <p className="font-syne font-bold text-[36px] leading-10 text-ink">
              Free
            </p>
            <p className="font-sans text-[14px] leading-6 text-ink">
              Five tester reports a month, and one more for every report you
              write as a tester.
            </p>
            <form action={signInWithGoogle} className="mt-2">
              <button type="submit" className={BTN_SECONDARY}>
                Start testing
              </button>
            </form>
          </div>

          <div className="flex flex-col gap-4 rounded-[12px] border border-accent-ink bg-surface-raised p-8">
            <div className="flex items-center gap-3">
              <h3 className={H3}>Pro</h3>
              {/* Design.md §7.5 — one of only two attention-grabbing extras
                  permitted, and the page's single Voltage fill. */}
              <span className="rounded-[4px] bg-accent px-2 py-0.5 font-mono font-medium text-[12px] tracking-[0.5px] text-obsidian">
                For teams without testers
              </span>
            </div>
            <p className="font-syne font-bold text-[36px] leading-10 text-ink">
              $19
              <span className="font-mono font-normal text-[14px] text-ink-muted">
                {" "}
                / month · ₦10–12k
              </span>
            </p>
            <p className="font-sans text-[14px] leading-6 text-ink">
              Twenty tester reports a month, eight testers on a mission, and
              your missions surface first in the tester queue.
            </p>
            <Link href="/contact" className={`${BTN_PRIMARY} mt-2`}>
              Hitting your limit? Get in touch
            </Link>
          </div>
        </div>
        <p className={`${META} mt-4`}>
          There is no checkout. Pro starts as a conversation — we are a small
          cohort and we would rather talk to you first.
        </p>
      </section>

      {/* ─── The comparison ────────────────────────────────────────────── */}
      <section aria-labelledby="compare-heading" className="mb-16">
        <h2 id="compare-heading" className={`${EYEBROW} mb-6`}>
          Side by side
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

      {/* ─── Why five ──────────────────────────────────────────────────── */}
      <section
        aria-labelledby="five-heading"
        className="rounded-[12px] border-l-2 border-accent-ink bg-surface-raised p-8 max-w-3xl"
      >
        <h2 id="five-heading" className={`${H3} mb-4`}>
          Why five testers, and not fifty
        </h2>
        <p className={P}>
          Five people find around 85% of the usability problems in what
          they&apos;re testing. Past that you are paying to rediscover the same
          issues. The finding is the{" "}
          <a
            href="https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_INLINE}
          >
            Nielsen Norman Group&apos;s
          </a>
          , and it is one of the most cited results in the field.
        </p>
        <p className={`${P} mt-4`}>
          So the cap is a method, not a ration. Testing a different flow? Create
          another mission. Ten missions of five beats one mission of fifty.
        </p>
        <p className={`${META} mt-4`}>
          The honest caveat: this holds for qualitative usability testing, which
          is what Twnhall does. It does not hold for quantitative work — task
          success rates, A/B tests, load testing — where you need far more
          people for a result to mean anything.
        </p>
      </section>
    </div>
  )
}
