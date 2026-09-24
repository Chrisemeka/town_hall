"use client"

import { useState, useTransition } from "react"
import { setUserPlan } from "@/actions/admin/users"
import { PLAN_IDS, type PlanId } from "@/lib/vocabulary"

/**
 * The manual upgrade path, in full.
 *
 * There is no checkout, so a sale is recorded here or it is not recorded at
 * all — which is why the plan_id column would be decorative without this
 * control.
 *
 * Builder only. plan_id is per-role and nothing about a tester account has a
 * plan, so offering the choice for both would ask a question with one
 * meaningful answer.
 */
export function UserPlanControl({
  userId,
  planId,
  hasBuilderAccount,
}: {
  userId: string
  planId: PlanId
  hasBuilderAccount: boolean
}) {
  const [value, setValue] = useState<PlanId>(planId)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!hasBuilderAccount) {
    return <span className="font-mono text-[12px] text-ink-muted">No builder account</span>
  }

  function choose(next: PlanId) {
    if (next === value || isPending) return
    const previous = value
    setValue(next)
    setError(null)
    startTransition(async () => {
      try {
        await setUserPlan(userId, "builder", next)
      } catch (err) {
        // Put the control back where it was: the select is now claiming a
        // change the database refused.
        setValue(previous)
        setError(err instanceof Error ? err.message : "Could not change the plan.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`plan-${userId}`} className="sr-only">
        Plan
      </label>
      <select
        id={`plan-${userId}`}
        value={value}
        disabled={isPending}
        onChange={(e) => choose(e.target.value as PlanId)}
        className="h-8 rounded-[6px] border border-ink-muted bg-surface px-2 font-mono text-[12px] text-ink focus:outline-none focus:border-accent-ink disabled:opacity-60 disabled:cursor-wait cursor-pointer"
      >
        {PLAN_IDS.map((id) => (
          <option key={id} value={id}>
            {id === "pro" ? "Pro" : "Community"}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="font-mono text-[11px] text-danger-ink">
          {error}
        </p>
      )}
    </div>
  )
}
