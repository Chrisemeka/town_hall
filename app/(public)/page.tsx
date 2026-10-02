"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { TEST_TEMPLATES } from "@/lib/testTemplates";
import { entryStatusLabel, type EntryStatus } from "@/lib/vocabulary";

/*
 * The homepage renders the product's own artifacts rather than describing
 * them. The test case below is real — imported from lib/testTemplates.ts, so
 * it cannot drift from what a builder actually starts with. The tester's
 * answers are written for this page (nobody's real report is on the marketing
 * site) but they are shaped by auditEntrySchema exactly: a pass owes nothing
 * but its status, a fail and a blocked step each owe actual result, issue
 * summary and steps to reproduce.
 *
 * The sticky header carries the page's one Voltage CTA (Design.md §7.2), and
 * it is on screen at every scroll position. So nothing below is a Voltage
 * fill — every action on this page is a secondary control or an accent-ink
 * link. That is the deliberate resolution, not an omission.
 */

const TEMPLATE = TEST_TEMPLATES.find((t) => t.id === "auth-flow")!;

type LogEntry = {
  status: EntryStatus;
  issue_summary?: string;
  steps_to_reproduce?: string;
};

/** One tester's answers to the five steps above. Illustrative, not a real
 *  submission — and note what the passes carry, which is nothing. */
const LOG: LogEntry[] = [
  { status: "pass" },
  { status: "pass" },
  {
    status: "fail",
    issue_summary: "Verification email never sends on signup",
    steps_to_reproduce:
      "1. Sign up with a new address. 2. Wait on the confirm screen. 3. Nothing arrives, and Resend does nothing either.",
  },
  {
    status: "blocked",
    issue_summary: "Cannot reach the signed-in app at all",
    steps_to_reproduce: "1. Finish step 2. 2. Sign out. 3. Sign in with the same details.",
  },
  {
    status: "blocked",
    issue_summary: "Blocked by the same missing email as step 3",
    steps_to_reproduce: "1. As step 4 — sign-in is refused before a wrong password can be tried.",
  },
];

const COUNTS = (["pass", "fail", "blocked"] as const).map((s) => ({
  status: s,
  n: LOG.filter((e) => e.status === s).length,
}));

/*
 * Design.md §5.4's badge is coloured text on a 12% tint of itself, which
 * assumes a dark ground — Mint text on a Mint tint over Bone is invisible.
 * A solid fill with Obsidian text reads identically in both themes (Mint
 * 14.7:1, Sky 8.8:1, Ember 6.0:1), which is the deliberate-inversion escape
 * CLAUDE.md allows for a literal on a public surface. Colour is never alone:
 * the word is inside the chip.
 */
const FILL: Record<EntryStatus, string> = {
  pass: "bg-mint",
  fail: "bg-ember",
  blocked: "bg-sky",
};

function StatusBadge({ status }: { status: EntryStatus }) {
  return (
    <span
      className={`${FILL[status]} text-obsidian inline-flex shrink-0 items-center rounded-[4px] px-2 py-0.5 font-mono font-medium text-[12px] tracking-[0.5px]`}
    >
      {entryStatusLabel(status)}
    </span>
  );
}

/** One field of a problem row. Tight, because three of them stack. */
function Answer({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[12px] uppercase tracking-[1px] text-ink-muted">
        {label}
      </span>
      <p className="font-sans text-[13px] leading-5 text-ink">{children}</p>
    </div>
  );
}

// Entrance only, and inside the brief's budget: 16px of travel, 300ms. The
// annotation is what keeps `ease` from widening to `string` — the old page
// reached for `as any` here, which CLAUDE.md forbids adding more of.
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};
const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

export default function LandingPage() {
  // Someone who asked for less motion gets the end state, not the animation —
  // same posture as the th-fade-in rule in globals.css.
  const still = useReducedMotion();
  const rise = still
    ? {}
    : {
        initial: "hidden" as const,
        whileInView: "visible" as const,
        viewport: { once: true, margin: "-80px" },
      };

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────
          Asymmetric: the headline takes seven columns and the report summary
          sits low in the remaining five, so the fold is not a centred stack. */}
      <section className="w-full">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 pt-16 pb-20 lg:pt-28 lg:pb-32">
          <div className="grid grid-cols-12 gap-x-8 gap-y-16 lg:items-end">
            <motion.div
              {...rise}
              variants={stagger}
              className="col-span-12 lg:col-span-7 flex flex-col"
            >
              {/* Design.md's Display step is 52 -> 80px, and the mobile end of
                  that does not fit: "Not feedback." sets about 323px of Syne at
                  48px, against the 312px a 360px viewport leaves inside the
                  gutters. 40px is under the documented floor on the smallest
                  screens, which is the lesser problem — a headline that runs off
                  the edge is not a type-scale question. Every step is on the 4px
                  grid; 52/66 were not. */}
              <motion.h1
                variants={still ? undefined : fadeUp}
                className="font-syne font-bold text-[40px] leading-[44px] sm:text-[64px] sm:leading-[68px] lg:text-[80px] lg:leading-[80px] tracking-[-1.5px] text-ink"
              >
                Not feedback.
                <br />
                <span className="text-accent-ink">A test report.</span>
              </motion.h1>
              <motion.p
                variants={still ? undefined : fadeUp}
                className="font-sans text-[18px] leading-8 text-ink mt-8 max-w-xl"
              >
                Write the steps you want checked. Real people work through them
                and send back every step marked pass, fail or blocked — with
                what actually happened, how to reproduce it, and screenshots.
              </motion.p>
              <motion.p
                variants={still ? undefined : fadeUp}
                className="font-mono text-[14px] leading-6 text-ink mt-6 max-w-xl"
              >
                Testers are a trained cohort, not a crowd. Test for someone else
                and you earn another report on your own.
              </motion.p>
              <motion.a
                variants={still ? undefined : fadeUp}
                href="#report"
                className="mt-10 inline-flex items-center gap-2 self-start font-mono text-[14px] text-accent-ink underline underline-offset-4 hover:no-underline rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                See what one looks like
                <ArrowDown size={14} aria-hidden="true" />
              </motion.a>
            </motion.div>

            {/* The summary line of the report rendered in full below. Counts
                are derived from LOG, so they cannot disagree with it. */}
            <motion.div
              {...rise}
              variants={still ? undefined : fadeUp}
              className="col-span-12 lg:col-span-5"
            >
              <div className="rounded-[16px] border border-line bg-surface-raised p-6 lg:p-8">
                <p className="font-mono text-[12px] uppercase tracking-[1px] text-ink-muted">
                  One report
                </p>
                <p className="font-syne font-bold text-[28px] leading-9 text-ink mt-2">
                  {TEMPLATE.name}
                </p>
                <p className="font-sans text-[14px] leading-6 text-ink mt-2">
                  {TEMPLATE.description}
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  {COUNTS.map(({ status, n }) => (
                    <div key={status} className="flex items-center gap-3">
                      <StatusBadge status={status} />
                      <span className="font-mono text-[14px] text-ink">
                        {n} of {LOG.length} steps
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── The artifact, full bleed ─────────────────────────────────────
          The one section that leaves the 1200px column: a different surface,
          edge to edge, and a wider inner measure. This is the page's centre
          of gravity and it is deliberately the tallest thing on it. */}
      <section
        id="report"
        className="w-full bg-surface-raised border-y border-line scroll-mt-16"
      >
        <div className="max-w-[1320px] mx-auto px-6 lg:px-8 py-20 lg:py-28">
          <motion.h2
            {...rise}
            variants={still ? undefined : fadeUp}
            className="font-syne font-bold text-[36px] leading-[42px] lg:text-[48px] lg:leading-[54px] tracking-[-0.5px] text-ink max-w-2xl"
          >
            What you write, and what comes back.
          </motion.h2>

          {/* Asymmetric on purpose — the report is the bigger half. */}
          <div className="mt-12 lg:mt-16 grid gap-8 lg:gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
            {/* Left: the test case, exactly as lib/testTemplates.ts has it. */}
            <motion.div {...rise} variants={still ? undefined : fadeUp}>
              <h3 className="font-mono text-[12px] uppercase tracking-[1px] text-ink-muted">
                The test case you write
              </h3>
              <ol className="mt-6 flex flex-col gap-0 rounded-[12px] border border-line bg-surface overflow-hidden">
                {TEMPLATE.steps.map((step, i) => (
                  <li
                    key={step.action}
                    className="flex gap-4 p-5 border-b border-line last:border-b-0"
                  >
                    <span className="font-mono text-[13px] leading-6 text-accent-ink shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex flex-col gap-2 min-w-0">
                      <p className="font-sans text-[14px] leading-6 text-ink">
                        {step.action}
                      </p>
                      <p className="font-mono text-[12px] leading-5 text-ink-muted">
                        Expected: {step.expected_result}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </motion.div>

            {/* Right: the same steps, answered. */}
            <motion.div {...rise} variants={stagger}>
              <motion.h3
                variants={still ? undefined : fadeUp}
                className="font-mono text-[12px] uppercase tracking-[1px] text-ink-muted"
              >
                The report that comes back
              </motion.h3>
              <ol className="mt-6 flex flex-col gap-0 rounded-[12px] border border-line bg-surface overflow-hidden">
                {LOG.map((entry, i) => (
                  <motion.li
                    key={i}
                    variants={still ? undefined : fadeUp}
                    className="flex flex-col gap-4 p-5 border-b border-line last:border-b-0"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-4 min-w-0">
                        <span className="font-mono text-[13px] leading-6 text-accent-ink shrink-0">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <p className="font-sans text-[14px] leading-6 text-ink min-w-0">
                          {TEMPLATE.steps[i].action}
                        </p>
                      </div>
                      <StatusBadge status={entry.status} />
                    </div>

                    {/* A pass carries nothing else, and showing that is the
                        point: what it confirms is the builder's own expected
                        result, already on the row. */}
                    {entry.status !== "pass" && (
                      <div className="flex flex-col gap-4 pl-0 sm:pl-9">
                        <Answer label="The issue">{entry.issue_summary}</Answer>
                        <Answer label="To reproduce">
                          {entry.steps_to_reproduce}
                        </Answer>
                      </div>
                    )}
                  </motion.li>
                ))}
              </ol>
              <p className="mt-4 font-mono text-[12px] leading-5 text-ink-muted">
                An example, not a real submission. Every report also carries the
                tester&apos;s screenshots.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── The two things ───────────────────────────────────────────────
          A statement column against a stacked pair, not three cards in a row.
          Shorter than the section above it. */}
      <section className="w-full">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-20 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] lg:gap-20">
            <motion.h2
              {...rise}
              variants={still ? undefined : fadeUp}
              className="font-syne font-bold text-[32px] leading-[38px] lg:text-[40px] lg:leading-[46px] tracking-[-0.5px] text-ink lg:sticky lg:top-28 self-start"
            >
              Two things, specifically.
            </motion.h2>

            <motion.div {...rise} variants={stagger} className="flex flex-col gap-12">
              <motion.div
                variants={still ? undefined : fadeUp}
                className="flex flex-col gap-3 border-l-2 border-accent-ink pl-6"
              >
                <h3 className="font-syne font-bold text-[22px] leading-7 text-ink">
                  Detail you can act on
                </h3>
                <p className="font-sans text-[16px] leading-8 text-ink">
                  Every step is answered on its own terms. A pass confirms what
                  you said would happen. A fail says what happened instead, and
                  how to make it happen again. A blocked step says nobody could
                  get that far — which is usually the most urgent line in the
                  report, because everything after it went untested.
                </p>
              </motion.div>

              <motion.div
                variants={still ? undefined : fadeUp}
                className="flex flex-col gap-3 border-l-2 border-line pl-6"
              >
                <h3 className="font-syne font-bold text-[22px] leading-7 text-ink">
                  Reports that keep arriving
                </h3>
                <p className="font-sans text-[16px] leading-8 text-ink">
                  The testers are a small trained cohort rather than an open
                  crowd, so capacity is real and finite — and it grows the way
                  the platform does. Write a report on someone else&apos;s
                  product and you earn another on your own, one for one.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Close ────────────────────────────────────────────────────────
          Left-aligned and short. The header's Get started is a glance away at
          every scroll position, so this points at the things it cannot. */}
      <section className="w-full border-t border-line">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-16 lg:py-20">
          <motion.div
            {...rise}
            variants={still ? undefined : fadeUp}
            className="flex flex-col gap-6 max-w-2xl"
          >
            <h2 className="font-syne font-bold text-[28px] leading-9 lg:text-[36px] lg:leading-[42px] tracking-[-0.5px] text-ink">
              Your next release deserves this.
            </h2>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <Link
                href="/guides/builder"
                className="inline-flex items-center gap-2 font-mono text-[14px] text-accent-ink underline underline-offset-4 hover:no-underline rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                How to write a test case
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 font-mono text-[14px] text-accent-ink underline underline-offset-4 hover:no-underline rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                What it costs
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
