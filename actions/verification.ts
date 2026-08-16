"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAccountForVerification } from "@/lib/auth"
import { homeFor, type AccountType } from "@/lib/access"
import {
  toFieldErrors,
  verificationSchemaFor,
  verificationStepSchemaFor,
  type FieldErrors,
  type TesterVerificationInput,
} from "@/lib/validation/schemas"

/**
 * The verification flow's own writes. These are the one place in the app that
 * runs before the verification gate — see `requireAccountForVerification()` in
 * lib/auth.ts for why they have to.
 */

/** Every field either flow can collect. Both actions report errors against it. */
type VerificationFields = TesterVerificationInput

type VerificationResult =
  | { success: true; redirectTo?: string }
  | { success: false; error: string; fieldErrors?: FieldErrors<VerificationFields> }

/** Validated input -> the profiles columns it maps to. */
const COLUMN_FOR = {
  fullName: "full_name",
  country: "country",
  phone: "phone",
  timezone: "timezone",
  bio: "bio",
  skills: "skills",
} as const

function toProfileColumns(data: Record<string, unknown>): Record<string, unknown> {
  // Explicit column list rather than a spread of `data`: this write uses the
  // service-role client, so anything that reaches it is written. Only keys with
  // a mapping here can ever land in the UPDATE.
  const row: Record<string, unknown> = {}
  for (const [field, column] of Object.entries(COLUMN_FOR)) {
    if (field in data) row[column] = data[field as keyof typeof COLUMN_FOR]
  }
  return row
}

/**
 * Saves one step of the flow. Partial by design — the later steps are still
 * blank at this point, so completeness is not checked here. Every field that
 * *is* present is fully validated, so a bad phone number fails on the step that
 * asked for it rather than at the end.
 *
 * Never sets `verification_completed_at`. Only `completeVerification()` does.
 */
export async function saveVerificationStep(
  role: AccountType,
  stepData: unknown,
): Promise<VerificationResult> {
  const { userId } = await requireAccountForVerification(role)

  const parsed = verificationStepSchemaFor(role).safeParse(stepData)
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors<VerificationFields>(parsed.error),
    }
  }

  const columns = toProfileColumns(parsed.data)
  if (Object.keys(columns).length === 0) return { success: true }

  const admin = createAdminClient()
  const { error } = await admin.from("profiles").update(columns).eq("id", userId)

  if (error) {
    console.error("[saveVerificationStep] update failed:", error.message)
    return { success: false, error: "Could not save your progress. Please try again." }
  }

  return { success: true }
}

/**
 * Opens the gate for one role.
 *
 * Re-reads the profile and re-validates the whole role schema rather than
 * trusting that the steps that got here were all completed — a client can call
 * this directly without ever submitting a step.
 */
export async function completeVerification(role: AccountType): Promise<VerificationResult> {
  const { userId } = await requireAccountForVerification(role)

  const admin = createAdminClient()
  const { data: profile, error: readError } = await admin
    .from("profiles")
    .select("full_name, country, phone, timezone, bio, skills")
    .eq("id", userId)
    .maybeSingle()

  if (readError) {
    console.error("[completeVerification] profile read failed:", readError.message)
    return { success: false, error: "Could not load your profile. Please try again." }
  }

  const parsed = verificationSchemaFor(role).safeParse({
    fullName: profile?.full_name,
    country: profile?.country,
    phone: profile?.phone,
    timezone: profile?.timezone,
    bio: profile?.bio,
    skills: profile?.skills ?? [],
  })

  if (!parsed.success) {
    return {
      success: false,
      error: "Some details are still missing. Please complete every step.",
      fieldErrors: toFieldErrors<VerificationFields>(parsed.error),
    }
  }

  // `.eq("type", role)` is what keeps this per-role: a person holding both
  // accounts who verifies as a tester must not have their builder account
  // opened by the same call.
  const { error: writeError } = await admin
    .from("accounts")
    .update({ verification_completed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("type", role)

  if (writeError) {
    console.error("[completeVerification] update failed:", writeError.message)
    return { success: false, error: "Could not complete verification. Please try again." }
  }

  revalidatePath("/dashboard")
  revalidatePath("/explore")

  return { success: true, redirectTo: homeFor(role) }
}
