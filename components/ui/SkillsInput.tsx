"use client"

import { useState } from "react"
import { Field, inputClass } from "@/components/ui/Field"
import { SetupField, setupInputClass } from "@/components/setup/chrome"
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
/*
 * Two surfaces, two spellings.
 *
 * This component is used by SettingsForm, which is a statically dark app
 * surface, and by the verification flow, which is now themed. The semantic
 * tokens resolve to their light values wherever no [data-theme] ancestor
 * exists, so one spelling cannot serve both — a semantic input on the
 * dashboard would be a light box on a dark page.
 *
 * When the dashboard joins the theme system this prop disappears and the
 * semantic spelling is the only one. Until then this is two class maps rather
 * than a second copy of the custom-tag logic, which is the part that matters:
 * normalizeSkills() and free entry have exactly one implementation.
 */
export type SkillsSurface = "app" | "setup"

export function SkillsInput({
  value,
  onChange,
  error,
  surface = "app",
}: {
  value: string[]
  onChange: (skills: string[]) => void
  /** The list's own errors, from the enclosing form's schema. */
  error?: string[]
  surface?: SkillsSurface
}) {
  const themed = surface === "setup"
  const Wrapper = themed ? SetupField : Field
  const boxClass = themed ? setupInputClass : inputClass
  const DROPDOWN = themed
    ? "absolute z-10 mt-2 w-full max-h-[192px] overflow-y-auto bg-surface-raised border border-line rounded-[12px] py-2"
    : "absolute z-10 mt-2 w-full max-h-[192px] overflow-y-auto bg-surface-raised border border-line rounded-[12px] py-2"
  const OPTION = themed
    ? "w-full h-8 px-4 flex items-center text-left font-mono text-[14px] text-ink hover:bg-ink/[0.06] transition-colors duration-150"
    : "w-full h-8 px-4 flex items-center text-left font-mono text-[14px] text-ink hover:bg-ink/[0.06] transition-colors duration-150"
  // On a light ground a 12% Voltage tint with Voltage text is invisible, so
  // the themed pill is an accent-ink outline instead of an accent fill.
  const PILL = themed
    ? "inline-flex items-center gap-2 border border-accent-ink text-accent-ink rounded-[4px] pl-2 pr-1 py-[2px] font-mono text-[12px] font-medium tracking-[0.5px]"
    : "inline-flex items-center gap-2 bg-voltage/[0.12] text-accent-ink rounded-[4px] pl-2 pr-1 py-[2px] font-mono text-[12px] font-medium tracking-[0.5px]"
  const REMOVE = themed
    ? "h-4 w-4 inline-flex items-center justify-center rounded-[2px] text-accent-ink hover:bg-accent-ink hover:text-surface-raised transition-colors duration-150"
    : "h-4 w-4 inline-flex items-center justify-center rounded-[2px] text-accent-ink/70 hover:text-obsidian hover:bg-voltage transition-colors duration-150"

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
    <Wrapper
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
          className={boxClass(!!addError || !!error?.length)}
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
    </Wrapper>
  )
}
