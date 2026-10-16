"use client"

import { useEffect, useId, useRef, type ReactNode } from "react"

const fine = () => matchMedia("(pointer: fine)").matches
const compact = () => matchMedia("(max-width: 599px)").matches

/**
 * A "?" that explains the control beside it.
 *
 * On the native Popover API. It used to be CSS only — `group-hover` and
 * `group-focus-within` — and iOS Safari does not focus a button on tap, so on
 * an iPhone the explanation never appeared. Now a tap opens it (the
 * `popoverTarget`), and a tap outside or Esc closes it: the platform's light
 * dismiss and top layer, as <dialog> gives the sheets. A mouse or keyboard
 * still opens it on hover and focus, as before.
 *
 * Positioned by hand: the top layer ignores the trigger's `relative` parent,
 * and CSS anchor positioning is not in Safari yet. Below 600px it is a card
 * pinned to the bottom of the screen; from 600px it opens above the trigger.
 *
 * The panel stays in the DOM, so `aria-describedby` has something to point at:
 * a screen reader gets the explanation with the button, not the word "help".
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
  const trigger = useRef<HTMLButtonElement>(null)
  const tip = useRef<HTMLSpanElement>(null)

  // Placed on every open, however it opened — tap, hover or focus.
  useEffect(() => {
    const el = tip.current
    if (!el) return
    function place(e: Event) {
      const t = tip.current
      const b = trigger.current
      if (!t || !b || (e as ToggleEvent).newState !== "open") return
      if (compact()) {
        t.style.left = t.style.top = ""
        return
      }
      const r = b.getBoundingClientRect()
      t.style.left = `${Math.max(16, Math.min(r.left, window.innerWidth - t.offsetWidth - 16))}px`
      // Opens upward: below the trigger it landed on the very choices it explains.
      t.style.top = `${Math.max(16, r.top - t.offsetHeight - 8)}px`
    }
    el.addEventListener("toggle", place)
    return () => el.removeEventListener("toggle", place)
  }, [])

  const show = () => fine() && tip.current?.showPopover()
  const hide = () => fine() && tip.current?.hidePopover()

  return (
    <span className={["relative inline-flex align-middle", className ?? ""].join(" ")}>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-describedby={id}
        popoverTarget={id}
        // "show", not a toggle: with a mouse, hover has already opened it, and
        // a click must not close it again under the pointer.
        popoverTargetAction="show"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        // 16–20px drawn, 48px to tap through the ::after.
        className="relative w-5 h-5 lg:w-4 lg:h-4 shrink-0 rounded-full border border-line text-ink-muted font-mono text-[12px] lg:text-[10px] leading-none flex items-center justify-center transition-colors duration-150 hover:border-ink-muted hover:text-ink after:absolute after:-inset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
      >
        ?
      </button>
      <span
        ref={tip}
        id={id}
        popover="auto"
        role="tooltip"
        className="m-0 rounded-[8px] border border-line bg-surface p-3 text-ink shadow-[0_2px_12px_rgba(0,0,0,0.4)] max-medium:inset-x-4 max-medium:top-auto max-medium:bottom-4 max-medium:w-auto medium:inset-auto medium:w-[280px] medium:max-w-[70vw]"
      >
        {children}
      </span>
    </span>
  )
}
