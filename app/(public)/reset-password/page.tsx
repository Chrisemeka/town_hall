import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { AuthCard } from "@/components/public/AuthCard"
import { ResetPasswordForm } from "@/components/public/auth/ResetPasswordForm"

export const metadata: Metadata = {
  title: "Set a new password — Twnhall",
  robots: { index: false },
}

/*
 * Exempt from the email-confirmation gate (see isEmailGateExempt in
 * lib/access.ts): a recovery link signs the user in with a session whose
 * address may never have been confirmed, and bouncing them to /confirm-email
 * mid-recovery would strand them with no way to finish.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <AuthCard
      title="Set a new password"
      lede={user ? "Choose something you have not used here before." : undefined}
    >
      <ResetPasswordForm hasSession={!!user} />
    </AuthCard>
  )
}
