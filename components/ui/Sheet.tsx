"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { X } from "lucide-react"
import { MenuMorphIcon } from "@/components/ui/MenuMorphIcon"
import { closeButtonPosition } from "@/lib/sheet"

// The `expanded:` breakpoint. The sheets never render from here up.
const EXPANDED = "(min-width: 840px)"

const ICON_BUTTON =
  "h-12 w-12 shrink-0 inline-flex items-center justify-center text-ink-muted hover:text-ink hover:bg-ink/[0.06] active:bg-ink/[0.10] transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"

// M3 modal navigation drawer from the trailing edge. The motion — sheet and
// scrim, in and out, and the reduced-motion fade — is `.th-sheet` in
// app/globals.css; a Tailwind variant chain cannot say allow-discrete.
const SHEET =
  "th-sheet m-0 ml-auto h-full max-h-full max-w-none rounded-l-[16px] bg-surface p-0 text-ink backdrop:bg-obsidian/60" // ponytail: the scrim is literal Obsidian on purpose — dark in both themes; one that follows the theme stops being a scrim.

export type SheetTrigger =
  | { kind: "menu" }
  | { kind: "avatar"; node: ReactNode; title?: string }

// Measured, not hard-coded: the public bar is 64px and sticky (static below
// 480px of height), the app bar 56px and fixed, and both insets change at
// 600px. Runs right after showModal(), in the same task, so nothing paints in
// between; before it the dialog is display:none and has no width to read.
function placeClose(dialog: HTMLDialogElement, trigger: HTMLElement, band: HTMLElement) {
  const { top, right } = closeButtonPosition(
    trigger.getBoundingClientRect(),
    document.documentElement.clientWidth,
    dialog.offsetWidth,
    band.offsetHeight,
  )
  dialog.style.setProperty("--th-x-top", `${top}px`)
  dialog.style.setProperty("--th-x-right", `${right}px`)
}

/**
 * The sheet below 840px: the public MobileNav and the app's AccountSheet.
 *
 * ponytail: a native <dialog> opened with showModal(), not a hand-rolled sheet.
 * The platform gives the three things that are tedious and easy to get wrong —
 * focus is trapped inside while it is open, Esc closes it, and focus returns to
 * the trigger on close — for no code. `open` state exists only to drive
 * aria-expanded on the trigger; the dialog's own `close` event keeps it honest
 * when Esc or the backdrop closes it without us.
 *
 * The close button covers the trigger exactly and comes first in the DOM, so
 * showModal() puts focus on the spot the person just pressed.
 */
export function Sheet({
  id,
  label,
  openLabel,
  closeLabel,
  trigger,
  width,
  bandClassName,
  band,
  children,
}: {
  id: string
  /** The dialog's accessible name. */
  label: string
  openLabel: string
  closeLabel: string
  trigger: SheetTrigger
  /** A width utility, e.g. `w-[min(22.5rem,85vw)]`. */
  width: string
  /** The top band — the bar's height, so the X centres in it as the trigger does in the bar. */
  bandClassName: string
  /** Content in the top band; it must leave room for the X on the right. */
  band?: ReactNode
  children: (close: () => void) => ReactNode
}) {
  // State, not a ref: `close` is handed to children during render.
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const bandRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const close = () => dialog?.close()
  const shape = trigger.kind === "avatar" ? "rounded-full" : "rounded-[8px]"

  // The wrapper is expanded:hidden, so crossing 840px while open (a tablet
  // rotating, a window widening) hid the dialog but left it modal: the whole
  // page inert under something nobody could see. Close it instead.
  useEffect(() => {
    const mq = window.matchMedia(EXPANDED)
    const onChange = () => {
      if (mq.matches) dialog?.close()
    }
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [dialog])

  useEffect(() => {
    if (!open || !dialog) return
    const onResize = () => {
      if (triggerRef.current && bandRef.current) {
        placeClose(dialog, triggerRef.current, bandRef.current)
      }
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [open, dialog])

  return (
    <div className="expanded:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-label={openLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        title={trigger.kind === "avatar" ? trigger.title : undefined}
        onClick={(e) => {
          if (!dialog || !bandRef.current) return
          dialog.showModal()
          placeClose(dialog, e.currentTarget, bandRef.current)
          setOpen(true)
        }}
        className={`${ICON_BUTTON} ${shape}`}
      >
        {trigger.kind === "avatar" ? trigger.node : <MenuMorphIcon />}
      </button>

      <dialog
        id={id}
        ref={setDialog}
        onClose={() => setOpen(false)}
        // A tap on the scrim lands on the dialog itself — its content box
        // fills it edge to edge, so anything else is a tap inside.
        onClick={(e) => {
          if (e.target === e.currentTarget) close()
        }}
        aria-label={label}
        // A dialog is centred and auto-sized by default; these pin it to the
        // right as a full-height sheet. backdrop:bg-* styles ::backdrop.
        className={`${SHEET} ${width}`}
      >
        <button
          type="button"
          aria-label={closeLabel}
          autoFocus
          onClick={close}
          className={`${ICON_BUTTON} ${shape} absolute z-10 top-(--th-x-top) right-(--th-x-right)`}
        >
          {/* Both glyphs, stacked. Which one shows is the dialog's [open]
              (.th-bar-* / .th-handoff-* in globals.css), so Esc, the scrim
              and a link all animate the same way, with no state in the loop. */}
          <span aria-hidden="true" className="grid place-items-center *:[grid-area:1/1]">
            {trigger.kind === "avatar" ? (
              <>
                <span className="th-handoff-avatar">{trigger.node}</span>
                <X size={20} className="th-handoff-x" />
              </>
            ) : (
              <>
                <MenuMorphIcon />
                {/* Reduced motion only: the bars fade out, this fades in. */}
                <X size={20} className="th-morph-x" />
              </>
            )}
          </span>
        </button>

        <div className="flex h-full flex-col">
          <div ref={bandRef} className={`${bandClassName} flex shrink-0 items-center`}>
            {band}
          </div>
          <div className="px-4 pb-4">{children(close)}</div>
        </div>
      </dialog>
    </div>
  )
}
