import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service — Townhall" };

export default function TermsPage() {
  return (
    <div className="theme-light min-h-screen bg-obsidian text-chalk">

      {/* Nav */}
      <header className="border-b border-iron">
        <div className="max-w-[1128px] mx-auto px-6 h-[60px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-syne font-bold text-[18px] text-chalk">Townhall</span>
          </Link>
          <Link
            href="/"
            className="font-mono text-[13px] text-ash hover:text-chalk transition-colors duration-150"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[720px] mx-auto px-6 py-16">

        <p className="font-mono text-[12px] text-ash uppercase tracking-[1.5px] mb-4">Legal</p>
        <h1 className="font-syne font-bold text-[40px] leading-[48px] tracking-[-0.5px] text-chalk mb-2">
          Terms of Service
        </h1>
        <p className="font-mono text-[13px] text-ash mb-6">Last updated: May 11, 2026</p>

        <p className="font-mono text-[14px] leading-7 text-ash mb-12">
          Welcome to <span className="text-chalk">Townhall</span>, the application designed to help you get real feedback from developers on your project. By using Townhall, you agree to abide by the following terms and conditions.
        </p>

        <div className="flex flex-col gap-10">

          <Section number="1" title="User Agreement">
            <p>By using Townhall, you agree to comply with all applicable laws and regulations.</p>
          </Section>

          <Section number="2" title="Privacy Policy">
            <p>
              We respect your privacy. Please review our{" "}
              <Link href="/privacy" className="text-voltage hover:underline">Privacy Policy</Link>
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
              <a href="mailto:terms@townhl.com" className="text-voltage hover:underline">
                terms@townhl.com
              </a>
            </p>
          </Section>

          <div className="pt-6 border-t border-iron">
            <p className="font-mono text-[13px] leading-6 text-ash">
              By using Townhall, you agree to these terms and conditions. If you do not agree with any part of these terms, please do not use the app.
            </p>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-iron mt-16">
        <div className="max-w-[1128px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-mono text-[12px] text-ash">© 2026 Townhall. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="font-mono text-[12px] text-ash hover:text-chalk transition-colors duration-150">Privacy Policy</Link>
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
      <h2 className="font-syne font-bold text-[20px] text-chalk mb-4">
        <span className="text-ash font-mono text-[14px] mr-2">{number}.</span>
        {title}
      </h2>
      <div className="flex flex-col gap-3 font-mono text-[14px] leading-7 text-ash">
        {children}
      </div>
    </div>
  );
}
