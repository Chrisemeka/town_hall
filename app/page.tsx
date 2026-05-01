"use client";

import { motion } from "framer-motion";
import { signInWithGoogle } from "@/actions/auth";
import { BugPlay, FileText, CheckCircle, Users } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  const fadeUp: any = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  const stagger: any = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  return (
    <div className="min-h-screen bg-bone text-midnight font-mono flex flex-col selection:bg-voltage selection:text-obsidian">
      
      {/* Sticky Nav */}
      <nav className="w-full h-16 sticky top-0 bg-bone/85 backdrop-blur-md z-50 border-b border-transparent transition-all duration-200">
        <div className="max-w-[1128px] mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BugPlay className="w-6 h-6 text-midnight" />
            <span className="font-syne font-bold text-xl tracking-tight">Townhall</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-6 text-sm text-midnight">
              <Link href="#how-it-works" className="hover:text-ash transition-colors">How It Works</Link>
              <Link href="#community" className="hover:text-ash transition-colors">Community</Link>
            </div>
            <div className="flex items-center gap-4">
              <form action={signInWithGoogle}>
                <button type="submit" className="text-sm font-medium text-midnight hover:text-ash transition-colors">
                  Sign In
                </button>
              </form>
              <form action={signInWithGoogle}>
                <button type="submit" className="h-8 px-3 bg-voltage text-obsidian rounded-md text-xs font-medium hover:bg-voltage-dark transition-colors flex items-center justify-center border border-transparent">
                  Get Started
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col">
        {/* Hero - Top to Bottom */}
        <section className="w-full pt-24 pb-24 relative overflow-hidden">
          <div className="max-w-[1128px] mx-auto px-6 flex flex-col items-center text-center">
            <motion.div initial="hidden" animate="visible" variants={stagger} className="flex flex-col items-center">
              <motion.h1 variants={fadeUp} className="font-syne font-bold text-5xl md:text-[64px] leading-[1.05] tracking-[-1px] mb-6 max-w-4xl text-midnight">
                Ship with confidence.<br />Test each other.
              </motion.h1>
              <motion.p variants={fadeUp} className="text-lg md:text-[18px] leading-7 text-midnight/70 max-w-2xl mb-8">
                Townhall is a peer-driven testing platform. Submit your project, test what others have built, and get real, unscripted feedback from developers just like you.
              </motion.p>
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4">
                <form action={signInWithGoogle}>
                  <button type="submit" className="h-12 px-6 bg-voltage text-obsidian rounded-md font-medium text-sm hover:bg-voltage-dark transition-colors w-full sm:w-auto">
                    Start Testing Free
                  </button>
                </form>
                <Link href="#community" className="h-12 px-6 bg-transparent border border-midnight text-midnight rounded-md font-medium text-sm hover:bg-midnight/5 transition-colors flex items-center justify-center w-full sm:w-auto">
                  Explore Community &rarr;
                </Link>
              </motion.div>
            </motion.div>

            {/* Dashboard Mockup - Top to bottom composition */}
            <motion.div 
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mt-16 w-full max-w-4xl aspect-[16/9] bg-obsidian rounded-2xl border border-iron shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-4 flex flex-col overflow-hidden relative"
            >
              {/* Top bar mockup */}
              <div className="h-10 border-b border-iron flex items-center px-4 gap-4 w-full">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-iron" />
                  <div className="w-2.5 h-2.5 rounded-full bg-iron" />
                  <div className="w-2.5 h-2.5 rounded-full bg-iron" />
                </div>
                <div className="h-5 w-48 bg-graphite rounded-md ml-4" />
              </div>
              <div className="flex-1 flex gap-4 mt-4">
                <div className="w-48 hidden md:flex flex-col gap-2">
                  <div className="h-6 w-full bg-graphite rounded-md opacity-50" />
                  <div className="h-6 w-3/4 bg-graphite rounded-md opacity-50" />
                  <div className="h-6 w-5/6 bg-graphite rounded-md opacity-50" />
                </div>
                <div className="flex-1 flex flex-col gap-4">
                  <div className="h-24 w-full bg-graphite rounded-xl border border-iron p-4 flex flex-col gap-2">
                     <div className="h-4 w-1/4 bg-iron rounded-md" />
                     <div className="h-3 w-1/2 bg-iron/50 rounded-md" />
                  </div>
                  <div className="h-24 w-full bg-graphite rounded-xl border border-iron p-4 flex flex-col gap-2">
                     <div className="h-4 w-1/3 bg-iron rounded-md" />
                     <div className="h-3 w-2/3 bg-iron/50 rounded-md" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* How The Loop Works (Light) */}
        <section id="how-it-works" className="w-full bg-bone py-24 text-midnight border-b border-black/5">
          <div className="max-w-[1128px] mx-auto px-6">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={stagger} className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
              <div className="flex flex-col relative z-10">
                <div className="text-[120px] font-syne font-bold leading-none text-midnight opacity-10 absolute -top-8 -left-4 pointer-events-none select-none">01</div>
                <FileText className="w-6 h-6 text-midnight mb-4" />
                <h4 className="font-syne font-bold text-2xl mb-2 text-midnight">Submit your project</h4>
                <p className="text-sm text-midnight/70">Create a project and define specific testing missions for the community to focus on.</p>
              </div>
              <div className="flex flex-col relative z-10">
                <div className="text-[120px] font-syne font-bold leading-none text-midnight opacity-10 absolute -top-8 -left-4 pointer-events-none select-none">02</div>
                <Users className="w-6 h-6 text-midnight mb-4" />
                <h4 className="font-syne font-bold text-2xl mb-2 text-midnight">Developers test it</h4>
                <p className="text-sm text-midnight/70">Real developers browse the feed, pick up your missions, and provide written feedback + screenshots.</p>
              </div>
              <div className="flex flex-col relative z-10">
                <div className="text-[120px] font-syne font-bold leading-none text-midnight opacity-10 absolute -top-8 -left-4 pointer-events-none select-none">03</div>
                <CheckCircle className="w-6 h-6 text-midnight mb-4" />
                <h4 className="font-syne font-bold text-2xl mb-2 text-midnight">Test theirs in return</h4>
                <p className="text-sm text-midnight/70">Reciprocity drives the platform. You test others' work, and they test yours. Everyone improves.</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* For Submitters (Light) */}
        <section className="w-full bg-white py-24">
          <div className="max-w-[1128px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 flex flex-col">
              <h2 className="font-syne font-bold text-4xl mb-4 tracking-tight">Structured feedback, not guesses.</h2>
              <p className="text-base text-midnight/70 mb-6 leading-relaxed">
                As a submitter, you don't just drop a link and hope for the best. You create specific <strong>Missions</strong>—telling testers exactly what flow to check and what you're worried about.
              </p>
              <ul className="flex flex-col gap-3 text-sm text-midnight/80">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-voltage-dark mt-1.5 shrink-0" />
                  Define clear testing boundaries.
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-voltage-dark mt-1.5 shrink-0" />
                  Get verified feedback with mandatory screenshot proof.
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-voltage-dark mt-1.5 shrink-0" />
                  Manage all insights in one central dashboard.
                </li>
              </ul>
            </div>
            <div className="lg:col-span-6 bg-bone rounded-xl border border-black/5 p-8 shadow-sm flex items-center justify-center aspect-[4/3]">
              <div className="w-full h-full border-2 border-dashed border-midnight/10 rounded-lg flex flex-col items-center justify-center text-midnight/30 gap-2">
                 <FileText className="w-8 h-8" />
                 <span className="text-sm font-medium">Mission Builder UI</span>
              </div>
            </div>
          </div>
        </section>

        {/* For Testers (Light) */}
        <section className="w-full bg-bone py-24 border-t border-black/5">
          <div className="max-w-[1128px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 bg-white rounded-xl border border-black/5 p-8 shadow-sm flex items-center justify-center aspect-[4/3] order-2 lg:order-1">
              <div className="w-full h-full border-2 border-dashed border-midnight/10 rounded-lg flex flex-col items-center justify-center text-midnight/30 gap-2">
                 <Users className="w-8 h-8" />
                 <span className="text-sm font-medium">Testing Workflow UI</span>
              </div>
            </div>
            <div className="lg:col-span-6 flex flex-col order-1 lg:order-2">
              <h2 className="font-syne font-bold text-4xl mb-4 tracking-tight">Frictionless testing.</h2>
              <p className="text-base text-midnight/70 mb-6 leading-relaxed">
                As a tester, you browse the community feed, pick a mission that interests you, and jump right in. The process is lightweight and entirely focused on the product.
              </p>
              <ul className="flex flex-col gap-3 text-sm text-midnight/80">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-voltage-dark mt-1.5 shrink-0" />
                  Discover new tools built by peers.
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-voltage-dark mt-1.5 shrink-0" />
                  Quickly submit feedback + proof without leaving the app.
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-voltage-dark mt-1.5 shrink-0" />
                  Build reputation by helping the community.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Community Proof */}
        <section id="community" className="w-full bg-white py-24 border-t border-black/5">
          <div className="max-w-[1128px] mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="font-syne font-bold text-3xl md:text-4xl mb-4">Projects waiting for your feedback right now</h2>
              <p className="text-sm text-midnight/60">Join hundreds of developers already testing each other's work.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Project Card Mockup 1 */}
              <div className="bg-graphite text-chalk rounded-2xl p-6 border border-iron shadow-card flex flex-col">
                 <div className="flex justify-between items-start mb-3">
                   <h5 className="font-syne font-bold text-xl text-chalk truncate">DevSync CLI</h5>
                   <span className="bg-voltage/10 text-voltage border border-voltage/20 px-2 py-0.5 rounded text-xs font-medium shrink-0">Needs Testers</span>
                 </div>
                 <p className="text-sm text-ash line-clamp-2 mb-4">A fast CLI tool for keeping local dev environments in perfect sync with staging.</p>
                 <a href="#" className="text-[13px] text-sky hover:underline mb-6 truncate">devsync.cli.dev</a>
                 <div className="mt-auto pt-4 border-t border-iron flex justify-between items-center">
                   <span className="text-xs text-ash">2 Missions &middot; 0 Feedbacks</span>
                   <button className="text-sm font-medium text-ash hover:text-chalk transition-colors">Test It &rarr;</button>
                 </div>
              </div>

              {/* Project Card Mockup 2 */}
              <div className="bg-graphite text-chalk rounded-2xl p-6 border border-iron shadow-card flex flex-col">
                 <div className="flex justify-between items-start mb-3">
                   <h5 className="font-syne font-bold text-xl text-chalk truncate">Palette Flow</h5>
                   <span className="bg-mint/10 text-mint border border-mint/20 px-2 py-0.5 rounded text-xs font-medium shrink-0">Active</span>
                 </div>
                 <p className="text-sm text-ash line-clamp-2 mb-4">Generative AI color palettes for modern web applications based on HSL theory.</p>
                 <a href="#" className="text-[13px] text-sky hover:underline mb-6 truncate">paletteflow.app</a>
                 <div className="mt-auto pt-4 border-t border-iron flex justify-between items-center">
                   <span className="text-xs text-ash">4 Missions &middot; 12 Feedbacks</span>
                   <button className="text-sm font-medium text-ash hover:text-chalk transition-colors">Test It &rarr;</button>
                 </div>
              </div>

              {/* Project Card Mockup 3 */}
              <div className="bg-graphite text-chalk rounded-2xl p-6 border border-iron shadow-card flex flex-col">
                 <div className="flex justify-between items-start mb-3">
                   <h5 className="font-syne font-bold text-xl text-chalk truncate">QueryMaster</h5>
                   <span className="bg-voltage/10 text-voltage border border-voltage/20 px-2 py-0.5 rounded text-xs font-medium shrink-0">Needs Testers</span>
                 </div>
                 <p className="text-sm text-ash line-clamp-2 mb-4">Visual SQL builder that connects directly to your Postgres database securely.</p>
                 <a href="#" className="text-[13px] text-sky hover:underline mb-6 truncate">querymaster.io</a>
                 <div className="mt-auto pt-4 border-t border-iron flex justify-between items-center">
                   <span className="text-xs text-ash">1 Mission &middot; 1 Feedback</span>
                   <button className="text-sm font-medium text-ash hover:text-chalk transition-colors">Test It &rarr;</button>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Strip */}
        <section className="w-full bg-obsidian py-24 border-t border-iron text-center">
          <div className="max-w-[1128px] mx-auto px-6 flex flex-col items-center">
            <h1 className="font-syne font-bold text-4xl md:text-5xl text-chalk mb-8 tracking-tight">Your next release deserves real feedback.</h1>
            <form action={signInWithGoogle}>
              <button type="submit" className="h-14 px-8 bg-voltage text-obsidian rounded-md font-medium text-base hover:bg-voltage-dark transition-colors">
                Start Testing Free
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full bg-obsidian border-t border-iron text-ash text-sm py-16">
        <div className="max-w-[1128px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-2">
              <BugPlay className="w-5 h-5 text-voltage" />
              <span className="font-syne font-bold text-lg text-chalk">Townhall</span>
            </div>
            <p className="text-xs text-ash/80">Ship with confidence. Test each other.</p>
          </div>
          <div className="flex flex-col gap-3">
            <h6 className="font-medium text-chalk mb-1">Product</h6>
            <Link href="#" className="hover:text-chalk transition-colors text-xs">How it Works</Link>
            <Link href="#" className="hover:text-chalk transition-colors text-xs">Explore Projects</Link>
          </div>
          <div className="flex flex-col gap-3">
            <h6 className="font-medium text-chalk mb-1">Community</h6>
            <Link href="#" className="hover:text-chalk transition-colors text-xs">Guidelines</Link>
            <Link href="#" className="hover:text-chalk transition-colors text-xs">Twitter</Link>
          </div>
          <div className="flex flex-col gap-3">
            <h6 className="font-medium text-chalk mb-1">Legal</h6>
            <Link href="#" className="hover:text-chalk transition-colors text-xs">Privacy</Link>
            <Link href="#" className="hover:text-chalk transition-colors text-xs">Terms</Link>
          </div>
        </div>
        <div className="max-w-[1128px] mx-auto px-6 mt-16 pt-8 border-t border-iron flex justify-between items-center text-xs text-ash/60">
          <span>&copy; {new Date().getFullYear()} Townhall.</span>
        </div>
      </footer>
    </div>
  );
}