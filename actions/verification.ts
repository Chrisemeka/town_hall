"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAccountForVerification } from "@/lib/auth"
import { homeFor, type AccountType } from "@/lib/access"
import { normalizeSkills } from "@/lib/vocabulary"
import { sendWelcomeEmail } from "@/lib/mail"
import { completionHeadlineFor, nextStepsFor } from "@/lib/setup"
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

/**
 * Validated input -> the profiles columns it maps to.
 *
 * `bio` is absent deliberately. The column still exists and still holds what
 * earlier verifications wrote, but verification no longer collects it, and a
 * mapping here is what would let it be written again.
 */
const COLUMN_FOR = {
  fullName: "full_name",
  country: "country",
  phone: "phone",
  timezone: "timezone",
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

  // Canonical spelling and de-duplication happen here rather than in the
  // schema, because they rewrite the value rather than judge it — "frontend"
  // is not invalid, it is just another way of writing "Frontend".
  const columns = toProfileColumns(parsed.data)
  if (Array.isArray(columns.skills)) {
    columns.skills = normalizeSkills(columns.skills as string[])
  }
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
    // `email` rides along on a read that already happens — the welcome mail
    // costs no extra query.
    .select("full_name, country, phone, timezone, skills, email")
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
    // Normalised on the way in as well as on the way out: rows written before
    // this rule existed, or by anything that bypassed the action, still have to
    // clear the same bar as a list that came through the form.
    skills: normalizeSkills(profile?.skills ?? []),
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
  //
  // `.is(..., null)` is what keeps it once. This action does NOT refuse a
  // second call on its own: requireAccountForVerification deliberately skips
  // the verification check — that is what stops the flow redirecting to the
  // page it is already on — so nothing above here notices that the gate is
  // already open. Without this filter a repeat call overwrites the timestamp
  // with a fresh one, so "when did this account verify" quietly becomes "when
  // was this last called".
  //
  // UPDATE ... WHERE ... IS NULL ... RETURNING is atomic in Postgres: run it
  // twice concurrently and exactly one of them gets the row back. That row is
  // the permission to send the welcome email, which is the side effect that
  // must not repeat. The UI never calls this twice, but a server action is an
  // addressable endpoint and the UI is not what enforces this.
  const { data: opened, error: writeError } = await admin
    .from("accounts")
    .update({ verification_completed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("type", role)
    .is("verification_completed_at", null)
    .select("id")

  if (writeError) {
    console.error("[completeVerification] update failed:", writeError.message)
    return { success: false, error: "Could not complete verification. Please try again." }
  }

  /** True only for the call that actually opened the gate. */
  const justOpened = (opened?.length ?? 0) > 0

  if (justOpened && profile?.email) {
    // after() rather than await: the completion screen is the reward for
    // finishing setup and should not wait on an SMTP round trip. It is also
    // not a bare floating promise — an un-awaited send can be dropped when a
    // serverless response ends, and after() is the supported way to say "run
    // this, but not before I answer".
    //
    // The send swallows its own failures (see lib/mail.ts), so nothing here
    // can turn a mail problem into a gate problem.
    //
    // Content comes from lib/setup.ts, which is what the completion screen
    // renders too, so the email cannot say something different from the page
    // the person just read.
    const email = profile.email as string
    const name = (profile.full_name as string | null) ?? ""
    after(() =>
      sendWelcomeEmail({
        to: email,
        name,
        role,
        headline: completionHeadlineFor(role),
        nextSteps: nextStepsFor(role),
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}${homeFor(role)}`,
        ctaLabel: role === "tester" ? "Find a mission" : "Go to your dashboard",
      }),
    )
  } else if (justOpened) {
    // No address on the row. Worth a line in the log, never worth a failure.
    console.error("[completeVerification] no email on profile; welcome mail skipped")
  }

  revalidatePath("/dashboard")
  revalidatePath("/explore")

  return { success: true, redirectTo: homeFor(role) }
}
