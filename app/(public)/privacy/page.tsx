import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy — Twnhall" };

export default function PrivacyPolicyPage() {
  return (
    <div className="flex-1 max-w-[720px] w-full mx-auto px-6 py-16">

        <h1 className="font-syne font-bold text-[40px] leading-[48px] tracking-[-0.5px] text-ink mb-2">
          Privacy Policy
        </h1>
        <p className="font-mono text-[13px] text-ink-muted mb-12">Last updated: August 6, 2026</p>

        <div className="flex flex-col gap-10">

          <p className="font-sans text-[14px] leading-7 text-ink">
            At <span className="text-ink">Twnhall</span>, we are committed to protecting your privacy and safeguarding your personal information. This Privacy Policy explains how we collect, use, and disclose your information when you use our services.
          </p>

          <Section title="Information We Collect">
            <p>Your activity and the information you provide, including app features you use and how you interact with them, as well as app and device information.</p>
            <p><span className="text-ink font-medium">Personal Information:</span> When you sign up on Twnhall, we may collect certain personal information such as your name, email address, and profile picture. We sign you in through Google, and receive your name, email address, and profile picture from that sign-in.</p>
            <p><span className="text-ink font-medium">Account Information:</span> We record which account types you hold — Builder, Tester, or both — and when each was created. If you hold both, they are stored as two separate account records tied to the same sign-in.</p>
            <p><span className="text-ink font-medium">Content You Submit:</span> Projects and mission briefs you create as a Builder, and the written feedback and screenshots you upload as a Tester. Screenshots are stored in our file storage and are visible to the Builder whose mission you submitted against.</p>
            <p><span className="text-ink font-medium">Review Information:</span> The status of each submission, the 1&ndash;5 rating a Builder gives it, and any note attached when changes are requested.</p>
            <p><span className="text-ink font-medium">Usage Information:</span> We may collect information about how you interact with the app, including your device&apos;s Internet Protocol address (e.g. IP address), the time and date of your visit, and projects you create.</p>
            <p><span className="text-ink font-medium">Device Information:</span> We may collect information about your device, including the device type, operating system, and unique device identifiers and other diagnostic data.</p>
          </Section>

          <Section title="Automated Analysis of Submissions">
            <p>
              When you submit feedback as a Tester, your written comment and the screenshots you attach are sent to <span className="text-ink">Google&apos;s Gemini API</span> to generate a short summary and a sentiment label for the Builder. This happens automatically on every submission.
            </p>
            <p>
              Do not include passwords, personal data about other people, or anything you would not want processed by a third party in your written feedback or screenshots.
            </p>
            <p>
              The generated summary is stored alongside your submission and shown to the Builder. It does not change your rating or whether your submission is approved — a human Builder makes that decision.
            </p>
          </Section>

          <Section title="What Other Users Can See">
            <p>
              <span className="text-ink font-medium">Builders see:</span> the written feedback, screenshots, and generated summary on submissions made against their own missions, and the name and profile picture attached to your account.
            </p>
            <p>
              <span className="text-ink font-medium">Testers see:</span> their own submissions and the status, rating, and any change request a Builder left on them. Testers cannot see other testers&apos; submissions.
            </p>
            <p>
              Project and mission details a Builder publishes are visible to testers browsing the platform.
            </p>
          </Section>

          <Section title="Service Providers We Use">
            <p>We rely on the following third parties to operate Twnhall, and information is shared with them only as needed to provide the service:</p>
            <p><span className="text-ink font-medium">Supabase:</span> database, authentication, and file storage for screenshots.</p>
            <p><span className="text-ink font-medium">Google:</span> sign-in, and the Gemini API for the automated analysis described above.</p>
            <p><span className="text-ink font-medium">Resend:</span> transactional and notification email.</p>
          </Section>

          <Section title="How We Use Your Information">
            <p>We use your personal information to create and manage your Twnhall account, communicate with you by email, or other equivalent forms of electronic communication, such as push notifications about updates or informative communications related to the functionalities, products or contracted services, including security updates when necessary or reasonable for their implementation, and to personalize your experience on the app.</p>
            <p>We use usage information to improve our app, analyze trends, and enhance user experience.</p>
            <p>We may use device information to troubleshoot technical issues and ensure compatibility with our app.</p>
          </Section>

          <Section title="Information Sharing and Disclosure">
            <p>We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>
            <p>We may share your information with third-party service providers who assist us in providing and improving our app, subject to confidentiality obligations.</p>
            <p>We may disclose your information if required by law or in response to the legal process.</p>
            <p>With your consent: We may disclose your personal information for any other purpose with your consent.</p>
          </Section>

          <Section title="Data Security">
            <p>We take reasonable measures to protect your personal information against unauthorized access, disclosure, alteration, and destruction.</p>
            <p>Despite our efforts, please be aware that no method of transmission over the internet or electronic storage is 100% secure.</p>
          </Section>

          <Section title="Delete Your Personal Data">
            <p>You have the right to delete or request we assist in deleting the Personal Data that we have collected about you.</p>
            <p>Our Service may give you the ability to delete certain information about you from within the Service. You can update, amend, or delete your details anytime by logging into your Account and going to the account section for managing your personal data.</p>
            <p>Deleting your account removes every account type you hold. If you hold both a Builder and a Tester account, both are deleted together, along with the projects, missions, submissions, screenshots, ratings, and reputation attached to them.</p>
            <p>Additionally, you can contact us if you wish to access, correct, or delete any personal information that you have shared with us.</p>
            <p>Please keep in mind that we may need to keep certain information if there is a legal requirement or lawful basis to do so.</p>
          </Section>

          <Section title="Changes to This Privacy Policy">
            <p>We may update our Privacy Policy from time to time. Any changes will be posted on this page, and the revised policy will be effective immediately upon posting.</p>
          </Section>

          <Section title="Contact Us">
            <p>
              If you have any questions or concerns about our Privacy Policy or our handling of your personal information, please contact us at{" "}
              <a href="mailto:twnhallhq@gmail.com" className="text-accent-ink  underline hover:overline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface">
                twnhallhq@gmail.com
              </a>
            </p>
          </Section>

        </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-syne font-bold text-[20px] text-ink mb-4">{title}</h2>
      <div className="flex flex-col gap-3 font-sans text-[14px] leading-7 text-ink">
        {children}
      </div>
    </div>
  );
}
