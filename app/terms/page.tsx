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
            <Logo size={20} />
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
        <p tabIndex={0} className="font-mono text-[13px] text-midnight/60 mb-6">Last updated: May 11, 2026</p>

        <p tabIndex={0} className="font-mono text-[14px] leading-7 text-midnight/70 mb-12">
          Welcome to <span className="text-midnight">Twnhall</span>, the application designed to help you get real feedback from developers on your project. By using Twnhall, you agree to abide by the following terms and conditions.
        </p>

        <div className="flex flex-col gap-10">

          <Section number="1" title="User Agreement">
            <p tabIndex={0}>By using Twnhall, you agree to comply with all applicable laws and regulations.</p>
          </Section>

          <Section number="2" title="Privacy Policy">
            <p tabIndex={0}>
              We respect your privacy. Please review our{" "}
              <Link tabIndex={0} href="/privacy" className="text-forest underline hover:overline">Privacy Policy</Link>
              {" "}to understand how we collect, use, and safeguard your personal information.
            </p>
          </Section>

          <Section number="3" title="User Conduct">
            <p tabIndex={0}>Users are prohibited from engaging in activities that violate our Community Guidelines, including but not limited to harassment, hate speech, and illegal content sharing.</p>
          </Section>

          <Section number="4" title="Liability and Disclaimers">
            <p tabIndex={0}>Twnhall is not liable for any damages or losses incurred while using the app.</p>
            <p tabIndex={0}>Users acknowledge that they use Twnhall at their own risk.</p>
          </Section>

          <Section number="5" title="Termination Policy">
            <p tabIndex={0}>Twnhall reserves the right to suspend or terminate accounts that violate our terms and conditions.</p>
          </Section>

          <Section number="6" title="Updates and Changes">
            <p tabIndex={0}>We may update our terms and conditions from time to time. Users will be notified of any changes.</p>
          </Section>

          <Section number="7" title="Jurisdiction and Governing Law">
            <p tabIndex={0}>These terms and conditions are governed by the laws of Nigeria. Any disputes shall be resolved in the courts of Nigeria.</p>
          </Section>

          <Section number="8" title="Contact Information">
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
