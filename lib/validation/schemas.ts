import { z } from "zod"
import {
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
} from "libphonenumber-js"
// Relative, with the extension: scripts/*.test.mts import this file under plain
// node, which resolves neither the "@/" alias nor an extensionless specifier.
import {
  COUNTRIES,
  DEVICE_TARGETS,
  ENTRY_STATUSES,
  PLAN_IDS,
  PROJECT_CATEGORIES,
  SKILLS_MAX,
  SKILLS_MIN,
  TEST_CATEGORIES,
  TIMEZONES,
  countryName,
  isDesignCategory,
} from "../vocabulary.ts"
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
// Lowered from 300. The cap is the whole length rule: a sentence count used to
// sit on top of it, but 200 characters is roughly 35 words, so it was doing
// work the cap already does while rejecting summaries nobody had been told about.
export const PROJECT_SUMMARY_MAX = 200

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
    ),
  category: projectCategorySchema,
})

export type ProjectInput = z.infer<typeof projectSchema>

/* ──────────────────────────────────────────────────────────────
 * Missions
 * ──────────────────────────────────────────────────────────── */

export const MISSION_TITLE_MAX = 100
export const MISSION_DESCRIPTION_MIN = 20
// The field had a floor and no ceiling. A text column with a minimum and no
// maximum is the one shape that lets a paste bomb straight through.
export const MISSION_DESCRIPTION_MAX = 2000

export const missionIntentSchema = z.enum(["publish", "draft"], {
  message: "Choose publish or draft.",
})

export const MISSION_CATEGORY_MAX = 40

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
  // Optional since the test case became the brief. Empty passes; short does
  // not, and the message names both ways out rather than only the one that
  // involves typing more.
  //
  // Not .optional(): FormData.get() yields a string when the textarea is
  // mounted and the form sends "" when it is not, so an undefined would be a
  // shape the column, the row type and every read site carry for nothing.
  task_description: z
    .string()
    .trim()
    .max(MISSION_DESCRIPTION_MAX, `Keep the notes under ${MISSION_DESCRIPTION_MAX} characters.`)
    .refine((v) => v === "" || v.length >= MISSION_DESCRIPTION_MIN, {
      message: `Add at least ${MISSION_DESCRIPTION_MIN} characters, or leave the notes off.`,
    }),
  intent: missionIntentSchema,
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
 *
 * There is no expected_result. It was prefilled from the builder's own
 * step_expected and ten of the first eleven entries left it exactly as it
 * arrived, so it asked a tester to retype a sentence already on the row.
 * Removed rather than made optional: a field nothing sends and nothing renders
 * is one a later reader has to work out the status of. The column keeps its
 * eleven historical values — see 20260908_01.
 */
export const auditEntrySchema = z
  .object({
    step_id: z.string().uuid("Each entry must name a step."),
    step_action: z.string().trim().min(1).max(STEP_ACTION_MAX),
    step_expected: z.string().trim().min(1).max(STEP_EXPECTED_MAX),
    status: z.enum(ENTRY_STATUSES, { message: "Mark this step pass, fail, or blocked." }),
    // Not asked of any status outside ui_design: on a fail or blocked step it
    // asked for the same thing as issue_summary, and testers wrote it twice.
    // Still accepted, since ui_design requires it (auditLogSchemaFor) and older
    // drafts carry it.
    actual_result: z
      .string()
      .trim()
      .max(ENTRY_TEXT_MAX, `Keep it under ${ENTRY_TEXT_MAX} characters.`)
      .optional()
      .or(z.literal("")),
    issue_summary: z.string().trim().max(ENTRY_TEXT_MAX).optional().or(z.literal("")),
    steps_to_reproduce: z.string().trim().max(ENTRY_TEXT_MAX).optional().or(z.literal("")),
  })
  // Conditional rather than blanket, and the condition is "not a pass" rather
  // than "a failure".
  //
  // A passing step has no issue and nothing to reproduce, and making a tester
  // type "N/A" on every one is the friction that produces garbage data. But a
  // BLOCKED step has both: something stopped the tester, and that something is
  // the entire content of the report. Blocked used to collect neither, which
  // meant the one status that means "I could not get there" reached the builder
  // with nothing they could act on.
  //
  // Every path is set so the focus hook can move the tester to the field.
  .refine((e) => e.status === "pass" || !!e.issue_summary?.trim(), {
    message: "Summarise the issue.",
    path: ["issue_summary"],
  })
  .refine((e) => e.status === "pass" || !!e.steps_to_reproduce?.trim(), {
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

/**
 * The shortest description a ui_design step accepts. "ok", "fine" and "looks
 * good" are not descriptions; twenty characters is about one short clause —
 * "The headline is clear but tiny" — which is the least a builder can act on.
 */
export const DESCRIPTION_MIN = 20

/**
 * The log as a mission of `category` judges it.
 *
 * INVERTS 20260907_01 FOR ui_design, deliberately. That migration made
 * actual_result optional on a pass because a functional step's pass is
 * already stated by step_expected — asking again filled the column with "as
 * expected". A ui_design step is an elicitation prompt ("describe your first
 * impression"): the description is not supplementary, it is the whole
 * deliverable, and without this a tester could click Pass and write nothing.
 *
 * Every other category — and a null or unknown one, which older rows have —
 * gets auditLogSchema unchanged. Mirrored by firstIncompleteEntry in
 * components/tester/AuditLogSteps.tsx; change both or neither.
 *
 * Applied in the action, not in submissionSchema: the category is on the
 * mission row, which the payload does not carry and should not be trusted to.
 */
export function auditLogSchemaFor(category: string | null | undefined) {
  if (!isDesignCategory(category)) return auditLogSchema
  return z.array(
    auditEntrySchema.refine((e) => (e.actual_result?.trim().length ?? 0) >= DESCRIPTION_MIN, {
      message: `Describe what you saw — at least ${DESCRIPTION_MIN} characters.`,
      path: ["actual_result"],
    }),
  )
}

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

export const REVIEW_NOTE_MAX = 1000

export const reviewSchema = z
  .object({
    resultId: z.string().uuid("Invalid submission id."),
    action: z.literal("approve", { message: "Approve is the only review action." }),
    rating: z.coerce
      .number()
      .int()
      .min(1, "Rate the tester from 1 to 5.")
      .max(5, "Rate the tester from 1 to 5.")
      .optional(),
    // Optional, and the only written feedback a tester gets on their own work.
    // Blank means no note: stored as null, left out of the approval email.
    reviewNote: z
      .string()
      .trim()
      .max(REVIEW_NOTE_MAX, `Keep the note under ${REVIEW_NOTE_MAX} characters.`)
      .optional()
      .transform((s) => s || null),
  })
  // Approval is a judgement of the work, so it carries a rating.
  .refine((d) => d.rating !== undefined, {
    message: "Rate the tester from 1 to 5.",
    path: ["rating"],
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
 *
 * The message is generic on purpose. The example for the *selected* country is
 * rendered by the form (lib/phoneExample.ts) — the examples dataset is too big
 * to drag into a module that runs on every submit and under plain node in
 * scripts/*.test.mts. It used to carry a Nigerian example for every country,
 * which read as "this form only wants Nigerian numbers".
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required.")
  .refine((v) => parsePhoneNumberFromString(v)?.isValid() ?? false, {
    message: "Enter a valid phone number for the selected country, including its country code.",
  })
  // Unreachable fallback: refine above already proved this parses.
  .transform((v) => parsePhoneNumberFromString(v)?.number ?? v)

/**
 * Whether a phone number belongs to the selected country.
 *
 * Compares CALLING CODES, not the parsed country. +1 covers the US, Canada and
 * most of the Caribbean, +7 Russia and Kazakhstan, and for a shared range the
 * parser names one specific country — getPossibleCountries() on +1 415 answers
 * only ["US"], so a Canadian user with a 415 number would be refused. The check
 * exists to catch "Botswana selected, Nigerian number", not to police area
 * codes.
 *
 * True when either side cannot be judged — an unparseable number or a country
 * with no metadata (BV, HM, AQ are selectable). Other rules own those errors;
 * reporting a mismatch on top of them would name the wrong problem.
 */
export function phoneMatchesCountry(phone: string, country: string): boolean {
  const parsed = parsePhoneNumberFromString(phone)
  if (!parsed || !isSupportedCountry(country)) return true
  return parsed.countryCallingCode === getCountryCallingCode(country)
}

/**
 * Adds the phone-vs-country check to an object schema that carries both.
 *
 * A wrapper rather than a refine on the field bag: the check needs two fields,
 * and Zod 4 THROWS on .partial() of a refined object — so the base objects stay
 * unrefined and this goes on last, including after .partial() for the step
 * save. Skips when either field is absent, which is what a partial payload is.
 *
 * The issue lands on `phone`, the key useFocusFirstError and FieldError resolve.
 */
export function withPhoneCountry<T extends z.ZodType<{ country?: string; phone?: string }>>(schema: T) {
  return schema.superRefine((v, ctx) => {
    if (!v.country || !v.phone) return
    if (phoneMatchesCountry(v.phone, v.country)) return
    ctx.addIssue({
      code: "custom",
      path: ["phone"],
      message: `That isn't a ${countryName(v.country)} number. Check the country code, or change the country above.`,
    })
  })
}

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

const step1Base = z.object({ ...identityFields, ...timezoneField })
export const testerStep1Schema = withPhoneCountry(step1Base)
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

const testerVerificationBase = z.object({
  ...identityFields,
  ...timezoneField,
  ...skillsField,
})
export const testerVerificationSchema = withPhoneCountry(testerVerificationBase)
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
  // .partial() on the unrefined base, then the refine — the other order throws.
  return withPhoneCountry((role === "tester" ? testerVerificationBase : step1Base).partial())
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
export const updateProfileSchema = withPhoneCountry(z.object({
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
}))

export type UpdateProfileInput = z.input<typeof updateProfileSchema>
/** The parsed shape — what actually reaches the column list. */
export type UpdateProfileFields = z.output<typeof updateProfileSchema>

/* ──────────────────────────────────────────────────────────────
 * Email + password auth
 *
 * Every key here is also a form control's `name`. That is not a
 * coincidence and it is not optional: useFocusFirstError resolves a
 * field by `name` then `id`, and components/ui/FieldError derives the
 * message id from the same string. A control called `confirm` against a
 * key called `confirm_password` is invisible to both — see the
 * SettingsForm note in CLAUDE.md.
 * ──────────────────────────────────────────────────────────── */

/** Matches the Supabase project's own minimum. Neither is looser than the
 *  other, so a password this accepts is never rejected downstream. */
export const PASSWORD_MIN = 8

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.")
  // Addresses are case-insensitive in practice and Supabase stores them
  // lowercased. Normalising here means "Alice@" and "alice@" cannot become two
  // attempts at the same account.
  .toLowerCase()

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters.`)
  // No composition rules. Length is the requirement that actually correlates
  // with strength, and a symbol rule mostly produces "Password1!".
  .max(72, "Password must be 72 characters or fewer.")

/*
 * The mismatch error is reported on `confirm_password`, not on `password`.
 * That is the field the user should be taken to and the one they should fix —
 * pointing at `password` invites them to retype the one that was probably right.
 *
 * ponytail: written out twice rather than through a generic helper that adds
 * the two password fields to a shape. Zod 4 loses the field names through that
 * inference, and the refine stops type-checking — which is the one thing the
 * helper existed to keep honest.
 */
/**
 * The Turnstile token. Supabase validates it, not us — the secret key lives
 * only in the Supabase dashboard. This only makes a missing one a field error
 * rather than a GoTrue refusal. The key is also the hidden input's name, set
 * through Turnstile's `response-field-name` (components/public/auth/Turnstile).
 */
export const CAPTCHA_REQUIRED = "Complete the verification above."
const captchaTokenSchema = z.string({ error: CAPTCHA_REQUIRED }).min(1, CAPTCHA_REQUIRED)

const PASSWORDS_MATCH = {
  message: "Passwords do not match.",
  path: ["confirm_password"],
}

export const signUpSchema = z
  .object({
    full_name: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirm_password: z.string(),
    captcha_token: captchaTokenSchema,
  })
  .refine((v) => v.password === v.confirm_password, PASSWORDS_MATCH)
export type SignUpInput = z.input<typeof signUpSchema>

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((v) => v.password === v.confirm_password, PASSWORDS_MATCH)
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>

export const signInSchema = z.object({
  email: emailSchema,
  // Deliberately not passwordSchema: an existing account may predate the
  // current minimum, and telling someone their password is too short at the
  // sign-in box is both useless and a disclosure about what is stored.
  password: z.string().min(1, "Password is required."),
  captcha_token: captchaTokenSchema,
})
export type SignInInput = z.input<typeof signInSchema>

export const emailOnlySchema = z.object({ email: emailSchema })
export type EmailOnlyInput = z.input<typeof emailOnlySchema>

/** Reset and resend. Not emailOnlySchema itself: /confirm-email parses its
 *  query string with that, and a query string carries no token. */
export const emailCaptchaSchema = emailOnlySchema.extend({ captcha_token: captchaTokenSchema })
export type EmailCaptchaInput = z.input<typeof emailCaptchaSchema>


/**
 * A plan id, for the admin override.
 *
 * `accounts.plan_id` has no CHECK constraint — fixed vocabularies live in
 * lib/vocabulary.ts and are enforced here, per CLAUDE.md — so this is the only
 * thing standing between a typo and the column.
 */
export const planIdSchema = z.enum(PLAN_IDS, { message: "Unknown plan." })
