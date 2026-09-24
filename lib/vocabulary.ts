// Fixed vocabularies the verification flow validates against.
//
// One definition each, no imports — the Zod schemas, the form components, and
// scripts/vocabulary.test.mts all read from here. A list that exists in two
// places drifts, and a drifted country list means a value the form offered gets
// rejected by the server.

/** Skills a tester can claim. Expandable — nothing keys off the order. */
export const SKILLS = [
  "Frontend",
  "Backend",
  "Mobile",
  "Design",
  "Product",
  "Data",
  "DevOps",
  "QA",
  "AI/ML",
  "Non-technical user",
] as const

export type Skill = (typeof SKILLS)[number]

/**
 * What kind of product a project is. Drives the Explore filter.
 *
 * Order is display order in the dropdown, and nothing keys off it except
 * "Other", which must stay last. "Other" has to exist: a builder whose category
 * is missing will otherwise pick a wrong one, and a wrong category is worse for
 * a filter people trust than an honest catch-all.
 *
 * Stored as the label itself rather than a slug. The list is small, the values
 * are display-ready, and a slug would add a mapping table for no gain — if these
 * ever need renaming without a data migration, that is the moment to add one.
 */
export const PROJECT_CATEGORIES = [
  "Fintech",
  "HealthTech",
  "EdTech",
  "E-commerce",
  "SaaS / B2B Tools",
  "Developer Tools",
  "AI / ML",
  "Social & Community",
  "Marketplace",
  "Productivity",
  "Media & Entertainment",
  "Logistics & Mobility",
  "Gaming",
  "Other",
] as const

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number]

/** What a project with no category shows. Never stored — null stays null. */
export const UNCATEGORISED_LABEL = "Uncategorised"

/**
 * What kind of testing a mission asks for.
 *
 * Machine values, unlike PROJECT_CATEGORIES — those are display copy the
 * builder picks from a list, these are enum-ish values a migration already
 * writes and that code branches on, so a slug is the right shape and
 * testCategoryLabel() renders them.
 */
export const TEST_CATEGORIES = ["process_flow", "component", "ui_design"] as const

export type TestCategory = (typeof TEST_CATEGORIES)[number]

const TEST_CATEGORY_LABELS: Record<TestCategory, string> = {
  process_flow: "Process Flow Testing",
  component: "Component Testing",
  ui_design: "UI Design Testing",
}

/** One line explaining each category, shown on the picker cards. */
export const TEST_CATEGORY_BLURBS: Record<TestCategory, string> = {
  process_flow: "A journey end to end — sign up, checkout, reset a password.",
  component: "Individual elements like buttons, inputs, and checkboxes.",
  ui_design: "How it reads and feels — clarity, hierarchy, polish.",
}

/** Human label for a stored test category. Unknown values render as-is. */
export function testCategoryLabel(value: string): string {
  return TEST_CATEGORY_LABELS[value as TestCategory] ?? value
}

/**
 * Where a mission is meant to be tested.
 *
 * Three states in one column, not a set: "both" is its own answer rather than
 * the union of the other two, and storing it that way keeps "the builder did
 * not care" distinguishable from "the builder picked both deliberately".
 */
export const DEVICE_TARGETS = ["mobile", "desktop", "both"] as const

export type DeviceTarget = (typeof DEVICE_TARGETS)[number]

const DEVICE_TARGET_LABELS: Record<DeviceTarget, string> = {
  mobile: "Mobile",
  desktop: "Desktop",
  both: "Mobile & Desktop",
}

/** Human label for a stored device target. Unknown values render as-is. */
export function deviceTargetLabel(value: string): string {
  return DEVICE_TARGET_LABELS[value as DeviceTarget] ?? value
}

/**
 * How a tester answers one test-case step.
 *
 * "blocked" is its own state rather than a kind of failure: a step nobody could
 * reach — the previous step broke, the environment was down — tells the builder
 * something different from a step that ran and gave the wrong answer, and
 * collapsing the two would hide which it was.
 */
export const ENTRY_STATUSES = ["pass", "fail", "blocked"] as const

export type EntryStatus = (typeof ENTRY_STATUSES)[number]

const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  pass: "Pass",
  fail: "Fail",
  blocked: "Blocked",
}

/**
 * One line explaining each status, shown beside the choice.
 *
 * The distinction above was written for developers, in a comment. Nothing in
 * the product has ever told a tester what these three mean, which is how a
 * blocked step gets marked Fail — reporting a bug in a feature nobody reached.
 */
export const ENTRY_STATUS_HINTS: Record<EntryStatus, string> = {
  pass: "It did what the builder said it would.",
  fail: "It ran, and did something else.",
  blocked: "You could not get to this step at all.",
}

/** Human label for a stored entry status. Unknown values render as-is. */
export function entryStatusLabel(value: string): string {
  return ENTRY_STATUS_LABELS[value as EntryStatus] ?? value
}

export const SKILLS_MIN = 1
export const SKILLS_MAX = 8

/** Trim the ends and squash runs of internal whitespace to one space. */
function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

/**
 * The canonical spelling of a skill, if we have one.
 *
 * A user typing "frontend" means the same thing as the vocabulary's "Frontend",
 * so it is stored as "Frontend" rather than becoming a second, near-identical
 * tag. Anything with no canonical match is a custom tag and keeps the casing
 * the user chose — "AI/ML" reads better than "ai/ml", and we have no basis for
 * guessing how someone wants their own words capitalised.
 */
export function canonicalSkill(skill: string): string {
  const cleaned = collapseWhitespace(skill)
  const canonical = SKILLS.find((s) => s.toLowerCase() === cleaned.toLowerCase())
  return canonical ?? cleaned
}

/**
 * Cleans a skill list for storage: whitespace collapsed, canonical spellings
 * applied, duplicates removed case-insensitively.
 *
 * Order is preserved and the first spelling of a duplicate wins — if someone
 * has "React" and later adds "react", the list keeps "React". There is no
 * better answer available: both are the user's own words, and the earlier one
 * is the one they have already seen on screen.
 *
 * Empty entries are dropped rather than rejected. They only arise from
 * whitespace-only input, which is not a skill and not worth an error.
 */
export function normalizeSkills(skills: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  for (const raw of skills) {
    const value = canonicalSkill(raw)
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }

  return out
}

/**
 * ISO 3166-1 alpha-2, officially assigned codes. Stored as codes rather than
 * names so the display string can change (and be localised) without a data
 * migration. Kept as one whitespace-separated literal because 249 codes as an
 * array literal is 249 lines of noise for something nobody edits by hand.
 *
 * The `[string, ...string[]]` type is what Zod's `z.enum` needs — the runtime
 * shape is guaranteed by scripts/vocabulary.test.mts.
 */
export const COUNTRIES = `
  AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
  BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
  CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
  DE DJ DK DM DO DZ
  EC EE EG EH ER ES ET
  FI FJ FK FM FO FR
  GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
  HK HM HN HR HT HU
  ID IE IL IM IN IO IQ IR IS IT
  JE JM JO JP
  KE KG KH KI KM KN KP KR KW KY KZ
  LA LB LC LI LK LR LS LT LU LV LY
  MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
  NA NC NE NF NG NI NL NO NP NR NU NZ
  OM
  PA PE PF PG PH PK PL PM PN PR PS PT PW PY
  QA
  RE RO RS RU RW
  SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
  TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
  UA UG UM US UY UZ
  VA VC VE VG VI VN VU
  WF WS
  YE YT
  ZA ZM ZW
`
  .trim()
  .split(/\s+/) as [string, ...string[]]

// The locale is pinned, and "en-US" specifically — not undefined, not [], not
// bare "en". Those defer to the runtime, and the runtime is not the same on
// both sides of a render: Node's ICU build resolved FK to "Falkland Islands"
// while the browser resolved it to "Falkland Islands (Islas Malvinas)", so the
// server markup and the hydrated markup disagreed and React threw. Any region
// with a disputed or aliased name can do this. Widening this back to a
// runtime-dependent locale reintroduces the hydration error.
const regionNames = new Intl.DisplayNames(["en-US"], { type: "region" })

/** "NG" -> "Nigeria". The platform owns the names, so we don't ship a second list. */
export function countryName(code: string): string {
  return regionNames.of(code) ?? code
}

/**
 * IANA timezone names, straight from the runtime. Sorted already, and it tracks
 * tzdata updates on its own — a hardcoded list would go stale the first time a
 * country changed its DST rules.
 *
 * "UTC" is appended because ECMA-402's canonical list deliberately omits it
 * (and all of Etc/*), while `Intl.DateTimeFormat().resolvedOptions().timeZone`
 * — what the form auto-detects with — returns exactly "UTC" on a machine with
 * no region set. Without this the auto-detected default fails its own enum.
 * It sorts after "Pacific/…" on its own, so the list stays ordered.
 */
export const TIMEZONES = Intl.supportedValuesOf("timeZone").concat("UTC") as [
  string,
  ...string[],
]

/**
 * Which plan an account is on.
 *
 * `null` on the column means Community, so this list is the set of values that
 * can be *written*. "community" is spelled out anyway: an admin setting
 * somebody back to the free tier needs a value to pick, and clearing a column
 * is not something a select box does well.
 *
 * Machine values like TEST_CATEGORIES rather than display copy like
 * PROJECT_CATEGORIES — a plan id is something code branches on, and the label
 * belongs in lib/plans.ts with the rest of the tier content.
 */
export const PLAN_IDS = ["community", "pro"] as const

export type PlanId = (typeof PLAN_IDS)[number]

/** What a null column means. Null and "community" are the same plan. */
export const DEFAULT_PLAN: PlanId = "community"

/** Narrows a stored value, which may be null, to the vocabulary. */
export function planIdFor(value: string | null | undefined): PlanId {
  return (PLAN_IDS as readonly string[]).includes(value ?? "")
    ? (value as PlanId)
    : DEFAULT_PLAN
}
