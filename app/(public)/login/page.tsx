import type { Metadata } from "next"
import { AuthCard } from "@/components/public/AuthCard"
import { SignInForm } from "@/components/public/auth/SignInForm"

export const metadata: Metadata = {
  title: "Sign in — Twnhall",
  description: "Sign in to Twnhall.",
}

export default function LoginPage() {
  return (
    <AuthCard title="Welcome back" lede="Sign in to pick up where you left off.">
      <SignInForm />
    </AuthCard>
  )
}
