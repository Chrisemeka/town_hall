import Link from "next/link"
import type { Metadata } from "next"
import { ArrowRight } from "lucide-react"
import { H3, PageHeader } from "@/components/public/prose"

export const metadata: Metadata = {
  title: "Guides — Twnhall",
  description:
    "How to run a test that gets you useful feedback, and how to write a report someone can act on.",
}

const GUIDES = [
  {
    href: "/guides/builder",
    title: "For builders",
    blurb:
      "Set up a project, write a test case people can follow, and read the audit log that comes back.",
  },
  {
    href: "/guides/tester",
    title: "For testers",
    blurb:
      "Work through a mission, mark each step honestly, and write up what you found so it gets fixed.",
  },
]

export default function GuidesIndexPage() {
  return (
    <div className="flex-1 w-full max-w-[720px] mx-auto px-6 py-16">
      <PageHeader
        eyebrow="Guides"
        title="Two sides of the same loop."
        lede="Most people here are both — you test other people's products to earn feedback on your own. Read whichever half you are about to do."
      />

      <div className="grid gap-6 sm:grid-cols-2">
        {GUIDES.map(({ href, title, blurb }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-3 rounded-[12px] border border-line bg-surface-raised p-6 hover:border-accent-ink transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <h2 className={H3}>{title}</h2>
            <p className="font-sans text-[14px] leading-6 text-ink">{blurb}</p>
            <span className="mt-2 inline-flex items-center gap-2 font-mono text-[13px] text-accent-ink">
              Read it
              <ArrowRight size={14} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
