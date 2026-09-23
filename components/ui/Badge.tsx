import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * A status chip — Design.md §5.4.
 *
 * The colour comes from a CSS custom property, not a hex literal. It used to
 * be inline hex in a `style` prop, which is invisible to Tailwind and was
 * therefore invisible to the theme refactor too: every one of these read at
 * under 1.1:1 on the light ground once the dashboard started following the
 * theme. Inline hex is the one place a colour can hide from both the compiler
 * and a class-based audit, so it does not get to hold a colour.
 *
 * Every variant uses an `*-ink` token, because a chip is text and a dot — the
 * ink half of the accent rule, never the fill half. Per §10 the colour is
 * never the only signal: each chip carries its label.
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "active"
    | "needs-testers"
    | "draft"
    | "complete"
    | "archived"
    | "role-tester"
    | "default"
    | "negative"
    | "positive"
}

/**
 * One hue per meaning, and no two meanings sharing one.
 *
 * `active` was Mint — the same colour as `complete`, so "this mission is live"
 * and "this mission is finished" were the same chip. It is now info: blue
 * reads as running rather than done, and it leaves green to mean finished.
 *
 * `needs-testers` keeps the accent. §7.5 names it as one of only two
 * attention-grabbing extras the design system permits, and this is the one
 * place a status is meant to pull the eye.
 */
const TONE: Record<string, string> = {
  active: "var(--color-info-ink)",
  "needs-testers": "var(--color-accent-ink)",
  complete: "var(--color-success-ink)",
  positive: "var(--color-success-ink)",
  negative: "var(--color-danger-ink)",
  // The three "not live" states share a neutral. They are told apart by their
  // label, which is what §10 requires anyway.
  draft: "var(--color-ink-muted)",
  archived: "var(--color-ink-muted)",
  default: "var(--color-ink-muted)",
  "role-tester": "var(--color-accent-ink)",
}

const LABEL_TEXT: Record<string, string> = {
  active: "ACTIVE",
  "needs-testers": "NEEDS TESTERS",
  draft: "DRAFT",
  complete: "COMPLETE",
  archived: "ARCHIVED",
  "role-tester": "TESTER",
  default: "",
  negative: "NEGATIVE",
  positive: "POSITIVE",
}

function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  const tone = TONE[variant]
  const label = children ?? LABEL_TEXT[variant]

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[4px] px-2 h-6 font-mono text-[12px] font-medium uppercase tracking-[0.5px] border border-line",
        className,
      )}
      style={{ color: tone }}
      {...props}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        // The dot takes the same token as the label rather than the fill
        // literal: a Mint dot on a light card is 1.07:1, and a dot is a
        // graphical object that WCAG 1.4.11 wants at 3:1.
        style={{ background: tone }}
        aria-hidden="true"
      />
      {label}
    </div>
  )
}

export { Badge }
