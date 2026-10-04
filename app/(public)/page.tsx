"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { HeroDemo, Tour } from "@/components/public/HomeMockups";

/*
 * The homepage shows the product rather than describing it: every window on
 * it is drawn from components/public/HomeMockups.tsx, which renders the real
 * template and the real SubmissionBody.
 *
 * The sticky header carries the page's one Voltage CTA (Design.md §7.2), and
 * it is on screen at every scroll position. So nothing below is a Voltage
 * fill — every action here is a secondary control or an accent-ink link.
 *
 * No logo strip, stats or testimonials: there are none real yet, and the
 * pricing page's honesty rule applies here too. Add them when they exist.
 */

// Entrance only, and inside the brief's budget: 16px of travel, 300ms. The
// annotation keeps `ease` from widening to `string`, which is what the old
// page reached for `as any` to silence.
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};
const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const LINK =
  "inline-flex items-center gap-2 font-mono text-[14px] text-accent-ink underline underline-offset-4 hover:no-underline rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const H2 =
  "font-syne font-bold text-[32px] leading-[40px] lg:text-[48px] lg:leading-[56px] tracking-[-0.5px] text-ink";

const LOOP = [
  { n: "01", title: "Test someone's project", body: "Work through their test case and file the report." },
  { n: "02", title: "Earn a report", body: "One report written is one report credited, for each mission you test." },
  { n: "03", title: "Spend it on yours", body: "Publish a mission and a tester works through your steps." },
];

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
  const up = still ? undefined : fadeUp;

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────
          Centred copy over the product window, GitHub-style. */}
      <section className="w-full overflow-x-clip">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28">
          <motion.div
            {...rise}
            variants={stagger}
            className="flex flex-col items-center text-center max-w-3xl mx-auto"
          >
            {/* Display is 52 -> 80px in Design.md, and the mobile end does not
                fit: "Not feedback." at 48px is wider than the 312px a 360px
                viewport leaves inside the gutters. */}
            <motion.h1
              variants={up}
              className="font-syne font-bold text-[40px] leading-[44px] sm:text-[64px] sm:leading-[68px] lg:text-[80px] lg:leading-[80px] tracking-[-1.5px] text-ink"
            >
              Not feedback.
              <br />
              <span className="text-accent-ink">A test report.</span>
            </motion.h1>
            <motion.p variants={up} className="font-sans text-[18px] leading-8 text-ink mt-8 max-w-2xl">
              Write the steps you want checked. Real people work through them
              and send back every step marked pass, fail or blocked, with the
              issue, how to reproduce it, and screenshots.
            </motion.p>
            <motion.p variants={up} className="font-mono text-[14px] leading-6 text-ink-muted mt-4 max-w-xl">
              Testers are a trained cohort, not a crowd. Test for someone else
              and you earn another report on your own.
            </motion.p>
            <motion.div variants={up} className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
              <a
                href="#tour"
                className="h-12 px-6 inline-flex items-center gap-2 rounded-[8px] border border-ink-muted font-mono font-medium text-[14px] text-ink hover:bg-ink/[0.06] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                See how it works
                <ArrowDown size={14} aria-hidden="true" />
              </a>
              <Link href="/guides/builder" className={LINK}>
                Read the builder guide
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </motion.div>
          </motion.div>

          <motion.div {...rise} variants={up} className="mt-16 lg:mt-20">
            <HeroDemo />
          </motion.div>
        </div>
      </section>

      {/* ── Tour ─────────────────────────────────────────────────────────
          GitHub's tabbed feature row, one tab per stage of a report. */}
      <section id="tour" className="w-full border-t border-line scroll-mt-16">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-20 lg:py-28">
          <motion.h2 {...rise} variants={up} className={`${H2} max-w-2xl mb-12`}>
            From test case to fix list.
          </motion.h2>
          <Tour />
        </div>
      </section>

      {/* ── The loop ─────────────────────────────────────────────────────
          Reciprocity, and who the testers are. */}
      <section className="w-full border-t border-line">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-20 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            <motion.div {...rise} variants={up} className="flex flex-col gap-6">
              <h2 className={H2}>Test one, earn one.</h2>
              <p className="font-sans text-[16px] leading-8 text-ink">
                The testers are a small trained cohort rather than an open
                crowd, so capacity is real and finite, and it grows the way the
                platform does. Write a report on someone else&apos;s product and
                you earn another on your own, one for one.
              </p>
            </motion.div>

            <motion.ol {...rise} variants={stagger} className="flex flex-col">
              {LOOP.map((step) => (
                <motion.li
                  key={step.n}
                  variants={up}
                  className="flex gap-6 py-6 border-t border-line last:border-b"
                >
                  <span className="font-mono text-[13px] font-medium leading-7 text-accent-ink shrink-0">
                    {step.n}
                  </span>
                  <div className="flex flex-col gap-2">
                    <h3 className="font-syne font-bold text-[22px] leading-7 text-ink">{step.title}</h3>
                    <p className="font-sans text-[16px] leading-7 text-ink-muted">{step.body}</p>
                  </div>
                </motion.li>
              ))}
            </motion.ol>
          </div>
        </div>
      </section>

      {/* ── Close ────────────────────────────────────────────────────────
          The header's Get started is a glance away at every scroll position,
          so this points at the things it cannot. */}
      <section className="w-full border-t border-line">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-16 lg:py-20">
          <motion.div {...rise} variants={up} className="flex flex-col gap-6 max-w-2xl">
            <h2 className="font-syne font-bold text-[28px] leading-9 lg:text-[36px] lg:leading-[44px] tracking-[-0.5px] text-ink">
              Your next release deserves this.
            </h2>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <Link href="/guides/builder" className={LINK}>
                How to write a test case
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
              <Link href="/pricing" className={LINK}>
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
