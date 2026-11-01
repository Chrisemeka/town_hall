"use client"

import { useState, useTransition } from "react"
import { setDigestEmail } from "@/actions/notifications"

/**
 * The Notifications section on the Account tab — testers only, so it is told
 * the active account rather than guessing. One switch, saved as it flips; a
 * failed save flips it back and says so.
 */
export function DigestSwitch({ initialOn }: { initialOn: boolean }) {
  const [on, setOn] = useState(initialOn)
  const [failed, setFailed] = useState(false)
  const [pending, startTransition] = useTransition()

  function toggle() {
    const next = !on
    setOn(next)
    setFailed(false)
    startTransition(async () => {
      const { ok } = await setDigestEmail(next).catch(() => ({ ok: false }))
      if (!ok) {
        setOn(!next)
        setFailed(true)
      }
    })
  }

  return (
    <div>
      <h2 className="font-syne font-bold text-[20px] text-ink">Notifications</h2>
      <div className="mt-4 flex items-center justify-between gap-4">
        <label htmlFor="digest-email" className="font-mono text-[14px] text-ink">
          Email me a daily list of new test cases
        </label>
        <button
          id="digest-email"
          type="button"
          role="switch"
          aria-checked={on}
          aria-busy={pending}
          onClick={toggle}
          // A 48px target around a 48×24 track, below lg. The track's edge is
          // an inset ring, which takes no room, so the 16px knob sits 4px in
          // from either end on the grid.
          className="group shrink-0 inline-flex items-center justify-center w-12 h-12 lg:h-8 focus-visible:outline-none"
        >
          <span
            className={[
              "flex items-center w-12 h-6 rounded-full ring-1 ring-inset transition-colors duration-150 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent-ink",
              on ? "bg-accent-ink ring-accent-ink" : "bg-surface ring-ink-muted",
            ].join(" ")}
          >
            <span
              className={[
                "w-4 h-4 rounded-full transition-transform duration-150 motion-reduce:transition-none",
                on ? "translate-x-7 bg-surface" : "translate-x-1 bg-ink-muted",
              ].join(" ")}
            />
          </span>
          <span className="sr-only">{on ? "On" : "Off"}</span>
        </button>
      </div>
      <p className="font-mono text-[13px] text-ink-muted mt-1">
        {on ? "On — sent each morning when something new has gone live." : "Off — you won't get the daily email."}
      </p>
      {failed && (
        <p role="alert" className="font-mono text-[13px] text-danger-ink mt-2">
          That didn&apos;t save. Try again.
        </p>
      )}
    </div>
  )
}
