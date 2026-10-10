"use client"

import { useEffect, useReducer, useState } from "react"
import { Field, inputClass } from "@/components/ui/Field"
import {
  SKILLS_COMBO_INITIAL,
  addSkill,
  enterValue,
  isExpanded,
  removeSkill,
  skillsCombo,
  suggestionsFor,
} from "@/lib/skills"
import { SKILLS_MAX } from "@/lib/vocabulary"

/**
 * The skills combo box: pick from the canonical vocabulary or type your own.
 *
 * Every rule about what may be added lives in `lib/skills.ts`, not here — this
 * renders the answer it gets back. Shared between the verification gate and
 * Settings, which is why it takes a list and a setter rather than the enclosing
 * form's value bag.
 */
export function SkillsInput({
  value,
  onChange,
  error,
}: {
  value: string[]
  onChange: (skills: string[]) => void
  /** The list's own errors, from the enclosing form's schema. */
  error?: string[]
}) {
  // One spelling. These were two class maps behind a `surface` prop for
  // exactly as long as there were two token systems — the swap made every
  // pair identical, so the prop and the branch are gone.
  //
  // The pill is an accent-ink OUTLINE rather than a Voltage tint with Voltage
  // text: on Bone that tint is invisible, which is the whole reason ink and
  // fill are separate halves of the accent rule.
  const PILL =
    "inline-flex items-center gap-2 border border-accent-ink text-accent-ink rounded-[4px] pl-2 pr-1 py-[2px] font-mono text-[12px] font-medium tracking-[0.5px]"
  const REMOVE =
    "h-4 w-4 inline-flex items-center justify-center rounded-[2px] text-accent-ink hover:bg-accent-ink hover:text-surface-raised transition-colors duration-150"
  const DROPDOWN =
    "absolute z-10 mt-2 w-full max-h-[192px] overflow-y-auto bg-surface-raised border border-line rounded-[12px] py-2"
  // The highlighted option is underlined as well as tinted: colour never
  // carries state alone.
  const OPTION =
    "w-full h-8 px-4 flex items-center text-left font-mono text-[14px] text-ink cursor-pointer hover:bg-ink/[0.06] aria-selected:bg-ink/[0.06] aria-selected:underline underline-offset-2 transition-colors duration-150"

  const [combo, dispatch] = useReducer(skillsCombo, SKILLS_COMBO_INITIAL)
  const { input, active } = combo
  // Errors from trying to add one skill are separate from the list's own
  // errors: "you already added that" is about the attempt, not about the list.
  const [addError, setAddError] = useState<string | null>(null)

  const suggestions = suggestionsFor(input, value)
  const expanded = isExpanded(combo, suggestions.length)
  const optionId = (index: number) => `skill-option-${index}`

  // Keep the highlighted option visible as arrows walk past the list's height.
  useEffect(() => {
    if (expanded && active >= 0) {
      document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" })
    }
  }, [expanded, active])

  function add(raw: string) {
    const { skills, error: rejected } = addSkill(value, raw)
    setAddError(rejected)
    if (rejected) return
    onChange(skills)
    dispatch({ type: "added" })
  }

  return (
    <Field
      label="Skills"
      htmlFor="skills"
      error={addError ? [addError] : error}
      helper={`Pick from the list or add your own — up to ${SKILLS_MAX}. "Non-technical user" is a real answer; builders need those testers most.`}
    >
      <div className="relative">
        <input
          id="skills"
          value={input}
          autoComplete="off"
          role="combobox"
          aria-expanded={expanded}
          aria-controls="skill-suggestions"
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
          placeholder="Add a skill and press Enter"
          onChange={(e) => {
            dispatch({ type: "type", input: e.target.value })
            setAddError(null)
          }}
          onFocus={() => dispatch({ type: "focus" })}
          onBlur={() => dispatch({ type: "blur" })}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault()
              dispatch({ type: "arrow", step: e.key === "ArrowDown" ? 1 : -1, count: suggestions.length })
            }
            // Enter belongs to the combo box here, not to the form — without
            // this it would submit with the tag still unadded. It adds the
            // highlighted option, or the typed text when none is highlighted.
            if (e.key === "Enter") {
              e.preventDefault()
              add(enterValue(combo, suggestions))
            }
            if (e.key === "Escape") dispatch({ type: "escape" })
          }}
          className={inputClass(!!addError || !!error?.length)}
        />

        {expanded && (
          <ul
            id="skill-suggestions"
            role="listbox"
            aria-label="Skill suggestions"
            className={DROPDOWN}
          >
            {suggestions.map((skill, index) => (
              // An option, not a button: focus never leaves the input, and the
              // input points at the highlighted row with aria-activedescendant.
              <li
                key={skill}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                // Blur fires before click, which would close the list out
                // from under the pointer. Suppressing the blur keeps the
                // click on the row under the cursor — and focus in the input.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(skill)}
                className={OPTION}
              >
                {skill}
              </li>
            ))}
          </ul>
        )}
      </div>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2 pt-1">
          {value.map((skill) => (
            <li
              key={skill}
              className={PILL}
            >
              {skill}
              <button
                type="button"
                aria-label={`Remove ${skill}`}
                onClick={() => {
                  onChange(removeSkill(value, skill))
                  setAddError(null)
                }}
                className={REMOVE}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  )
}
