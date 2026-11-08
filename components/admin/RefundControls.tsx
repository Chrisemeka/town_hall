"use client"

import { useRef, useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { markPaidOutside, refundPayment, retryRefund, type RefundActionResult } from "@/actions/admin/billing"
import { formatNgn } from "@/lib/subscriptions"

const field = "h-12 lg:h-10 w-full rounded-[8px] border border-ink-muted bg-surface px-3 font-mono text-[14px] text-ink focus:outline-none focus:border-accent-ink"
const label = "block font-mono text-[12px] uppercase tracking-[1px] text-ink-muted mb-1"

/** The admin console's native <dialog>, as PlanDialog. A refusal is shown, never a disabled button. */
function AdminDialog({
  open,
  title,
  confirm,
  onOpen,
  submit,
  children,
}: {
  open: string
  title: string
  confirm: string
  onOpen?: () => void
  submit: () => Promise<RefundActionResult>
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <>
      <Button
        variant="secondary"
        className="h-8 px-3 text-[13px]"
        onClick={() => {
          setError(null)
          onOpen?.()
          ref.current?.showModal()
        }}
      >
        {open}
      </Button>
      <dialog
        ref={ref}
        aria-label={title}
        // ponytail: a literal scrim via ::backdrop, dark on both themes by design.
        className="m-auto w-[calc(100%-32px)] max-w-[480px] rounded-[12px] border border-line bg-surface-raised p-0 text-ink backdrop:bg-black/60"
      >
        <form
          className="flex flex-col gap-4 p-6"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            start(async () => {
              const result = await submit()
              if (!result.ok) return setError(result.error)
              ref.current?.close()
              router.refresh()
            })
          }}
        >
          <h2 className="font-syne font-bold text-[20px] leading-7">{title}</h2>
          {children}
          {error && (
            <p role="alert" className="font-mono text-[14px] text-danger-ink">
              {error}
            </p>
          )}
          <div className="flex flex-col medium:flex-row gap-4">
            <Button type="submit" variant="primary">
              {pending ? "One moment…" : confirm}
            </Button>
            <Button type="button" variant="secondary" onClick={() => ref.current?.close()}>
              Close
            </Button>
          </div>
        </form>
      </dialog>
    </>
  )
}

/**
 * "Refund" on one payment. The key is made when the dialog opens, so a
 * double-click or a resubmitted form is one refund. The reason stays internal.
 */
export function RefundDialog({ paymentId, leftNgn, source }: { paymentId: string; leftNgn: number; source: string }) {
  const [refundKey, setRefundKey] = useState("")
  const [amount, setAmount] = useState(String(leftNgn))
  const [reason, setReason] = useState("")
  const [transfer, setTransfer] = useState("")
  const [endPlan, setEndPlan] = useState(false)
  const outside = source !== "paystack"
  return (
    <AdminDialog
      open="Refund"
      title={`Refund up to ${formatNgn(leftNgn)}`}
      confirm={outside ? "Record refund" : "Refund through Paystack"}
      onOpen={() => {
        setRefundKey(crypto.randomUUID())
        setAmount(String(leftNgn))
      }}
      submit={() =>
        refundPayment({
          paymentId,
          amountNgn: Number(amount),
          reason,
          refundKey,
          transferReference: outside ? transfer : undefined,
          endPlan,
        })
      }
    >
      <div>
        <label htmlFor={`amount-${paymentId}`} className={label}>Amount (₦, whole naira)</label>
        <input id={`amount-${paymentId}`} name="amountNgn" inputMode="numeric" pattern="[0-9]*" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
      </div>
      <div>
        <label htmlFor={`reason-${paymentId}`} className={label}>Reason (internal, never emailed)</label>
        <input id={`reason-${paymentId}`} name="reason" value={reason} onChange={(e) => setReason(e.target.value)} className={field} />
      </div>
      {outside && (
        <div>
          <label htmlFor={`transfer-${paymentId}`} className={label}>Bank transfer reference</label>
          <input id={`transfer-${paymentId}`} name="transferReference" value={transfer} onChange={(e) => setTransfer(e.target.value)} className={field} />
          <p className="mt-1 font-mono text-[12px] text-ink-muted">This was paid outside Paystack, so it goes back by bank transfer. Send it first, then record it here.</p>
        </div>
      )}
      <label className="flex items-center gap-2 h-12 lg:h-10 font-mono text-[14px]">
        <input type="checkbox" name="endPlan" checked={endPlan} onChange={(e) => setEndPlan(e.target.checked)} />
        Also end the plan now and switch off renewal
      </label>
      <p className="font-sans text-[14px] leading-6 text-ink">
        {outside
          ? "The builder is emailed that it's been paid back."
          : "The builder is emailed when Paystack starts it and again when it's processed. It isn't counted as refunded until then."}
      </p>
    </AdminDialog>
  )
}

/** A failed refund's two ways out: a new attempt through the clamp, or recording a bank transfer. */
export function FailedRefundControls({ refundId, amountNgn }: { refundId: string; amountNgn: number }) {
  const [transfer, setTransfer] = useState("")
  const [note, setNote] = useState("")
  return (
    <span className="inline-flex flex-wrap gap-2">
      <AdminDialog open="Try again" title={`Try ${formatNgn(amountNgn)} again?`} confirm="Try again" submit={() => retryRefund({ refundId })}>
        <p className="font-sans text-[14px] leading-6">A new refund is sent through Paystack. The failed one stays as it is, for the record.</p>
      </AdminDialog>
      <AdminDialog
        open="Mark paid outside Paystack"
        title="Paid back by bank transfer"
        confirm="Record it"
        submit={() => markPaidOutside({ refundId, transferReference: transfer, note: note || undefined })}
      >
        <div>
          <label htmlFor={`outside-${refundId}`} className={label}>Bank transfer reference</label>
          <input id={`outside-${refundId}`} name="transferReference" value={transfer} onChange={(e) => setTransfer(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor={`note-${refundId}`} className={label}>Note (internal)</label>
          <input id={`note-${refundId}`} name="note" value={note} onChange={(e) => setNote(e.target.value)} className={field} />
        </div>
      </AdminDialog>
    </span>
  )
}
