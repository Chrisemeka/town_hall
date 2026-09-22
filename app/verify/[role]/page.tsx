import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import { accountTypesFor } from "@/lib/auth"
import { SetupShell } from "@/components/setup/SetupShell"
import { firstIncompleteStep } from "@/lib/setup"
// requireAccountForVerification, NOT requireAccount: this is the page that
// lifts the gate, so gating it would redirect it to itself forever. See the
// comment on that function in lib/auth.ts.
import { requireAccountForVerification } from "@/lib/auth"
import { homeFor, type AccountType } from "@/lib/access"
import {
  builderStep1Schema,
  testerStep1Schema,
  testerStep2Schema,
} from "@/lib/validation/schemas"
import { VerificationFlow, type VerificationValues } from "@/components/verification/VerificationFlow"

export const metadata: Metadata = { title: "Complete your profile — Twnhall" }

/** The steps that collect something, in order. Review is the one after these. */
const COLLECTING_STEPS = {
  tester: [testerStep1Schema, testerStep2Schema],
  builder: [builderStep1Schema],
} as const

/**
 * Whether a collecting step already holds valid data.
 *
 * The per-step schemas the form validates with, so "complete" cannot mean one
 * thing on the way in and another on the way through. lib/setup.ts turns this
 * into a position; the schemas stay here.
 */
function stepComplete(role: AccountType, values: VerificationValues) {
  return (index: number) => COLLECTING_STEPS[role][index].safeParse(values).success
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ role: string }>
}) {
  const { role: rawRole } = await params
  if (rawRole !== "builder" && rawRole !== "tester") notFound()
  const role: AccountType = rawRole

  const { userId, verified } = await requireAccountForVerification(role)

  // The in-page half of "a verified user is never sent through the flow".
  // Middleware bounces this too; per CLAUDE.md neither layer is trusted alone.
  if (verified) redirect(homeFor(role))

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, country, phone, timezone, skills, accepted_terms_at")
    .eq("id", userId)
    .maybeSingle()

  // The indicator reports the chain, not this wizard's position — somebody
  // adding a second role cleared these months ago. See lib/setup.ts.
  const held = await accountTypesFor(userId)

  const values: VerificationValues = {
    fullName: profile?.full_name ?? "",
    country: profile?.country ?? "",
    phone: profile?.phone ?? "",
    timezone: profile?.timezone ?? "",
    skills: profile?.skills ?? [],
  }

  return (
    <SetupShell context="Setting up your account">
      <VerificationFlow
        role={role}
        initialValues={values}
        initialStep={firstIncompleteStep(role, stepComplete(role, values))}
        gates={{
          termsAcceptedAt: profile?.accepted_terms_at ?? null,
          hasAccount: held.includes(role),
        }}
      />
    </SetupShell>
  )
}
