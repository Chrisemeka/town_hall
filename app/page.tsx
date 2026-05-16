"use client";

import { motion } from "framer-motion";
import { signInWithGoogle } from "@/actions/auth";
import { BugPlay, FileText, CheckCircle, Users, Check, ArrowRight } from "lucide-react";
import Link from "next/link";
import NextImage from "next/image";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fadeUp: any = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stagger: any = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bone text-midnight font-mono flex flex-col selection:bg-voltage selection:text-obsidian">

      {/* ─── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="w-full h-16 sticky top-0 bg-bone/85 backdrop-blur-md z-50 border-b border-transparent">
        <div className="max-w-[1128px] mx-auto px-6 h-full flex items-center justify-between gap-8">

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <BugPlay className="w-5 h-5 text-midnight" />
            <span className="font-syne font-bold text-lg tracking-tight text-midnight">Townhall</span>
          </div>

          {/* Center links */}
          <div className="hidden md:flex items-center gap-8 flex-1 justify-center">
            <Link href="#how-it-works" className="font-mono text-sm text-midnight/70 hover:text-midnight transition-colors duration-150">
              How It Works
            </Link>
            <Link href="#community" className="font-mono text-sm text-midnight/70 hover:text-midnight transition-colors duration-150">
              Community
            </Link>
          </div>

          {/* CTA */}
          <form action={signInWithGoogle} className="shrink-0">
            <button
              type="submit"
              className="h-9 px-4 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 cursor-pointer"
            >
              Start Testing Free
            </button>
          </form>
        </div>
      </nav>

      <main className="flex-1 flex flex-col">

        {/* ─── ① HERO ──────────────────────────────────────────────────────── */}
        <section className="w-full py-16 lg:py-24 bg-bone relative overflow-hidden">
          {/* Dot-grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(rgba(0,0,0,0.03) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          <div className="max-w-[1128px] mx-auto px-6 relative">
            <div className="flex flex-col items-center text-center">

              <motion.div
                initial="hidden"
                animate="visible"
                variants={stagger}
                className="flex flex-col items-center"
              >
                <motion.h1
                  variants={fadeUp}
                  className="font-syne font-bold text-[40px] leading-[44px] lg:text-[64px] lg:leading-[68px] tracking-[-1px] text-midnight mb-6"
                >
                  Ship better.<br />Test each other.
                </motion.h1>
                <motion.p
                  variants={fadeUp}
                  className="font-mono text-[16px] leading-6 lg:text-[14px] lg:leading-7 text-midnight/70 mb-8 max-w-xl"
                >
                  Submit your project, define what to test, and get real feedback from developers — in return for testing theirs.
                </motion.p>
                <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-16">
                  <form action={signInWithGoogle}>
                    <button
                      type="submit"
                      className="w-full sm:w-auto h-12 px-6 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-sm hover:bg-voltage-dark transition-colors duration-150 cursor-pointer"
                    >
                      Start Testing Free
                    </button>
                  </form>
                  <Link
                    href="#community"
                    className="h-12 px-6 flex items-center justify-center gap-1.5 font-mono font-medium text-sm text-midnight rounded-[8px] hover:bg-midnight/5 transition-colors duration-150"
                  >
                    Explore Projects <ArrowRight className="w-4 h-4" />
                  </Link>
                </motion.div>
              </motion.div>

              {/* Dashboard mockup — full width below */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.6, ease: "easeOut" }}
                className="w-full"
              >
                <NextImage
                  src="/images/hero-wireframe.svg"
                  alt="Townhall app dashboard preview"
                  width={1128}
                  height={705}
                  className="w-full rounded-[16px] shadow-[0_16px_40px_rgba(0,0,0,0.2)]"
                  priority
                  unoptimized
                />
              </motion.div>

            </div>
          </div>
        </section>

        {/* ─── ② HOW THE LOOP WORKS ────────────────────────────────────────── */}
        <section id="how-it-works" className="w-full bg-bone py-16 lg:py-24">
          <div className="max-w-[1128px] mx-auto px-6">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={stagger}
            >
              <motion.p variants={fadeUp} className="font-mono text-[12px] font-medium text-forest uppercase tracking-[1px] mb-3">
                The Loop
              </motion.p>
              <motion.h2 variants={fadeUp} className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-midnight mb-16">
                How it works.
              </motion.h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  {
                    num: "01",
                    icon: <FileText className="w-5 h-5 text-voltage" />,
                    title: "Submit your project + missions",
                    copy: "Create a project and define specific testing missions. Tell testers exactly what flow to check and what you're worried about.",
                  },
                  {
                    num: "02",
                    icon: <Users className="w-5 h-5 text-voltage" />,
                    title: "Community developers test it",
                    copy: "Real developers pick up your missions, visit your project, and submit written feedback with screenshot proof of visit.",
                  },
                  {
                    num: "03",
                    icon: <CheckCircle className="w-5 h-5 text-voltage" />,
                    title: "You test theirs. Everyone improves.",
                    copy: "Reciprocity drives the platform. Test others' projects to earn feedback on yours. No points, no rewards — just accountability.",
                  },
                ].map((step, i) => (
                  <motion.div key={i} variants={fadeUp} className="relative flex flex-col pt-14">
                    {/* Watermark number */}
                    <div
                      className="absolute top-0 -left-2 font-syne font-bold leading-none text-midnight select-none pointer-events-none"
                      style={{ fontSize: 120, opacity: 0.05 }}
                    >
                      {step.num}
                    </div>
                    <div className="relative z-10 flex flex-col gap-4">
                      <div className="w-10 h-10 rounded-[8px] bg-graphite border border-iron flex items-center justify-center">
                        {step.icon}
                      </div>
                      <h4 className="font-syne font-bold text-[20px] leading-7 text-midnight">{step.title}</h4>
                      <p className="font-mono text-[14px] leading-5 text-midnight/60">{step.copy}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── ③ FOR SUBMITTERS ────────────────────────────────────────────── */}
        <section className="w-full bg-bone py-16 lg:py-24">
          <div className="max-w-[1128px] mx-auto px-6">
            <div className="grid grid-cols-12 gap-6 items-center">

              {/* Left: 6-col text */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={stagger}
                className="col-span-12 lg:col-span-6 flex flex-col"
              >
                <motion.p variants={fadeUp} className="font-mono text-[12px] font-medium text-forest uppercase tracking-[1px] mb-4">
                  For Submitters
                </motion.p>
                <motion.h2 variants={fadeUp} className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-midnight mb-4">
                  Structured feedback,<br />not guesses.
                </motion.h2>
                <motion.p variants={fadeUp} className="font-mono text-[16px] leading-6 text-midnight/70 mb-8">
                  Define exactly what you need tested. Missions give testers a clear brief — so you get specific, actionable feedback instead of vague impressions.
                </motion.p>
                <motion.ul variants={stagger} className="flex flex-col gap-3">
                  {[
                    "Create a project and add targeted testing missions",
                    "Testers submit written feedback + screenshot proof",
                    "Review all feedback in one central dashboard",
                  ].map((item, i) => (
                    <motion.li key={i} variants={fadeUp} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-forest/10 border border-forest/40 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-forest" />
                      </div>
                      <span className="font-mono text-[14px] leading-5 text-midnight/80">{item}</span>
                    </motion.li>
                  ))}
                </motion.ul>
              </motion.div>

              {/* Right: 6-col — Submit Project form mockup */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="col-span-12 lg:col-span-6"
              >
                <NextImage
                  src="/images/submit-project-form.svg"
                  alt="Submit a Project form preview"
                  width={600}
                  height={440}
                  className="w-full rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.1)]"
                  unoptimized
                />
              </motion.div>

            </div>
          </div>
        </section>

        {/* ─── ④ FOR TESTERS ───────────────────────────────────────────────── */}
        <section className="w-full bg-bone py-16 lg:py-24">
          <div className="max-w-[1128px] mx-auto px-6">
            <div className="grid grid-cols-12 gap-6 items-center">

              {/* Left: 6-col — Mission card mockup */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="col-span-12 lg:col-span-6 order-2 lg:order-1"
              >
                <NextImage
                  src="/images/mission-card.svg"
                  alt="Mission card preview"
                  width={600}
                  height={370}
                  className="w-full rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.1)]"
                  unoptimized
                />
              </motion.div>

              {/* Right: 6-col text */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={stagger}
                className="col-span-12 lg:col-span-6 flex flex-col order-1 lg:order-2"
              >
                <motion.p variants={fadeUp} className="font-mono text-[12px] font-medium text-forest uppercase tracking-[1px] mb-4">
                  For Testers
                </motion.p>
                <motion.h2 variants={fadeUp} className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-midnight mb-4">
                  Frictionless testing.
                </motion.h2>
                <motion.p variants={fadeUp} className="font-mono text-[16px] leading-6 text-midnight/70 mb-8">
                  Browse the community feed, pick a mission, and jump in. Clear instructions tell you exactly what to test — no guessing, no wasted time.
                </motion.p>
                <motion.ul variants={stagger} className="flex flex-col gap-3">
                  {[
                    "Discover real projects built by fellow developers",
                    "Follow mission instructions for focused testing",
                    "Submit feedback + screenshot as proof of visit",
                  ].map((item, i) => (
                    <motion.li key={i} variants={fadeUp} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-forest/10 border border-forest/40 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-forest" />
                      </div>
                      <span className="font-mono text-[14px] leading-5 text-midnight/80">{item}</span>
                    </motion.li>
                  ))}
                </motion.ul>
              </motion.div>

            </div>
          </div>
        </section>

        {/* ─── ⑤ COMMUNITY PROOF / LIVE FEED ──────────────────────────────── */}
        <section id="community" className="w-full bg-bone py-16 lg:py-24">
          <div className="max-w-[1128px] mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="font-syne font-bold text-[36px] leading-[44px] tracking-[-0.5px] text-midnight mb-4">
                Projects waiting for your feedback right now
              </h2>
              <p className="font-mono text-[14px] text-midnight/60">
                Join hundreds of developers already testing each other's work.
              </p>
            </div>

            <NextImage
              src="/images/community-cards.svg"
              alt="Community project cards — DevSync CLI, Palette Flow, QueryMaster"
              width={1104}
              height={226}
              className="w-full"
              unoptimized
            />
          </div>
        </section>


        {/* ─── ⑦ FINAL CTA STRIP ───────────────────────────────────────────── */}
        <section className="w-full bg-bone py-16 lg:py-24 text-center">
          <div className="max-w-[1128px] mx-auto px-6 flex flex-col items-center">
            <h1 className="font-syne font-bold text-[32px] leading-[36px] lg:text-[48px] lg:leading-[52px] tracking-[-0.5px] text-midnight mb-8">
              Your next release deserves real feedback.
            </h1>
            <form action={signInWithGoogle}>
              <button
                type="submit"
                className="h-14 px-8 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-base hover:bg-voltage-dark transition-colors duration-150 cursor-pointer"
              >
                Start Testing Free
              </button>
            </form>
          </div>
        </section>

      </main>

      {/* ─── ⑧ FOOTER ────────────────────────────────────────────────────── */}
      <footer className="w-full bg-obsidian border-t border-iron font-mono py-16">
        <div className="max-w-[1128px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-2">
              <BugPlay className="w-5 h-5 text-voltage" />
              <span className="font-syne font-bold text-lg text-chalk">Townhall</span>
            </div>
            <p className="font-mono text-[12px] text-ash/70 leading-5">
              Ship with confidence.<br />Test each other.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <h6 className="font-mono font-medium text-[14px] text-chalk mb-1">Product</h6>
            <Link href="#how-it-works" className="font-mono text-[13px] text-ash hover:text-chalk transition-colors duration-150">How it Works</Link>
            <Link href="#community" className="font-mono text-[13px] text-ash hover:text-chalk transition-colors duration-150">Explore Projects</Link>
          </div>
          <div className="flex flex-col gap-3">
            <h6 className="font-mono font-medium text-[14px] text-chalk mb-1">Community</h6>
            <Link href="/guidelines" className="font-mono text-[13px] text-ash hover:text-chalk transition-colors duration-150">Guidelines</Link>
            <Link href="#" className="text-ash hover:text-chalk transition-colors duration-150" aria-label="X (Twitter)">
              <NextImage src="/images/logo-white.png" alt="X" width={16} height={16} className="opacity-60 hover:opacity-100 transition-opacity duration-150" unoptimized />
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            <h6 className="font-mono font-medium text-[14px] text-chalk mb-1">Legal</h6>
            <Link href="/privacy" className="font-mono text-[13px] text-ash hover:text-chalk transition-colors duration-150">Privacy Policy</Link>
            <Link href="/terms" className="font-mono text-[13px] text-ash hover:text-chalk transition-colors duration-150">Terms of Service</Link>
          </div>
        </div>
        <div className="max-w-[1128px] mx-auto px-6 mt-12 pt-8 border-t border-iron">
          <span className="font-mono text-[12px] text-ash/50">
            &copy; {new Date().getFullYear()} Townhall. All rights reserved.
          </span>
        </div>
      </footer>

    </div>
  );
}
