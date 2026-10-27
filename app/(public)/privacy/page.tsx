import type { Metadata } from "next";
import { DocLayout } from "@/components/public/DocNav";
import { ANCHOR } from "@/components/public/prose";
import { docSection } from "@/lib/docNav";
import { Reveal } from "@/components/public/Reveal";

export const metadata: Metadata = { title: "Privacy Policy — Twnhall" };

export default function PrivacyPolicyPage() {
  return (
    <DocLayout slug="privacy">

        <Reveal>
          <h1 className="font-syne font-bold text-[32px] leading-10 medium:text-[40px] medium:leading-[48px] tracking-[-0.5px] text-ink mb-2">
            Privacy Policy
          </h1>
        </Reveal>
        <Reveal step={1}>
          <p className="font-mono text-[13px] text-ink-muted mb-10 medium:mb-12">Last updated: October 13, 2026</p>
        </Reveal>

        <div className="flex flex-col gap-8 medium:gap-10">

          <Reveal step={2}>
          <p className="font-sans text-[16px] leading-7 text-ink lg:text-[14px]">
            At <span className="text-ink">Twnhall</span>, we are committed to protecting your privacy and safeguarding your personal information. This Privacy Policy explains how we collect, use, and disclose your information when you use our services.
          </p>
          </Reveal>

          <Section {...docSection("privacy", "collect")}>
            <p>Your activity and the information you provide, including app features you use and how you interact with them, as well as app and device information.</p>
            <p><span className="text-ink font-medium">Personal Information:</span> When you sign up on Twnhall, we collect your email address and a password, or, if you sign in with Google, your name, email address, and profile picture from that sign-in. Before you can use an account type, you complete a short profile for it: your full name, country, phone number, and timezone, plus your skills for a Tester account. You may also add a short bio in Settings.</p>
            <p><span className="text-ink font-medium">Account Information:</span> We record which account types you hold — Builder, Tester, or both — when each was created, and when its profile was completed. If you hold both, they are stored as two account records tied to the same sign-in. We also record your plan (Community, Starter or Pro) and your balance of tester reports: the reports you have been granted, earned by testing, and spent on test cases.</p>
            <p><span className="text-ink font-medium">Content You Submit:</span> Projects and test cases you create as a Builder, including their test steps, and the reports you submit as a Tester: a status for each step (pass, fail, or blocked), the issue and steps to reproduce for any step that did not pass, any closing comment, and screenshots. Screenshots are stored in our file storage and are visible to the Builder whose test case you submitted against.</p>
            <p><span className="text-ink font-medium">Review Information:</span> The status of each submission, the 1&ndash;5 rating a Builder gives it when approving it, and the optional note the Builder writes with that approval.</p>
            <p><span className="text-ink font-medium">Usage Information:</span> We may collect information about how you interact with the app, including your device&apos;s Internet Protocol address (e.g. IP address), the time and date of your visit, and projects you create.</p>
            <p><span className="text-ink font-medium">Device Information:</span> We may collect information about your device, including the device type, operating system, and unique device identifiers and other diagnostic data.</p>
          </Section>

          <Section {...docSection("privacy", "automated-analysis")}>
            <p>
              When you submit a report as a Tester, its contents — each step&apos;s status, the issues and steps to reproduce you wrote, any closing comment, and the screenshots you attach — are sent to <span className="text-ink">Google&apos;s Gemini API</span>, together with the test case&apos;s steps, to generate a short summary and a sentiment label for the Builder. This happens automatically on every submission. We keep a record of each analysis (its size and estimated cost) to run the service; it is not used to limit or charge you.
            </p>
            <p>
              Do not include passwords, personal data about other people, or anything you would not want processed by a third party in your report or screenshots.
            </p>
            <p>
              The generated summary is stored alongside your submission and shown to the Builder. It does not change your rating or whether your submission is approved — a human Builder makes that decision.
            </p>
          </Section>

          <Section {...docSection("privacy", "visibility")}>
            <p>
              <span className="text-ink font-medium">Builders see:</span> the report, screenshots, and generated summary on submissions made against their own test cases. We do not show Builders your name, email address, or profile picture: on each test case, testers appear as &ldquo;Tester 1&rdquo;, &ldquo;Tester 2&rdquo; and so on, including in the exports Builders can download. Anything you show in a screenshot or write in a report, such as your own email address, is visible to the Builder, so leave it out if you do not want it seen.
            </p>
            <p>
              <span className="text-ink font-medium">Testers see:</span> their own submissions and the status, rating, and any note a Builder left on them, and their own totals and average rating in Settings. Testers cannot see other testers&apos; submissions.
            </p>
            <p>
              Project and test case details a Builder publishes are visible to testers browsing the platform.</p>
            <p>
              <span className="text-ink font-medium">Twnhall&apos;s administrators see:</span> account details, including names and email addresses, to provide support, moderate the platform, and pay members of our tester cohort.
            </p>
          </Section>

          <Section {...docSection("privacy", "providers")}>
            <p>We rely on the following third parties to operate Twnhall, and information is shared with them only as needed to provide the service:</p>
            <p><span className="text-ink font-medium">Supabase:</span> database, authentication, and file storage for screenshots.</p>
            <p><span className="text-ink font-medium">Google:</span> Google sign-in, if you choose it, and the Gemini API for the automated analysis described above.</p>
            <p><span className="text-ink font-medium">Cloudflare:</span> the Turnstile check on the sign-up, sign-in, and password reset forms, which reads signals from your browser to tell people from bots.</p>
            <p><span className="text-ink font-medium">Vercel:</span> hosting the app.</p>
            <p><span className="text-ink font-medium">Resend:</span> transactional and notification email.</p>
          </Section>

          <Section {...docSection("privacy", "analytics")}>
            <p>We count visits to Twnhall ourselves, in our own database. No third-party analytics, advertising or tracking script runs on the site.</p>
            <p>When a page loads, we record the page (with any ids removed), the site that linked you to us, any campaign tags in the link, your country as reported by our host, and whether you are on a phone, tablet or computer. We do not store your IP address. If you are signed in, the visit is linked to your account.</p>
            <p>Two cookies make this work: <span className="text-ink font-medium">th_vid</span>, a random identifier that lets us count returning visitors, kept for one year, and <span className="text-ink font-medium">th_sid</span>, which groups the pages of one visit and expires after 30 minutes without activity. Neither is shared with anyone.</p>
            <p>We also record some actions inside the app — signing in and out, exports, emails sent, and errors — to run and improve the service. Visit records are kept for 90 days and then reduced to daily totals per page; action records are kept for 13 months.</p>
          </Section>

          <Section {...docSection("privacy", "use")}>
            <p>We use your personal information to create and manage your Twnhall account, communicate with you by email, or other equivalent forms of electronic communication, such as push notifications about updates or informative communications related to the functionalities, products or contracted services, including security updates when necessary or reasonable for their implementation, and to personalize your experience on the app.</p>
            <p>We use usage information to improve our app, analyze trends, and enhance user experience.</p>
            <p>We may use device information to troubleshoot technical issues and ensure compatibility with our app.</p>
          </Section>

          <Section {...docSection("privacy", "sharing")}>
            <p>We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>
            <p>We may share your information with third-party service providers who assist us in providing and improving our app, subject to confidentiality obligations.</p>
            <p>We may disclose your information if required by law or in response to the legal process.</p>
            <p>With your consent: We may disclose your personal information for any other purpose with your consent.</p>
          </Section>

          <Section {...docSection("privacy", "security")}>
            <p>We take reasonable measures to protect your personal information against unauthorized access, disclosure, alteration, and destruction.</p>
            <p>Despite our efforts, please be aware that no method of transmission over the internet or electronic storage is 100% secure.</p>
          </Section>

          <Section {...docSection("privacy", "deletion")}>
            <p>You have the right to delete or request we assist in deleting the Personal Data that we have collected about you.</p>
            <p>Our Service may give you the ability to delete certain information about you from within the Service. You can update, amend, or delete your details anytime by logging into your Account and going to the account section for managing your personal data.</p>
            <p>Deleting your account removes every account type you hold. If you hold both a Builder and a Tester account, both are deleted together, along with the projects, test cases, submissions, screenshots, ratings, and reputation attached to them.</p>
            <p>Additionally, you can contact us if you wish to access, correct, or delete any personal information that you have shared with us.</p>
            <p>Please keep in mind that we may need to keep certain information if there is a legal requirement or lawful basis to do so.</p>
          </Section>

          <Section {...docSection("privacy", "changes")}>
            <p>We may update our Privacy Policy from time to time. Any changes will be posted on this page, and the revised policy will be effective immediately upon posting.</p>
          </Section>

          <Section {...docSection("privacy", "contact")}>
            <p>
              If you have any questions or concerns about our Privacy Policy or our handling of your personal information, please contact us at{" "}
              <a href="mailto:twnhallhq@gmail.com" className="text-accent-ink underline hover:overline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                twnhallhq@gmail.com
              </a>
            </p>
          </Section>

        </div>
    </DocLayout>
  );
}

// No number: the policy is unnumbered (docNav's `numbered: false`).
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <h2 id={id} tabIndex={-1} className={`font-syne font-bold text-[20px] text-ink mb-3 medium:mb-4 ${ANCHOR}`}>{title}</h2>
      {/* 16px below lg, as every other long-form public page; 14px from lg. */}
      <div className="flex flex-col gap-4 font-sans text-[16px] leading-7 text-ink lg:gap-3 lg:text-[14px]">
        {children}
      </div>
    </Reveal>
  );
}
