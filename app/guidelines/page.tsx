import Link from "next/link";
import { Logo } from "@/components/Logo";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Community Guidelines — Twnhall" };

export default function GuidelinesPage() {
  return (
    <div className="min-h-screen bg-bone text-midnight font-mono flex flex-col selection:bg-voltage selection:text-obsidian">

      {/* Nav */}
      <header className="border-b border-midnight/10 bg-bone/85 backdrop-blur-md">
        <div className="max-w-[1128px] mx-auto px-6 h-[60px] flex items-center justify-between">
          <Link tabIndex={0} href="/" className="flex items-center gap-2">
            <Logo  size={40} />
            <span className="font-syne font-bold text-[18px] text-midnight">Twnhall</span>
          </Link>
          <Link
            tabIndex={0}
            href="/"
            className="font-mono text-[13px] text-midnight/70 hover:text-midnight transition-colors duration-150"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-midnight/10">
        <div className="max-w-[720px] mx-auto px-6 py-16">
          <p tabIndex={0} className="font-mono text-[12px] text-forest uppercase tracking-[1.5px] mb-4">Community</p>
          <h1 tabIndex={0} className="font-syne font-bold text-[40px] leading-[48px] tracking-[-0.5px] text-midnight mb-4">
            Community Guidelines
          </h1>
          <p tabIndex={0} className="font-mono text-[15px] leading-7 text-midnight/70">
            Twnhall runs on reciprocity. Read this once and you&apos;ll understand everything about how and why this community works.
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-[720px] w-full mx-auto px-6 py-16">
        <div className="flex flex-col gap-12">

          {/* The Social Contract */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span tabIndex={0} className="font-mono text-[11px] text-forest uppercase tracking-[1.5px]">The Foundation</span>
            </div>
            <h2 tabIndex={0} className="font-syne font-bold text-[28px] leading-[36px] text-midnight mb-4">
              The Social Contract
            </h2>
            <div className="border-l-2 border-voltage bg-voltage/10 rounded-r-[8px] px-6 py-5 mb-6">
              <p tabIndex={0} className="font-mono text-[15px] leading-7 text-midnight">
                &quot;Ship with confidence. Test each other.&quot;
              </p>
            </div>
            <div className="flex flex-col gap-4 font-mono text-[14px] leading-7 text-midnight/70">
              <p tabIndex={0}>
                Twnhall is purely community-driven — no points, no rewards, no leaderboards. The platform exists because developers help each other. The implicit incentive is <span className="text-midnight">reciprocity</span>: you test others so others will test you.
              </p>
              <p tabIndex={0}>
                This isn&apos;t a SaaS tool. It&apos;s a shared workspace where peers hold each other accountable. The energy here should feel collaborative and direct — developer to developer.
              </p>
            </div>
          </div>

          <Divider />

          {/* How It Works */}
          <div>
            <h2 tabIndex={0} className="font-syne font-bold text-[28px] leading-[36px] text-midnight mb-6">
              How It Works
            </h2>
            <div className="flex flex-col gap-8">
              <Role
                label="As a Submitter"
                steps={[
                  "Create a project — fill in the name, URL, and a brief summary of what you built.",
                  "Create Missions — each mission defines one specific area for testers to focus on.",
                  "Wait for community testers to pick up your missions and submit written feedback.",
                ]}
              />
              <Role
                label="As a Tester"
                steps={[
                  "Browse available projects and missions from the community feed.",
                  "Pick a mission, visit the project URL, and follow the tester's instructions.",
                  "Submit written feedback and a screenshot as proof of visit, tied directly to that mission.",
                ]}
              />
            </div>
          </div>

          <Divider />

          {/* Proof of Visit */}
          <div>
            <h2 tabIndex={0} className="font-syne font-bold text-[28px] leading-[36px] text-midnight mb-4">
              The Screenshot Requirement
            </h2>
            <div className="flex flex-col gap-4 font-mono text-[14px] leading-7 text-midnight/70">
              <p tabIndex={0}>
                Every feedback submission requires two things: <span className="text-midnight">written feedback</span> and a <span className="text-midnight">screenshot from the project</span>.
              </p>
              <p tabIndex={0}>
                The screenshot serves a dual purpose — it acts as proof of visit so submitters know you actually used their product, and it provides visual context that written feedback alone can&apos;t capture.
              </p>
              <p tabIndex={0}>
                This is not optional. Feedback without a screenshot cannot be submitted. This requirement is the trust layer that keeps the community honest.
              </p>
            </div>
          </div>

          <Divider />

          {/* Standards */}
          <div>
            <h2 tabIndex={0} className="font-syne font-bold text-[28px] leading-[36px] text-midnight mb-6">
              Standards of Conduct
            </h2>
            <div className="flex flex-col gap-4">
              <Standard
                title="Be specific"
                body="Vague feedback is wasted feedback. Tell the submitter exactly what you encountered, where you got confused, and what could be clearer. Good feedback is actionable."
              />
              <Standard
                title="Be constructive"
                body="You're talking to another developer who shipped something and asked for help. Critique the work, not the person. Frame problems as opportunities."
              />
              <Standard
                title="Follow the mission"
                body="Each mission has a focus area. Stick to it. If you notice something outside the mission scope, mention it briefly — but don't let it derail your primary feedback."
              />
              <Standard
                title="No harassment or hate speech"
                body="This is a peer community. Harassment, discriminatory language, and bad-faith interactions are not tolerated and will result in account termination."
              />
              <Standard
                title="No spam or gaming the system"
                body="Submitting low-quality feedback to unlock testing credits, or creating dummy projects to inflate your submission count, undermines the community for everyone."
              />
              <Standard
                title="Respect externally linked projects"
                body="When a mission takes you to an external project URL, you're a guest on that developer's product. Behave accordingly — don't abuse, attack, or misuse what you find there."
              />
            </div>
          </div>

          <Divider />

          {/* What good looks like */}
          <div>
            <h2 tabIndex={0} className="font-syne font-bold text-[28px] leading-[36px] text-midnight mb-4">
              What Good Feedback Looks Like
            </h2>
            <div className="flex flex-col gap-4 font-mono text-[14px] leading-7">
              <div className="bg-white border border-midnight/10 rounded-[12px] p-5">
                <p tabIndex={0} className="text-[11px] text-forest uppercase tracking-[1px] mb-3">Good</p>
                <p tabIndex={0} className="text-midnight/70">
                  &quot;The checkout form loses my input when I click back — I had to refill my card details twice. The error message on the CVV field also doesn&apos;t appear until I submit, which was confusing. Screenshot attached showing the empty state after navigating back.&quot;
                </p>
              </div>
              <div className="bg-white border border-midnight/10 rounded-[12px] p-5">
                <p tabIndex={0} className="text-[11px] text-forest uppercase tracking-[1px] mb-3">Not helpful</p>
                <p tabIndex={0} className="text-midnight/70">
                  &quot;Looks good! Nice design.&quot;
                </p>
              </div>
            </div>
          </div>

          <Divider />

          {/* What a good project & mission looks like */}
          <div>
            <h2 tabIndex={0} className="font-syne font-bold text-[28px] leading-[36px] text-midnight mb-4">
              What a Good Project &amp; Mission Looks Like
            </h2>
            <div className="flex flex-col gap-4 font-mono text-[14px] leading-7 text-midnight/70">
              <p tabIndex={0}>
                Testers can only help you as well as you brief them. A clear project sets the context; a focused mission tells testers exactly where to look and what kind of feedback you need.
              </p>
            </div>

            <h3 tabIndex={0} className="font-mono text-[12px] text-forest uppercase tracking-[1px] mt-8 mb-4">The Project</h3>
            <div className="flex flex-col gap-4 font-mono text-[14px] leading-7">
              <div className="bg-white border border-midnight/10 rounded-[12px] p-5">
                <p tabIndex={0} className="text-[11px] text-forest uppercase tracking-[1px] mb-3">Good</p>
                <p tabIndex={0} className="text-midnight/70">
                  &quot;Ledgerly — a budgeting app for freelancers. It connects to your bank, auto-categorizes income and expenses, and forecasts taxes owed. We just shipped onboarding and the dashboard; both are live and need fresh eyes before launch.&quot;
                </p>
              </div>
              <div className="bg-white border border-midnight/10 rounded-[12px] p-5">
                <p tabIndex={0} className="text-[11px] text-forest uppercase tracking-[1px] mb-3">Not helpful</p>
                <p tabIndex={0} className="text-midnight/70">
                  &quot;My new app. Check it out and tell me what you think.&quot;
                </p>
              </div>
            </div>

            <h3 tabIndex={0} className="font-mono text-[12px] text-forest uppercase tracking-[1px] mt-8 mb-4">The Mission</h3>
            <div className="flex flex-col gap-4 font-mono text-[14px] leading-7">
              <div className="bg-white border border-midnight/10 rounded-[12px] p-5">
                <p tabIndex={0} className="text-[11px] text-forest uppercase tracking-[1px] mb-3">Good</p>
                <p tabIndex={0} className="text-midnight/70">
                  &quot;Test the onboarding flow. Sign up with a new email, connect the demo bank (use credentials user / pass), and reach the dashboard. I want to know: where did you hesitate, did anything feel slow or unclear, and did the tax forecast make sense? Screenshot the step that confused you most.&quot;
                </p>
              </div>
              <div className="bg-white border border-midnight/10 rounded-[12px] p-5">
                <p tabIndex={0} className="text-[11px] text-forest uppercase tracking-[1px] mb-3">Not helpful</p>
                <p tabIndex={0} className="text-midnight/70">
                  &quot;Just look around and find bugs.&quot;
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 font-mono text-[14px] leading-7 text-midnight/70 mt-6">
              <p tabIndex={0}>
                A strong mission does three things: it <span className="text-midnight">scopes one focus area</span>, it gives testers <span className="text-midnight">the steps and any credentials</span> they need to get in, and it <span className="text-midnight">asks specific questions</span> so the feedback comes back actionable.
              </p>
            </div>
          </div>

          <Divider />

          {/* Enforcement */}
          <div>
            <h2 tabIndex={0} className="font-syne font-bold text-[28px] leading-[36px] text-midnight mb-4">
              Enforcement
            </h2>
            <div className="flex flex-col gap-4 font-mono text-[14px] leading-7 text-midnight/70">
              <p tabIndex={0}>
                Twnhall reserves the right to remove feedback, suspend missions, or terminate accounts that violate these guidelines. We don&apos;t issue warnings for serious violations — harassment, hate speech, and deliberate gaming of the system result in immediate removal.
              </p>
              <p tabIndex={0}>
                If you encounter a violation — bad-faith feedback, abusive content, or a project that appears malicious — contact us at{" "}
                <a tabIndex={0} href="mailto:twnhallhq@gmail.com" className="text-forest underline hover:overline">
                  twnhallhq@gmail.com
                </a>
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* Footer — dark, matches landing */}
      <footer className="w-full bg-obsidian font-mono">
        <div className="max-w-[1128px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p tabIndex={0} className="font-mono text-[12px] text-[#F0F0F2]">© {new Date().getFullYear()} Twnhall. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link tabIndex={0} href="/guidelines" className="font-mono text-[12px] text-voltage">Guidelines</Link>
            <Link tabIndex={0} href="/privacy" className="font-mono text-[12px] text-[#F0F0F2] hover:text-chalk transition-colors duration-150 text-decoration-line: underline hover:overline">Privacy Policy</Link>
            <Link tabIndex={0} href="/terms" className="font-mono text-[12px] text-[#F0F0F2] hover:text-chalk transition-colors duration-150 text-decoration-line: underline hover:overline">Terms of Service</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

function Divider() {
  return <div className="border-t border-midnight/10" />;
}

function Role({ label, steps }: { label: string; steps: string[] }) {
  return (
    <div>
      <p tabIndex={0} className="font-mono text-[12px] text-forest uppercase tracking-[1px] mb-3">{label}</p>
      <ol className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <li tabIndex={0} key={i} className="flex gap-4">
            <span className="font-mono text-[13px] text-forest shrink-0 mt-0.5">{i + 1}.</span>
            <span className="font-mono text-[14px] leading-6 text-midnight/70">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Standard({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-4 py-4 border-b border-midnight/10 last:border-0">
      <div className="w-1.5 h-1.5 rounded-full bg-voltage shrink-0 mt-2" />
      <div>
        <p tabIndex={0} className="font-mono text-[14px] font-medium text-midnight mb-1">{title}</p>
        <p tabIndex={0} className="font-mono text-[14px] leading-6 text-midnight/70">{body}</p>
      </div>
    </div>
  );
}
