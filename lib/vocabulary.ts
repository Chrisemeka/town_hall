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

export const SKILLS_MIN = 1
export const SKILLS_MAX = 8

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

const regionNames = new Intl.DisplayNames(["en"], { type: "region" })

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
