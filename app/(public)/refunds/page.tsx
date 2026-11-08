import Link from "next/link";
import type { Metadata } from "next";
import { DocLayout } from "@/components/public/DocNav";
import { ANCHOR } from "@/components/public/prose";
import { docSection } from "@/lib/docNav";
import { Reveal } from "@/components/public/Reveal";
import { MERCHANT, addressLine, legalLine, phoneDisplay } from "@/lib/merchant";
import { PLANS, priceLine } from "@/lib/plans";
import { PLAN_IDS } from "@/lib/vocabulary";

export const metadata: Metadata = { title: "Billing and Refund Policy — Twnhall" };

// Every sentence here is a promise a builder can hold us to in a dispute, and
// Paystack reads it when deciding one (docs/specs/SPEC-billing-policy.md).
// Describe the product as it is: a monthly subscription, cancelled in Settings,
// and no turnaround time. Prices come from lib/plans.ts and are never written
// here. A change to how billing works changes this page in the same PR.

const PAID = PLAN_IDS.map((id) => PLANS[id]).filter((plan) => plan.price);

const LINK =
  "text-accent-ink underline hover:overline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const Email = () => (
  <a href={`mailto:${MERCHANT.supportEmail}`} className={LINK}>
    {MERCHANT.supportEmail}
  </a>
);

export default function RefundsPage() {
  return (
    <DocLayout slug="refunds">

        <Reveal>
          <h1 className="font-syne font-bold text-[32px] leading-10 medium:text-[40px] medium:leading-[48px] tracking-[-0.5px] text-ink mb-2">
            Billing and Refund Policy
          </h1>
        </Reveal>
        <Reveal step={1}>
          <p className="font-mono text-[13px] text-ink-muted mb-6">Last updated: November 8, 2026</p>
        </Reveal>

        <Reveal step={2}>
        <p className="font-sans text-[16px] leading-7 text-ink lg:text-[14px] mb-10 medium:mb-12">
          How you pay for Starter and Pro, what you get, and what happens when something goes wrong. This policy is part of our{" "}
          <Link href="/terms" className={LINK}>Terms of Service</Link>.
        </p>
        </Reveal>

        <div className="flex flex-col gap-8 medium:gap-10">

          <Section {...docSection("refunds", "who")}>
            <p>{legalLine()}</p>
            <p>
              Starter and Pro are sold by {MERCHANT.legalName}. We are responsible for the service you buy, for support, and for refunds.
            </p>
            <p>Payments are processed by Paystack. We never see or store your card number or security code.</p>
          </Section>

          <Section {...docSection("refunds", "what")}>
            <p>
              A paid plan gives you a number of <span className="text-ink font-medium">tester reports</span> each calendar month (Lagos time). A tester report is one real person testing your product against your test case and sending you a structured report: what they did, what broke, and screenshots.
            </p>
            <ul className="flex flex-col gap-2 list-disc pl-6">
              {PAID.map((plan) => (
                <li key={plan.id}>
                  <span className="text-ink font-medium">{plan.name}</span>: <span className="font-mono">{priceLine(plan)}</span>, {plan.monthlyReports} tester reports a month, {plan.activeMissions} active test cases at once.
                </li>
              ))}
            </ul>
            <p>
              Everything else a plan includes is on{" "}
              <Link href="/pricing" className={LINK}>Pricing</Link>.
            </p>
          </Section>

          <Section {...docSection("refunds", "paying")}>
            <p>
              Prices are in naira. They include any tax we&apos;re required to charge. <span className="text-ink font-medium">We never add a card or processing fee on top.</span>
            </p>
            <p>
              You subscribe in Settings → Plan and pay by card through Paystack. Your card is charged when you subscribe and then on the same date every month (the 28th if you subscribe on the 29th–31st). Your plan starts once the payment arrives, and we email you to confirm it, with the date of your next charge.
            </p>
          </Section>

          <Section {...docSection("refunds", "renewal")}>
            <p>
              A billing period is one month from the day your plan starts, unless we agree another length in writing.
            </p>
            <p>
              <span className="text-ink font-medium">Your plan renews every month until you cancel.</span> Three days before each renewal we email you the amount, the date and the card. If a renewal payment fails, your plan stays for 3 more days so you can pay; after that it ends and nothing more is charged. When a plan ends, the account moves to Community, and test cases already live keep the testers they have.
            </p>
            <p>
              A plan we arranged with you directly doesn&apos;t renew. It ends on its end date, and you can subscribe in Settings → Plan from then.
            </p>
          </Section>

          <Section {...docSection("refunds", "delivery")}>
            <p>
              Everything you buy is delivered online, inside Twnhall. A report is delivered when a tester submits it to your test case. It appears on the test case&apos;s page, and we email you when it arrives.
            </p>
            <p>
              Reports arrive as testers complete them. <span className="text-ink font-medium">We don&apos;t promise a turnaround time.</span> A test case is open to up to five testers, and you can close it early and keep everything that came in. Nothing physical is shipped.
            </p>
          </Section>

          <Section {...docSection("refunds", "undelivered")}>
            <p>
              If testers don&apos;t deliver every report a test case was open to, the reports you didn&apos;t receive are never lost. Close the test case and they come back to your balance. If the month they came from has already ended, they come back as <span className="text-ink font-medium">carried reports</span>, which don&apos;t expire and stay yours on any plan.
            </p>
            <p>
              Monthly reports you never publish on a test case expire at the end of the month, as{" "}
              <Link href="/pricing" className={LINK}>Pricing</Link> explains. If you close a test case on the last day of a month, its reports come back to that month.
            </p>
          </Section>

          <Section {...docSection("refunds", "cancel")}>
            <p>
              <span className="text-ink font-medium">Cancel any time in Settings → Plan.</span> You keep your plan until the end of the period you&apos;ve paid for, and you won&apos;t be charged again. We confirm by email.
            </p>
            <p>
              We don&apos;t refund the rest of a period you cancel part-way through, except as described under Refunds. To stop a plan we arranged with you directly, email <Email /> from your account&apos;s email address.
            </p>
            <p>
              To move to a smaller plan, use Switch to Starter in Settings → Plan. It takes effect when your current period ends, and the new price starts then.
            </p>
          </Section>

          <Section {...docSection("refunds", "refunds")}>
            <p>You can have a full refund:</p>
            <ul className="flex flex-col gap-2 list-disc pl-6">
              <li>within 7 days of paying, if you haven&apos;t published a test case using that period&apos;s reports;</li>
              <li>if you were charged twice, charged the wrong amount, paid for a plan that was never applied to your account, or charged after you cancelled;</li>
              <li>
                for the unused part of a period, by day, if we close your account for a reason other than a breach of our{" "}
                <Link href="/terms" className={LINK}>Terms</Link>, or stop offering your plan.
              </li>
            </ul>
            <p>
              If you move from Starter to Pro, we refund Starter for the whole days left in your billing period after the day you upgrade, at the daily rate you paid, rounded down to the naira. Days are counted in Lagos time. A billing period runs from the day you paid up to the day before your next billing date. For example, a period paid on 4 November covers 4 November to 3 December, so upgrading on 14 November refunds 19 of its 30 days. It&apos;s automatic and goes back to the card you paid with. It only starts once your Pro payment has gone through. We email you when it starts and when it&apos;s done.
            </p>
            <p>
              <span className="text-ink font-medium">We only tell you a refund is done when Paystack confirms it.</span> If one can&apos;t be sent automatically, we pay it back another way within two business days.
            </p>
            <p>
              To ask, email <Email /> from your account&apos;s email address with the payment&apos;s date and amount. We reply within one business day. Once a refund is agreed, we start it within two business days, to the card or account you paid from. How long it then takes to reach you depends on your bank. We refund the full amount you paid.
            </p>
          </Section>

          <Section {...docSection("refunds", "disputes")}>
            <p>
              Please email us before disputing a charge with your bank. We answer within one business day, and most problems are fixed faster that way than through a dispute.
            </p>
            <p>
              If you do dispute a charge, we&apos;ll give your bank or card issuer the record of what was delivered: which test cases you published, when, and when each report arrived. Testers appear in it only as &ldquo;Tester 1&rdquo;, &ldquo;Tester 2&rdquo; and so on.
            </p>
          </Section>

          <Section {...docSection("refunds", "changes")}>
            <p>
              We give you at least 30 days&apos; notice by email before a price change affects you, and never change the price of a period you&apos;ve already paid for.
            </p>
            <p>
              Changes to this policy are posted here with a new date. A change that&apos;s worse for you applies only from your next billing period.
            </p>
          </Section>

          <Section {...docSection("refunds", "contact")}>
            <p>
              Email <Email />
              {MERCHANT.phone && (
                <>
                  {" "}or call{" "}
                  <a href={`tel:${MERCHANT.phone}`} className={LINK}>
                    {phoneDisplay(MERCHANT.phone)}
                  </a>
                </>
              )}
              .
            </p>
            <p>Our postal address is {addressLine()}.</p>
          </Section>

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
