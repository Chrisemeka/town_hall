import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Logo } from "@/components/Logo";
import { X_URL } from "@/lib/contact";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const LINK = `text-[14px] lg:text-[13px] text-ink-muted hover:text-ink transition-colors duration-150 rounded-[4px] ${FOCUS}`;

/**
 * The three link columns. Both layouts render from this one list — compact
 * accordions and the columns from 600px — so a link is added in one place.
 *
 * Never add an entry before its destination exists — a footer link to a 404 is
 * the failure mode the revamp brief names by name.
 */
const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/about", label: "About" },
    ],
  },
  {
    heading: "Guides",
    links: [
      { href: "/guides/builder", label: "For builders" },
      { href: "/guides/tester", label: "For testers" },
      { href: "/signup", label: "Get started" },
    ],
  },
  {
    heading: "Company & legal",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
      { href: "/login", label: "Sign in" },
    ],
  },
];

/**
 * The brand block and four columns from 600px; below that, the brand block and
 * three closed accordions.
 *
 * ponytail: both layouts are rendered and one is hidden by class. display:none
 * takes the hidden copy out of the accessibility tree and the tab order, a
 * <details> cannot be forced open by CSS everywhere, and a width-reading hook
 * would flash on hydration.
 */
export function PublicFooter() {
  return (
    <footer className="bg-surface border-t border-line">
      <div className="max-w-[1200px] mx-auto px-4 medium:px-6 lg:px-8 pt-12 medium:pt-16 pb-12">
        <div className="grid gap-8 medium:gap-12 medium:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-4 max-w-sm">
            <div className="flex items-center gap-2">
              <Logo size={24} />
              <span className="font-syne font-bold text-[20px] text-ink">
                Twnhall
              </span>
            </div>
            <p className="font-sans text-[14px] leading-6 text-ink">
              Ship with confidence. Test each other.
            </p>
            <p className="text-[13px] text-ink-muted">Made in Nigeria 🇳🇬</p>
            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${LINK} max-medium:flex max-medium:min-h-12 max-medium:items-center`}
            >
              We&apos;re on X
            </a>
          </div>

          {COLUMNS.map(({ heading, links }) => (
            <div key={heading} className="hidden medium:flex flex-col gap-3">
              <h2 className="font-medium text-[13px] text-ink mb-1">{heading}</h2>
              {links.map(({ href, label }) => (
                <Link key={href} href={href} className={LINK}>
                  {label}
                </Link>
              ))}
            </div>
          ))}

          <div className="medium:hidden border-t border-line">
            {COLUMNS.map(({ heading, links }) => (
              <details key={heading} className="group border-b border-line">
                <summary
                  className={`flex min-h-12 cursor-pointer list-none items-center justify-between rounded-[4px] [&::-webkit-details-marker]:hidden ${FOCUS}`}
                >
                  <h2 className="font-medium text-[14px] text-ink">{heading}</h2>
                  <ChevronDown
                    size={20}
                    aria-hidden="true"
                    className="text-ink-muted transition-transform duration-150 ease-standard group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <div className="flex flex-col pb-2">
                  {links.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className={`${LINK} flex min-h-12 items-center`}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-line">
          <span className="text-[12px] text-ink-muted">
            &copy; {new Date().getFullYear()} Twnhall. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
