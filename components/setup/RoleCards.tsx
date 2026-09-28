"use client"

import { useState } from "react"
import { Hammer, FlaskConical, ArrowRight } from "lucide-react"
import { roleCardState } from "@/lib/setup"
import type { AccountType } from "@/lib/access"

const ROLES = [
  {
    type: "builder" as const,
    icon: Hammer,
    label: "I'm a Builder",
    blurb: "Submit products for real people to test, write missions, and review the feedback that comes back.",
    bullets: ["Submit projects", "Write missions", "Review + rate submissions"],
  },
  {
    type: "tester" as const,
    icon: FlaskConical,
    label: "I'm a Tester",
    blurb: "Pick up missions, work through the builder's test case step by step, and file feedback they have to answer.",
    bullets: ["Browse open missions", "File a step-by-step audit log", "See what the builder did with it"],
  },
]

/**
 * The two role cards on /choose-account, with one pending state between them.
 *
 * The server page decides which action each card gets — create or switch —
 * and passes it in; this component only knows that a submit is in flight. The
 * forms stay `<form action>` so the page still posts with JS off.
 *
 * No reset on failure: a throwing action lands on the error boundary, which
 * replaces this subtree, and a success redirects away. Either way the locked
 * state never outlives the submit.
 */
export function RoleCards({
  held,
  actions,
}: {
  held: AccountType[]
  actions: Record<AccountType, () => Promise<void>>
}) {
  const [pendingRole, setPendingRole] = useState<AccountType | null>(null)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {ROLES.map(({ type, icon: Icon, label, blurb, bullets }) => {
        const alreadyHeld = held.includes(type)
        const state = roleCardState(type, alreadyHeld, pendingRole)

        return (
          <form key={type} action={actions[type]} onSubmit={() => setPendingRole(type)}>
            <button
              type="submit"
              disabled={state.disabled}
              aria-busy={state.busy}
              className="group w-full h-full text-left bg-surface-raised border border-line rounded-[12px] p-6 flex flex-col hover:border-accent-ink transition-colors duration-150 cursor-pointer disabled:cursor-wait disabled:hover:border-line disabled:opacity-60 aria-busy:opacity-100 aria-busy:border-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-[8px] bg-accent-ink/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-accent-ink" strokeWidth={1.8} />
                </div>
                {alreadyHeld && (
                  <span className="font-mono text-[12px] uppercase tracking-[1px] text-accent-ink">
                    You have this
                  </span>
                )}
              </div>

              <h2 className="font-syne font-bold text-[20px] text-ink mb-2">
                {label}
              </h2>
              <p className="font-sans text-[13px] leading-6 text-ink mb-5">
                {blurb}
              </p>

              <ul className="flex flex-col gap-1.5 mb-6">
                {bullets.map((b) => (
                  <li key={b} className="font-mono text-[12px] text-ink-muted flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-accent-ink shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>

              {/* aria-live so the label change is announced, not only seen. */}
              <span
                aria-live="polite"
                className="mt-auto font-mono text-[13px] font-medium text-ink flex items-center gap-1.5 group-hover:text-accent-ink transition-colors duration-150"
              >
                {state.label}
                {state.busy ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-ink-muted border-t-transparent animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </span>
            </button>
          </form>
        )
      })}
    </div>
  )
}
