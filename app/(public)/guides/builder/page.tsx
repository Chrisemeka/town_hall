import Link from "next/link"
import type { Metadata } from "next"
import { DocLayout } from "@/components/public/DocNav"
import { docSection } from "@/lib/docNav"
import {
  H3,
  LINK_INLINE,
  META,
  P,
  PageHeader,
  Section,
  UL,
} from "@/components/public/prose"
import {
  DEVICE_TARGETS,
  ENTRY_STATUS_HINTS,
  TEST_CATEGORY_BLURBS,
  deviceTargetLabel,
  entryStatusLabel,
  testCategoryLabel,
} from "@/lib/vocabulary"
import {
  PROJECT_SUMMARY_MAX,
  STEP_ACTION_MAX,
  STEP_EXPECTED_MAX,
} from "@/lib/validation/schemas"
import { TEST_TEMPLATES } from "@/lib/testTemplates"

export const metadata: Metadata = {
  title: "Guide for builders — Twnhall",
  description:
    "How to set up a project, write a test case people can actually follow, and read the audit log that comes back.",
}

/*
 * SOURCE OF TRUTH IS THE CODE, NOT THIS PAGE.
 *
 * Every number here is imported from the constant that enforces it, and every
 * status hint and category blurb is read from lib/vocabulary.ts rather than
 * retyped — a guide that contradicts the form is worse than no guide, and prose
 * drifts silently where a type would not. scripts/guides.test.mts asserts the
 * vocabulary strings still appear.
 *
 * One thing this guide must NOT say: that a builder chooses how many testers to
 * put on a mission. They don't: publishing asks for the plan's five, capped by
 * the report balance, and writes the result to missions.testers_needed.
 * Section 6 below therefore explains the five-tester rule as method and mission
 * sizing, not as a field.
 */

const TEMPLATE_COUNT = TEST_TEMPLATES.length

export default function BuilderGuidePage() {
  return (
    <DocLayout slug="builder">
      <PageHeader
        title="Getting feedback worth having."
        lede="You get structured reports from real people. You pay for them by testing other people's work — that is the whole deal. This is how to ask for something specific enough that what comes back is useful."
      />

      <div className="flex flex-col gap-12">
        <Section {...docSection("builder", "project")}>
          <p className={P}>
            A project is the thing you built: a name, a URL testers can reach, a
            category, and a summary.
          </p>
          <p className={P}>
            The summary is capped at {PROJECT_SUMMARY_MAX} characters. That is
            not us being
            precious about length — a tester decides whether to pick up your
            mission from this sentence and the mission title. Say what it does
            and who it is for. Skip the positioning.
          </p>
          <p className={META}>
            The URL has to be reachable without an invite. A tester who hits a
            login wall marks every step blocked, which is a true report and a
            wasted one.
          </p>
        </Section>

        <Section {...docSection("builder", "test-kind")}>
          <p className={P}>
            Missions come in three kinds. Picking the right one changes who
            self-selects into your mission and what they look at.
          </p>
          <dl className="flex flex-col gap-4">
            {(
              Object.entries(TEST_CATEGORY_BLURBS) as [
                keyof typeof TEST_CATEGORY_BLURBS,
                string,
              ][]
            ).map(([value, blurb]) => (
              <div
                key={value}
                className="rounded-[12px] border border-line bg-surface-raised p-6"
              >
                <dt className="font-mono font-medium text-[14px] text-ink mb-2">
                  {testCategoryLabel(value)}
                </dt>
                <dd className="font-sans text-[14px] leading-6 text-ink">
                  {blurb}
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section {...docSection("builder", "test-case")}>
          <p className={P}>
            The test case is the brief. It is an ordered list of steps, and each
            step is two things: <strong>an action</strong> the tester takes, and{" "}
            <strong>what should happen</strong> when they do. The action is
            capped at {STEP_ACTION_MAX} characters and the expected result at{" "}
            {STEP_EXPECTED_MAX} — if a step needs more room than that, it is two
            steps.
          </p>
          <p className={P}>
            Start from one of the {TEMPLATE_COUNT} templates if one fits. They
            are grouped by the three categories above and cover the flows most
            projects share — sign-up, password reset, checkout, form validation,
            first impressions, mobile layout. A template is copied onto your
            mission, so edit it freely afterwards.
          </p>
          <h3 className={H3}>What makes a step testable</h3>
          <ul className={`${UL} ${P}`}>
            <li>
              One action per step. &ldquo;Sign up and create a project&rdquo; is
              two steps, and when it fails you will not know which half broke.
            </li>
            <li>
              Say what should happen in terms the tester can see. &ldquo;The
              session persists&rdquo; is invisible; &ldquo;you land back on the
              dashboard and your name is in the top right&rdquo; is not.
            </li>
            <li>
              Do not write the answer you hope for. The expected result is what
              you believe the product does — if you are unsure, that is the most
              valuable step in the case.
            </li>
          </ul>
          <p className={META}>
            Your wording is copied onto every report as it was at the moment the
            tester submitted. Editing the mission later never rewrites what a
            tester appears to have been asked.
          </p>
        </Section>

        <Section {...docSection("builder", "notes")}>
          <p className={P}>
            There is a notes field, tucked behind a disclosure, and it is
            genuinely optional. It is notes — a login you want them to use, a
            warning that the payment step is a sandbox. It is not the brief. The
            test case directly below it is the brief.
          </p>
          <p className={P}>
            If you find yourself writing the instructions in here, they belong
            in the steps.
          </p>
        </Section>

        <Section {...docSection("builder", "device")}>
          <p className={P}>
            Three answers, and{" "}
            <strong>{deviceTargetLabel("both")}</strong> is a real choice rather
            than indecision — it means you want the flow checked in both places
            and you will get reports from testers doing each.
          </p>
          <ul className={`${UL} ${P}`}>
            {DEVICE_TARGETS.map((target) => (
              <li key={target}>{deviceTargetLabel(target)}</li>
            ))}
          </ul>
        </Section>

        <Section {...docSection("builder", "five-testers")}>
          <p className={P}>
            Five people find around 85% of the usability problems in what
            they&apos;re testing. Past five you are mostly paying to rediscover
            the same issues — the finding is the{" "}
            <a
              href="https://www.nngroup.com/articles/why-you-only-need-to-test-with-5-users/"
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_INLINE}
            >
              Nielsen Norman Group&apos;s
            </a>
            , and it is one of the most cited results in usability research.
          </p>
          <p className={P}>
            The practical consequence is about <em>mission sizing</em>, not
            about a number you pick. Scope a mission to one flow that five
            people can cover properly. Testing something else as well? That is
            a second mission. Ten missions of five beats one mission of fifty.
          </p>
          <p className={META}>
            This holds for qualitative usability testing, which is what Twnhall
            does. It does not hold for quantitative work — task success rates,
            A/B tests, load testing.
          </p>
        </Section>

        <Section {...docSection("builder", "audit-log")}>
          <p className={P}>
            A report comes back as one row per step, in your order, with your
            wording. Each row carries a status:
          </p>
          <dl className="flex flex-col gap-4">
            {(
              Object.entries(ENTRY_STATUS_HINTS) as [
                keyof typeof ENTRY_STATUS_HINTS,
                string,
              ][]
            ).map(([status, hint]) => (
              <div
                key={status}
                className="rounded-[12px] border border-line bg-surface-raised p-6"
              >
                <dt className="font-mono font-medium text-[14px] text-ink mb-2">
                  {entryStatusLabel(status)}
                </dt>
                <dd className="font-sans text-[14px] leading-6 text-ink">
                  {hint}
                </dd>
              </div>
            ))}
          </dl>
          <p className={P}>
            A passing step carries nothing else — what it confirms is your own
            expected result, already on the row. A failed step and a blocked
            step both carry two things: a one-line summary of the issue, and
            steps to reproduce it.
          </p>
          <p className={P}>
            <strong>Read the blocked steps first.</strong> Blocked is not a
            milder failure — it means the tester could not get there at all, so
            everything below it in the case went untested. One blocked step
            early in a flow can invalidate the rest of the report.
          </p>
          <p className={META}>
            Screenshots are attached to the report, not to individual steps.
            Every report has at least one.
          </p>
        </Section>

        <Section {...docSection("builder", "review")}>
          <p className={P}>
            A report arrives pending, and you approve it with a rating out of
            five. There is no sending it back: a tester files one report per
            mission. The rating is required — an approval without one
            leaves the tester nothing to build a reputation on, and reputation
            is the only thing Twnhall has to offer testers.
          </p>
          <p className={P}>
            Rate the report, not the news. A careful report that says your
            checkout is broken is a five.
          </p>
        </Section>
      </div>

      <div className="mt-16 pt-8 border-t border-line flex flex-col gap-4">
        <p className={P}>
          Testing someone else&apos;s project is how you earn reports on your
          own — and the tester guide is worth reading even if you never write a
          report, because it tells you what your testers were asked to do.
        </p>
        <Link href="/guides/tester" className={LINK_INLINE}>
          Read the tester guide →
        </Link>
      </div>
    </DocLayout>
  )
}
