import { SKILLS, SKILLS_MAX, canonicalSkill } from "./vocabulary.ts"
import { skillSchema } from "./validation/schemas.ts"

/**
 * The combo box's decisions, separated from its markup.
 *
 * Every rule the user can hit — too short, bad characters, already added, list
 * full — is answered here, so the component only has to render the answer.
 */

export type AddSkillResult = {
  skills: string[]
  /** Null when the skill was added. Otherwise the message to show inline. */
  error: string | null
}

const sameSkill = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * Adds a typed or clicked skill to the list.
 *
 * Canonical spelling is resolved before anything else is checked, which is what
 * makes typing "frontend" the same act as clicking the "Frontend" suggestion —
 * including for the duplicate check, so a user cannot end up with both.
 *
 * Order of the checks is deliberate. A duplicate is reported as a duplicate
 * even when the list is already full: "Maximum 8 skills" would be misleading
 * advice for an entry that was never going to lengthen the list.
 */
export function addSkill(current: string[], raw: string): AddSkillResult {
  const value = canonicalSkill(raw)

  const parsed = skillSchema.safeParse(value)
  if (!parsed.success) {
    return { skills: current, error: parsed.error.issues[0].message }
  }

  if (current.some((s) => sameSkill(s, value))) {
    return { skills: current, error: "You've already added that skill" }
  }

  if (current.length >= SKILLS_MAX) {
    return { skills: current, error: `Maximum ${SKILLS_MAX} skills` }
  }

  return { skills: [...current, value], error: null }
}

/** Removes a skill. Case-insensitive so it matches however it was added. */
export function removeSkill(current: string[], skill: string): string[] {
  return current.filter((s) => !sameSkill(s, skill))
}

/**
 * Canonical skills worth offering for what has been typed so far.
 *
 * Vocabulary only — suggesting other users' custom tags would need a query
 * across every profile, and the amendment rules that out for now.
 *
 * Already-selected skills are filtered out, since offering one again can only
 * lead to the duplicate error. An empty input matches everything, so the list
 * doubles as a browsable menu of the vocabulary on focus — otherwise a free
 * text field gives no hint that a canonical set exists at all.
 */
export function suggestionsFor(input: string, current: string[]): string[] {
  const needle = input.trim().toLowerCase()
  const taken = new Set(current.map((s) => s.toLowerCase()))
  return SKILLS.filter((s) => !taken.has(s.toLowerCase()) && s.toLowerCase().includes(needle))
}
