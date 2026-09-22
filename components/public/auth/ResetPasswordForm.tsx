"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { updatePassword } from "@/actions/auth"
import {
  AUTH_LINK,
  AuthBanner,
  AuthField,
  AuthSubmit,
} from "@/components/public/AuthCard"
import { useFocusFirstError } from "@/lib/hooks/useFocusFirstError"
import {
  PASSWORD_MIN,
  resetPasswordSchema,
  toFieldErrors,
  type FieldErrors,
  type ResetPasswordInput,
} from "@/lib/validation/schemas"

export function ResetPasswordForm({ hasSession }: { hasSession: boolean }) {
  const [state, formAction, pending] = useActionState(updatePassword, null)
  const [clientErrors, setClientErrors] = useState<FieldErrors<ResetPasswordInput>>({})
  const banner = useRef<HTMLDivElement>(null)
  const focusFirstError = useFocusFirstError({ fallback: banner })

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget)
    const parsed = resetPasswordSchema.safeParse({
      password: fd.get("password"),
      confirm_password: fd.get("confirm_password"),
    })
    if (!parsed.success) {
      e.preventDefault()
      const errors = toFieldErrors<ResetPasswordInput>(parsed.error)
      setClientErrors(errors)
      focusFirstError(errors)
      return
    }
    setClientErrors({})
  }

  useEffect(() => {
    if (state?.success === false && state.fieldErrors) focusFirstError(state.fieldErrors)
  }, [state, focusFirstError])

  // No recovery session — the link expired, or it was opened in a different
  // browser from the one that asked for it. Say so rather than rendering a form
  // that cannot work.
  if (!hasSession) {
    return (
      <div className="flex flex-col gap-4">
        <p className="font-sans text-[14px] leading-6 text-ink">
          This reset link has expired, or it was opened in a different browser
          from the one that requested it.
        </p>
        <Link href="/forgot-password" className={AUTH_LINK}>
          Request a new link →
        </Link>
      </div>
    )
  }

  const errors: FieldErrors<ResetPasswordInput> = {
    ...(state?.success === false ? state.fieldErrors ?? {} : {}),
    ...clientErrors,
  }

  return (
    <>
      <div ref={banner}>
        <AuthBanner
          message={state?.success === false && !state.fieldErrors ? state.error : null}
        />
      </div>
      <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <AuthField
          name="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          errors={errors.password}
          helper={`At least ${PASSWORD_MIN} characters.`}
        />
        <AuthField
          name="confirm_password"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          errors={errors.confirm_password}
        />
        <AuthSubmit pending={pending}>{pending ? "Saving…" : "Set new password"}</AuthSubmit>
      </form>
    </>
  )
}
