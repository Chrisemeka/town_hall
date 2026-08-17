"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { getActiveAccount } from "@/lib/auth"
import { normalizeSkills } from "@/lib/vocabulary"
import {
  toFieldErrors,
  updateProfileSchema,
  type FieldErrors,
  type UpdateProfileInput,
} from "@/lib/validation/schemas"

/**
 * Settings' own write. The other end of the verification gate: the gate collects
 * these columns once, this is how a person changes them afterwards.
 */

type ProfileResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: FieldErrors<UpdateProfileInput> }

/**
 * The only columns Settings may write, and the whole reason this list is spelled
 * out: the write below runs as service-role, so anything reaching the UPDATE is
 * written. Zod already strips keys it does not know, but a schema is a shape
 * check and this is an authority check — they answer different questions, and the
 * one that matters here is "may Settings write this column".
 *
 * `verification_completed_at` is absent deliberately, and must stay absent. It
 * lives on `accounts` rather than `profiles` so this UPDATE could not reach it
 * anyway, but the omission is the point: editing a phone number is not
 * re-verifying, and a profile edit must never re-close a gate the user has
 * already cleared.
 */
const EDITABLE_COLUMNS = [
  "full_name",
  "country",
  "phone",
  "timezone",
  "bio",
  "skills",
] as const

/**
 * Updates the signed-in person's profile.
 *
 * Partial by design: the payload carries only the fields the form actually
 * changed, and a column whose key is absent is left alone. `bio` is the one
 * field where present-but-null is meaningful — that is a cleared bio, not an
 * absent one, so it writes NULL rather than being skipped.
 *
 * Auth is `getActiveAccount()` rather than `requireAccount()` on purpose.
 * /settings is a shared surface (see SHARED_PREFIXES in lib/access.ts), so it is
 * not role-scoped and the verification gate does not apply to it — gating it
 * here would make this action stricter than the middleware that let the user
 * onto the page, and would strand someone who came to Settings to fix the very
 * phone number their verification is stuck on. The cookie-versus-database
 * intersection still happens, inside that helper.
 */
export async function updateProfile(fields: unknown): Promise<ProfileResult> {
  const resolved = await getActiveAccount()
  if (!resolved || resolved.active === null) {
    return { success: false, error: "You need to be signed in to update your profile." }
  }

  const parsed = updateProfileSchema.safeParse(fields)
  if (!parsed.success) {
    return {
      success: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors<UpdateProfileInput>(parsed.error),
    }
  }

  const row: Record<string, unknown> = {}
  for (const column of EDITABLE_COLUMNS) {
    if (column in parsed.data) row[column] = parsed.data[column]
  }

  // Skills belong to the tester role, so a builder-only account does not get to
  // set them. Dropped rather than rejected: the field should never have been
  // rendered for them, and answering a request the UI cannot produce with an
  // error only turns a hidden UI bug into a visible dead end for the user.
  if (!resolved.types.includes("tester")) delete row.skills

  // Canonical spelling and de-duplication happen here rather than in the schema,
  // for the same reason as in the verification action: they rewrite the value
  // rather than judge it. "frontend" is not invalid, it is another spelling.
  if (Array.isArray(row.skills)) row.skills = normalizeSkills(row.skills as string[])

  // Nothing left to write once the allowlist and the role rule have had their
  // say. Sending an empty UPDATE is an error in PostgREST, not a no-op.
  if (Object.keys(row).length === 0) return { success: true }

  const admin = createAdminClient()
  const { error } = await admin.from("profiles").update(row).eq("id", resolved.userId)

  if (error) {
    console.error("[updateProfile] update failed:", error.message)
    return { success: false, error: "Could not save your profile. Please try again." }
  }

  revalidatePath("/settings")

  return { success: true }
}
