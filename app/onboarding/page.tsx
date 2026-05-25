import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BugPlay, Telescope, Target, FileText, Camera, MessageSquare, Settings,
  ArrowRight, AlertTriangle,
} from "lucide-react";
import { completeOnboarding } from "@/actions/onboarding";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Welcome to Townhall — Onboarding" };

export default async function OnboardingPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, accepted_terms_at, completed_onboarding_at")
    .eq("id", user.id)
    .maybeSingle();

  // Admins don't go through the onboarding flow.
  if (profile?.role === "admin") {
    redirect("/admin");
  }

  if (!profile?.accepted_terms_at) {
    redirect("/terms-accept");
  }

  const isFirstTime = !profile?.completed_onboarding_at;

  return (
    <div className="min-h-screen bg-bone text-midnight font-mono flex flex-col selection:bg-voltage selection:text-obsidian">

      {/* Nav */}
      <header className="border-b border-midnight/10 bg-bone/85 backdrop-blur-md">
        <div className="max-w-[1128px] mx-auto px-6 h-[60px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BugPlay className="w-5 h-5 text-midnight" />
            <span className="font-syne font-bold text-[18px] text-midnight">Townhall</span>
          </div>
          {!isFirstTime && (
            <Link
              href="/explore"
              className="font-mono text-[13px] text-midnight/70 hover:text-midnight transition-colors duration-150"
            >
              ← Back to Explore
            </Link>
          )}
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-midnight/10">
        <div className="max-w-[760px] mx-auto px-6 py-16 text-center">
          {isFirstTime && (
            <p className="font-mono text-[12px] text-forest uppercase tracking-[1.5px] mb-3">
              Step 2 of 2
            </p>
          )}
          <h1 className="font-syne font-bold text-[40px] leading-[48px] tracking-[-0.5px] text-midnight mb-4">
            Welcome to Townhall.
          </h1>
          <p className="font-mono text-[15px] leading-7 text-midnight/70 max-w-[560px] mx-auto">
            Townhall runs on reciprocity — you test others so others will test you. No points, no rewards, just developers helping developers ship better work.
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1">
        <div className="max-w-[760px] mx-auto px-6 py-14 flex flex-col gap-14">

          {/* The Loop */}
          <Section
            label="The Loop"
            title="How the platform works"
            description="Every interaction on Townhall follows the same loop: submit, test, get tested. Here's the full picture."
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <LoopCard
                num="01"
                title="Submit your project"
                copy="Create a project with a name, URL, and brief description so testers know what they're looking at."
              />
              <LoopCard
                num="02"
                title="Community tests it"
                copy="Developers pick up your missions, visit your app, and submit written feedback with screenshots."
              />
              <LoopCard
                num="03"
                title="You test theirs"
                copy="Browse projects from other developers and return the favor. Reciprocity keeps the community alive."
              />
            </div>
          </Section>

          {/* Page-by-page walkthrough */}
          <Section
            label="The Pages"
            title="What you'll see, page by page"
            description="A quick tour of every important page in the app so nothing feels unfamiliar on your first visit."
          >
            <div className="flex flex-col gap-3">
              <PageRow
                icon={Telescope}
                title="Explore"
                href="/explore"
                copy="The main feed. Browse every active project in the community and click any card to see its missions. This is where most of your testing time will be spent."
              />
              <PageRow
                icon={Target}
                title="Browse Missions"
                href="/explore/missions"
                copy="A flat list of every open mission, across every project. Use it when you want to pick a quick task to test rather than diving into a full project."
              />
              <PageRow
                icon={FileText}
                title="My Projects"
                href="/dashboard"
                copy="Where everything you've submitted lives. Open any project to see its missions, the feedback received, and tester activity."
              />
              <PageRow
                icon={Target}
                title="My Missions"
                href="/dashboard/missions"
                copy="The missions you've personally tested for other developers. Track your contribution to the community here."
              />
              <PageRow
                icon={MessageSquare}
                title="Feedback Received"
                href="/dashboard/feedback"
                copy="All the feedback your projects have received from testers, gathered into one place. Read, learn, and ship better."
              />
              <PageRow
                icon={Settings}
                title="Settings"
                href="/settings"
                copy="Manage your display name, email preferences, and account. You can also delete your account from here at any time."
              />
            </div>
          </Section>

          {/* How to test */}
          <Section
            label="Testing flow"
            title="How to test a mission"
            description="When you pick up a mission, follow these steps to submit feedback that actually helps the developer."
          >
            <ol className="flex flex-col gap-4">
              <Step
                num="1"
                title="Read the mission brief"
                body="Each mission has a focus area and instructions from the submitter. Read it carefully before opening the app — it tells you exactly what to look at."
              />
              <Step
                num="2"
                title="Visit the project URL"
                body="Open the project in a new tab and walk through the experience as a real user would. Follow the mission's focus area first."
              />
              <Step
                num="3"
                icon={Camera}
                title="Capture a screenshot"
                body="A screenshot is required for every submission — it's the proof of visit that keeps the community honest. It also gives the developer visual context for your feedback."
              />
              <Step
                num="4"
                title="Submit written feedback"
                body="Be specific. Tell the developer what worked, what confused you, and what could be clearer. Vague feedback like 'looks good' doesn't help — actionable observations do."
              />
            </ol>
          </Section>

          {/* Submitting a project */}
          <Section
            label="As a submitter"
            title="How to submit your own project"
            description="When you're ready to get feedback on something you've built, here's the flow."
          >
            <ol className="flex flex-col gap-4">
              <Step
                num="1"
                title="Create a project"
                body="Click 'New Project' from the top nav. Add the name, public URL, and a brief summary of what you built."
              />
              <Step
                num="2"
                title="Add at least one mission"
                body="A mission is one specific area you want tested — onboarding, a checkout flow, a particular page. The narrower the focus, the better the feedback."
              />
              <Step
                num="3"
                title="Wait for testers"
                body="Once your missions are live, the community can pick them up. Feedback rolls in over time — return the favor by testing other projects while you wait."
              />
            </ol>

            {/* DRAFT status callout */}
            <div className="mt-6 border border-midnight/10 bg-voltage/10 rounded-[12px] p-5 flex gap-4">
              <div className="w-9 h-9 rounded-[8px] bg-white border border-midnight/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-midnight" />
              </div>
              <div className="flex-1">
                <p className="font-mono text-[11px] text-forest uppercase tracking-[1px] mb-1.5">
                  Heads up · Project status
                </p>
                <p className="font-syne font-bold text-[16px] text-midnight mb-2">
                  A project without a mission stays in DRAFT
                </p>
                <p className="font-mono text-[13px] leading-6 text-midnight/70">
                  Creating a project is only step one — until you add at least one mission, it stays in <span className="text-midnight font-medium">DRAFT</span> and will <span className="text-midnight font-medium">not appear on the Explore page</span>. Other developers can only discover and test your project once it has a live mission attached.
                </p>
              </div>
            </div>
          </Section>

          {/* House rules */}
          <Section
            label="House rules"
            title="A few ground rules"
            description="Townhall stays useful because everyone holds the same line. Read the full guidelines anytime."
          >
            <ul className="flex flex-col gap-3">
              <Rule text="Be specific and constructive — critique the work, not the person." />
              <Rule text="Stick to the mission's focus area. Note other things briefly if they matter, but stay on brief." />
              <Rule text="Always include a screenshot. Feedback without one cannot be submitted." />
              <Rule text="Don't game the system. Low-quality feedback to farm credits hurts the whole community." />
              <Rule text="Respect external projects. When a mission sends you to a developer's app, behave as a guest." />
            </ul>
            <div className="mt-5">
              <Link
                href="/guidelines"
                target="_blank"
                className="font-mono text-[13px] text-forest hover:underline inline-flex items-center gap-1"
              >
                Read the full Community Guidelines <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </Section>

          {/* CTA */}
          <div className="border-t border-midnight/10 pt-10">
            {isFirstTime ? (
              <form action={completeOnboarding} className="flex flex-col items-start gap-4">
                <h2 className="font-syne font-bold text-[24px] leading-[32px] text-midnight">
                  Ready to dive in?
                </h2>
                <p className="font-mono text-[14px] leading-7 text-midnight/70 max-w-[480px]">
                  Click below to finish onboarding and land on the Explore page. You can revisit this guide anytime from the sidebar.
                </p>
                <button
                  type="submit"
                  className="h-11 px-5 inline-flex items-center gap-2 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 cursor-pointer"
                >
                  Get Started <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div className="flex flex-col items-start gap-4">
                <h2 className="font-syne font-bold text-[24px] leading-[32px] text-midnight">
                  Need to do something else?
                </h2>
                <p className="font-mono text-[14px] leading-7 text-midnight/70 max-w-[480px]">
                  This guide is always here when you need a refresher. Jump back into the app whenever you're ready.
                </p>
                <Link
                  href="/explore"
                  className="h-11 px-5 inline-flex items-center gap-2 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 cursor-pointer"
                >
                  Back to Explore <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Footer — dark, matches landing */}
      <footer className="w-full bg-obsidian font-mono">
        <div className="max-w-[1128px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-mono text-[12px] text-ash/60">© {new Date().getFullYear()} Townhall. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/guidelines" className="font-mono text-[12px] text-ash/60 hover:text-chalk transition-colors duration-150">Guidelines</Link>
            <Link href="/privacy" className="font-mono text-[12px] text-ash/60 hover:text-chalk transition-colors duration-150">Privacy</Link>
            <Link href="/terms" className="font-mono text-[12px] text-ash/60 hover:text-chalk transition-colors duration-150">Terms</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

function Section({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="font-mono text-[11px] text-forest uppercase tracking-[1.5px] mb-3">{label}</p>
      <h2 className="font-syne font-bold text-[26px] leading-[34px] text-midnight mb-3">{title}</h2>
      <p className="font-mono text-[14px] leading-7 text-midnight/70 mb-6 max-w-[600px]">{description}</p>
      {children}
    </section>
  );
}

function LoopCard({ num, title, copy }: { num: string; title: string; copy: string }) {
  return (
    <div className="bg-white border border-midnight/10 rounded-[12px] p-5 relative">
      <span className="absolute top-4 right-5 font-syne font-bold text-[11px] tracking-[1px] text-midnight/30">{num}</span>
      <h3 className="font-syne font-bold text-[16px] text-midnight mb-2 pr-8">{title}</h3>
      <p className="font-mono text-[13px] leading-6 text-midnight/70">{copy}</p>
    </div>
  );
}

function PageRow({
  icon: Icon,
  title,
  href,
  copy,
}: {
  icon: React.ElementType;
  title: string;
  href: string;
  copy: string;
}) {
  return (
    <div className="flex gap-4 p-4 bg-white border border-midnight/10 rounded-[10px]">
      <div className="w-9 h-9 rounded-[8px] bg-bone border border-midnight/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-midnight" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1 flex-wrap">
          <p className="font-mono text-[14px] font-medium text-midnight">{title}</p>
          <span className="font-mono text-[12px] text-midnight/50">{href}</span>
        </div>
        <p className="font-mono text-[13px] leading-6 text-midnight/70">{copy}</p>
      </div>
    </div>
  );
}

function Step({
  num,
  title,
  body,
  icon: Icon,
}: {
  num: string;
  title: string;
  body: string;
  icon?: React.ElementType;
}) {
  return (
    <li className="flex gap-4">
      <span className="w-7 h-7 rounded-full bg-voltage/30 border border-midnight/10 text-midnight font-mono text-[12px] flex items-center justify-center shrink-0 mt-0.5">
        {num}
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-mono text-[14px] font-medium text-midnight">{title}</p>
          {Icon && <Icon className="w-3.5 h-3.5 text-midnight/60" />}
        </div>
        <p className="font-mono text-[13px] leading-6 text-midnight/70">{body}</p>
      </div>
    </li>
  );
}

function Rule({ text }: { text: string }) {
  return (
    <li className="flex gap-3">
      <span className="w-1.5 h-1.5 rounded-full bg-voltage shrink-0 mt-2.5" />
      <span className="font-mono text-[14px] leading-6 text-midnight/70">{text}</span>
    </li>
  );
}
