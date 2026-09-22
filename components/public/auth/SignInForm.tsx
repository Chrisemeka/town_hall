"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { signInWithEmail } from "@/actions/auth"
import {
  AUTH_LINK,
  AuthBanner,
  AuthField,
  AuthSubmit,
  GoogleBlock,
} from "@/components/public/AuthCard"
import { useFocusFirstError } from "@/lib/hooks/useFocusFirstError"
import {
  signInSchema,
  toFieldErrors,
  type FieldErrors,
  type SignInInput,
} from "@/lib/validation/schemas"

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signInWithEmail, null)
  const [clientErrors, setClientErrors] = useState<FieldErrors<SignInInput>>({})
  const banner = useRef<HTMLDivElement>(null)
  const focusFirstError = useFocusFirstError({ fallback: banner })

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget)
    const parsed = signInSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
    })
    if (!parsed.success) {
      e.preventDefault()
      const errors = toFieldErrors<SignInInput>(parsed.error)
      setClientErrors(errors)
      focusFirstError(errors)
      return
    }
    setClientErrors({})
  }

  useEffect(() => {
    if (state?.success === false && state.fieldErrors) focusFirstError(state.fieldErrors)
  }, [state, focusFirstError])

  const errors: FieldErrors<SignInInput> = {
    ...(state?.success === false ? state.fieldErrors ?? {} : {}),
    ...clientErrors,
  }
  const formError = state?.success === false && !state.fieldErrors ? state.error : null

  return (
    <>
      <GoogleBlock label="Continue with Google" />
      <div ref={banner}>
        <AuthBanner message={formError} />
      </div>
      <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <AuthField
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          errors={errors.email}
        />
        <AuthField
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          errors={errors.password}
        />
        <div className="flex justify-end -mt-2">
          <Link href="/forgot-password" className={`${AUTH_LINK} font-mono text-[13px]`}>
            Forgot password?
          </Link>
        </div>
        <AuthSubmit pending={pending}>{pending ? "Signing you in…" : "Sign in"}</AuthSubmit>
      </form>
      {/* Surfaced only on the unconfirmed-email failure, which is the one case
          where the fix is somewhere else entirely. */}
      {formError?.includes("Confirm your email") && (
        <p className="mt-4 font-mono text-[13px] text-ink-muted">
          <Link href="/confirm-email" className={AUTH_LINK}>
            Send the link again
          </Link>
        </p>
      )}
      <p className="mt-6 font-mono text-[13px] text-ink-muted">
        New here?{" "}
        <Link href="/signup" className={AUTH_LINK}>
          Create an account
        </Link>
      </p>
    </>
  )
}
