import Link from "next/link";
import { Logo } from "@/components/Logo";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy — Twnhall" };

export default function PrivacyPolicyPage() {
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
          Privacy Policy
        </h1>
        <p tabIndex={0} className="font-mono text-[13px] text-midnight/60 mb-12">Last updated: August 6, 2026</p>

        <div className="flex flex-col gap-10">

          <p tabIndex={0} className="font-mono text-[14px] leading-7 text-midnight/70">
            At <span className="text-midnight">Twnhall</span>, we are committed to protecting your privacy and safeguarding your personal information. This Privacy Policy explains how we collect, use, and disclose your information when you use our services.
          </p>

          <Section title="Information We Collect">
            <p tabIndex={0}>Your activity and the information you provide, including app features you use and how you interact with them, as well as app and device information.</p>
            <p tabIndex={0}><span className="text-midnight font-medium">Personal Information:</span> When you sign up on Twnhall, we may collect certain personal information such as your name, email address, and profile picture. We sign you in through Google, and receive your name, email address, and profile picture from that sign-in.</p>
            <p tabIndex={0}><span className="text-midnight font-medium">Account Information:</span> We record which account types you hold — Builder, Tester, or both — and when each was created. If you hold both, they are stored as two separate account records tied to the same sign-in.</p>
            <p tabIndex={0}><span className="text-midnight font-medium">Content You Submit:</span> Projects and mission briefs you create as a Builder, and the written feedback and screenshots you upload as a Tester. Screenshots are stored in our file storage and are visible to the Builder whose mission you submitted against.</p>
            <p tabIndex={0}><span className="text-midnight font-medium">Reputation Information:</span> The status of each submission, the 1&ndash;5 rating a Builder gives it, any note attached when changes are requested, and the aggregate rating, completed-mission count, and rank derived from them.</p>
            <p tabIndex={0}><span className="text-midnight font-medium">Earnings Information:</span> The payout amount attached to each mission you complete and the approval status that determines whether it counts toward your balance. We do not currently collect bank details or payment information, because withdrawals are not yet live. If you add a payout method in future, this policy will be updated before we collect it.</p>
            <p tabIndex={0}><span className="text-midnight font-medium">Usage Information:</span> We may collect information about how you interact with the app, including your device&apos;s Internet Protocol address (e.g. IP address), the time and date of your visit, and projects you create.</p>
            <p tabIndex={0}><span className="text-midnight font-medium">Device Information:</span> We may collect information about your device, including the device type, operating system, and unique device identifiers and other diagnostic data.</p>
          </Section>

          <Section title="Automated Analysis of Submissions">
            <p tabIndex={0}>
              When you submit feedback as a Tester, your written comment and the screenshots you attach are sent to <span className="text-midnight">Google&apos;s Gemini API</span> to generate a short summary and a sentiment label for the Builder. This happens automatically on every submission.
            </p>
            <p tabIndex={0}>
              Do not include passwords, personal data about other people, or anything you would not want processed by a third party in your written feedback or screenshots.
            </p>
            <p tabIndex={0}>
              The generated summary is stored alongside your submission and shown to the Builder. It does not change your rating or whether your submission is approved — a human Builder makes that decision.
            </p>
          </Section>

          <Section title="What Other Users Can See">
            <p tabIndex={0}>
              <span className="text-midnight font-medium">Builders see:</span> the written feedback, screenshots, and generated summary on submissions made against their own missions, and the name and profile picture attached to your account.
            </p>
            <p tabIndex={0}>
              <span className="text-midnight font-medium">Testers see:</span> their own submissions and the status, rating, and any change request a Builder left on them. Testers cannot see other testers&apos; submissions.
            </p>
            <p tabIndex={0}>
              Your aggregate rating, completed-mission count, and rank are shown on your own Tester home. Project and mission details a Builder publishes are visible to testers browsing the platform.
            </p>
          </Section>

          <Section title="Service Providers We Use">
            <p tabIndex={0}>We rely on the following third parties to operate Twnhall, and information is shared with them only as needed to provide the service:</p>
            <p tabIndex={0}><span className="text-midnight font-medium">Supabase:</span> database, authentication, and file storage for screenshots.</p>
            <p tabIndex={0}><span className="text-midnight font-medium">Google:</span> sign-in, and the Gemini API for the automated analysis described above.</p>
            <p tabIndex={0}><span className="text-midnight font-medium">Resend:</span> transactional and notification email.</p>
          </Section>

          <Section title="How We Use Your Information">
            <p tabIndex={0}>We use your personal information to create and manage your Twnhall account, communicate with you by email, or other equivalent forms of electronic communication, such as push notifications about updates or informative communications related to the functionalities, products or contracted services, including security updates when necessary or reasonable for their implementation, and to personalize your experience on the app.</p>
            <p tabIndex={0}>We use usage information to improve our app, analyze trends, and enhance user experience.</p>
            <p tabIndex={0}>We may use device information to troubleshoot technical issues and ensure compatibility with our app.</p>
          </Section>

          <Section title="Information Sharing and Disclosure">
            <p tabIndex={0}>We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>
            <p tabIndex={0}>We may share your information with third-party service providers who assist us in providing and improving our app, subject to confidentiality obligations.</p>
            <p tabIndex={0}>We may disclose your information if required by law or in response to the legal process.</p>
            <p tabIndex={0}>With your consent: We may disclose your personal information for any other purpose with your consent.</p>
          </Section>

          <Section title="Data Security">
            <p tabIndex={0}>We take reasonable measures to protect your personal information against unauthorized access, disclosure, alteration, and destruction.</p>
            <p tabIndex={0}>Despite our efforts, please be aware that no method of transmission over the internet or electronic storage is 100% secure.</p>
          </Section>

          <Section title="Delete Your Personal Data">
            <p tabIndex={0}>You have the right to delete or request we assist in deleting the Personal Data that we have collected about you.</p>
            <p tabIndex={0}>Our Service may give you the ability to delete certain information about you from within the Service. You can update, amend, or delete your details anytime by logging into your Account and going to the account section for managing your personal data.</p>
            <p tabIndex={0}>Deleting your account removes every account type you hold. If you hold both a Builder and a Tester account, both are deleted together, along with the projects, missions, submissions, screenshots, ratings, and reputation attached to them.</p>
            <p tabIndex={0}>Additionally, you can contact us if you wish to access, correct, or delete any personal information that you have shared with us.</p>
            <p tabIndex={0}>Please keep in mind that we may need to keep certain information if there is a legal requirement or lawful basis to do so.</p>
          </Section>

          <Section title="Changes to This Privacy Policy">
            <p tabIndex={0}>We may update our Privacy Policy from time to time. Any changes will be posted on this page, and the revised policy will be effective immediately upon posting.</p>
          </Section>

          <Section title="Contact Us">
            <p tabIndex={0}>
              If you have any questions or concerns about our Privacy Policy or our handling of your personal information, please contact us at{" "}
              <a tabIndex={0} href="mailto:twnhallhq@gmail.com" className="text-forest  underline hover:overline">
                twnhallhq@gmail.com
              </a>
            </p>
          </Section>

        </div>
      </main>

      {/* Footer — dark, matches landing */}
      <footer className="w-full bg-obsidian font-mono">
        <div className="max-w-[1128px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p tabIndex={0} className="font-mono text-[12px] text-[#F0F0F2]">© {new Date().getFullYear()} Twnhall. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link tabIndex={0} href="/privacy" className="font-mono text-[12px] text-voltage">Privacy Policy</Link>
            <Link tabIndex={0} href="/terms" className="font-mono text-[12px] text-[#F0F0F2] hover:text-chalk transition-colors duration-150  underline hover:overline">Terms of Service</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 tabIndex={0} className="font-syne font-bold text-[20px] text-midnight mb-4">{title}</h2>
      <div className="flex flex-col gap-3 font-mono text-[14px] leading-7 text-midnight/70">
        {children}
      </div>
    </div>
  );
}
