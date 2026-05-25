import Link from "next/link";
import { BugPlay } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy — Townhall" };

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-bone text-midnight font-mono flex flex-col selection:bg-voltage selection:text-obsidian">

      {/* Nav */}
      <header className="border-b border-midnight/10 bg-bone/85 backdrop-blur-md">
        <div className="max-w-[1128px] mx-auto px-6 h-[60px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BugPlay className="w-5 h-5 text-midnight" />
            <span className="font-syne font-bold text-[18px] text-midnight">Townhall</span>
          </Link>
          <Link
            href="/"
            className="font-mono text-[13px] text-midnight/70 hover:text-midnight transition-colors duration-150"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-[720px] w-full mx-auto px-6 py-16">

        <p className="font-mono text-[12px] text-forest uppercase tracking-[1.5px] mb-4">Legal</p>
        <h1 className="font-syne font-bold text-[40px] leading-[48px] tracking-[-0.5px] text-midnight mb-2">
          Privacy Policy
        </h1>
        <p className="font-mono text-[13px] text-midnight/60 mb-12">Last updated: May 11, 2026</p>

        <div className="flex flex-col gap-10">

          <p className="font-mono text-[14px] leading-7 text-midnight/70">
            At <span className="text-midnight">Townhall</span>, we are committed to protecting your privacy and safeguarding your personal information. This Privacy Policy explains how we collect, use, and disclose your information when you use our services.
          </p>

          <Section title="Information We Collect">
            <p>Your activity and the information you provide, including app features you use and how you interact with them, as well as app and device information.</p>
            <p><span className="text-midnight font-medium">Personal Information:</span> When you sign up on Townhall, we may collect certain personal information such as your name, email address, and profile picture.</p>
            <p><span className="text-midnight font-medium">Usage Information:</span> We may collect information about how you interact with the app, including your device's Internet Protocol address (e.g. IP address), the time and date of your visit, and projects you create.</p>
            <p><span className="text-midnight font-medium">Device Information:</span> We may collect information about your device, including the device type, operating system, and unique device identifiers and other diagnostic data.</p>
          </Section>

          <Section title="How We Use Your Information">
            <p>We use your personal information to create and manage your Townhall account, communicate with you by email, or other equivalent forms of electronic communication, such as push notifications about updates or informative communications related to the functionalities, products or contracted services, including security updates when necessary or reasonable for their implementation, and to personalize your experience on the app.</p>
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
            <p>Additionally, you can contact us if you wish to access, correct, or delete any personal information that you have shared with us.</p>
            <p>Please keep in mind that we may need to keep certain information if there is a legal requirement or lawful basis to do so.</p>
          </Section>

          <Section title="Changes to This Privacy Policy">
            <p>We may update our Privacy Policy from time to time. Any changes will be posted on this page, and the revised policy will be effective immediately upon posting.</p>
          </Section>

          <Section title="Contact Us">
            <p>
              If you have any questions or concerns about our Privacy Policy or our handling of your personal information, please contact us at{" "}
              <a href="mailto:privacy@townhl.com" className="text-forest hover:underline">
                privacy@townhl.com
              </a>
            </p>
          </Section>

        </div>
      </main>

      {/* Footer — dark, matches landing */}
      <footer className="w-full bg-obsidian font-mono">
        <div className="max-w-[1128px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-mono text-[12px] text-ash/60">© {new Date().getFullYear()} Townhall. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="font-mono text-[12px] text-voltage">Privacy Policy</Link>
            <Link href="/terms" className="font-mono text-[12px] text-ash/60 hover:text-chalk transition-colors duration-150">Terms of Service</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-syne font-bold text-[20px] text-midnight mb-4">{title}</h2>
      <div className="flex flex-col gap-3 font-mono text-[14px] leading-7 text-midnight/70">
        {children}
      </div>
    </div>
  );
}
