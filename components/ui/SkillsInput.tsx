"use client"

import { useState } from "react"
import { Field, inputClass } from "@/components/ui/Field"
import { addSkill, removeSkill, suggestionsFor } from "@/lib/skills"
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
  const OPTION =
    "w-full h-8 px-4 flex items-center text-left font-mono text-[14px] text-ink hover:bg-ink/[0.06] transition-colors duration-150"

  const [input, setInput] = useState("")
  const [open, setOpen] = useState(false)
  // Errors from trying to add one skill are separate from the list's own
  // errors: "you already added that" is about the attempt, not about the list.
  const [addError, setAddError] = useState<string | null>(null)

  const suggestions = suggestionsFor(input, value)

  function add(raw: string) {
    const { skills, error: rejected } = addSkill(value, raw)
    setAddError(rejected)
    if (rejected) return
    onChange(skills)
    setInput("")
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
          aria-expanded={open && suggestions.length > 0}
          aria-controls="skill-suggestions"
          placeholder="Add a skill and press Enter"
          onChange={(e) => {
            setInput(e.target.value)
            setAddError(null)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            // Enter belongs to the combo box here, not to the form — without
            // this it would submit with the tag still unadded.
            if (e.key === "Enter") {
              e.preventDefault()
              add(input)
            }
            if (e.key === "Escape") setOpen(false)
          }}
          className={inputClass(!!addError || !!error?.length)}
        />

        {open && suggestions.length > 0 && (
          <ul
            id="skill-suggestions"
            className={DROPDOWN}
          >
            {suggestions.map((skill) => (
              <li key={skill}>
                <button
                  type="button"
                  // Blur fires before click, which would close the list out
                  // from under the pointer. Suppressing the blur keeps the
                  // click on the row that was actually under the cursor.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(skill)}
                  className={OPTION}
                >
                  {skill}
                </button>
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
