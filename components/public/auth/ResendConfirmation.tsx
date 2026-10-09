"use client"

import { useActionState, useEffect, useState } from "react"
import { resendConfirmation } from "@/actions/auth"
import { AuthBanner, AuthSubmit } from "@/components/public/AuthCard"
import { Turnstile } from "@/components/public/auth/Turnstile"

/** Matches the project's per-user minimum interval between emails. The real
 *  enforcement is GoTrue's — this is the countdown that explains it. */
const COOLDOWN_SECONDS = 60

export function ResendConfirmation({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(resendConfirmation, null)
  const [left, setLeft] = useState(0)

  // Start the countdown on a successful send. Derived during render from the
  // action state changing identity, rather than in an effect — React's
  // documented way to adjust state when an input changes, and the one the
  // set-state-in-effect rule leaves alone.
  //
  // The server refuses early requests regardless (over_email_send_rate_limit);
  // this only saves the user pressing a button that was always going to be.
  const [seen, setSeen] = useState(state)
  if (state !== seen) {
    setSeen(state)
    if (state?.success) setLeft(COOLDOWN_SECONDS)
  }

  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [left])

  return (
    <div className="flex flex-col gap-3">
      <AuthBanner
        message={state?.success === false ? state.error : null}
      />
      {state?.success && (
        <p role="status" className="font-mono text-[13px] text-ink-muted">
          Sent. Check your inbox.
        </p>
      )}
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="email" value={email} />
        <Turnstile
          resetKey={state}
          errors={state?.success === false ? state.fieldErrors?.captcha_token : undefined}
        />
        {/* Counting down is a statement about the server's cooldown, not about
            the form being incomplete — which is the disabled state CLAUDE.md
            forbids. The label says which it is. */}
        <AuthSubmit pending={pending || left > 0}>
          {left > 0 ? `Resend in ${left}s` : "Resend the link"}
        </AuthSubmit>
      </form>
    </div>
  )
}
