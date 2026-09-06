import { z } from "zod"
import { parsePhoneNumberFromString } from "libphonenumber-js"
// Relative, with the extension: scripts/*.test.mts import this file under plain
// node, which resolves neither the "@/" alias nor an extensionless specifier.
import {
  COUNTRIES,
  DEVICE_TARGETS,
  ENTRY_STATUSES,
  PROJECT_CATEGORIES,
  SKILLS_MAX,
  SKILLS_MIN,
  TEST_CATEGORIES,
  TIMEZONES,
} from "../vocabulary.ts"
// Relative with the extension, like the imports above: scripts/*.test.mts run
// this file under plain node, which does not resolve the "@/" alias.
import { countSentences } from "../sentences.ts"
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

/**
 * Every issue keyed by its full dotted path — "test_steps.2.action".
 *
 * flattenError() above only reports top-level fields, which is right for a flat
 * form but collapses an array of objects: a bad action on step three arrives as
 * one anonymous "test_steps" error with no way to put it on the row that caused
 * it. This keeps the path so the step editor can.
 */
export function toPathErrors(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".")
    ;(out[key] ??= []).push(issue.message)
  }
  return out
}

/* ──────────────────────────────────────────────────────────────
 * Projects
 * ──────────────────────────────────────────────────────────── */

export const PROJECT_NAME_MAX = 80
// Lowered from 300. Two sentences do not need 300 characters, and the cap is a
// cheaper and more exact constraint than the sentence heuristic layered on it.
export const PROJECT_SUMMARY_MAX = 200
export const PROJECT_SUMMARY_MAX_SENTENCES = 2

/** The category vocabulary, enforced here because the column has no CHECK. */
export const projectCategorySchema = z.enum(PROJECT_CATEGORIES, {
  message: "Choose a category.",
})

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
    )
    // The counting lives in lib/sentences.ts so it can be tested against the
    // abbreviation and decimal cases without going through a schema parse.
    .refine((value) => countSentences(value) <= PROJECT_SUMMARY_MAX_SENTENCES, {
      message: "Keep it to two sentences — say what it does and who it's for.",
    }),
  category: projectCategorySchema,
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

export const STEP_ACTION_MIN = 4
export const STEP_ACTION_MAX = 200
export const STEP_EXPECTED_MIN = 4
export const STEP_EXPECTED_MAX = 200
export const TEST_STEPS_MAX = 15

/**
 * One step of a test case: what the tester does, and what should happen.
 *
 * `id` is generated client-side when the step is added and must survive every
 * edit and reorder. PR 4's audit entries reference it, so an id that changes
 * silently detaches a tester's history from the step they answered. Nothing may
 * derive it from the array index.
 *
 * The minimums are deliberately low. The job here is to reject blank and "x",
 * not to police how a builder phrases an instruction.
 */
export const testStepSchema = z.object({
  id: z.string().uuid("Each step needs a stable id."),
  action: z
    .string()
    .trim()
    .min(STEP_ACTION_MIN, "Say what the tester should do.")
    .max(STEP_ACTION_MAX, `Keep the action under ${STEP_ACTION_MAX} characters.`),
  expected_result: z
    .string()
    .trim()
    .min(STEP_EXPECTED_MIN, "Say what should happen.")
    .max(STEP_EXPECTED_MAX, `Keep the expected result under ${STEP_EXPECTED_MAX} characters.`),
})

export type TestStep = z.infer<typeof testStepSchema>

/**
 * What a stored test case is allowed to look like when reading it back.
 *
 * Deliberately laxer than testStepsSchema: an empty array is a legitimate
 * stored state — it is what every mission written before test cases existed
 * holds — and the 1..15 bounds are a rule about what a builder may *save*, not
 * about what the column may contain. Parsing reads with the write schema
 * reports those rows as corrupt, which they are not.
 */
export const storedTestStepsSchema = z.array(testStepSchema)

export const testStepsSchema = z
  .array(testStepSchema)
  .min(1, "Add at least one step.")
  .max(TEST_STEPS_MAX, `A test case can have at most ${TEST_STEPS_MAX} steps.`)
  // Duplicate ids would let two audit histories merge into one step in PR 4,
  // which reads as a tester answering something they never saw.
  .refine((steps) => new Set(steps.map((s) => s.id)).size === steps.length, {
    message: "Each step needs its own id.",
  })

/**
 * Parses a `test_steps` payload that arrived as a JSON string on FormData.
 *
 * The JSON.parse is inside the schema rather than at the call site so a
 * malformed body comes back as a field error on test_steps like any other
 * validation failure, instead of throwing out of the action as a 500.
 */
export const testStepsJsonSchema = z
  .string()
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown
    } catch {
      ctx.addIssue({ code: "custom", message: "The test case could not be read. Try again." })
      return z.NEVER
    }
  })
  .pipe(testStepsSchema)

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
  // Was a free-text tag capped at MISSION_CATEGORY_MAX. Since the test-case
  // migration it is the test-category enum, and it is required: a mission
  // without one cannot be filtered or explained to a tester.
  category: z.enum(TEST_CATEGORIES, { message: "Pick what kind of testing this is." }),
  device_target: z.enum(DEVICE_TARGETS, { message: "Pick where this should be tested." }),
  // The JSON-string variant: this arrives off FormData as a string, and
  // parsing it inside the schema keeps a malformed body a field error rather
  // than a throw out of the action.
  test_steps: testStepsJsonSchema,
}

/** Currency units off a form -> the integer cents the column stores. */
export function toCents(payout: number): number {
  return Math.round(payout * 100)
}

export const createMissionSchema = z.object({
  projectId: z.string().uuid("Invalid project id."),
  // Provenance only, and only settable at creation. Validated rather than taken
  // on trust: it is a free string on the wire, and an unknown value here would
  // make "which template did this come from" unanswerable later.
  template_id: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => v || null),
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

export const ENTRY_TEXT_MIN = 4
export const ENTRY_TEXT_MAX = 500

/**
 * One tester answer to one step.
 *
 * The step text is carried on the payload rather than looked up server-side so
 * the snapshot records what was actually rendered to the tester. The action
 * still checks step_id against the mission's live steps — the snapshot is the
 * record, but it is not taken on trust.
 */
export const auditEntrySchema = z
  .object({
    step_id: z.string().uuid("Each entry must name a step."),
    step_action: z.string().trim().min(1).max(STEP_ACTION_MAX),
    step_expected: z.string().trim().min(1).max(STEP_EXPECTED_MAX),
    status: z.enum(ENTRY_STATUSES, { message: "Mark this step pass, fail, or blocked." }),
    actual_result: z
      .string()
      .trim()
      .min(ENTRY_TEXT_MIN, "Say what actually happened.")
      .max(ENTRY_TEXT_MAX, `Keep it under ${ENTRY_TEXT_MAX} characters.`),
    expected_result: z
      .string()
      .trim()
      .min(ENTRY_TEXT_MIN, "Say what should have happened.")
      .max(ENTRY_TEXT_MAX, `Keep it under ${ENTRY_TEXT_MAX} characters.`),
    issue_summary: z.string().trim().max(ENTRY_TEXT_MAX).optional().or(z.literal("")),
    steps_to_reproduce: z.string().trim().max(ENTRY_TEXT_MAX).optional().or(z.literal("")),
  })
  // Conditional rather than a blanket requirement: a passing step has no issue
  // and nothing to reproduce, and making a tester type "N/A" on every one of
  // them is the friction that produces garbage data.
  .refine((e) => e.status !== "fail" || !!e.issue_summary?.trim(), {
    message: "Summarise the issue.",
    path: ["issue_summary"],
  })
  .refine((e) => e.status !== "fail" || !!e.steps_to_reproduce?.trim(), {
    message: "List the steps to reproduce it.",
    path: ["steps_to_reproduce"],
  })

export type AuditEntryInput = z.infer<typeof auditEntrySchema>

/**
 * The whole log. Empty is legitimate: a mission written before test cases
 * existed has no steps to file against, and the form falls back to comment plus
 * screenshots for those. Thirteen of the sixteen live missions are that shape.
 */
export const auditLogSchema = z.array(auditEntrySchema)

/** The JSON-string variant, parsed inside the schema so a malformed body is a
 *  field error rather than a throw out of the action. Same shape as
 *  testStepsJsonSchema. */
export const auditLogJsonSchema = z
  .string()
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown
    } catch {
      ctx.addIssue({ code: "custom", message: "Your answers could not be read. Try again." })
      return z.NEVER
    }
  })
  .pipe(auditLogSchema)

export const submissionSchema = z.object({
  missionId: z.string().uuid("Invalid mission id."),
  // Optional since the audit log carries the substance. The entries are where
  // the minimum lives now — COMMENT_MIN applied when this was the only field.
  comment: z.string().trim().max(2000).optional().or(z.literal("")),
  entries: auditLogJsonSchema,
})
  // A submission has to say something. Entries are the normal case; a comment
  // alone is the fallback for a mission with no steps to file against.
  .refine((v) => v.entries.length > 0 || !!v.comment?.trim(), {
    message: "Add your answers, or leave a comment about what you found.",
    path: ["comment"],
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

/* Settings used to validate its display name against a schema of its own here.
 * It now writes profiles.full_name through updateProfileSchema below, which
 * validates the same value against the same rule the verification gate uses —
 * two limits on one column is how the gate and the editor end up disagreeing
 * about what fits in it. */

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
export const SKILL_MIN = 2
export const SKILL_MAX = 30

/* The individual field schemas, exported one by one.
 *
 * They are named exports rather than inline members of the field bags below
 * because verification is no longer their only consumer — the profile editor
 * validates the same five values, and two definitions of "a valid phone number"
 * is how the gate and the editor end up disagreeing about the row they both
 * write. Composed into bags immediately after, which is what keeps the role
 * schemas reading as a list of fields rather than a wall of validators. */

export const fullNameSchema = z
  .string()
  .trim()
  .min(FULL_NAME_MIN, `Name must be at least ${FULL_NAME_MIN} characters.`)
  .max(FULL_NAME_MAX, `Name must be ${FULL_NAME_MAX} characters or fewer.`)

export const countryEnum = z.enum(COUNTRIES, { message: "Select your country." })

/**
 * Parsed rather than regex-matched: E.164 is only half the problem, the other
 * half is whether the national number is actually valid for that country.
 * Normalised to E.164 on the way through so the column holds one format.
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required.")
  .refine((v) => parsePhoneNumberFromString(v)?.isValid() ?? false, {
    message: "Enter a valid phone number including country code — e.g. +234 801 234 5678.",
  })
  // Unreachable fallback: refine above already proved this parses.
  .transform((v) => parsePhoneNumberFromString(v)?.number ?? v)

export const timezoneEnum = z.enum(TIMEZONES, { message: "Select your timezone." })

/**
 * Identity — what both roles have to give up before their gate opens. Kept as a
 * field bag rather than a schema so the two role schemas below compose it
 * instead of redeclaring it; a builder and a tester answer these identically.
 */
const identityFields = {
  fullName: fullNameSchema,
  country: countryEnum,
  phone: phoneSchema,
}

/**
 * Timezone, asked of both roles. It sits with the identity fields rather than in
 * a step of its own — the "about you" step it used to share with the bio is
 * gone, and a lone dropdown is not a step.
 *
 * Kept separate from identityFields only because it arrived later; both role
 * schemas now compose both bags. Fold it in if a third field ever joins it.
 */
const timezoneField = {
  timezone: timezoneEnum,
}

/**
 * One skill. Free text, not an enum: the vocabulary is a starting point now,
 * not a fence. What is still enforced is that a tag is a tag — long enough to
 * mean something, short enough to render in a pill, and made of characters that
 * belong in a skill name rather than markup or an injected payload.
 */
export const skillSchema = z
  .string()
  .trim()
  .min(SKILL_MIN, `Skill must be at least ${SKILL_MIN} characters`)
  .max(SKILL_MAX, `Skill must be ${SKILL_MAX} characters or less`)
  .regex(/^[\p{L}\p{N}\s.\-+/#]+$/u, "Skill can only contain letters, numbers, and . - + / #")

/**
 * The whole list.
 *
 * No uniqueness check here on purpose: normalizeSkills() runs on every write
 * path and collapses case-insensitive duplicates before this ever sees them, so
 * a refine could only fire on a list that had skipped normalisation — and would
 * then report "duplicate" for something the user cannot see or fix.
 */
export const skillsArraySchema = z
  .array(skillSchema)
  .min(SKILLS_MIN, "Add at least one skill")
  .max(SKILLS_MAX, `Maximum ${SKILLS_MAX} skills`)

const skillsField = {
  skills: skillsArraySchema,
}

/* Per-step schemas — the form validates the step in front of the user with
 * these, so an error lands on the field that caused it rather than on a later
 * step the user hasn't reached yet. */

export const testerStep1Schema = z.object({ ...identityFields, ...timezoneField })
/**
 * Structurally identical to tester step 1 — both roles now answer the same
 * identity questions, timezone included.
 *
 * Aliased rather than re-declared on purpose. Two `z.object()` calls listing the
 * same fields are one careless edit away from disagreeing, and the disagreement
 * would surface as a builder being rejected at the gate for a field their own
 * form never asked them for. Keeping both names is for the call sites, which
 * read better naming the role than picking the "other" role's schema.
 */
export const builderStep1Schema = testerStep1Schema
export const testerStep2Schema = z.object(skillsField)

/* Full role schemas — what `completeVerification` re-checks before it opens the
 * gate, because the partial saves that got us here each only saw one step. */

export const testerVerificationSchema = z.object({
  ...identityFields,
  ...timezoneField,
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

/* ──────────────────────────────────────────────────────────────
 * Profile editor
 * ──────────────────────────────────────────────────────────── */

export const BIO_MAX = 500

/**
 * What Settings may change about a person.
 *
 * Keyed by column name rather than by the camelCase field names verification
 * uses. The editor's job is "write these columns", and naming the keys after the
 * columns is what lets the action's allowlist be a straight comparison instead of
 * a second mapping table that can fall out of step with this one.
 *
 * Every field is optional because the payload is partial by design: someone who
 * only changed their phone number sends only their phone number, and a field
 * that is absent means "leave that column alone".
 *
 * Reuses the verification primitives rather than restating them — the gate and
 * the editor write the same five columns, so they have to agree on what is
 * allowed in them. A phone number the gate accepted cannot be one the editor
 * rejects.
 */
export const updateProfileSchema = z.object({
  full_name: fullNameSchema.optional(),
  country: countryEnum.optional(),
  phone: phoneSchema.optional(),
  timezone: timezoneEnum.optional(),
  bio: z
    .string()
    .trim()
    .max(BIO_MAX, `Bio must be ${BIO_MAX} characters or fewer.`)
    // An emptied textarea is a cleared bio, not an empty string — the column
    // goes back to NULL so "has a bio" stays a single check everywhere else.
    .transform((v) => v || null)
    .nullable()
    .optional(),
  skills: skillsArraySchema.optional(),
})

export type UpdateProfileInput = z.input<typeof updateProfileSchema>
/** The parsed shape — what actually reaches the column list. */
export type UpdateProfileFields = z.output<typeof updateProfileSchema>
