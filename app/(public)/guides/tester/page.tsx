import Link from "next/link"
import type { Metadata } from "next"
import {
  H3,
  LINK_INLINE,
  META,
  P,
  PageHeader,
  Section,
  UL,
} from "@/components/public/prose"
import { ENTRY_STATUS_HINTS, entryStatusLabel } from "@/lib/vocabulary"
import {
  ENTRY_TEXT_MAX,
  MAX_SCREENSHOTS,
  MAX_SCREENSHOT_BYTES,
} from "@/lib/validation/schemas"

export const metadata: Metadata = {
  title: "Guide for testers — Twnhall",
  description:
    "How to work through a mission's test case, what pass, fail and blocked each mean, and what makes a report worth a good rating.",
}

/*
 * SOURCE OF TRUTH IS THE CODE, NOT THIS PAGE. See the note in the builder
 * guide. The field rules below come from auditEntrySchema in
 * lib/validation/schemas.ts, and CLAUDE.md names auditEntrySchema and
 * firstIncompleteEntry as a pair that moves together — this page is now a third
 * place that states the same rule, in prose. scripts/guides.test.mts is what
 * notices when it stops matching.
 *
 * In particular: a tester is NOT asked to restate the expected result. That
 * field was removed from the form in 20260908_01 because it was prefilled from
 * the builder's own wording and came back unchanged ten times out of eleven. Do
 * not describe it here as something the tester fills in.
 */

const MAX_SCREENSHOT_MB = MAX_SCREENSHOT_BYTES / (1024 * 1024)

/** What a fail and a blocked step each owe. A pass owes none of them. */
const REQUIRED_ON_PROBLEM = [
  {
    label: "What actually happened",
    body: "What you saw, in the order you saw it. Not what you think caused it — a guess about the cause is the one thing the builder can check for themselves and you cannot.",
  },
  {
    label: "Summary of the issue",
    body: "One line. This is what the builder reads in a list of twenty rows, so it has to survive on its own: “Checkout button does nothing on mobile Safari”, not “doesn't work”.",
  },
  {
    label: "Steps to reproduce",
    body: "Numbered, starting from somewhere the builder can start — a URL or a logged-out browser. If you cannot reproduce it a second time, say so; that is useful too.",
  },
]

export default function TesterGuidePage() {
  return (
    <div className="flex-1 w-full max-w-[720px] mx-auto px-6 py-16">
      <PageHeader
        eyebrow="Guide · Testers"
        title="Writing a report someone can act on."
        lede="A mission takes a few minutes. The difference between a report that gets fixed and one that gets skimmed is almost entirely in how specific you are — and the form is built to make specific easy."
      />

      <div className="flex flex-col gap-12">
        <Section number="1" title="What a mission is">
          <p className={P}>
            One project, one thing to test, and a test case to work through. The
            builder has written an ordered list of steps: each one is an action
            to take and what they believe should happen when you take it.
          </p>
          <p className={P}>
            Your job is to do each step and say whether it did that. You are not
            being asked to review the product, guess at causes, or be kind.
          </p>
        </Section>

        <Section number="2" title="Read the whole test case first">
          <p className={P}>
            Before you open anything, read every step. You will spot a flow that
            needs an account, or a step that depends on the one before it, and
            you can plan around both.
          </p>
          <p className={P}>
            Then open the project in another tab and keep the mission page
            beside it. The log is meant to be filled as you go, not
            reconstructed from memory at the end — that is where &ldquo;it
            broke somewhere around checkout&rdquo; comes from.
          </p>
        </Section>

        <Section number="3" title="Pass, fail, or blocked">
          <p className={P}>
            Every step gets one of three answers, and the third one is the one
            people get wrong.
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
            <strong>Blocked is not a softer fail.</strong> Fail means the step
            ran and did the wrong thing. Blocked means you never got to it — the
            previous step broke, the page would not load, the feature needs an
            account you could not create. Marking a blocked step as a fail
            reports a bug in a feature nobody reached, and the builder will go
            looking for it.
          </p>
          <p className={META}>
            Blocked is often the most urgent thing in your report, because
            everything after it went untested. Do not feel you are giving up by
            using it.
          </p>
        </Section>

        <Section number="4" title="What each field wants">
          <p className={P}>
            <strong>A passing step asks nothing else of you.</strong> Mark it
            and move on — what it confirms is the builder&apos;s own expected
            result, which is already recorded on the row. You are never asked to
            restate it.
          </p>
          <p className={P}>
            A <strong>failed</strong> step and a <strong>blocked</strong> step
            both ask for the same three things. All three are required on both —
            the form will not let you submit until they are filled, and each is
            capped at {ENTRY_TEXT_MAX} characters.
          </p>
          <dl className="flex flex-col gap-4">
            {REQUIRED_ON_PROBLEM.map(({ label, body }) => (
              <div
                key={label}
                className="rounded-[12px] border border-line bg-surface-raised p-6"
              >
                <dt className="font-mono font-medium text-[14px] text-ink mb-2">
                  {label}
                </dt>
                <dd className="font-sans text-[14px] leading-6 text-ink">
                  {body}
                </dd>
              </div>
            ))}
          </dl>
          <p className={META}>
            Yes, a blocked step asks for all three. Something stopped you, and
            what stopped you is the entire content of that row.
          </p>
        </Section>

        <Section number="5" title="Screenshots">
          <p className={P}>
            At least one screenshot is required on every report, and you can
            attach up to {MAX_SCREENSHOTS}. PNG, JPG or WEBP, under{" "}
            {MAX_SCREENSHOT_MB}&nbsp;MB each — the form compresses them before
            upload, so a full-resolution phone screenshot is fine.
          </p>
          <h3 className={H3}>Shoot the problem, not the homepage</h3>
          <ul className={`${UL} ${P}`}>
            <li>
              Capture the broken state while it is on screen. A screenshot taken
              after you reloaded shows a working page.
            </li>
            <li>
              Include enough around the problem to place it — the URL bar, the
              page heading.
            </li>
            <li>
              An error message is worth a screenshot even if you also typed it
              out. Exact text matters.
            </li>
          </ul>
        </Section>

        <Section number="6" title="Anything else">
          <p className={P}>
            There is one free-text box at the end of the report. It is optional,
            and it is for the things that did not belong to any single step: the
            flow felt long, the copy confused you, something you noticed on the
            way past.
          </p>
          <p className={P}>
            Do not put a step&apos;s issue in here. A problem filed against its
            step is one the builder can act on; the same problem in the comment
            box has lost the thing it was about.
          </p>
        </Section>

        <Section number="7" title="What gets rated well">
          <p className={P}>
            The builder reviews every report and rates it out of five. Ratings
            are the whole of your standing here — there is no payment, and
            nothing else accumulates.
          </p>
          <ul className={`${UL} ${P}`}>
            <li>
              <strong>Specific.</strong> One clear problem per row, with what you
              saw.
            </li>
            <li>
              <strong>Reproducible.</strong> Someone else can follow your steps
              and land on the same screen.
            </li>
            <li>
              <strong>Shown.</strong> A screenshot of the actual failure.
            </li>
            <li>
              <strong>Honest about the gaps.</strong> Say what you could not
              reach and why. A report that marks three steps blocked and
              explains them is far more useful than one that guesses.
            </li>
          </ul>
          <p className={P}>
            A report that finds nothing wrong is a real result. Pass every step,
            attach your screenshot, and say so in the comment.
          </p>
        </Section>
      </div>

      <div className="mt-16 pt-8 border-t border-line flex flex-col gap-4">
        <p className={P}>
          Testing earns you feedback on your own work. The builder guide covers
          the other half — setting up a project and writing a test case.
        </p>
        <Link href="/guides/builder" className={LINK_INLINE}>
          Read the builder guide →
        </Link>
      </div>
    </div>
  )
}
