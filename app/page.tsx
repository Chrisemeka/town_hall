"use client";

import { motion } from "framer-motion";
import { signInWithGoogle } from "@/actions/auth";
import { BugPlay, FileText, CheckCircle, Users, ArrowRight } from "lucide-react";
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
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 h-full flex items-center justify-between gap-6">

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <BugPlay className="w-5 h-5 text-midnight" />
            <span className="font-syne font-bold text-lg tracking-tight text-midnight">Twnhall</span>
          </div>

          {/* Right group: links + CTA */}
          <div className="flex items-center gap-8 lg:gap-10">
            <div className="hidden md:flex items-center gap-7 lg:gap-9">
              <Link href="#how-it-works" className="font-mono text-[14px] text-midnight/70 hover:text-midnight transition-colors duration-150">
                How It Works
              </Link>
              <Link href="#community" className="font-mono text-[14px] text-midnight/70 hover:text-midnight transition-colors duration-150">
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
          <div className="max-w-[1200px] mx-auto px-6 lg:px-8 relative">
            <div className="flex flex-col items-center text-center">

              <motion.div
                initial="hidden"
                animate="visible"
                variants={stagger}
                className="flex flex-col items-center"
              >
                <motion.h1
                  variants={fadeUp}
                  className="font-syne font-bold text-[52px] leading-[56px] lg:text-[80px] lg:leading-[84px] tracking-[-1.5px] text-midnight mb-6"
                >
                  Ship better.<br />Test each other.
                </motion.h1>
                <motion.p
                  variants={fadeUp}
                  className="font-mono text-[18px] leading-7 lg:text-[18px] lg:leading-8 text-midnight/70 mb-10 max-w-2xl"
                >
                  Submit your project, define what to test, and get real feedback from developers — in return for testing theirs.
                </motion.p>
                <motion.div variants={fadeUp} className="mb-16">
                  <form action={signInWithGoogle}>
                    <button
                      type="submit"
                      className="h-14 px-7 inline-flex items-center justify-center gap-1.5 font-mono font-medium text-base text-midnight rounded-[8px] hover:bg-midnight/5 transition-colors duration-150 cursor-pointer"
                    >
                      Explore Projects <ArrowRight className="w-[18px] h-[18px]" />
                    </button>
                  </form>
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
                  alt="Twnhall app dashboard preview"
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
        <section id="how-it-works" className="w-full bg-bone">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-20 lg:py-28">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={stagger}
            >
              <motion.p variants={fadeUp} className="font-mono text-[12px] font-medium text-forest uppercase tracking-[1px] mb-4">
                The Loop
              </motion.p>
              <motion.h2 variants={fadeUp} className="font-syne font-bold text-[40px] leading-[46px] lg:text-[44px] lg:leading-[50px] tracking-[-0.5px] text-midnight mb-16">
                How it works.
              </motion.h2>

              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-midnight/10 border-y border-midnight/10 -mx-6 lg:-mx-8">
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
                  <motion.div key={i} variants={fadeUp} className="relative flex flex-col px-6 lg:px-8 pt-14 pb-10 lg:pt-16 lg:pb-12 min-h-[240px]">
                    {/* Step number — top-right tag */}
                    <span className="absolute top-6 right-6 lg:top-8 lg:right-8 font-syne font-bold text-[12px] tracking-[1px] text-midnight/30 select-none">
                      {step.num}
                    </span>
                    <div className="flex flex-col gap-4">
                      <div className="w-11 h-11 rounded-[8px] bg-graphite border border-iron flex items-center justify-center">
                        {step.icon}
                      </div>
                      <h4 className="font-syne font-bold text-[22px] leading-7 tracking-[-0.2px] text-midnight">{step.title}</h4>
                      <p className="font-mono text-[14px] leading-6 text-midnight/60">{step.copy}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── ③ FOR SUBMITTERS ────────────────────────────────────────────── */}
        <section className="w-full bg-bone">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-20 lg:py-28">
            <div className="grid grid-cols-12 gap-8 lg:gap-12 items-center">

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
                <motion.h2 variants={fadeUp} className="font-syne font-bold text-[40px] leading-[46px] lg:text-[44px] lg:leading-[50px] tracking-[-0.5px] text-midnight mb-5">
                  Structured feedback,<br />not guesses.
                </motion.h2>
                <motion.p variants={fadeUp} className="font-mono text-[16px] leading-8 text-midnight/70 max-w-md">
                  Define exactly what you need tested, where you want eyes, and what you&apos;re worried about. Missions give testers a clear brief — so you get specific, actionable feedback instead of vague impressions. Whether you&apos;re chasing edge cases, pressure-testing onboarding, or sanity-checking a new flow, every project ships with a list of asks the community can pick up and run with.
                </motion.p>
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
        <section className="w-full bg-bone">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-8 border-t border-midnight/10 py-20 lg:py-28">
            <div className="grid grid-cols-12 gap-8 lg:gap-12 items-center">

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
                <motion.h2 variants={fadeUp} className="font-syne font-bold text-[40px] leading-[46px] lg:text-[44px] lg:leading-[50px] tracking-[-0.5px] text-midnight mb-5">
                  Frictionless testing.
                </motion.h2>
                <motion.p variants={fadeUp} className="font-mono text-[16px] leading-8 text-midnight/70 max-w-md">
                  Browse the community feed, pick a mission, and jump in. Clear instructions tell you exactly what to test — no guessing, no wasted time. Every mission ships with focus areas and a brief from the builder, so the few minutes you spend testing turn into feedback that actually moves the project forward.
                </motion.p>
              </motion.div>

            </div>
          </div>
        </section>

        {/* ─── ⑤ COMMUNITY PROOF / LIVE FEED ──────────────────────────────── */}
        <section id="community" className="w-full bg-bone">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-8 border-t border-midnight/10 py-20 lg:py-28">
            <div className="text-center mb-16 max-w-2xl mx-auto">
              <h2 className="font-syne font-bold text-[40px] leading-[46px] lg:text-[44px] lg:leading-[50px] tracking-[-0.5px] text-midnight mb-4">
                Projects waiting for your feedback right now
              </h2>
              <p className="font-mono text-[15px] leading-7 text-midnight/60">
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
        <section className="w-full bg-bone text-center">
          <div className="max-w-[1200px] mx-auto px-6 lg:px-8 border-t border-midnight/10 py-20 lg:py-28 flex flex-col items-center">
            <h1 className="font-syne font-bold text-[36px] leading-[40px] lg:text-[56px] lg:leading-[60px] tracking-[-0.5px] text-midnight mb-8 max-w-3xl">
              Your next release deserves real feedback.
            </h1>
          </div>
        </section>

      </main>

      {/* ─── ⑧ FOOTER ────────────────────────────────────────────────────── */}
      <footer className="w-full bg-obsidian font-mono">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-16 lg:py-20">

          {/* Upper area */}
          <div className="flex flex-col lg:flex-row lg:justify-between gap-12 pb-12 lg:pb-16">

            {/* Brand block */}
            <div className="flex flex-col gap-5 max-w-sm">
              <div className="flex items-center gap-2">
                <BugPlay className="w-6 h-6 text-voltage" />
                <span className="font-syne font-bold text-[22px] text-chalk">Twnhall</span>
              </div>
              <p className="font-mono text-[14px] text-ash/80 leading-6">
                Ship with confidence. Test each other.
              </p>
              <form action={signInWithGoogle} className="mt-2">
                <button
                  type="submit"
                  className="h-10 px-5 inline-flex items-center justify-center border border-ash/30 text-chalk rounded-full font-mono font-medium text-[13px] hover:bg-chalk/[0.06] hover:border-chalk/40 transition-colors duration-150 cursor-pointer"
                >
                  Start Testing Free
                </button>
              </form>
            </div>

            {/* Link columns */}
            <div className="flex flex-row gap-16 lg:gap-24">
              <div className="flex flex-col gap-3">
                <h6 className="font-mono font-medium text-[13px] text-chalk mb-2">Product</h6>
                <Link href="#how-it-works" className="font-mono text-[13px] text-ash hover:text-chalk transition-colors duration-150">How it Works</Link>
              </div>
              <div className="flex flex-col gap-3">
                <h6 className="font-mono font-medium text-[13px] text-chalk mb-2">Community</h6>
                <Link href="/guidelines" className="font-mono text-[13px] text-ash hover:text-chalk transition-colors duration-150">Guidelines</Link>
                <Link href="#" className="font-mono text-[13px] text-ash hover:text-chalk transition-colors duration-150">X (Twitter)</Link>
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="border-t border-iron pt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-mono text-[12px] text-ash/60">
              &copy; {new Date().getFullYear()} Twnhall. All rights reserved.
            </span>
            <span className="text-ash/30 text-[10px]">·</span>
            <Link href="/privacy" className="font-mono text-[12px] text-ash/60 hover:text-chalk transition-colors duration-150">Privacy Policy</Link>
            <span className="text-ash/30 text-[10px]">·</span>
            <Link href="/terms" className="font-mono text-[12px] text-ash/60 hover:text-chalk transition-colors duration-150">Terms of Service</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
