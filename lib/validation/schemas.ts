import { z } from "zod"
import { parsePhoneNumberFromString } from "libphonenumber-js"
// Relative, with the extension: scripts/*.test.mts import this file under plain
// node, which resolves neither the "@/" alias nor an extensionless specifier.
import { COUNTRIES, SKILLS, SKILLS_MAX, SKILLS_MIN, TIMEZONES } from "../vocabulary.ts"
import type { AccountType } from "../access.ts"

/* ──────────────────────────────────────────────────────────────
 * Shared helpers
 * ──────────────────────────────────────────────────────────── */

export type FieldErrors<T extends Record<string, unknown>> = Partial<
  Record<keyof T, string[]>
>

export type ValidationFailure<T extends Record<string, unknown>> = {
  success: false
  error: string
  fieldErrors?: FieldErrors<T>
}

/** Convert a Zod safeParse error into the `{ fieldErrors }` shape forms expect. */
export function toFieldErrors<T extends Record<string, unknown>>(
  error: z.ZodError,
): FieldErrors<T> {
  return z.flattenError(error).fieldErrors as FieldErrors<T>
}

/* ──────────────────────────────────────────────────────────────
 * Projects
 * ──────────────────────────────────────────────────────────── */

export const PROJECT_NAME_MAX = 80
export const PROJECT_SUMMARY_MAX = 300

export const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name is required.")
    .max(PROJECT_NAME_MAX, `Name must be ${PROJECT_NAME_MAX} characters or fewer.`),
  app_url: z
    .string()
    .trim()
    .min(1, "Project URL is required.")
    .url("Enter a valid URL — e.g. https://yourapp.com"),
  description: z
    .string()
    .trim()
    .min(1, "Brief summary is required.")
    .max(
      PROJECT_SUMMARY_MAX,
      `Summary must be ${PROJECT_SUMMARY_MAX} characters or fewer.`,
    ),
})

export type ProjectInput = z.infer<typeof projectSchema>

/* ──────────────────────────────────────────────────────────────
 * Missions
 * ──────────────────────────────────────────────────────────── */

export const MISSION_TITLE_MAX = 100
export const MISSION_DESCRIPTION_MIN = 20

export const missionIntentSchema = z.enum(["publish", "draft"], {
  message: "Choose publish or draft.",
})

export const MISSION_CATEGORY_MAX = 40
export const MISSION_PAYOUT_MAX = 1000

const missionFields = {
  title: z
    .string()
    .trim()
    .min(1, "Mission title is required.")
    .max(MISSION_TITLE_MAX, `Title must be ${MISSION_TITLE_MAX} characters or fewer.`),
  task_description: z
    .string()
    .trim()
    .min(
      MISSION_DESCRIPTION_MIN,
      `Tell testers what to do — at least ${MISSION_DESCRIPTION_MIN} characters.`,
    ),
  intent: missionIntentSchema,
  // Payout is entered in whole currency units and stored as cents. Blank means
  // unpaid, which is what every mission created before this field existed is.
  payout: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : v),
    z.coerce
      .number()
      .min(0, "Payout can't be negative.")
      .max(MISSION_PAYOUT_MAX, `Payout must be ${MISSION_PAYOUT_MAX} or less.`),
  ),
  category: z
    .string()
    .trim()
    .max(MISSION_CATEGORY_MAX, `Tag must be ${MISSION_CATEGORY_MAX} characters or fewer.`)
    .optional()
    .or(z.literal("")),
}

/** Currency units off a form -> the integer cents the column stores. */
export function toCents(payout: number): number {
  return Math.round(payout * 100)
}

export const createMissionSchema = z.object({
  projectId: z.string().uuid("Invalid project id."),
  ...missionFields,
})
export type CreateMissionInput = z.infer<typeof createMissionSchema>

export const updateMissionSchema = z.object({
  missionId: z.string().uuid("Invalid mission id."),
  projectId: z.string().uuid("Invalid project id."),
  ...missionFields,
})
export type UpdateMissionInput = z.infer<typeof updateMissionSchema>

/* ──────────────────────────────────────────────────────────────
 * Test submissions
 * ──────────────────────────────────────────────────────────── */

export const COMMENT_MIN = 100
export const ALLOWED_SCREENSHOT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024
export const MAX_SCREENSHOTS = 10

export const submissionSchema = z.object({
  missionId: z.string().uuid("Invalid mission id."),
  comment: z
    .string()
    .trim()
    .min(
      COMMENT_MIN,
      `Feedback should be at least ${COMMENT_MIN} characters — be specific and constructive.`,
    ),
})
export type SubmissionInput = z.infer<typeof submissionSchema>

/** File validation is separate so the screenshot can be supplied as a Blob. */
export const screenshotSchema = z
  .instanceof(File, { message: "A screenshot is required." })
  .refine(
    (f) => (ALLOWED_SCREENSHOT_TYPES as readonly string[]).includes(f.type),
    { message: "File must be PNG, JPG, or WEBP." },
  )
  .refine((f) => f.size <= MAX_SCREENSHOT_BYTES, {
    message: "Screenshot must be 5 MB or smaller.",
  })

/** A submission carries 1..MAX_SCREENSHOTS images, each validated individually. */
export const screenshotsSchema = z
  .array(screenshotSchema)
  .min(1, "At least one screenshot is required.")
  .max(MAX_SCREENSHOTS, `You can attach up to ${MAX_SCREENSHOTS} screenshots.`)

/* ──────────────────────────────────────────────────────────────
 * Submission review (builder side)
 * ──────────────────────────────────────────────────────────── */

export const REVIEW_NOTE_MAX = 500

export const reviewSchema = z
  .object({
    resultId: z.string().uuid("Invalid submission id."),
    action: z.enum(["approve", "request_changes", "mark_paid"], {
      message: "Choose approve, request changes, or mark paid.",
    }),
    rating: z.coerce
      .number()
      .int()
      .min(1, "Rate the tester from 1 to 5.")
      .max(5, "Rate the tester from 1 to 5.")
      .optional(),
    note: z.string().trim().max(REVIEW_NOTE_MAX).optional().or(z.literal("")),
  })
  // A rating is what feeds the tester's aggregate on their home screen, so it's
  // required on the two actions that are actually a judgement of the work.
  .refine((d) => d.action === "mark_paid" || d.rating !== undefined, {
    message: "Rate the tester from 1 to 5.",
    path: ["rating"],
  })
  // "Needs changes" with no reason is unactionable for the tester.
  .refine((d) => d.action !== "request_changes" || !!d.note, {
    message: "Tell the tester what needs changing.",
    path: ["note"],
  })

export type ReviewInput = z.infer<typeof reviewSchema>

/* ──────────────────────────────────────────────────────────────
 * Settings
 * ──────────────────────────────────────────────────────────── */

export const DISPLAY_NAME_MAX = 50

export const displayNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required.")
    .max(
      DISPLAY_NAME_MAX,
      `Display name must be ${DISPLAY_NAME_MAX} characters or fewer.`,
    ),
})
export type DisplayNameInput = z.infer<typeof displayNameSchema>

/* ──────────────────────────────────────────────────────────────
 * Admin broadcast
 * ──────────────────────────────────────────────────────────── */

export const BROADCAST_SUBJECT_MIN = 3
export const BROADCAST_SUBJECT_MAX = 150
export const BROADCAST_BODY_MIN = 10
export const BROADCAST_BODY_MAX = 5000
export const BROADCAST_CTA_LABEL_MAX = 40

export const broadcastSchema = z
  .object({
    subject: z
      .string()
      .trim()
      .min(BROADCAST_SUBJECT_MIN, `Subject must be at least ${BROADCAST_SUBJECT_MIN} characters.`)
      .max(BROADCAST_SUBJECT_MAX),
    messageBody: z
      .string()
      .trim()
      .min(BROADCAST_BODY_MIN, `Message must be at least ${BROADCAST_BODY_MIN} characters.`)
      .max(BROADCAST_BODY_MAX),
    ctaLabel: z
      .string()
      .trim()
      .max(BROADCAST_CTA_LABEL_MAX)
      .optional()
      .or(z.literal("")),
    ctaUrl: z
      .string()
      .trim()
      .url("CTA URL must be a valid URL.")
      .optional()
      .or(z.literal("")),
    targetType: z.enum(["all", "single"]),
    targetEmail: z
      .string()
      .trim()
      .email("Enter a valid email address.")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => data.targetType !== "single" || !!data.targetEmail,
    { message: "Recipient email is required.", path: ["targetEmail"] },
  )
  .refine(
    (data) => {
      const hasLabel = !!(data.ctaLabel && data.ctaLabel.length)
      const hasUrl = !!(data.ctaUrl && data.ctaUrl.length)
      return hasLabel === hasUrl
    },
    { message: "Provide both a CTA label and URL, or leave both empty.", path: ["ctaUrl"] },
  )

export type BroadcastInput = z.input<typeof broadcastSchema>

/* ──────────────────────────────────────────────────────────────
 * Verification gate
 * ──────────────────────────────────────────────────────────── */

export const FULL_NAME_MIN = 2
export const FULL_NAME_MAX = 80
export const BIO_MIN = 50
export const BIO_MAX = 500

/**
 * Identity — what both roles have to give up before their gate opens. Kept as a
 * field bag rather than a schema so the two role schemas below compose it
 * instead of redeclaring it; a builder and a tester answer these identically.
 */
const identityFields = {
  fullName: z
    .string()
    .trim()
    .min(FULL_NAME_MIN, `Name must be at least ${FULL_NAME_MIN} characters.`)
    .max(FULL_NAME_MAX, `Name must be ${FULL_NAME_MAX} characters or fewer.`),
  country: z.enum(COUNTRIES, { message: "Select your country." }),
  // Parsed rather than regex-matched: E.164 is only half the problem, the other
  // half is whether the national number is actually valid for that country.
  // Normalised to E.164 on the way through so the column holds one format.
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required.")
    .refine((v) => parsePhoneNumberFromString(v)?.isValid() ?? false, {
      message: "Enter a valid phone number including country code — e.g. +234 801 234 5678.",
    })
    // Unreachable fallback: refine above already proved this parses.
    .transform((v) => parsePhoneNumberFromString(v)?.number ?? v),
}

const testerProfileFields = {
  timezone: z.enum(TIMEZONES, { message: "Select your timezone." }),
  bio: z
    .string()
    .trim()
    .min(BIO_MIN, `Tell builders a bit more — at least ${BIO_MIN} characters.`)
    .max(BIO_MAX, `Bio must be ${BIO_MAX} characters or fewer.`),
}

const skillsField = {
  skills: z
    .array(z.enum(SKILLS, { message: "That isn't one of the available skills." }))
    .min(SKILLS_MIN, "Pick at least one skill.")
    .max(SKILLS_MAX, `Pick ${SKILLS_MAX} skills or fewer.`)
    // Without this, the same tag eight times passes the max check.
    .refine((s) => new Set(s).size === s.length, "Each skill can only be picked once."),
}

/* Per-step schemas — the form validates the step in front of the user with
 * these, so an error lands on the field that caused it rather than on a later
 * step the user hasn't reached yet. */

export const builderStep1Schema = z.object(identityFields)
/** Tester step 1 asks exactly what builder step 1 asks. */
export const testerStep1Schema = builderStep1Schema
export const testerStep2Schema = z.object(testerProfileFields)
export const testerStep3Schema = z.object(skillsField)

/* Full role schemas — what `completeVerification` re-checks before it opens the
 * gate, because the partial saves that got us here each only saw one step. */

export const testerVerificationSchema = z.object({
  ...identityFields,
  ...testerProfileFields,
  ...skillsField,
})
/** A builder's full requirement is its only step. Named for symmetry at the call site. */
export const builderVerificationSchema = builderStep1Schema

export type TesterVerificationInput = z.input<typeof testerVerificationSchema>
export type BuilderVerificationInput = z.input<typeof builderVerificationSchema>

/** The schema a role's completed profile is judged against. */
export function verificationSchemaFor(role: AccountType) {
  return role === "tester" ? testerVerificationSchema : builderVerificationSchema
}

/**
 * The same schema with every field optional — what a mid-flow "Continue" save is
 * checked against.
 *
 * A step save cannot demand every field, because the point of it is that the
 * later steps are still blank. It still fully validates whatever *was* sent, so
 * a bad phone number is rejected at step 1 rather than surfacing at the end. The
 * completeness check is `verificationSchemaFor()` at the gate, which is where it
 * belongs — the step number a client claims to be on is not evidence.
 */
export function verificationStepSchemaFor(role: AccountType) {
  return verificationSchemaFor(role).partial()
}
