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

/**
 * The combo box's open/closed and highlighted-option state, as a reducer so
 * the transitions can be tested without a DOM.
 *
 * `active` is an index into the current suggestions, or -1 for none — in which
 * case Enter adds the typed text, which is how custom skills get in.
 */
export type SkillsComboState = { input: string; open: boolean; active: number }

export type SkillsComboEvent =
  | { type: "type"; input: string }
  | { type: "focus" }
  | { type: "blur" }
  | { type: "escape" }
  /** A skill was added — picked or typed. */
  | { type: "added" }
  | { type: "arrow"; step: 1 | -1; count: number }

export const SKILLS_COMBO_INITIAL: SkillsComboState = { input: "", open: false, active: -1 }

export function skillsCombo(state: SkillsComboState, event: SkillsComboEvent): SkillsComboState {
  switch (event.type) {
    // Typing reopens the list — after a pick, and after Escape.
    case "type":
      return { input: event.input, open: true, active: -1 }
    case "focus":
      return { ...state, open: true }
    case "blur":
    case "escape":
      return { ...state, open: false, active: -1 }
    // Closed on a pick, so the list stops covering the rest of the form. Focus
    // stays in the input, so the next keystroke reopens it.
    case "added":
      return { input: "", open: false, active: -1 }
    case "arrow": {
      if (event.count === 0) return state
      const active =
        state.open && state.active >= 0
          ? (state.active + event.step + event.count) % event.count
          : event.step > 0 ? 0 : event.count - 1
      return { ...state, open: true, active }
    }
  }
}

/** What aria-expanded reports: open, and with something in the list. */
export function isExpanded(state: SkillsComboState, suggestionCount: number): boolean {
  return state.open && suggestionCount > 0
}

/** What Enter adds: the highlighted suggestion if there is one, else the text. */
export function enterValue(state: SkillsComboState, suggestions: string[]): string {
  return (isExpanded(state, suggestions.length) && suggestions[state.active]) || state.input
}
