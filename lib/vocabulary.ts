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

/**
 * Whether a mission's steps are judgements rather than functional checks.
 *
 * A ui_design step is an elicitation prompt — "describe your first
 * impression" — which cannot pass or fail; the tester's description IS the
 * deliverable, so it is required at every status (auditLogSchemaFor), and the
 * status becomes a judgement on the builder's expectation. process_flow and
 * component are genuinely functional and keep Pass / Fail / Blocked with the
 * description optional on a pass. Null and unknown categories — older rows
 * exist — are treated as functional.
 */
export function isDesignCategory(category: string | null | undefined): boolean {
  return category === "ui_design"
}

/**
 * Display copy for a ui_design mission. The STORED values do not change —
 * pass / fail / blocked in the database, the AI prompt, the CSV and every
 * count — only what the tester is shown while answering.
 *
 * "Couldn't tell" keeps the distinction ENTRY_STATUSES exists to protect: a
 * step nobody could judge still reports differently from one that was seen and
 * did not land.
 */
const DESIGN_STATUS_COPY: Record<EntryStatus, { label: string; hint: string }> = {
  pass: { label: "Clear", hint: "It landed the way the builder described." },
  fail: { label: "Unclear", hint: "You saw it, and it didn't land that way." },
  blocked: {
    label: "Couldn't tell",
    hint: "You couldn't judge this — it didn't load, or wasn't there.",
  },
}

/** The label and hint a tester sees for `status` on a mission of `category`. */
export function entryStatusCopy(
  status: EntryStatus,
  category: string | null | undefined,
): { label: string; hint: string } {
  return isDesignCategory(category)
    ? DESIGN_STATUS_COPY[status]
    : { label: ENTRY_STATUS_LABELS[status], hint: ENTRY_STATUS_HINTS[status] }
}

/**
 * The question above the status buttons. On a design step it points at the
 * builder's expectation, not the action — the description answers the action,
 * and "How did it go?" under "describe your first impression" reads as
 * grading the description.
 */
export function statusQuestionFor(category: string | null | undefined): string {
  return isDesignCategory(category) ? "Did the builder's expectation hold?" : "How did it go?"
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

// The display name of every country code, in the order the dropdown shows.
//
// Data, not Intl.DisplayNames. The runtime owned these names until it served
// two different ones: Node resolved FK to "Falkland Islands" and Chrome to
// "Falkland Islands (Islas Malvinas)" for the same pinned en-US locale,
// because each ships its own ICU data. The <select> is server-rendered and
// hydrated, so any difference is a hydration error. Pinning the locale could
// not fix that; only a list both sides read can.
//
// Already sorted by name, so the dropdown's order does not depend on a
// runtime Collator either. Keys are ISO 3166-1 alpha-2, officially assigned.
// Adding a country is one line here.
const COUNTRY_NAMES = {
  AF: "Afghanistan",
  AX: "Åland Islands",
  AL: "Albania",
  DZ: "Algeria",
  AS: "American Samoa",
  AD: "Andorra",
  AO: "Angola",
  AI: "Anguilla",
  AQ: "Antarctica",
  AG: "Antigua & Barbuda",
  AR: "Argentina",
  AM: "Armenia",
  AW: "Aruba",
  AU: "Australia",
  AT: "Austria",
  AZ: "Azerbaijan",
  BS: "Bahamas",
  BH: "Bahrain",
  BD: "Bangladesh",
  BB: "Barbados",
  BY: "Belarus",
  BE: "Belgium",
  BZ: "Belize",
  BJ: "Benin",
  BM: "Bermuda",
  BT: "Bhutan",
  BO: "Bolivia",
  BA: "Bosnia & Herzegovina",
  BW: "Botswana",
  BV: "Bouvet Island",
  BR: "Brazil",
  IO: "British Indian Ocean Territory",
  VG: "British Virgin Islands",
  BN: "Brunei",
  BG: "Bulgaria",
  BF: "Burkina Faso",
  BI: "Burundi",
  KH: "Cambodia",
  CM: "Cameroon",
  CA: "Canada",
  CV: "Cape Verde",
  BQ: "Caribbean Netherlands",
  KY: "Cayman Islands",
  CF: "Central African Republic",
  TD: "Chad",
  CL: "Chile",
  CN: "China",
  CX: "Christmas Island",
  CC: "Cocos (Keeling) Islands",
  CO: "Colombia",
  KM: "Comoros",
  CG: "Congo - Brazzaville",
  CD: "Congo - Kinshasa",
  CK: "Cook Islands",
  CR: "Costa Rica",
  CI: "Côte d’Ivoire",
  HR: "Croatia",
  CU: "Cuba",
  CW: "Curaçao",
  CY: "Cyprus",
  CZ: "Czechia",
  DK: "Denmark",
  DJ: "Djibouti",
  DM: "Dominica",
  DO: "Dominican Republic",
  EC: "Ecuador",
  EG: "Egypt",
  SV: "El Salvador",
  GQ: "Equatorial Guinea",
  ER: "Eritrea",
  EE: "Estonia",
  SZ: "Eswatini",
  ET: "Ethiopia",
  FK: "Falkland Islands",
  FO: "Faroe Islands",
  FJ: "Fiji",
  FI: "Finland",
  FR: "France",
  GF: "French Guiana",
  PF: "French Polynesia",
  TF: "French Southern Territories",
  GA: "Gabon",
  GM: "Gambia",
  GE: "Georgia",
  DE: "Germany",
  GH: "Ghana",
  GI: "Gibraltar",
  GR: "Greece",
  GL: "Greenland",
  GD: "Grenada",
  GP: "Guadeloupe",
  GU: "Guam",
  GT: "Guatemala",
  GG: "Guernsey",
  GN: "Guinea",
  GW: "Guinea-Bissau",
  GY: "Guyana",
  HT: "Haiti",
  HM: "Heard & McDonald Islands",
  HN: "Honduras",
  HK: "Hong Kong SAR China",
  HU: "Hungary",
  IS: "Iceland",
  IN: "India",
  ID: "Indonesia",
  IR: "Iran",
  IQ: "Iraq",
  IE: "Ireland",
  IM: "Isle of Man",
  IL: "Israel",
  IT: "Italy",
  JM: "Jamaica",
  JP: "Japan",
  JE: "Jersey",
  JO: "Jordan",
  KZ: "Kazakhstan",
  KE: "Kenya",
  KI: "Kiribati",
  KW: "Kuwait",
  KG: "Kyrgyzstan",
  LA: "Laos",
  LV: "Latvia",
  LB: "Lebanon",
  LS: "Lesotho",
  LR: "Liberia",
  LY: "Libya",
  LI: "Liechtenstein",
  LT: "Lithuania",
  LU: "Luxembourg",
  MO: "Macao SAR China",
  MG: "Madagascar",
  MW: "Malawi",
  MY: "Malaysia",
  MV: "Maldives",
  ML: "Mali",
  MT: "Malta",
  MH: "Marshall Islands",
  MQ: "Martinique",
  MR: "Mauritania",
  MU: "Mauritius",
  YT: "Mayotte",
  MX: "Mexico",
  FM: "Micronesia",
  MD: "Moldova",
  MC: "Monaco",
  MN: "Mongolia",
  ME: "Montenegro",
  MS: "Montserrat",
  MA: "Morocco",
  MZ: "Mozambique",
  MM: "Myanmar (Burma)",
  NA: "Namibia",
  NR: "Nauru",
  NP: "Nepal",
  NL: "Netherlands",
  NC: "New Caledonia",
  NZ: "New Zealand",
  NI: "Nicaragua",
  NE: "Niger",
  NG: "Nigeria",
  NU: "Niue",
  NF: "Norfolk Island",
  KP: "North Korea",
  MK: "North Macedonia",
  MP: "Northern Mariana Islands",
  NO: "Norway",
  OM: "Oman",
  PK: "Pakistan",
  PW: "Palau",
  PS: "Palestinian Territories",
  PA: "Panama",
  PG: "Papua New Guinea",
  PY: "Paraguay",
  PE: "Peru",
  PH: "Philippines",
  PN: "Pitcairn Islands",
  PL: "Poland",
  PT: "Portugal",
  PR: "Puerto Rico",
  QA: "Qatar",
  RE: "Réunion",
  RO: "Romania",
  RU: "Russia",
  RW: "Rwanda",
  WS: "Samoa",
  SM: "San Marino",
  ST: "São Tomé & Príncipe",
  SA: "Saudi Arabia",
  SN: "Senegal",
  RS: "Serbia",
  SC: "Seychelles",
  SL: "Sierra Leone",
  SG: "Singapore",
  SX: "Sint Maarten",
  SK: "Slovakia",
  SI: "Slovenia",
  SB: "Solomon Islands",
  SO: "Somalia",
  ZA: "South Africa",
  GS: "South Georgia & South Sandwich Islands",
  KR: "South Korea",
  SS: "South Sudan",
  ES: "Spain",
  LK: "Sri Lanka",
  BL: "St. Barthélemy",
  SH: "St. Helena",
  KN: "St. Kitts & Nevis",
  LC: "St. Lucia",
  MF: "St. Martin",
  PM: "St. Pierre & Miquelon",
  VC: "St. Vincent & Grenadines",
  SD: "Sudan",
  SR: "Suriname",
  SJ: "Svalbard & Jan Mayen",
  SE: "Sweden",
  CH: "Switzerland",
  SY: "Syria",
  TW: "Taiwan",
  TJ: "Tajikistan",
  TZ: "Tanzania",
  TH: "Thailand",
  TL: "Timor-Leste",
  TG: "Togo",
  TK: "Tokelau",
  TO: "Tonga",
  TT: "Trinidad & Tobago",
  TN: "Tunisia",
  TR: "Türkiye",
  TM: "Turkmenistan",
  TC: "Turks & Caicos Islands",
  TV: "Tuvalu",
  UM: "U.S. Outlying Islands",
  VI: "U.S. Virgin Islands",
  UG: "Uganda",
  UA: "Ukraine",
  AE: "United Arab Emirates",
  GB: "United Kingdom",
  US: "United States",
  UY: "Uruguay",
  UZ: "Uzbekistan",
  VU: "Vanuatu",
  VA: "Vatican City",
  VE: "Venezuela",
  VN: "Vietnam",
  WF: "Wallis & Futuna",
  EH: "Western Sahara",
  YE: "Yemen",
  ZM: "Zambia",
  ZW: "Zimbabwe",
} as const

/** "NG" -> "Nigeria". From the list above, never Intl — see there why. */
export function countryName(code: string): string {
  return (COUNTRY_NAMES as Record<string, string>)[code] ?? code
}

/**
 * ISO 3166-1 alpha-2, officially assigned codes, in the order the dropdown
 * shows them: by name, as COUNTRY_NAMES lists them. Stored as codes
 * rather than names so a display string can change without a data migration.
 *
 * The `[string, ...string[]]` type is what Zod's `z.enum` needs — the runtime
 * shape is guaranteed by scripts/vocabulary.test.mts.
 */
export const COUNTRIES = Object.keys(COUNTRY_NAMES) as [string, ...string[]]

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
/** Cheapest first: /pricing, /settings and the admin control list them in this order. */
export const PLAN_IDS = ["community", "starter", "pro"] as const

export type PlanId = (typeof PLAN_IDS)[number]

/** What a null column means. Null and "community" are the same plan. */
export const DEFAULT_PLAN: PlanId = "community"

/** Narrows a stored value, which may be null, to the vocabulary. */
export function planIdFor(value: string | null | undefined): PlanId {
  return (PLAN_IDS as readonly string[]).includes(value ?? "")
    ? (value as PlanId)
    : DEFAULT_PLAN
}
