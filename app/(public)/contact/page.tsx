import type { Metadata } from "next"
import { Mail, MessageCircle } from "lucide-react"
import { META, P, PageHeader } from "@/components/public/prose"
import { CONTACT_EMAIL, X_URL, mailto } from "@/lib/contact"

export const metadata: Metadata = {
  title: "Contact — Twnhall",
  description: "Email us about Pro, or about anything else. We read everything.",
}

/*
 * No form, deliberately.
 *
 * A public unauthenticated form is a spam magnet and there is no bot check
 * anywhere in this repo — the Turnstile the reference design uses is
 * explicitly skipped. A mailto has no spam surface and no server action to
 * secure. If the drop-off from people without a mail client configured ever
 * matters more than that, the form is the thing to build: schema, server
 * action, Resend, rate limit. The plain address is printed below for everyone
 * else.
 */

const ROUTES = [
  {
    icon: Mail,
    title: "Hitting your report limit?",
    body: "Pro starts as a conversation rather than a checkout. Tell us what you are building and how much testing you need, and we will sort it out from there.",
    href: mailto("Twnhall Pro"),
    label: "Email us about Pro",
  },
  {
    icon: MessageCircle,
    title: "Anything else",
    body: "A bug, a tester who needs sorting out, a question about how something works, or an idea. It all goes to the same place and we read it.",
    href: mailto(),
    label: "Send us an email",
  },
]

export default function ContactPage() {
  return (
    <div className="flex-1 w-full max-w-[720px] mx-auto px-6 py-16">
      <PageHeader
        eyebrow="Contact"
        title="Talk to us."
        lede="Twnhall is small enough that a real person reads everything that comes in. Usually a reply within a day or two."
      />

      <div className="grid gap-6 sm:grid-cols-2">
        {ROUTES.map(({ icon: Icon, title, body, href, label }) => (
          <div
            key={title}
            className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface-raised p-6"
          >
            <Icon size={20} className="text-accent-ink" aria-hidden="true" />
            <h2 className="font-syne font-bold text-[20px] leading-7 text-ink">
              {title}
            </h2>
            <p className="font-sans text-[14px] leading-6 text-ink flex-1">
              {body}
            </p>
            <a
              href={href}
              className="mt-2 inline-flex items-center font-mono text-[13px] text-accent-ink underline underline-offset-2 hover:no-underline rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              {label} →
            </a>
          </div>
        ))}
      </div>

      <div className="mt-12 pt-8 border-t border-line flex flex-col gap-3">
        <p className={P}>
          If your mail client does not open, the address is{" "}
          <span className="font-mono text-ink">{CONTACT_EMAIL}</span>.
        </p>
        <p className={P}>
          We are also on{" "}
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-ink underline underline-offset-2 hover:no-underline rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            X
          </a>
          , though email gets a faster answer.
        </p>
        <p className={META}>
          Please do not send credentials or anything you would not put in an
          ordinary email.
        </p>
      </div>
    </div>
  )
}
