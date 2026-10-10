import { prefersReducedMotion } from "./focus.ts"

/**
 * The four long documents and their sections — the one source for both the
 * headings on each page and the navigation beside them.
 *
 * A page never writes a section title: it spreads `docSection(slug, id)` onto
 * its heading, so renaming a section here renames the heading and the nav link
 * together. components/public/__tests__/docNav.test.ts fails if a page and
 * this list stop matching in either direction.
 *
 * Ids are written out, not derived from titles: they end up in shared links,
 * so a heading can be reworded without moving its anchor.
 *
 * Pure and React-free, like lib/access.ts, so a node test can import it.
 */
export const DOCS = [
  {
    slug: "builder",
    href: "/guides/builder",
    label: "Builder guide",
    numbered: true,
    sections: [
      { id: "project", title: "Start with a project" },
      { id: "test-kind", title: "Decide what kind of test you need" },
      { id: "test-case", title: "Write the test case" },
      { id: "notes", title: "Notes for testers are optional" },
      { id: "device", title: "Say where it should be tested" },
      { id: "five-testers", title: "How many testers, and why five" },
      { id: "audit-log", title: "Reading the audit log" },
      { id: "review", title: "Review and rate every report" },
    ],
  },
  {
    slug: "tester",
    href: "/guides/tester",
    label: "Tester guide",
    numbered: true,
    sections: [
      { id: "mission", title: "What a mission is" },
      { id: "read-first", title: "Read the whole test case first" },
      { id: "statuses", title: "Pass, fail, or blocked" },
      { id: "fields", title: "What each field wants" },
      { id: "screenshots", title: "Screenshots" },
      { id: "anything-else", title: "Anything else" },
      { id: "rated-well", title: "What gets rated well" },
    ],
  },
  {
    slug: "terms",
    href: "/terms",
    label: "Terms of Service",
    numbered: true,
    sections: [
      { id: "agreement", title: "User Agreement" },
      { id: "accounts", title: "Accounts and Account Types" },
      { id: "missions", title: "Missions and Review" },
      { id: "ratings", title: "Ratings and Reputation" },
      { id: "content", title: "Your Content" },
      { id: "privacy", title: "Privacy Policy" },
      { id: "conduct", title: "User Conduct" },
      { id: "liability", title: "Liability and Disclaimers" },
      { id: "termination", title: "Termination Policy" },
      { id: "updates", title: "Updates and Changes" },
      { id: "jurisdiction", title: "Jurisdiction and Governing Law" },
      { id: "contact", title: "Contact Information" },
    ],
  },
  {
    slug: "privacy",
    href: "/privacy",
    label: "Privacy Policy",
    numbered: false,
    sections: [
      { id: "collect", title: "Information We Collect" },
      { id: "automated-analysis", title: "Automated Analysis of Submissions" },
      { id: "visibility", title: "What Other Users Can See" },
      { id: "providers", title: "Service Providers We Use" },
      { id: "use", title: "How We Use Your Information" },
      { id: "sharing", title: "Information Sharing and Disclosure" },
      { id: "security", title: "Data Security" },
      { id: "deletion", title: "Delete Your Personal Data" },
      { id: "changes", title: "Changes to This Privacy Policy" },
      { id: "contact", title: "Contact Us" },
    ],
  },
] as const

type Doc = (typeof DOCS)[number]
export type DocSlug = Doc["slug"]
export type SectionId<S extends DocSlug> = Extract<Doc, { slug: S }>["sections"][number]["id"]

export type SectionHeading = { id: string; number?: string; title: string }

export function docFor(slug: DocSlug): Doc {
  return DOCS.find((doc) => doc.slug === slug)!
}

/** Every section's heading props. The number is its position, so it cannot skip. */
export function headingsFor(slug: DocSlug): SectionHeading[] {
  const doc = docFor(slug)
  return doc.sections.map(({ id, title }, index) =>
    doc.numbered ? { id, number: String(index + 1), title } : { id, title },
  )
}

/** One section's heading props, for the page to spread onto its heading. */
export function docSection<S extends DocSlug>(slug: S, id: SectionId<S>): SectionHeading {
  return headingsFor(slug).find((heading) => heading.id === id)!
}

/**
 * Scroll to a section heading and move keyboard focus onto it.
 *
 * Focus, not just scroll: a keyboard or screen-reader user left at the link
 * they pressed has not been taken anywhere. The heading carries tabIndex={-1}
 * so it can take focus without joining the tab order. preventScroll, or the
 * browser's own focus scroll races the smooth one — same as lib/focus.ts.
 */
export function jumpToSection(id: string): void {
  const heading = document.getElementById(id)
  if (!heading) return
  heading.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  })
  heading.focus({ preventScroll: true })
  history.replaceState(null, "", `#${id}`)
}
