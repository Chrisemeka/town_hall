import Link from "next/link";
import { Logo } from "@/components/Logo";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service — Twnhall" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-bone text-midnight font-mono flex flex-col selection:bg-voltage selection:text-obsidian">

      {/* Nav */}
      <header className="border-b border-midnight/10 bg-bone/85 backdrop-blur-md">
        <div className="max-w-[1128px] mx-auto px-6 h-[60px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={40} />
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

      {/* Content */}
      <main className="flex-1 max-w-[720px] w-full mx-auto px-6 py-16">

        <p tabIndex={0} className="font-mono text-[12px] text-forest uppercase tracking-[1.5px] mb-4">Legal</p>
        <h1 tabIndex={0} className="font-syne font-bold text-[40px] leading-[48px] tracking-[-0.5px] text-midnight mb-2">
          Terms of Service
        </h1>
        <p tabIndex={0} className="font-mono text-[13px] text-midnight/60 mb-6">Last updated: August 6, 2026</p>

        <p tabIndex={0} className="font-mono text-[14px] leading-7 text-midnight/70 mb-12">
          Welcome to <span className="text-midnight">Twnhall</span>, where builders put their products in front of real people and testers do real testing work in exchange for feedback credit and, on some missions, payment. By using Twnhall, you agree to abide by the following terms and conditions.
        </p>

        <div className="flex flex-col gap-10">

          <Section number="1" title="User Agreement">
            <p tabIndex={0}>By using Twnhall, you agree to comply with all applicable laws and regulations.</p>
          </Section>

          <Section number="2" title="Accounts and Account Types">
            <p tabIndex={0}>
              Twnhall has two account types: a <span className="text-midnight">Builder</span> account, which submits projects and missions and reviews the feedback that comes back, and a <span className="text-midnight">Tester</span> account, which picks up missions and submits feedback.
            </p>
            <p tabIndex={0}>
              These are separate accounts, not two modes of one account. Each has its own dashboard and its own history. One person may hold both a Builder and a Tester account, and you choose your account type when you sign up.
            </p>
            <p tabIndex={0}>
              A Builder account cannot access Tester views, and a Tester account cannot access Builder views. You may not use a Tester account to submit feedback on a project you own, and you may not create additional accounts to work around this.
            </p>
            <p tabIndex={0}>
              You are responsible for activity that occurs under any account you hold, and for keeping the Google account used to sign in secure.
            </p>
          </Section>

          <Section number="3" title="Missions, Payouts and Fees">
            <p tabIndex={0}>
              Builders may attach a payout amount to a mission. Where a mission states a payout, that amount is what a Tester is offered for a submission the Builder <span className="text-midnight">approves</span>.
            </p>
            <p tabIndex={0}>
              <span className="text-midnight font-medium">Approval is a prerequisite for payout.</span> A submission moves from Pending Review to Approved, Needs Changes, or Paid. No payout becomes available on a submission that has not been approved. Once a submission is marked Paid it is final and cannot be reopened.
            </p>
            <p tabIndex={0}>
              Builders are expected to review submissions in good faith and within a reasonable time. Requesting changes must be accompanied by a specific, actionable reason. Withholding approval from work that meets the mission brief, or requesting changes in order to avoid paying, is a violation of these terms.
            </p>
            <p tabIndex={0}>
              Missions without a stated payout are unpaid. Picking up an unpaid mission earns feedback and reputation, not money, and you should not expect payment for it.
            </p>
            <p tabIndex={0}>
              <span className="text-midnight font-medium">Payouts are not yet live.</span> Withdrawal is currently disabled, and an approved balance shown in your account is a record of what you have earned, not a promise of immediate payment. We will publish the withdrawal process, any applicable fees, minimum thresholds, and payment timelines before enabling withdrawals. Twnhall does not currently charge a fee on payouts; if that changes we will say so before it takes effect.
            </p>
            <p tabIndex={0}>
              You are responsible for any taxes owed on amounts you earn through Twnhall.
            </p>
          </Section>

          <Section number="4" title="Ratings and Reputation">
            <p tabIndex={0}>
              When a Builder approves a submission or requests changes, they rate the Tester&apos;s work from 1 to 5. These ratings are averaged into a rating shown on that Tester&apos;s account, alongside the number of missions they have completed and the rank those completions earn.
            </p>
            <p tabIndex={0}>
              Ratings must reflect the quality of the work submitted. Rating a Tester down for reasons unrelated to their submission, coordinating ratings between accounts, or soliciting ratings in exchange for anything of value is prohibited.
            </p>
            <p tabIndex={0}>
              Reputation is earned on Twnhall and belongs to the account it was earned on. It cannot be transferred, sold, or moved between accounts, including between a Builder and a Tester account held by the same person.
            </p>
          </Section>

          <Section number="5" title="Your Content">
            <p tabIndex={0}>
              You keep ownership of what you submit — your project details, mission briefs, written feedback, and screenshots.
            </p>
            <p tabIndex={0}>
              By submitting content you grant Twnhall a non-exclusive licence to host, store, display, and process it for the purpose of operating the service. This includes showing your feedback and screenshots to the Builder whose mission you submitted against, and processing submissions through automated analysis as described in our{" "}
              <Link tabIndex={0} href="/privacy" className="text-forest underline hover:overline">Privacy Policy</Link>.
            </p>
            <p tabIndex={0}>
              Screenshots you capture while testing may show another developer&apos;s unreleased product. Do not publish, share, or reuse them outside Twnhall. Treat anything you see while testing as confidential.
            </p>
            <p tabIndex={0}>
              Do not submit content you do not have the right to submit, and do not include personal data, credentials, or payment details of other people in a screenshot or written feedback.
            </p>
          </Section>

          <Section number="6" title="Privacy Policy">
            <p tabIndex={0}>
              We respect your privacy. Please review our{" "}
              <Link tabIndex={0} href="/privacy" className="text-forest underline hover:overline">Privacy Policy</Link>
              {" "}to understand how we collect, use, and safeguard your personal information.
            </p>
          </Section>

          <Section number="7" title="User Conduct">
            <p tabIndex={0}>Users are prohibited from engaging in activities that violate our Community Guidelines, including but not limited to harassment, hate speech, and illegal content sharing.</p>
            <p tabIndex={0}>
              Submitting low-effort feedback to collect a payout, submitting feedback for a mission you did not actually attempt, or using automated tools in place of genuine human testing defeats the purpose of the platform and is grounds for termination and forfeiture of any unpaid balance.
            </p>
          </Section>

          <Section number="8" title="Liability and Disclaimers">
            <p tabIndex={0}>Twnhall is not liable for any damages or losses incurred while using the app.</p>
            <p tabIndex={0}>Users acknowledge that they use Twnhall at their own risk.</p>
            <p tabIndex={0}>
              Twnhall provides the platform on which Builders and Testers transact. We do not guarantee the quality of any feedback, the availability of missions, or that any given Builder will approve a given submission.
            </p>
          </Section>

          <Section number="9" title="Termination Policy">
            <p tabIndex={0}>Twnhall reserves the right to suspend or terminate accounts that violate our terms and conditions.</p>
            <p tabIndex={0}>
              You may delete your account at any time from Settings. Where you hold both a Builder and a Tester account, deletion removes both, along with the projects, missions, submissions, and reputation attached to them.
            </p>
            <p tabIndex={0}>
              If we terminate an account for a violation involving payment — including gaming ratings or submitting work in bad faith — any unpaid balance on that account may be forfeited.
            </p>
          </Section>

          <Section number="10" title="Updates and Changes">
            <p tabIndex={0}>We may update our terms and conditions from time to time. Users will be notified of any changes.</p>
            <p tabIndex={0}>
              Changes that affect payouts, fees, or how earnings are calculated will be communicated before they take effect.
            </p>
          </Section>

          <Section number="11" title="Jurisdiction and Governing Law">
            <p tabIndex={0}>These terms and conditions are governed by the laws of Nigeria. Any disputes shall be resolved in the courts of Nigeria.</p>
          </Section>

          <Section number="12" title="Contact Information">
            <p tabIndex={0}>
              For inquiries, support, or complaints, please contact us at{" "}
              <a tabIndex={0} href="mailto:twnhallhq@gmail.com" className="text-forest  underline hover:overline">
                twnhallhq@gmail.com
              </a>
            </p>
          </Section>

          <div className="pt-6 border-t border-midnight/10">
            <p tabIndex={0} className="font-mono text-[13px] leading-6 text-midnight/70">
              By using Twnhall, you agree to these terms and conditions. If you do not agree with any part of these terms, please do not use the app.
            </p>
          </div>

        </div>
      </main>

      {/* Footer — dark, matches landing */}
      <footer className="w-full bg-obsidian font-mono">
        <div className="max-w-[1128px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p tabIndex={0} className="font-mono text-[12px] text-[#F0F0F2]">© {new Date().getFullYear()} Twnhall. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link tabIndex={0} href="/privacy" className="font-mono text-[12px] text-[#F0F0F2] hover:text-chalk transition-colors duration-150 text-decoration-line: underline hover:overline">Privacy Policy</Link>
            <Link tabIndex={0} href="/terms" className="font-mono text-[12px] text-voltage">Terms of Service</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 tabIndex={0} className="font-syne font-bold text-[20px] text-midnight mb-4">
        <span className="text-forest font-mono text-[14px] mr-2">{number}.</span>
        {title}
      </h2>
      <div className="flex flex-col gap-3 font-mono text-[14px] leading-7 text-midnight/70">
        {children}
      </div>
    </div>
  );
}
