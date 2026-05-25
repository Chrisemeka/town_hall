import Link from "next/link";
import { BugPlay } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service — Townhall" };

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="font-mono text-[13px] text-midnight/60 mb-6">Last updated: May 11, 2026</p>

        <p className="font-mono text-[14px] leading-7 text-midnight/70 mb-12">
          Welcome to <span className="text-midnight">Townhall</span>, the application designed to help you get real feedback from developers on your project. By using Townhall, you agree to abide by the following terms and conditions.
        </p>

        <div className="flex flex-col gap-10">

          <Section number="1" title="User Agreement">
            <p>By using Townhall, you agree to comply with all applicable laws and regulations.</p>
          </Section>

          <Section number="2" title="Privacy Policy">
            <p>
              We respect your privacy. Please review our{" "}
              <Link href="/privacy" className="text-forest hover:underline">Privacy Policy</Link>
              {" "}to understand how we collect, use, and safeguard your personal information.
            </p>
          </Section>

          <Section number="3" title="User Conduct">
            <p>Users are prohibited from engaging in activities that violate our Community Guidelines, including but not limited to harassment, hate speech, and illegal content sharing.</p>
          </Section>

          <Section number="4" title="Liability and Disclaimers">
            <p>Townhall is not liable for any damages or losses incurred while using the app.</p>
            <p>Users acknowledge that they use Townhall at their own risk.</p>
          </Section>

          <Section number="5" title="Termination Policy">
            <p>Townhall reserves the right to suspend or terminate accounts that violate our terms and conditions.</p>
          </Section>

          <Section number="6" title="Updates and Changes">
            <p>We may update our terms and conditions from time to time. Users will be notified of any changes.</p>
          </Section>

          <Section number="7" title="Jurisdiction and Governing Law">
            <p>These terms and conditions are governed by the laws of Nigeria. Any disputes shall be resolved in the courts of Nigeria.</p>
          </Section>

          <Section number="8" title="Contact Information">
            <p>
              For inquiries, support, or complaints, please contact us at{" "}
              <a href="mailto:terms@townhl.com" className="text-forest hover:underline">
                terms@townhl.com
              </a>
            </p>
          </Section>

          <div className="pt-6 border-t border-midnight/10">
            <p className="font-mono text-[13px] leading-6 text-midnight/70">
              By using Townhall, you agree to these terms and conditions. If you do not agree with any part of these terms, please do not use the app.
            </p>
          </div>

        </div>
      </main>

      {/* Footer — dark, matches landing */}
      <footer className="w-full bg-obsidian font-mono">
        <div className="max-w-[1128px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-mono text-[12px] text-ash/60">© {new Date().getFullYear()} Townhall. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="font-mono text-[12px] text-ash/60 hover:text-chalk transition-colors duration-150">Privacy Policy</Link>
            <Link href="/terms" className="font-mono text-[12px] text-voltage">Terms of Service</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-syne font-bold text-[20px] text-midnight mb-4">
        <span className="text-midnight/50 font-mono text-[14px] mr-2">{number}.</span>
        {title}
      </h2>
      <div className="flex flex-col gap-3 font-mono text-[14px] leading-7 text-midnight/70">
        {children}
      </div>
    </div>
  );
}
