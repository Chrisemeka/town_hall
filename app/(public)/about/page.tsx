import Link from "next/link"
import type { Metadata } from "next"
import { LINK_INLINE, P, PageHeader, Section } from "@/components/public/prose"

export const metadata: Metadata = {
  title: "About — Twnhall",
  description:
    "Twnhall is a reciprocal testing platform for developers, built in Nigeria. You earn feedback on your product by testing someone else's.",
}

export default function AboutPage() {
  return (
    <div className="flex-1 w-full max-w-[720px] mx-auto px-6 py-16">
      <PageHeader
        eyebrow="About"
        title="Built for people with no one to test on."
        lede="Most developers ship to an audience of nobody. Friends say it looks nice, and the first real user finds the broken thing in forty seconds. Twnhall is the room in between."
      />

      <div className="flex flex-col gap-12">
        <Section title="What it is">
          <p className={P}>
            You put up a product and say exactly what you want tested. Someone
            works through it step by step and sends back a structured report —
            what they did, what broke, with screenshots. Not an opinion, not a
            star rating. A record of what happened when a real person used it.
          </p>
        </Section>

        <Section title="The deal is reciprocal">
          <p className={P}>
            Nobody buys their way in. You earn a report on your own product by
            writing one on someone else&apos;s, one for one. That is the whole
            economy, and it is why the feedback is any good: the person testing
            your checkout has shipped a checkout, and knows which parts are hard.
          </p>
          <p className={P}>
            There is a paid tier for people who would rather not test — usually
            an agency or a solo founder with nobody to spare.{" "}
            <Link href="/pricing" className={LINK_INLINE}>
              The pricing page
            </Link>{" "}
            is honest about what it does and does not include.
          </p>
        </Section>

        <Section title="Who does the testing">
          <p className={P}>
            A small trained cohort, not a crowd. Everyone here has been walked
            through what a useful report looks like — how to tell a failure from
            a blocked step, why a screenshot of the broken state beats a
            paragraph about it. That is why reports come back in a shape you can
            act on rather than a shape you have to interpret.
          </p>
          <p className={P}>
            It also means capacity is real and finite. We would rather tell you
            that than promise volume we cannot supply.
          </p>
        </Section>

        <Section title="Made in Nigeria">
          <p className={P}>
            Built in Lagos, for a market where &ldquo;just run a usability
            study&rdquo; means a quote in dollars from a company that has never
            loaded your site on a 3G connection. The testers here have.
          </p>
        </Section>
      </div>

      <div className="mt-16 pt-8 border-t border-line flex flex-col gap-4">
        <p className={P}>
          Questions, or want to talk about Pro?{" "}
          <Link href="/contact" className={LINK_INLINE}>
            Get in touch
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
