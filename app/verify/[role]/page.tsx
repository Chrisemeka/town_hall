import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
// requireAccountForVerification, NOT requireAccount: this is the page that
// lifts the gate, so gating it would redirect it to itself forever. See the
// comment on that function in lib/auth.ts.
import { requireAccountForVerification } from "@/lib/auth"
import { homeFor, type AccountType } from "@/lib/access"
import {
  builderStep1Schema,
  testerStep1Schema,
  testerStep2Schema,
  testerStep3Schema,
} from "@/lib/validation/schemas"
import { VerificationFlow, type VerificationValues } from "@/components/verification/VerificationFlow"

export const metadata: Metadata = { title: "Complete your profile — Twnhall" }

/** The steps that collect something, in order. Review is the one after these. */
const COLLECTING_STEPS = {
  tester: [testerStep1Schema, testerStep2Schema, testerStep3Schema],
  builder: [builderStep1Schema],
} as const

/**
 * Where to drop someone who left mid-flow: the first step that does not yet
 * hold valid data, or the review step if they all do.
 *
 * Derived from the same per-step schemas the form validates with, so "complete"
 * cannot mean one thing on the way in and another on the way through.
 */
function firstIncompleteStep(role: AccountType, values: VerificationValues): number {
  const steps = COLLECTING_STEPS[role]
  const at = steps.findIndex((schema) => !schema.safeParse(values).success)
  return at === -1 ? steps.length : at
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
    .select("full_name, country, phone, timezone, bio, skills")
    .eq("id", userId)
    .maybeSingle()

  const values: VerificationValues = {
    fullName: profile?.full_name ?? "",
    country: profile?.country ?? "",
    phone: profile?.phone ?? "",
    timezone: profile?.timezone ?? "",
    bio: profile?.bio ?? "",
    skills: profile?.skills ?? [],
  }

  return (
    <div className="min-h-screen bg-obsidian text-chalk font-mono selection:bg-voltage selection:text-obsidian">
      <main className="mx-auto w-full max-w-[640px] px-6 py-16">
        <VerificationFlow
          role={role}
          initialValues={values}
          initialStep={firstIncompleteStep(role, values)}
        />
      </main>
    </div>
  )
}
