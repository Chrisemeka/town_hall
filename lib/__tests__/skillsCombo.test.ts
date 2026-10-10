import { describe, expect, it } from "vitest"
import {
  SKILLS_COMBO_INITIAL,
  addSkill,
  enterValue,
  isExpanded,
  skillsCombo,
  type SkillsComboEvent,
  type SkillsComboState,
} from "@/lib/skills"

const run = (...events: SkillsComboEvent[]): SkillsComboState =>
  events.reduce(skillsCombo, SKILLS_COMBO_INITIAL)

const SUGGESTIONS = ["Frontend", "Backend", "Mobile"]

describe("skillsCombo", () => {
  it("closes the list on a pick and clears the input", () => {
    const state = run({ type: "focus" }, { type: "type", input: "front" }, { type: "added" })
    expect(state).toEqual({ input: "", open: false, active: -1 })
    expect(isExpanded(state, SUGGESTIONS.length)).toBe(false)
  })

  it("keeps focus in the input: a pick never dispatches blur", () => {
    // Focus is the browser's, not the reducer's — what the reducer guarantees
    // is that "added" is not "blur", so the next keystroke lands in the input.
    const afterPick = run({ type: "focus" }, { type: "added" })
    expect(skillsCombo(afterPick, { type: "type", input: "m" }).open).toBe(true)
  })

  it("reopens on typing after a pick", () => {
    const state = run({ type: "focus" }, { type: "added" }, { type: "type", input: "b" })
    expect(isExpanded(state, SUGGESTIONS.length)).toBe(true)
  })

  it("reopens on typing after Escape", () => {
    const state = run({ type: "focus" }, { type: "escape" }, { type: "type", input: "b" })
    expect(state.open).toBe(true)
  })

  it("closes on Escape without adding anything", () => {
    const state = run({ type: "focus" }, { type: "type", input: "front" }, { type: "escape" })
    expect(state.open).toBe(false)
    expect(state.input).toBe("front")
  })

  it("reports aria-expanded in both directions, and false with nothing to show", () => {
    const open = run({ type: "focus" })
    expect(isExpanded(open, SUGGESTIONS.length)).toBe(true)
    expect(isExpanded(open, 0)).toBe(false)
    expect(isExpanded(skillsCombo(open, { type: "escape" }), SUGGESTIONS.length)).toBe(false)
    expect(isExpanded(skillsCombo(open, { type: "blur" }), SUGGESTIONS.length)).toBe(false)
  })

  it("walks the options with the arrows and wraps", () => {
    const down = { type: "arrow", step: 1, count: 3 } as const
    const up = { type: "arrow", step: -1, count: 3 } as const
    expect(run({ type: "focus" }, down).active).toBe(0)
    expect(run({ type: "focus" }, down, down, down, down).active).toBe(0)
    expect(run({ type: "focus" }, up).active).toBe(2)
    // An arrow on a closed list opens it.
    expect(run(down)).toMatchObject({ open: true, active: 0 })
  })

  it("Enter adds the highlighted option, else the typed text", () => {
    const typed = run({ type: "focus" }, { type: "type", input: "front" })
    expect(enterValue(typed, SUGGESTIONS)).toBe("front")
    const highlighted = skillsCombo(typed, { type: "arrow", step: 1, count: 3 })
    expect(enterValue(highlighted, SUGGESTIONS)).toBe("Frontend")
    // A closed list's stale highlight never wins over what was typed.
    expect(enterValue({ ...highlighted, open: false }, SUGGESTIONS)).toBe("front")
  })

  it("still lets a custom skill in", () => {
    const state = run({ type: "focus" }, { type: "type", input: "Rust embedded" })
    const { skills, error } = addSkill([], enterValue(state, []))
    expect(error).toBeNull()
    expect(skills).toEqual(["Rust embedded"])
  })
})
