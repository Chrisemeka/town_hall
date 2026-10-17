"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Features, HeroDemo } from "@/components/public/HomeMockups";
import { heroProgress } from "@/lib/heroScroll";

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

// 48px tall below lg (SPEC-m3-foundations §3.4); desktop keeps its text height.
const LINK =
  "inline-flex items-center max-lg:min-h-12 gap-2 font-mono text-[14px] text-accent-ink underline underline-offset-4 hover:no-underline rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

// The Headline role: 28/36 compact, 32/40 medium, today's 48/56 from lg.
const H2 =
  "font-syne font-bold text-[28px] leading-9 medium:text-[32px] medium:leading-10 lg:text-[48px] lg:leading-[56px] tracking-[-0.5px] text-ink";

// "Test one, earn one": a vertical stepper on compact (circles joined by a
// rule), three cards on medium and expanded, today's ruled list from lg. The
// two smaller layouts are range-scoped (medium:max-lg:) so lg needs no resets.
const LOOP_ITEM =
  "max-medium:relative max-medium:pl-14 max-medium:pb-8 max-medium:last:pb-0 max-medium:before:absolute max-medium:before:left-[19px] max-medium:before:top-10 max-medium:before:bottom-0 max-medium:before:w-0.5 max-medium:before:bg-line max-medium:last:before:hidden " +
  "medium:max-lg:flex medium:max-lg:flex-col medium:max-lg:gap-4 medium:max-lg:rounded-[12px] medium:max-lg:border medium:max-lg:border-line medium:max-lg:bg-surface-raised medium:max-lg:p-5 " +
  "lg:flex lg:gap-6 lg:py-6 lg:border-t lg:border-line lg:last:border-b";

const LOOP_NUMBER =
  "font-mono font-medium text-accent-ink shrink-0 text-[12px] lg:text-[13px] lg:leading-7 " +
  "max-lg:size-10 max-lg:rounded-full max-lg:bg-ink/[0.06] max-lg:flex max-lg:items-center max-lg:justify-center " +
  "max-medium:absolute max-medium:left-0 max-medium:top-0";

// The hero-scroll variant's other half (globals.css): the same short-viewport
// boundary, read in JS so the motion values switch off where the layout does.
const SHORT = "(max-height: 479px)";
const subscribeShort = (onChange: () => void) => {
  const mq = matchMedia(SHORT);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};

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

  // The hero scroll (SPEC-motion-hero-scroll). Motion values, so a scroll
  // re-renders nothing. Linear to the scroll on purpose: the reader's thumb is
  // the easing, and a spring here lags and fights them.
  const short = useSyncExternalStore(subscribeShort, () => matchMedia(SHORT).matches, () => true);
  const scrolling = !still && !short;
  const regionRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const regionHeight = useMotionValue(0);
  const copyHeight = useMotionValue(0);
  const { scrollY } = useScroll();
  const progress = useTransform(() => heroProgress(scrollY.get(), regionHeight.get(), copyHeight.get()));
  const copyOpacity = useTransform(progress, [0.1, 0.7], [1, 0]);
  const copyScale = useTransform(progress, [0, 1], [1, 0.96]);
  // Dark only in effect: in light .th-glow has no background to fade.
  const glowOpacity = useTransform(progress, [0, 0.5], [0.6, 1]);

  // offsetHeight ignores the scale, so measuring never feeds back into itself.
  useEffect(() => {
    const region = regionRef.current;
    const copy = copyRef.current;
    if (!region || !copy) return;
    const measure = () => {
      regionHeight.set(region.offsetHeight);
      copyHeight.set(copy.offsetHeight);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(region);
    ro.observe(copy);
    return () => ro.disconnect();
  }, [regionHeight, copyHeight]);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────
          Centred copy over the product window, GitHub-style. At rest the
          window peeks in below the copy; scrolling, the copy holds and fades
          while the window rises over it. The layout is the hero-scroll
          variant (globals.css); off it, this is the static layout.
          overflow-x-clip, never overflow-hidden: hidden makes the section a
          scroll container, and that silently kills the copy's sticky. */}
      <section className="w-full overflow-x-clip">
        <div className="max-w-[1200px] mx-auto px-4 medium:px-6 lg:px-8 pb-12 medium:pb-20 lg:pb-28">
          {/* The copy's region: the space above the window's peek (96, 128,
              then 160px), with the copy centred in it and 24px clear of the
              window. A minimum, so a viewport too short for both grows it
              and the peek shrinks first — never the actions below the fold.
              Compound variants where they must beat a medium:/lg: padding. */}
          <motion.div
            ref={regionRef}
            style={scrolling ? { opacity: copyOpacity, scale: copyScale } : undefined}
            // WCAG 2.4.11: a sticky element is always "in view", so tabbing to
            // a link under the window scrolls nothing and the focus ring is
            // drawn beneath an opaque window. Bring the copy back instead.
            // Keyboard only (:focus-visible), so a click on "See how it works"
            // never fights its own jump to #tour.
            onFocus={(e) => {
              if (scrolling && progress.get() > 0 && e.target.matches(":focus-visible")) {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            className="flex flex-col justify-center pt-10 medium:pt-16 lg:pt-24 hero-scroll:sticky hero-scroll:top-16 hero-scroll:py-6 medium:hero-scroll:py-6 lg:hero-scroll:py-6 hero-scroll:min-h-[calc(100svh-4rem-96px)] medium:hero-scroll:min-h-[calc(100svh-4rem-128px)] lg:hero-scroll:min-h-[calc(100svh-4rem-160px)]"
          >
          <motion.div
            ref={copyRef}
            {...rise}
            variants={stagger}
            className="flex flex-col items-center text-center max-w-3xl mx-auto"
          >
            {/* The Display role, stepped per size class. "Not feedback." must
                never wrap: 64px is wider than the 552px a 600px screen leaves,
                so medium is 52, and below 360px compact drops to 36. */}
            <motion.h1
              variants={up}
              className="font-syne font-bold max-[359px]:text-[36px] max-[359px]:leading-10 text-[40px] leading-[44px] medium:text-[52px] medium:leading-[56px] expanded:text-[64px] expanded:leading-[68px] lg:text-[80px] lg:leading-[80px] tracking-[-1.5px] text-ink"
            >
              Not feedback.
              <br />
              <span className="text-accent-ink">A test report.</span>
            </motion.h1>
            {/* One line, GitHub-style. The cohort and the earn-one loop have
                their own section below; the hero only has to land the idea. */}
            <motion.p variants={up} className="font-sans text-[16px] leading-7 medium:text-[18px] medium:leading-8 text-ink mt-6 medium:mt-8 max-w-xl">
              Write the steps. Real testers work through every one and tell
              you exactly what broke, and how to break it again.
            </motion.p>
            {/* Stacked full width on compact, a centred row from 600px. */}
            <motion.div variants={up} className="mt-8 medium:mt-10 w-full medium:w-auto flex flex-col items-stretch gap-2 medium:flex-row medium:flex-wrap medium:items-center medium:justify-center medium:gap-x-8 medium:gap-y-4">
              <a
                href="#tour"
                className="h-12 px-6 inline-flex items-center justify-center gap-2 rounded-[8px] border border-ink-muted font-mono font-medium text-[14px] text-ink hover:bg-ink/[0.06] active:bg-ink/[0.10] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                See how it works
                <ArrowDown size={14} aria-hidden="true" />
              </a>
              <Link href="/guides/builder" className={`${LINK} justify-center`}>
                Read the builder guide
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </motion.div>
          </motion.div>
          </motion.div>

          {/* Above the copy and opaque, so it covers the text rather than
              mixing with it. No entrance of its own: the scroll is it. */}
          <div className="relative z-10 mt-12 medium:mt-16 lg:mt-20 hero-scroll:mt-0 medium:hero-scroll:mt-0 lg:hero-scroll:mt-0">
            <HeroDemo glow={scrolling ? glowOpacity : undefined} />
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────
          Cursor-style feature cards, alternating sides. See Features. */}
      {/* Wider than the 1200px column on purpose: the windows are the point,
          and boxed to 1200 on a wide screen they read as squeezed. */}
      <section id="tour" className="w-full border-t border-line scroll-mt-16">
        <div className="max-w-[1680px] mx-auto px-4 medium:px-6 lg:px-10 py-12 medium:py-20 lg:py-28">
          <motion.h2 {...rise} variants={up} className={`${H2} max-w-2xl mb-8 medium:mb-12`}>
            From test case to fix list.
          </motion.h2>
          <Features />
        </div>
      </section>

      {/* ── The loop ─────────────────────────────────────────────────────
          Reciprocity, and who the testers are. */}
      <section className="w-full border-t border-line">
        <div className="max-w-[1200px] mx-auto px-4 medium:px-6 lg:px-8 py-12 medium:py-20 lg:py-24">
          <div className="grid gap-8 medium:gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
            <motion.div {...rise} variants={up} className="flex flex-col gap-6">
              <h2 className={H2}>Test one, earn one.</h2>
              <p className="font-sans text-[16px] leading-8 text-ink">
                The testers are a small trained cohort rather than an open
                crowd, so capacity is real and finite, and it grows the way the
                platform does. Write a report on someone else&apos;s product and
                you earn another on your own, one for one.
              </p>
            </motion.div>

            <motion.ol {...rise} variants={stagger} className="flex flex-col medium:max-lg:grid medium:max-lg:grid-cols-3 medium:max-lg:gap-4">
              {LOOP.map((step) => (
                <motion.li
                  key={step.n}
                  variants={up}
                  className={LOOP_ITEM}
                >
                  <span className={LOOP_NUMBER}>
                    {step.n}
                  </span>
                  <div className="flex flex-col gap-2">
                    <h3 className="font-syne font-bold text-[20px] medium:text-[22px] leading-7 text-ink">{step.title}</h3>
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
        <div className="max-w-[1200px] mx-auto px-4 medium:px-6 lg:px-8 py-12 medium:py-16 lg:py-20">
          <motion.div {...rise} variants={up} className="flex flex-col gap-6 max-w-2xl">
            <h2 className="font-syne font-bold text-[28px] leading-9 medium:text-[32px] medium:leading-10 lg:text-[36px] lg:leading-[44px] tracking-[-0.5px] text-ink">
              Your next release deserves this.
            </h2>
            {/* 48px rows stacked on compact, a wrapping row from 600px. */}
            <div className="flex flex-col medium:flex-row medium:flex-wrap gap-x-8 medium:gap-y-3">
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
