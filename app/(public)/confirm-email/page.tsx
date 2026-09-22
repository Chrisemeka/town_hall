import type { Metadata } from "next"
import Link from "next/link"
import { signOutAction } from "@/actions/auth"
import { createClient } from "@/lib/supabase/server"
import { AUTH_LINK, AuthCard } from "@/components/public/AuthCard"
import { ResendConfirmation } from "@/components/public/auth/ResendConfirmation"
import { emailOnlySchema } from "@/lib/validation/schemas"

export const metadata: Metadata = {
  title: "Confirm your email — Twnhall",
  robots: { index: false },
}

/*
 * The email-confirmation gate's own page — NOT /verify/[role], which is a
 * different gate about role profiles. See lib/access.ts.
 *
 * It has to work in two states, because with "Confirm email" on there may be no
 * session at all: signUp() returns a user and no session until the link is
 * clicked. So the address comes from the session when there is one, and from
 * the query string when there is not. It is not a secret — the person just
 * typed it — and next.config.ts already sets a strict-origin Referrer-Policy,
 * so the path does not travel cross-origin. It is still parsed through Zod
 * before being shown or resent to.
 */
export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const fromQuery = emailOnlySchema.safeParse({ email: (await searchParams).email })
  const email = user?.email ?? (fromQuery.success ? fromQuery.data.email : null)

  if (!email) {
    return (
      <AuthCard
        title="Check your inbox"
        lede="We sent you a confirmation link. Open it and you're in."
      >
        <p className="font-mono text-[13px] text-ink-muted">
          Need to start again?{" "}
          <Link href="/signup" className={AUTH_LINK}>
            Create an account
          </Link>
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Confirm your email">
      <p className="font-sans text-[14px] leading-6 text-ink mb-2">
        We sent a link to{" "}
        <strong className="font-mono text-ink">{email}</strong>. Open it and
        you&apos;re in.
      </p>
      <p className="font-mono text-[12px] text-ink-muted leading-5 mb-8">
        It can take a minute. Check spam before asking for another.
      </p>

      <ResendConfirmation email={email} />

      <div className="mt-8 pt-6 border-t border-line">
        <p className="font-mono text-[13px] text-ink-muted">
          Wrong address?{" "}
          {user ? (
            <form action={signOutAction} className="inline">
              <button type="submit" className={`${AUTH_LINK} cursor-pointer`}>
                Sign out and register again
              </button>
            </form>
          ) : (
            <Link href="/signup" className={AUTH_LINK}>
              Register again
            </Link>
          )}
        </p>
      </div>
    </AuthCard>
  )
}
