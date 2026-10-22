import Link from "next/link";
import type { Metadata } from "next";
import { DocLayout } from "@/components/public/DocNav";
import { ANCHOR } from "@/components/public/prose";
import { docSection } from "@/lib/docNav";
import { Reveal } from "@/components/public/Reveal";

export const metadata: Metadata = { title: "Terms of Service — Twnhall" };

export default function TermsPage() {
  return (
    <DocLayout slug="terms">

        <Reveal>
          <h1 className="font-syne font-bold text-[32px] leading-10 medium:text-[40px] medium:leading-[48px] tracking-[-0.5px] text-ink mb-2">
            Terms of Service
          </h1>
        </Reveal>
        <Reveal step={1}>
          <p className="font-mono text-[13px] text-ink-muted mb-6">Last updated: October 13, 2026</p>
        </Reveal>

        <Reveal step={2}>
        <p className="font-sans text-[16px] leading-7 text-ink lg:text-[14px] mb-10 medium:mb-12">
          Welcome to <span className="text-ink">Twnhall</span>, where builders put their products in front of real people and testers do real testing work in exchange for feedback on their own. By using Twnhall, you agree to abide by the following terms and conditions.
        </p>
        </Reveal>

        <div className="flex flex-col gap-8 medium:gap-10">

          <Section {...docSection("terms", "agreement")}>
            <p>By using Twnhall, you agree to comply with all applicable laws and regulations.</p>
          </Section>

          <Section {...docSection("terms", "accounts")}>
            <p>
              Twnhall has two account types: a <span className="text-ink">Builder</span> account, which submits projects and missions and reviews the feedback that comes back, and a <span className="text-ink">Tester</span> account, which picks up missions and submits feedback.
            </p>
            <p>
              One sign-in can hold both a Builder and a Tester account. You choose your first account type after you sign up and can add the other later; each has its own dashboard, history, and profile, which you complete before using it, and you switch between them while signed in.
            </p>
            <p>
              While you act as a Builder you see Builder views, and while you act as a Tester you see Tester views. You may not use a Tester account to submit a report on a project you own, and you may not create additional accounts to work around this.
            </p>
            <p>
              You are responsible for activity that occurs under any account you hold, and for keeping your password, or the Google account you sign in with, secure.
            </p>
          </Section>

          <Section {...docSection("terms", "missions")}>
            <p>
              <span className="text-ink font-medium">Testing on Twnhall is reciprocal.</span> Missions carry no payment, and the platform does not pay testers. Each report you write earns one tester report for your own projects, once per mission, and publishing a mission spends reports from your balance. Starter and Pro add a monthly allowance and are arranged with us directly; there is no checkout. Members of Twnhall&apos;s tester cohort are paid by us under a separate arrangement, outside the platform.
            </p>
            <p>
              A submission moves from Pending Review to Approved, with a rating and an optional note from the Builder. A submission is not sent back for changes. Builders are expected to review and rate submissions in good faith and within a reasonable time. Withholding approval from work that meets the mission brief is a violation of these terms.
            </p>
          </Section>

          <Section {...docSection("terms", "ratings")}>
            <p>
              When a Builder approves a submission, they rate the Tester&apos;s work from 1 to 5. Those ratings are recorded against the Tester&apos;s account, and a Tester sees their own average rating in Settings. Twnhall does not show ratings or a rank to anyone else; this section will be updated before it does.
            </p>
            <p>
              Ratings must reflect the quality of the work submitted. Rating a Tester down for reasons unrelated to their submission, coordinating ratings between accounts, or soliciting ratings in exchange for anything of value is prohibited.
            </p>
            <p>
              Reputation is earned on Twnhall and belongs to the account it was earned on. It cannot be transferred, sold, or moved between accounts, including between a Builder and a Tester account held by the same person.
            </p>
          </Section>

          <Section {...docSection("terms", "content")}>
            <p>
              You keep ownership of what you submit — your project details, missions, reports, and screenshots.
            </p>
            <p>
              By submitting content you grant Twnhall a non-exclusive licence to host, store, display, and process it for the purpose of operating the service. This includes showing your report and screenshots to the Builder whose mission you submitted against, and processing submissions through automated analysis as described in our{" "}
              <Link href="/privacy" className="text-accent-ink underline hover:overline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface">Privacy Policy</Link>.
            </p>
            <p>
              Screenshots you capture while testing may show another developer&apos;s unreleased product. Do not publish, share, or reuse them outside Twnhall. Treat anything you see while testing as confidential.
            </p>
            <p>
              Do not submit content you do not have the right to submit, and do not include personal data, credentials, or payment details of other people in a screenshot or report.
            </p>
          </Section>

          <Section {...docSection("terms", "privacy")}>
            <p>
              We respect your privacy. Please review our{" "}
              <Link href="/privacy" className="text-accent-ink underline hover:overline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface">Privacy Policy</Link>
              {" "}to understand how we collect, use, and safeguard your personal information.
            </p>
          </Section>

          <Section {...docSection("terms", "conduct")}>
            <p>Users are prohibited from engaging in activities that violate our Community Guidelines, including but not limited to harassment, hate speech, and illegal content sharing.</p>
            <p>
              Submitting low-effort reports, submitting a report for a mission you did not actually attempt, or using automated tools in place of genuine human testing defeats the purpose of the platform and is grounds for termination.
            </p>
          </Section>

          <Section {...docSection("terms", "liability")}>
            <p>Twnhall is not liable for any damages or losses incurred while using the app.</p>
            <p>Users acknowledge that they use Twnhall at their own risk.</p>
            <p>
              Twnhall provides the platform on which Builders and Testers work together. We do not guarantee the quality of any feedback, the availability of missions, or that any given Builder will approve a given submission.
            </p>
          </Section>

          <Section {...docSection("terms", "termination")}>
            <p>Twnhall reserves the right to suspend or terminate accounts that violate our terms and conditions.</p>
            <p>
              You may delete your account at any time from Settings. Where you hold both a Builder and a Tester account, deletion removes both, along with the projects, missions, submissions, and reputation attached to them.
            </p>
          </Section>

          <Section {...docSection("terms", "updates")}>
            <p>We may update our terms and conditions from time to time. Users will be notified of any changes.</p>
            <p>
              Changes that materially affect how missions, submissions, or reviews work will be communicated before they take effect.
            </p>
          </Section>

          <Section {...docSection("terms", "jurisdiction")}>
            <p>These terms and conditions are governed by the laws of Nigeria. Any disputes shall be resolved in the courts of Nigeria.</p>
          </Section>

          <Section {...docSection("terms", "contact")}>
            <p>
              For inquiries, support, or complaints, please contact us at{" "}
              <a href="mailto:twnhallhq@gmail.com" className="text-accent-ink underline hover:overline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                twnhallhq@gmail.com
              </a>
            </p>
          </Section>

          <Reveal className="pt-6 border-t border-line">
            {/* The sentence the page exists for: body text below lg, today's look from lg. */}
            <p className="font-sans text-[16px] leading-7 text-ink lg:font-mono lg:text-[13px] lg:leading-6">
              By using Twnhall, you agree to these terms and conditions. If you do not agree with any part of these terms, please do not use the app.
            </p>
          </Reveal>

        </div>
    </DocLayout>
  );
}

function Section({ id, number, title, children }: { id: string; number?: string; title: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <h2 id={id} tabIndex={-1} className={`font-syne font-bold text-[20px] text-ink mb-3 medium:mb-4 ${ANCHOR}`}>
        <span className="text-accent-ink font-mono text-[14px] mr-2">{number}.</span>
        {title}
      </h2>
      {/* 16px below lg, as every other long-form public page; 14px from lg. */}
      <div className="flex flex-col gap-4 font-sans text-[16px] leading-7 text-ink lg:gap-3 lg:text-[14px]">
        {children}
      </div>
    </Reveal>
  );
}
