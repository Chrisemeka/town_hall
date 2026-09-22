"use client";

import { motion } from "framer-motion";
import { signInWithGoogle } from "@/actions/auth";
import { FileText, CheckCircle, Users, ArrowRight } from "lucide-react";
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
    <>

      {/* ─── ① HERO ──────────────────────────────────────────────────────── */}
      <section className="w-full py-16 lg:py-24 bg-surface relative overflow-hidden">
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
                className="font-syne font-bold text-[52px] leading-[56px] lg:text-[80px] lg:leading-[84px] tracking-[-1.5px] text-ink mb-6"
              >
                Ship better.<br />Test each other.
              </motion.h1>
              <motion.p
               
                variants={fadeUp}
                className="font-sans text-[18px] leading-7 lg:text-[18px] lg:leading-8 text-ink mb-10 max-w-2xl"
              >
                Submit your project, define what to test, and get real feedback from developers — in return for testing theirs.
              </motion.p>
              <motion.div variants={fadeUp} className="mb-16">
                <form action={signInWithGoogle}>
                  <button
                   
                    type="submit"
                    className="h-14 px-7 inline-flex items-center justify-center gap-1.5 font-mono font-medium text-base text-ink rounded-[8px] hover:bg-ink/5 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    Continue with Google <ArrowRight className="w-[18px] h-[18px]" />
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
                alt="A dark-themed user interface for Twnhall, displaying the Explore Projects page. The screen features a left navigation sidebar and a main grid showing four project cards. Each card includes the project name, website URL, project status badge, mission/feedback metrics, and a Test It link."
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
      <section id="how-it-works" className="w-full bg-surface">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-20 lg:py-28">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
          >
            <motion.p variants={fadeUp} className="font-mono text-[12px] font-medium text-accent-ink uppercase tracking-[1px] mb-4">
              The Loop
            </motion.p>
            <motion.h2 variants={fadeUp} className="font-syne font-bold text-[40px] leading-[46px] lg:text-[44px] lg:leading-[50px] tracking-[-0.5px] text-ink mb-16">
              How it works.
            </motion.h2>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-line border-y border-line -mx-6 lg:-mx-8">
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
                  copy: "Real developers pick up your missions, visit your project, and submit written feedback with screenshots of what they saw.",
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
                  <span className="absolute top-6 right-6 lg:top-8 lg:right-8 font-syne font-bold text-[12px] tracking-[1px] text-ink-muted select-none">
                    {step.num}
                  </span>
                  <div className="flex flex-col gap-4">
                    {/* Deliberate inversion: a dark chip with a Voltage icon
                        on a light ground. Literal tokens rather than semantic
                        ones because it is meant to stay dark in both themes —
                        Graphite on Obsidian still reads. */}
                    <div className="w-11 h-11 rounded-[8px] bg-graphite border border-iron flex items-center justify-center">
                      {step.icon}
                    </div>
                    <h3 className="font-syne font-bold text-[22px] leading-7 tracking-[-0.2px] text-ink">{step.title}</h3>
                    <p className="font-sans text-[14px] leading-6 text-ink">{step.copy}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── ③ FOR SUBMITTERS ────────────────────────────────────────────── */}
      <section className="w-full bg-surface">
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
              <motion.p variants={fadeUp} className="font-mono text-[12px] font-medium text-accent-ink uppercase tracking-[1px] mb-4">
                For Submitters
              </motion.p>
              <motion.h2 variants={fadeUp} className="font-syne font-bold text-[40px] leading-[46px] lg:text-[44px] lg:leading-[50px] tracking-[-0.5px] text-ink mb-5">
                Structured feedback,<br />not guesses.
              </motion.h2>
              <motion.p variants={fadeUp} className="font-sans text-[16px] leading-8 text-ink max-w-md">
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
                alt="A dark-themed modal window titled Submit a Project with the subtitle Tell the community what you've built. The form contains three filled text fields: Project Name, Project URL, and a highlighted Brief Summary text area. At the bottom, there is a prominent yellow Create Project button and a dark Cancel button."
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
      <section className="w-full bg-surface">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 border-t border-line py-20 lg:py-28">
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
                alt="A dark-themed user interface showing a mission page. At the bottom is a prominent yellow action button that reads Open Project in New Tab."
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
              <motion.p variants={fadeUp} className="font-mono text-[12px] font-medium text-accent-ink uppercase tracking-[1px] mb-4">
                For Testers
              </motion.p>
              <motion.h2 variants={fadeUp} className="font-syne font-bold text-[40px] leading-[46px] lg:text-[44px] lg:leading-[50px] tracking-[-0.5px] text-ink mb-5">
                Frictionless testing.
              </motion.h2>
              <motion.p variants={fadeUp} className="font-sans text-[16px] leading-8 text-ink max-w-md">
                Browse the community feed, pick a mission, and jump in. Clear instructions tell you exactly what to test — no guessing, no wasted time. Every mission ships with a test case — ordered steps and what each one should do — so the few minutes you spend testing turn into feedback that actually moves the project forward.
              </motion.p>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ─── ⑤ COMMUNITY PROOF / LIVE FEED ──────────────────────────────── */}
      <section id="community" className="w-full bg-surface">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 border-t border-line py-20 lg:py-28">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="font-syne font-bold text-[40px] leading-[46px] lg:text-[44px] lg:leading-[50px] tracking-[-0.5px] text-ink mb-4">
              Projects waiting for your feedback right now
            </h2>
            <p className="font-sans text-[15px] leading-7 text-ink">
              Join hundreds of developers already testing each other&apos;s work.
            </p>
          </div>

          <NextImage
            src="/images/community-cards.svg"
            alt="Three dark-themed Community project cards displayed side-by-side — DevSync CLI, Palette Flow, and QueryMaster"
            width={1104}
            height={226}
            className="w-full"
            unoptimized
          />
        </div>
      </section>


      {/* ─── ⑦ FINAL CTA STRIP ───────────────────────────────────────────── */}
      <section className="w-full bg-surface text-center">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 border-t border-line py-20 lg:py-28 flex flex-col items-center">
          <h2 className="font-syne font-bold text-[36px] leading-[40px] lg:text-[56px] lg:leading-[60px] tracking-[-0.5px] text-ink mb-8 max-w-3xl">
            Your next release deserves real feedback.
          </h2>
        </div>
      </section>

    </>
  );
}
