"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { signUpWithEmail } from "@/actions/auth"
import {
  AUTH_LINK,
  AuthBanner,
  AuthField,
  AuthSubmit,
  GoogleBlock,
} from "@/components/public/AuthCard"
import { Turnstile } from "@/components/public/auth/Turnstile"
import { useFocusFirstError } from "@/lib/hooks/useFocusFirstError"
import {
  PASSWORD_MIN,
  signUpSchema,
  toFieldErrors,
  type FieldErrors,
  type SignUpInput,
} from "@/lib/validation/schemas"

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpWithEmail, null)
  const [clientErrors, setClientErrors] = useState<FieldErrors<SignUpInput>>({})
  const banner = useRef<HTMLDivElement>(null)
  const focusFirstError = useFocusFirstError({ fallback: banner })

  // Validate on click and say which field is outstanding, rather than disabling
  // the button — a disabled control cannot say what is missing, and the message
  // written for it becomes unreachable (CLAUDE.md).
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget)
    const parsed = signUpSchema.safeParse({
      full_name: fd.get("full_name"),
      email: fd.get("email"),
      password: fd.get("password"),
      confirm_password: fd.get("confirm_password"),
      captcha_token: fd.get("captcha_token"),
    })
    if (!parsed.success) {
      e.preventDefault()
      const errors = toFieldErrors<SignUpInput>(parsed.error)
      setClientErrors(errors)
      focusFirstError(errors)
      return
    }
    setClientErrors({})
  }

  useEffect(() => {
    if (state?.success === false && state.fieldErrors) focusFirstError(state.fieldErrors)
  }, [state, focusFirstError])

  const errors: FieldErrors<SignUpInput> = {
    ...(state?.success === false ? state.fieldErrors ?? {} : {}),
    ...clientErrors,
  }

  return (
    <>
      <GoogleBlock label="Continue with Google" />
      <div ref={banner}>
        <AuthBanner
          message={state?.success === false && !state.fieldErrors ? state.error : null}
        />
      </div>
      <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <AuthField
          name="full_name"
          label="Full name"
          autoComplete="name"
          errors={errors.full_name}
        />
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
          autoComplete="new-password"
          errors={errors.password}
          helper={`At least ${PASSWORD_MIN} characters.`}
        />
        <AuthField
          name="confirm_password"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          errors={errors.confirm_password}
        />
        <Turnstile resetKey={state} errors={errors.captcha_token} />
        <AuthSubmit pending={pending}>{pending ? "Creating your account…" : "Create account"}</AuthSubmit>
      </form>
      <p className="mt-6 font-mono text-[13px] text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className={AUTH_LINK}>
          Sign in
        </Link>
      </p>
    </>
  )
}
