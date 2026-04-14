"use client";

import { motion } from "framer-motion";
import { signInWithGoogle } from "@/actions/auth";
import { Telescope, Code2, Users, ArrowRight, ShieldCheck, Zap, BugPlay } from "lucide-react";

export default function Home() {
  const fadeUp: any = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  const staggerContainer: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans relative">
      {/* Absolute strict 8pt grid background pattern to sell mathematical alignment */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Navbar */}
      <motion.nav 
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full h-20 px-4 md:px-8 max-w-7xl mx-auto flex items-center justify-between z-50 relative border-b border-outline-variant/50"
      >
        <div className="flex items-center gap-3">
          <BugPlay size={24} color="#ffff" className="text-surface" />
          <span className="text-xl font-bold text-on-surface tracking-tight">Townhall</span>
        </div>
        
        <form action={signInWithGoogle}>
          <button 
            type="submit"
            className="h-10 px-5 bg-surface hover:bg-surface-container border border-outline-variant text-sm text-on-surface font-medium rounded-full flex items-center gap-2 transition-colors hover:shadow-m3-1"
          >
            Sign In
          </button>
        </form>
      </motion.nav>

      <main className="flex-1 w-full flex flex-col relative z-10">
        {/* Soft Minimalist Hero Section */}
        <section className="w-full max-w-7xl mx-auto px-4 md:px-8 pt-24 pb-32 flex flex-col lg:flex-row items-center gap-16">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="flex-1 flex flex-col items-start"
          >
            <motion.div variants={fadeUp} className="px-3 py-1 mb-8 rounded-full border border-outline-variant bg-surface-container-low text-secondary text-xs font-medium uppercase tracking-widest flex items-center gap-2">
              <Zap size={12} className="text-on-surface" />
              The Missing Link in QA
            </motion.div>
            
            {/* Stark Typography: Massive Headers */}
            <motion.h1 variants={fadeUp} className="text-6xl md:text-8xl font-medium text-on-surface leading-[1.05] tracking-tighter mb-8">
              Build better <br />
              <span className="text-secondary italic font-light">
                together.
              </span>
            </motion.h1>
            
            {/* Stark Typography: Modest Body text */}
            <motion.p variants={fadeUp} className="text-sm md:text-base text-secondary max-w-xl mb-12 leading-relaxed">
              Townhall perfectly connects passionate developers with real-world testers. Discover issues before your users do, and build software that truly lasts with precision and trust.
            </motion.p>
            
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <form action={signInWithGoogle} className="w-full sm:w-auto">
                <button 
                  type="submit"
                  className="group h-12 px-6 w-full sm:w-auto bg-on-surface text-surface rounded-full flex items-center justify-center gap-3 hover:bg-white/90 transition-all font-medium text-sm shadow-m3-2"
                >
                  <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Get Started
                </button>
              </form>
              <a href="#features" className="h-12 px-6 w-full sm:w-auto bg-transparent border border-outline-variant text-on-surface hover:bg-surface-container-low rounded-full flex items-center justify-center transition-all font-medium text-sm">
                Learn More
              </a>
            </motion.div>
          </motion.div>

          {/* Hero Visual - Subdued, geometric, bordered areas */}
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="flex-1 w-full relative"
          >
            <div className="w-full aspect-[4/3] bg-surface-container rounded-2xl shadow-m3-2 border border-outline-variant p-6 flex flex-col overflow-hidden relative">
              {/* Fake UI Header purely greyscale */}
              <div className="flex items-center gap-2 mb-8">
                <div className="w-2.5 h-2.5 rounded-full bg-outline-variant" />
                <div className="w-2.5 h-2.5 rounded-full bg-outline-variant" />
                <div className="w-2.5 h-2.5 rounded-full bg-outline-variant" />
              </div>
              
              {/* Fake UI Content */}
              <div className="flex-1 flex gap-4">
                <div className="w-1/3 h-full bg-surface rounded-xl border border-outline-variant flex flex-col gap-3 p-4">
                  <div className="w-full h-8 bg-surface-variant rounded flex items-center px-3">
                    <div className="w-16 h-2 bg-outline rounded-full opacity-50" />
                  </div>
                  <div className="w-3/4 h-8 bg-surface-variant rounded flex items-center px-3">
                     <div className="w-12 h-2 bg-outline rounded-full opacity-50" />
                  </div>
                  <div className="w-full h-32 bg-surface-container-low rounded mt-auto border border-outline-variant border-dashed opacity-50 flex items-center justify-center">
                    <Code2 className="text-outline w-6 h-6 opacity-30" />
                  </div>
                </div>
                <div className="flex-1 h-full bg-surface rounded-xl border border-outline-variant p-6 flex flex-col gap-4 shadow-m3-1">
                  <div className="w-1/3 h-4 bg-on-surface rounded-full mb-2" />
                  <div className="w-full h-2 bg-surface-variant rounded-full" />
                  <div className="w-5/6 h-2 bg-surface-variant rounded-full" />
                  <div className="w-4/6 h-2 bg-surface-variant rounded-full" />
                  
                  <div className="mt-auto flex gap-4">
                    <div className="flex-1 h-16 bg-surface-variant rounded-lg flex items-center justify-center border border-outline-variant">
                      <Telescope size={20} className="text-secondary opacity-50" />
                    </div>
                    <div className="flex-1 h-16 bg-surface-variant rounded-lg flex items-center justify-center border border-outline-variant">
                      <Users size={20} className="text-secondary opacity-50" />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating badge */}
              <motion.div 
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute right-4 top-24 bg-surface px-4 py-3 rounded-xl shadow-m3-2 border border-outline-variant flex items-center gap-3"
              >
                <div className="w-6 h-6 rounded bg-on-surface text-surface flex items-center justify-center">
                  <ShieldCheck size={14} />
                </div>
                <p className="text-xs font-semibold text-on-surface tracking-wide uppercase">Verified</p>
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* Features Section - Defined by subtle borders */}
        <section id="features" className="w-full bg-surface-container-low border-y border-outline-variant py-32">
          <div className="max-w-7xl mx-auto px-4 md:px-8">
            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="text-center max-w-2xl mx-auto mb-20"
            >
              <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-semibold text-on-surface mb-6 tracking-tight">Systematic Quality</motion.h2>
              <motion.p variants={fadeUp} className="text-sm md:text-base text-secondary">Everything you need to orchestrate perfect testing loops. Mathematically aligned for your workflow.</motion.p>
            </motion.div>

            <motion.div 
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainer}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {[
                {
                  icon: <Code2 size={20} />,
                  title: "For Developers",
                  desc: "Create projects, define testing missions, and get actionable user feedback delivered straight to your dashboard."
                },
                {
                  icon: <Telescope size={20} />,
                  title: "For Testers",
                  desc: "Explore exciting new products, complete meaningful missions, and earn reputation in the Townhall ecosystem."
                },
                {
                  icon: <ShieldCheck size={20} />,
                  title: "Quality Assurance",
                  desc: "Bridge the gap between code completion and user satisfaction with real-world, unscripted edge-case testing."
                }
              ].map((feature, i) => (
                <motion.div 
                  key={i}
                  variants={fadeUp}
                  className="bg-surface rounded-2xl p-8 border border-outline-variant hover:border-outline hover:shadow-m3-1 transition-all group"
                >
                  <div className="w-12 h-12 bg-surface-variant text-on-surface rounded-xl flex items-center justify-center mb-8 transition-colors border border-outline-variant">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-medium text-on-surface mb-4 tracking-tight">{feature.title}</h3>
                  <p className="text-sm text-secondary leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* About / CTA section */}
        <section className="w-full py-40 relative flex items-center justify-center">
          <div className="max-w-3xl px-4 text-center">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <h2 className="text-5xl md:text-6xl font-medium text-on-surface mb-8 tracking-tighter">Enter the grid.</h2>
              <p className="text-sm md:text-base text-secondary mx-auto mb-12 max-w-xl leading-relaxed">
                Whether you're pushing your first app to production or you're a seasoned tester, Townhall provides the structure you need. Stop guessing what users want.
              </p>
              
              <form action={signInWithGoogle} className="inline-block">
                <button 
                  type="submit"
                  className="h-14 px-8 bg-on-surface text-surface rounded-full flex items-center justify-center gap-3 hover:bg-white/90 transition-all font-medium text-sm shadow-m3-2 group"
                >
                  Start Building
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-outline-variant bg-surface py-8">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-on-surface text-sm">home_work</span>
            <span className="text-sm font-semibold text-on-surface">Townhall</span>
          </div>
          <p className="text-xs text-secondary">
            © {new Date().getFullYear()} Townhall Inc.
          </p>
        </div>
      </footer>
    </div>
  );
}