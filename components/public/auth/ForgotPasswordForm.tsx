"use client"

import { useActionState, useRef } from "react"
import Link from "next/link"
import { requestPasswordReset } from "@/actions/auth"
import {
  AUTH_LINK,
  AuthBanner,
  AuthField,
  AuthSubmit,
} from "@/components/public/AuthCard"
import { Turnstile } from "@/components/public/auth/Turnstile"

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, null)
  const banner = useRef<HTMLDivElement>(null)

  // The same answer for an address that exists and one that does not. Anything
  // that distinguishes them turns this form into an oracle for whether a given
  // person has an account here.
  if (state?.success) {
    return (
      <div className="flex flex-col gap-4">
        <p className="font-sans text-[14px] leading-6 text-ink">
          If that address has an account, a reset link is on its way. It expires
          after an hour.
        </p>
        <p className="font-mono text-[13px] text-ink-muted">
          Nothing arrived? Check spam, then{" "}
          <Link href="/forgot-password" className={AUTH_LINK}>
            try again
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <>
      <div ref={banner}>
        <AuthBanner
          message={state?.success === false && !state.fieldErrors ? state.error : null}
        />
      </div>
      <form action={formAction} className="flex flex-col gap-5" noValidate>
        <AuthField
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          errors={state?.success === false ? state.fieldErrors?.email : undefined}
        />
        <Turnstile
          resetKey={state}
          errors={state?.success === false ? state.fieldErrors?.captcha_token : undefined}
        />
        <AuthSubmit pending={pending}>{pending ? "Sending…" : "Send reset link"}</AuthSubmit>
      </form>
      <p className="mt-6 font-mono text-[13px] text-ink-muted">
        Remembered it?{" "}
        <Link href="/login" className={AUTH_LINK}>
          Sign in
        </Link>
      </p>
    </>
  )
}
