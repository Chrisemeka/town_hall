import type { Metadata } from "next"
import { AuthCard } from "@/components/public/AuthCard"
import { SignUpForm } from "@/components/public/auth/SignUpForm"

export const metadata: Metadata = {
  title: "Create an account — Twnhall",
  description: "Join Twnhall and start getting real feedback on what you build.",
}

// One page for everyone. task2k splits company and tester signup; Twnhall does
// not — a person is one profile with up to two accounts, and which role they
// take is chosen after they are in, at /choose-account.
export default function SignUpPage() {
  return (
    <AuthCard
      title="Create your account"
      lede="One account covers both sides — build and test under the same name."
    >
      <SignUpForm />
    </AuthCard>
  )
}
