import type { Metadata } from "next"
import { AuthBanner, AuthCard } from "@/components/public/AuthCard"
import { SignInForm } from "@/components/public/auth/SignInForm"
import { tooManyMessage } from "@/lib/rateLimit"

export const metadata: Metadata = {
  title: "Sign in — Twnhall",
  description: "Sign in to Twnhall.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; retry?: string }>
}) {
  // Set by app/api/auth/callback when it hit the rate limit. Rendered only
  // through tooManyMessage(), which states no parameters.
  const { error, retry } = await searchParams
  const limited = error === "rate_limited" ? tooManyMessage(Number(retry) || 60) : null

  return (
    <AuthCard title="Welcome back" lede="Sign in to pick up where you left off.">
      <AuthBanner message={limited} />
      <SignInForm />
    </AuthCard>
  )
}
