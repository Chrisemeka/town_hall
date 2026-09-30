"use client"

import { useState, useTransition } from "react"
import { setCohortMember } from "@/actions/admin/users"

/**
 * Puts a tester in the paid cohort, or takes them out. Every change is logged
 * with who made it (set_account_field), and leaving keeps the join date, so a
 * month already paid never changes under anyone.
 *
 * Tester accounts only — cohort membership is a property of the tester role.
 */
export function CohortControl({
  userId,
  member,
  hasTesterAccount,
}: {
  userId: string
  member: boolean
  hasTesterAccount: boolean
}) {
  const [value, setValue] = useState(member)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!hasTesterAccount) {
    return <span className="font-mono text-[12px] text-ink-muted">No tester account</span>
  }

  function toggle() {
    if (isPending) return
    const next = !value
    setValue(next)
    setError(null)
    startTransition(async () => {
      try {
        await setCohortMember(userId, next)
      } catch (err) {
        setValue(!next)
        setError(err instanceof Error ? err.message : "Could not change cohort membership.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-1 items-end">
      <label className="flex items-center gap-2 font-mono text-[12px] text-ink cursor-pointer">
        <input
          type="checkbox"
          checked={value}
          disabled={isPending}
          onChange={toggle}
          className="h-4 w-4 accent-[var(--color-accent-ink)] disabled:cursor-wait"
        />
        Paid cohort
      </label>
      {error && (
        <p role="alert" className="font-mono text-[11px] text-danger-ink">
          {error}
        </p>
      )}
    </div>
  )
}
