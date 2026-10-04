import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service — Twnhall" };

export default function TermsPage() {
  return (
    <div className="flex-1 max-w-[720px] w-full mx-auto px-6 py-16">

        <h1 className="font-syne font-bold text-[40px] leading-[48px] tracking-[-0.5px] text-ink mb-2">
          Terms of Service
        </h1>
        <p className="font-mono text-[13px] text-ink-muted mb-6">Last updated: August 6, 2026</p>

        <p className="font-sans text-[14px] leading-7 text-ink mb-12">
          Welcome to <span className="text-ink">Twnhall</span>, where builders put their products in front of real people and testers do real testing work in exchange for feedback on their own. By using Twnhall, you agree to abide by the following terms and conditions.
        </p>

        <div className="flex flex-col gap-10">

          <Section number="1" title="User Agreement">
            <p>By using Twnhall, you agree to comply with all applicable laws and regulations.</p>
          </Section>

          <Section number="2" title="Accounts and Account Types">
            <p>
              Twnhall has two account types: a <span className="text-ink">Builder</span> account, which submits projects and missions and reviews the feedback that comes back, and a <span className="text-ink">Tester</span> account, which picks up missions and submits feedback.
            </p>
            <p>
              These are separate accounts, not two modes of one account. Each has its own dashboard and its own history. One person may hold both a Builder and a Tester account, and you choose your account type when you sign up.
            </p>
            <p>
              A Builder account cannot access Tester views, and a Tester account cannot access Builder views. You may not use a Tester account to submit feedback on a project you own, and you may not create additional accounts to work around this.
            </p>
            <p>
              You are responsible for activity that occurs under any account you hold, and for keeping the Google account used to sign in secure.
            </p>
          </Section>

          <Section number="3" title="Missions and Review">
            <p>
              <span className="text-ink font-medium">Testing on Twnhall is reciprocal and unpaid.</span> Missions carry no payment, and nothing you do on the platform earns money. What a submission earns you is the Builder&apos;s response to it, on the record against your account.
            </p>
            <p>
              A submission moves from Pending Review to Approved or Needs Changes. Builders are expected to review submissions in good faith and within a reasonable time. Requesting changes must be accompanied by a specific, actionable reason. Withholding approval from work that meets the mission brief is a violation of these terms.
            </p>
          </Section>

          <Section number="4" title="Ratings and Reputation">
            <p>
              When a Builder approves a submission or requests changes, they rate the Tester&apos;s work from 1 to 5. Those ratings are recorded against the Tester&apos;s account. Twnhall does not currently display an aggregate rating or a rank to Testers; the underlying ratings are kept, and this section will be updated before any of it is surfaced.
            </p>
            <p>
              Ratings must reflect the quality of the work submitted. Rating a Tester down for reasons unrelated to their submission, coordinating ratings between accounts, or soliciting ratings in exchange for anything of value is prohibited.
            </p>
            <p>
              Reputation is earned on Twnhall and belongs to the account it was earned on. It cannot be transferred, sold, or moved between accounts, including between a Builder and a Tester account held by the same person.
            </p>
          </Section>

          <Section number="5" title="Your Content">
            <p>
              You keep ownership of what you submit — your project details, mission briefs, written feedback, and screenshots.
            </p>
            <p>
              By submitting content you grant Twnhall a non-exclusive licence to host, store, display, and process it for the purpose of operating the service. This includes showing your feedback and screenshots to the Builder whose mission you submitted against, and processing submissions through automated analysis as described in our{" "}
              <Link href="/privacy" className="text-accent-ink underline hover:overline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface">Privacy Policy</Link>.
            </p>
            <p>
              Screenshots you capture while testing may show another developer&apos;s unreleased product. Do not publish, share, or reuse them outside Twnhall. Treat anything you see while testing as confidential.
            </p>
            <p>
              Do not submit content you do not have the right to submit, and do not include personal data, credentials, or payment details of other people in a screenshot or written feedback.
            </p>
          </Section>

          <Section number="6" title="Privacy Policy">
            <p>
              We respect your privacy. Please review our{" "}
              <Link href="/privacy" className="text-accent-ink underline hover:overline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface">Privacy Policy</Link>
              {" "}to understand how we collect, use, and safeguard your personal information.
            </p>
          </Section>

          <Section number="7" title="User Conduct">
            <p>Users are prohibited from engaging in activities that violate our Community Guidelines, including but not limited to harassment, hate speech, and illegal content sharing.</p>
            <p>
              Submitting low-effort feedback, submitting feedback for a mission you did not actually attempt, or using automated tools in place of genuine human testing defeats the purpose of the platform and is grounds for termination.
            </p>
          </Section>

          <Section number="8" title="Liability and Disclaimers">
            <p>Twnhall is not liable for any damages or losses incurred while using the app.</p>
            <p>Users acknowledge that they use Twnhall at their own risk.</p>
            <p>
              Twnhall provides the platform on which Builders and Testers work together. We do not guarantee the quality of any feedback, the availability of missions, or that any given Builder will approve a given submission.
            </p>
          </Section>

          <Section number="9" title="Termination Policy">
            <p>Twnhall reserves the right to suspend or terminate accounts that violate our terms and conditions.</p>
            <p>
              You may delete your account at any time from Settings. Where you hold both a Builder and a Tester account, deletion removes both, along with the projects, missions, submissions, and reputation attached to them.
            </p>
          </Section>

          <Section number="10" title="Updates and Changes">
            <p>We may update our terms and conditions from time to time. Users will be notified of any changes.</p>
            <p>
              Changes that materially affect how missions, submissions, or reviews work will be communicated before they take effect.
            </p>
          </Section>

          <Section number="11" title="Jurisdiction and Governing Law">
            <p>These terms and conditions are governed by the laws of Nigeria. Any disputes shall be resolved in the courts of Nigeria.</p>
          </Section>

          <Section number="12" title="Contact Information">
            <p>
              For inquiries, support, or complaints, please contact us at{" "}
              <a href="mailto:twnhallhq@gmail.com" className="text-accent-ink  underline hover:overline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                twnhallhq@gmail.com
              </a>
            </p>
          </Section>

          <div className="pt-6 border-t border-line">
            <p className="font-mono text-[13px] leading-6 text-ink">
              By using Twnhall, you agree to these terms and conditions. If you do not agree with any part of these terms, please do not use the app.
            </p>
          </div>

        </div>
    </div>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-syne font-bold text-[20px] text-ink mb-4">
        <span className="text-accent-ink font-mono text-[14px] mr-2">{number}.</span>
        {title}
      </h2>
      <div className="flex flex-col gap-3 font-sans text-[14px] leading-7 text-ink">
        {children}
      </div>
    </div>
  );
}
