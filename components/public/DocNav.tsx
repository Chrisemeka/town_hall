"use client"

import Link from "next/link"
import { DOCS, headingsFor, jumpToSection, type DocSlug } from "@/lib/docNav"
import { META } from "@/components/public/prose"

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"

const ITEM = `block rounded-[4px] py-1 font-mono text-[13px] leading-5 text-ink hover:text-accent-ink hover:underline underline-offset-2 ${FOCUS}`

/**
 * Navigation for the four long documents: the current document's sections and
 * a switcher across all four. Both lists come from lib/docNav.ts, the same data
 * the page's headings are rendered from.
 *
 * Rendered twice by DocLayout — once in the wide-screen sidebar, once in the
 * phone disclosure — and only one of the two is ever displayed.
 */
export function DocNav({ slug }: { slug: DocSlug }) {
  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="On this page">
        <p className={`${META} uppercase tracking-[0.5px] mb-2`}>On this page</p>
        <ol className="flex flex-col">
          {headingsFor(slug).map(({ id, number, title }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                onClick={(e) => {
                  // A modified click still opens the anchor where it was asked to.
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                  e.preventDefault()
                  jumpToSection(id)
                }}
                className={ITEM}
              >
                {number && <span className="text-accent-ink mr-2">{number}.</span>}
                {title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <nav aria-label="Documents">
        <p className={`${META} uppercase tracking-[0.5px] mb-2`}>Documents</p>
        <ul className="flex flex-col">
          {DOCS.map((d) => (
            <li key={d.slug}>
              <Link
                href={d.href}
                aria-current={d.slug === slug ? "page" : undefined}
                className={`${ITEM} aria-[current=page]:font-medium aria-[current=page]:text-accent-ink`}
              >
                {d.label}
                {/* Colour never carries state alone. */}
                {d.slug === slug && <span className="text-ink-muted"> (you are here)</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

/**
 * The page frame for a long document: a sticky sidebar beside the text on wide
 * screens, and a collapsed "On this page" block above it on narrow ones.
 * Collapsed by default, and native <details>, so a phone reader reaches the
 * first paragraph without scrolling past a dozen links — with or without JS.
 */
export function DocLayout({ slug, children }: { slug: DocSlug; children?: React.ReactNode }) {
  return (
    <div className="flex-1 w-full max-w-[1040px] mx-auto px-6 py-16 lg:grid lg:grid-cols-[240px_minmax(0,720px)] lg:justify-center lg:gap-12">
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-128px)] overflow-y-auto pr-2">
          <DocNav slug={slug} />
        </div>
      </aside>

      <div className="min-w-0 w-full max-w-[720px] mx-auto lg:mx-0">
        <details className="lg:hidden mb-12 rounded-[12px] border border-line bg-surface-raised group">
          <summary
            className={`flex items-center justify-between min-h-11 px-4 cursor-pointer list-none rounded-[12px] font-mono font-medium text-[14px] text-ink [&::-webkit-details-marker]:hidden ${FOCUS}`}
          >
            On this page
            <span aria-hidden="true" className="text-ink-muted transition-transform duration-150 group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="px-4 pb-4 pt-2">
            <DocNav slug={slug} />
          </div>
        </details>

        {children}
      </div>
    </div>
  )
}
