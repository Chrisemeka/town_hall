import type { Metadata } from "next"
import { AuthCard } from "@/components/public/AuthCard"
import { ForgotPasswordForm } from "@/components/public/auth/ForgotPasswordForm"

export const metadata: Metadata = {
  title: "Reset your password — Twnhall",
  // Nothing to index here, and a reset page in search results is noise.
  robots: { index: false },
}

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      lede="Enter the address you signed up with and we'll send a link."
    >
      <ForgotPasswordForm />
    </AuthCard>
  )
}
