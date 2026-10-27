"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { changePlan, downgrade, extend } from "@/actions/admin/subscriptions"
import { PLAN_IDS, type PlanId } from "@/lib/vocabulary"
import { planFor } from "@/lib/plans"
import { allowanceEffect, changeKind, defaultPeriodEnd, lagosDate } from "@/lib/subscriptions"

/**
 * The plan change, in full: which plan, until when, what was paid, why, and
 * whether to tell the builder — with a line spelling out what it does to the
 * allowance before anything is written. One dialog for the three moves
 * (start, downgrade, renew); changeKind() decides which one a choice is.
 */
export function PlanDialog({
  userId,
  current,
  activeEnd,
  hasActive,
}: {
  userId: string
  current: PlanId
  activeEnd: string | null
  hasActive: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [target, setTarget] = useState<PlanId>(current === "community" ? "starter" : current)
  const [periodEnd, setPeriodEnd] = useState(() => defaultPeriodEnd(new Date()))
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [reason, setReason] = useState("")
  const [notify, setNotify] = useState(true)
  const [when, setWhen] = useState<"now" | "period_end">(activeEnd ? "period_end" : "now")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const kind = changeKind(current, target, hasActive)
  const effect =
    kind === "none"
      ? "Already on Community — nothing to change."
      : allowanceEffect(kind, current, target, { when, periodEnd: kind === "downgrade" ? activeEnd : `${periodEnd}T22:59:59Z` })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    start(async () => {
      const amountNgn = amount.trim() === "" ? null : Number(amount)
      const result =
        kind === "extend"
          ? await extend({ userId, periodEnd, amountNgn, paymentReference: reference, notify })
          : kind === "downgrade"
            ? await downgrade({ userId, planId: target as "community" | "starter", when, reason, notify })
            : kind === "start"
              ? await changePlan({ userId, planId: target as "starter" | "pro", periodEnd, amountNgn, paymentReference: reference, reason, notify })
              : { ok: false as const, error: "Nothing to change." }
      if (!result.ok) {
        setError(result.error)
        return
      }
      ref.current?.close()
      router.refresh()
    })
  }

  const field = "h-12 lg:h-10 w-full rounded-[8px] border border-ink-muted bg-surface px-3 font-mono text-[14px] text-ink focus:outline-none focus:border-accent-ink"
  const label = "block font-mono text-[12px] uppercase tracking-[1px] text-ink-muted mb-1"

  return (
    <>
      <Button variant="secondary" onClick={() => ref.current?.showModal()}>
        Change plan
      </Button>
      <dialog
        ref={ref}
        aria-labelledby="plan-dialog-title"
        // ponytail: a literal scrim via ::backdrop, dark on both themes by design.
        className="m-auto w-[calc(100%-32px)] max-w-[480px] rounded-[12px] border border-line bg-surface-raised p-0 text-ink backdrop:bg-black/60"
      >
        <form onSubmit={submit} className="flex flex-col gap-4 p-6">
          <h2 id="plan-dialog-title" className="font-syne font-bold text-[20px] leading-[28px]">Change plan</h2>
          <p className="font-mono text-[14px] text-ink-muted">
            Now on <span className="text-ink">{planFor(current).name}</span>
            {activeEnd ? ` until ${lagosDate(activeEnd)}` : hasActive ? ", open-ended" : ""}.
          </p>

          <div>
            <label htmlFor="plan-target" className={label}>Plan</label>
            <select id="plan-target" value={target} onChange={(e) => setTarget(e.target.value as PlanId)} className={field}>
              {PLAN_IDS.map((id) => (
                <option key={id} value={id}>
                  {planFor(id).name}
                  {id === current ? (hasActive ? " — renew" : " — current") : ""}
                </option>
              ))}
            </select>
          </div>

          {kind === "downgrade" ? (
            <fieldset>
              <legend className={label}>Takes effect</legend>
              <label className="flex items-center gap-2 h-12 lg:h-10 font-mono text-[14px]">
                <input type="radio" name="when" checked={when === "now"} onChange={() => setWhen("now")} className="h-4 w-4 accent-[var(--color-accent-ink)]" />
                Now
              </label>
              <label className={`flex items-center gap-2 h-12 lg:h-10 font-mono text-[14px] ${activeEnd ? "" : "text-ink-muted"}`}>
                <input type="radio" name="when" disabled={!activeEnd} checked={when === "period_end"} onChange={() => setWhen("period_end")} className="h-4 w-4 accent-[var(--color-accent-ink)]" />
                {activeEnd ? `At the end of the period, ${lagosDate(activeEnd)}` : "At the end of the period (none set)"}
              </label>
            </fieldset>
          ) : kind !== "none" ? (
            <>
              <div>
                <label htmlFor="plan-end" className={label}>{kind === "extend" ? "New period end" : "Period ends"}</label>
                <input id="plan-end" type="date" required value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={field} />
              </div>
              <div className="grid grid-cols-1 medium:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="plan-amount" className={label}>Amount paid (₦)</label>
                  <input id="plan-amount" inputMode="numeric" pattern="[0-9]*" placeholder="Blank if comped" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
                </div>
                <div>
                  <label htmlFor="plan-ref" className={label}>Payment reference</label>
                  <input id="plan-ref" value={reference} onChange={(e) => setReference(e.target.value)} className={field} />
                </div>
              </div>
            </>
          ) : null}

          {kind !== "extend" && kind !== "none" && (
            <div>
              <label htmlFor="plan-reason" className={label}>Reason (required)</label>
              <input id="plan-reason" required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className={field} />
            </div>
          )}

          <label className="flex items-center gap-2 h-12 lg:h-10 font-mono text-[14px]">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 accent-[var(--color-accent-ink)]" />
            Email the builder
          </label>

          <p className="rounded-[8px] border border-line p-3 font-mono text-[14px] leading-6 text-ink" aria-live="polite">{effect}</p>
          {error && <p role="alert" className="font-mono text-[14px] text-danger-ink">{error}</p>}

          <div className="flex flex-col-reverse medium:flex-row medium:justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => ref.current?.close()}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Confirm"}</Button>
          </div>
        </form>
      </dialog>
    </>
  )
}
