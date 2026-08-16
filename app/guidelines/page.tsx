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
            Twnhall runs on real people doing real testing. Read this once and you&apos;ll understand everything about how and why this community works.
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
                &quot;Real people. Real feedback. Real work.&quot;
              </p>
            </div>
            <div className="flex flex-col gap-4 font-mono text-[14px] leading-7 text-midnight/70">
              <p tabIndex={0}>
                Twnhall exists because automated testing can&apos;t tell you where a real person hesitated. Builders put products in front of actual humans; testers do the work of using them properly and reporting back.
              </p>
              <p tabIndex={0}>
                There are two account types: <span className="text-midnight">Builder</span> and <span className="text-midnight">Tester</span>. They are separate accounts, each with its own dashboard and its own history. One person can hold both — plenty do — but you are always acting as one or the other, never both at once.
              </p>
              <p tabIndex={0}>
                Testing here is treated as work. Some missions carry a <span className="text-midnight">payout</span>; all of them build a <span className="text-midnight">rating and a rank</span> that follow your Tester account. That cuts both ways: testers are accountable for the quality of what they submit, and builders are accountable for reviewing it honestly.
              </p>
              <p tabIndex={0}>
                This isn&apos;t a SaaS tool. It&apos;s a shared workspace where builders and testers hold each other accountable. The energy here should feel collaborative and direct — developer to developer.
              </p>
            </div>
          </div>

          <Divider />

          {/* How It Works */}
          <div>
            <h2 tabIndex={0} className="font-syne font-bold text-[28px] leading-[36px] text-midnight mb-6">
              How It Works
            </h2>
            <p tabIndex={0} className="font-mono text-[14px] leading-7 text-midnight/70 mb-8">
              You pick your account type when you sign up. If you want to do both, create the second account from your sidebar — it&apos;s a separate account, and you switch between them.
            </p>
            <div className="flex flex-col gap-8">
              <Role
                label="As a Builder"
                steps={[
                  "Create a project — fill in the name, URL, and a brief summary of what you built.",
                  "Create Missions — each mission defines one specific area for testers to focus on. Add a payout and a skill tag if you want to pay for the work.",
                  "Wait for testers to pick up your missions and submit written feedback with screenshots.",
                  "Review each submission — approve it or request changes — and rate the tester's work from 1 to 5.",
                ]}
              />
              <Role
                label="As a Tester"
                steps={[
                  "Browse available missions from your Tester home or the mission feed.",
                  "Pick a mission, visit the project URL, and follow the builder's instructions.",
                  "Submit written feedback and at least one screenshot as proof of visit, tied directly to that mission.",
                  "Track the status on your Tester home. Approved work counts toward your rating, your rank, and your balance.",
                ]}
              />
            </div>
          </div>

          <Divider />

          {/* The Review Loop */}
          <div>
            <h2 tabIndex={0} className="font-syne font-bold text-[28px] leading-[36px] text-midnight mb-4">
              The Review Loop
            </h2>
            <div className="flex flex-col gap-4 font-mono text-[14px] leading-7 text-midnight/70 mb-6">
              <p tabIndex={0}>
                Every submission moves through the same four states. Testers see the current state on their home screen; builders move it.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <Standard
                title="Pending Review"
                body="You've submitted. The builder hasn't looked at it yet. Nothing counts toward your rating or balance while a submission sits here."
              />
              <Standard
                title="Approved"
                body="The builder accepted the work and rated it. This counts toward your completed-mission count and your rank, and any payout on the mission becomes part of your available balance."
              />
              <Standard
                title="Needs Changes"
                body="The builder sent it back with a specific reason. Read the note, fix what they asked for, and the submission can still be approved afterwards."
              />
              <Standard
                title="Paid"
                body="The payout has been settled. This is final — a paid submission can't be reopened, re-rated, or rejected."
              />
            </div>
            <div className="flex flex-col gap-4 font-mono text-[14px] leading-7 text-midnight/70 mt-6">
              <p tabIndex={0}>
                <span className="text-midnight">Approval is the gate on payment.</span> Nothing pays out that a builder hasn&apos;t approved first. Builders: review promptly and in good faith. If you request changes, say exactly what needs changing — &quot;not good enough&quot; is not a review.
              </p>
              <p tabIndex={0}>
                Withholding approval from work that meets the brief in order to avoid paying is a violation of our{" "}
                <Link tabIndex={0} href="/terms" className="text-forest underline hover:overline">Terms of Service</Link>
                {" "}and will cost you your account.
              </p>
              <p tabIndex={0}>
                <span className="text-midnight">Withdrawals aren&apos;t live yet.</span> Your approved balance is a record of what you&apos;ve earned. We&apos;ll publish the withdrawal process before enabling it.
              </p>
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
                title="Do the work before you submit"
                body="Actually use the product. Submitting feedback for a mission you didn't attempt, padding a comment to clear the length minimum, or running an automated tool in place of real testing defeats the entire point of the platform — and on a paid mission, it's taking money for work you didn't do."
              />
              <Standard
                title="Review honestly, rate fairly"
                body="Builders: a rating reflects the quality of the submission in front of you, nothing else. Don't rate someone down because the feedback stung, and don't request changes to delay a payout. Testers: don't solicit ratings or trade them between accounts."
              />
              <Standard
                title="One account per role, per person"
                body="You may hold a Builder and a Tester account. You may not create extra accounts to test your own projects, inflate your own reputation, or work around a suspension."
              />
              <Standard
                title="Keep what you see confidential"
                body="Screenshots you take while testing often show unreleased work. They're for the builder and for Twnhall — don't publish, share, or reuse them anywhere else."
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
                Where a violation involves payment — bad-faith reviews, rating manipulation, or submitting work you didn&apos;t do — any unpaid balance on the account may be forfeited. Enforcement applies to the person, not just the account: if you hold both a Builder and a Tester account, a violation on one can cost you both.
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
