"use client"

import { useRef, useState } from "react"
import { X } from "lucide-react"
import { Avatar } from "@/components/ui/Avatar"
import { AccountActions } from "./Sidebar"
import type { AccountType } from "@/lib/access"

const ICON_BUTTON =
  "h-12 w-12 shrink-0 inline-flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-ink/[0.06] active:bg-ink/[0.10] transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"

// The same sheet as the public MobileNav: from the trailing edge, under the
// avatar that opens it, 300ms ease-standard, no slide under reduced motion.
const SHEET =
  "m-0 ml-auto h-full max-h-full w-[min(20rem,85vw)] max-w-none rounded-l-[16px] bg-surface p-0 text-ink backdrop:bg-obsidian/60 open:transition-[translate] open:duration-300 open:ease-standard motion-safe:starting:open:translate-x-full" // ponytail: the scrim is literal Obsidian on purpose — dark in both themes; one that follows the theme stops being a scrim.

/**
 * The avatar below 840px, and the account actions it opens.
 *
 * ponytail: a native <dialog> opened with showModal(), as MobileNav — the
 * platform traps focus, closes on Esc and returns focus to the avatar. `open`
 * only drives aria-expanded; the dialog's own close event keeps it honest.
 */
export function AccountSheet({
  avatarUrl,
  displayName,
  account,
}: {
  avatarUrl: string | null
  displayName: string | null
  account: AccountType
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const close = () => ref.current?.close()

  return (
    <>
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="account-sheet"
        title={displayName ?? undefined}
        onClick={() => {
          ref.current?.showModal()
          setOpen(true)
        }}
        className={ICON_BUTTON}
      >
        <Avatar src={avatarUrl} name={displayName} size={32} />
      </button>

      <dialog
        id="account-sheet"
        ref={ref}
        onClose={() => setOpen(false)}
        // A tap on the scrim lands on the dialog itself; its content fills it.
        onClick={(e) => {
          if (e.target === e.currentTarget) close()
        }}
        aria-label="Account"
        className={SHEET}
      >
        <div className="flex h-full flex-col p-4">
          <div className="flex items-center gap-3 pl-2">
            <Avatar src={avatarUrl} name={displayName} size={40} />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[14px] text-ink truncate">{displayName ?? "Your account"}</p>
              <p className="font-mono text-[12px] font-medium text-ink-muted uppercase tracking-[1px]">
                Account · {account}
              </p>
            </div>
            <button type="button" aria-label="Close account menu" onClick={close} className={ICON_BUTTON}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-line">
            <AccountActions onNavigate={close} rowClassName="h-auto min-h-12 text-[16px]" />
          </div>
        </div>
      </dialog>
    </>
  )
}
