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
import { Turnstile } from "@/components/public/auth/Turnstile"
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
      captcha_token: fd.get("captcha_token"),
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
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="next"
          errors={errors.email}
        />
        <AuthField
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="go"
          errors={errors.password}
        />
        {/* A standalone action, not a word in a sentence: 48px below lg. */}
        <div className="flex justify-end -mt-1 lg:-mt-2">
          <Link href="/forgot-password" className={`${AUTH_LINK} min-h-12 inline-flex items-center lg:min-h-0 font-mono text-[14px] lg:text-[13px]`}>
            Forgot password?
          </Link>
        </div>
        <Turnstile resetKey={state} errors={errors.captcha_token} />
        <AuthSubmit pending={pending}>{pending ? "Signing you in…" : "Sign in"}</AuthSubmit>
      </form>
      {/* Surfaced only on the unconfirmed-email failure, which is the one case
          where the fix is somewhere else entirely. */}
      {formError?.includes("Confirm your email") && (
        <p className="mt-4 font-mono text-[14px] lg:text-[13px] text-ink-muted">
          <Link href="/confirm-email" className={AUTH_LINK}>
            Send the link again
          </Link>
        </p>
      )}

      {/*
        Standing, never conditional.

        Someone who signed up with a password, skipped confirmation, then used
        Google has no password any more: GoTrue discards an unproven credential
        when the address is claimed by a verified one. They cannot know that
        from "email and password do not match", and we cannot tell them
        specifically — a message that appears only for addresses that turn out
        to be Google accounts answers "does this person have an account here?"
        for anyone who asks. So it is always on screen, for everyone.
      */}
      <p className="mt-4 font-mono text-[14px] lg:text-[13px] text-ink-muted">
        Signed up with Google? Use the Google button above.
      </p>

      {/* The only way to the other form: a tappable 48px row below lg, with the
          link still inside its sentence. */}
      <p className="mt-6 min-h-12 flex flex-wrap items-center gap-x-1 lg:block lg:min-h-0 font-mono text-[13px] text-ink-muted">
        New here?{" "}
        <Link href="/signup" className={AUTH_LINK}>
          Create an account
        </Link>
      </p>
    </>
  )
}
