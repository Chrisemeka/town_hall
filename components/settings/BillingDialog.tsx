"use client"

import { useRef, useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"

/**
 * A control on a subscription, always behind a confirmation that says what will
 * happen. ponytail: the native <dialog> PlanDialog uses. components/ui/Sheet.tsx
 * is the navigation drawer: it renders below 840px only, and a billing control
 * has to work at every width.
 *
 * The action either redirects (to Paystack), or answers. A refusal is shown here,
 * and never by disabling the button.
 */
export function BillingDialog({
  label,
  title,
  confirm,
  dismiss,
  variant = "secondary",
  confirmVariant = "primary",
  action,
  children,
}: {
  label: string
  title: string
  confirm: string
  dismiss: string
  variant?: "primary" | "secondary" | "destructive"
  confirmVariant?: "primary" | "destructive"
  action: () => Promise<{ ok: true } | { ok: false; error: string }>
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <>
      <Button type="button" variant={variant} className="w-full medium:w-auto h-12 lg:h-11" onClick={() => ref.current?.showModal()}>
        {label}
      </Button>
      <dialog
        ref={ref}
        aria-label={title}
        // ponytail: a literal scrim via ::backdrop, dark on both themes by design.
        className="m-auto w-[calc(100%-32px)] max-w-[480px] rounded-[12px] border border-line bg-surface-raised p-0 text-ink backdrop:bg-black/60"
      >
        <div className="flex flex-col gap-4 p-6">
          <h2 className="font-syne font-bold text-[20px] leading-7">{title}</h2>
          <div className="flex flex-col gap-3 font-sans text-[14px] leading-6 text-ink">{children}</div>
          {error && (
            <p role="alert" className="font-mono text-[14px] text-danger-ink">
              {error}
            </p>
          )}
          <div className="flex flex-col medium:flex-row gap-4 mt-2">
            <Button
              type="button"
              variant={confirmVariant}
              className="w-full medium:w-auto h-12 lg:h-11"
              onClick={() => {
                setError(null)
                start(async () => {
                  const result = await action()
                  if (!result.ok) return setError(result.error)
                  ref.current?.close()
                  router.refresh()
                })
              }}
            >
              {pending ? "One moment…" : confirm}
            </Button>
            <Button type="button" variant="secondary" className="w-full medium:w-auto h-12 lg:h-11" onClick={() => ref.current?.close()}>
              {dismiss}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  )
}
