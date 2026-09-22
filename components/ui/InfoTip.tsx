"use client"

import { useId, type ReactNode } from "react"

/**
 * A "?" that explains the control beside it.
 *
 * CSS only — `group-hover` for a mouse, `group-focus-within` for a keyboard and
 * for touch, where `:hover` never fires and a hover-only tooltip is simply
 * invisible. A tooltip library would be a dependency for two pseudo-classes.
 *
 * The panel stays in the DOM rather than mounting on hover, so `aria-describedby`
 * has something to point at: a screen reader gets the explanation along with the
 * button instead of the word "help".
 */
export function InfoTip({
  label,
  children,
  className,
}: {
  /** What the button announces as, e.g. "What do Pass, Fail and Blocked mean?" */
  label: string
  children: ReactNode
  className?: string
}) {
  const id = useId()

  return (
    <span className={["relative inline-flex group align-middle", className ?? ""].join(" ")}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="w-4 h-4 shrink-0 rounded-full border border-line text-ink-muted font-mono text-[10px] leading-none flex items-center justify-center transition-colors duration-150 hover:border-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
      >
        ?
      </button>
      <span
        id={id}
        role="tooltip"
        // Opens upward. Below the trigger it landed straight on top of the
        // controls it was explaining — readable, but you could not see the
        // choice while reading about it.
        //
        // Invisible rather than unmounted, and pointer-events-none so it never
        // swallows a click meant for what is underneath it.
        className="pointer-events-none invisible absolute left-0 bottom-full mb-2 z-30 w-[280px] max-w-[70vw] rounded-[8px] border border-line bg-surface p-3 opacity-0 shadow-[0_2px_12px_rgba(0,0,0,0.4)] transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {children}
      </span>
    </span>
  )
}
