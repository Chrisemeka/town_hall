"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { z } from "zod"
import { completeVerification, saveVerificationStep } from "@/actions/verification"
import { Button } from "@/components/ui/Button"
import type { AccountType } from "@/lib/access"
import { formatPhoneAsYouType, isAllowedPhoneKey } from "@/lib/phone"
import { addSkill, removeSkill, suggestionsFor } from "@/lib/skills"
import { COUNTRIES, SKILLS_MAX, TIMEZONES, countryName } from "@/lib/vocabulary"
import {
  FULL_NAME_MAX,
  builderStep1Schema,
  testerStep1Schema,
  testerStep2Schema,
  toFieldErrors,
} from "@/lib/validation/schemas"

export type VerificationValues = {
  fullName: string
  country: string
  phone: string
  timezone: string
  skills: string[]
}

type Errors = Partial<Record<keyof VerificationValues, string[]>>

/**
 * A step knows its own label, which fields it owns, and how to validate them.
 * Keeping the field list on the step is what lets "Continue" save exactly what
 * the user just filled in rather than the whole form.
 */
type Step = {
  /** Which panel to render. Keyed by name so a step can be added or dropped
   *  without every later step's index silently meaning something else. */
  id: "identity" | "skills"
  label: string
  fields: readonly (keyof VerificationValues)[]
  schema: z.ZodType
}

const STEPS: Record<AccountType, readonly Step[]> = {
  tester: [
    {
      id: "identity",
      label: "Identity",
      fields: ["fullName", "country", "phone", "timezone"],
      schema: testerStep1Schema,
    },
    { id: "skills", label: "Skills", fields: ["skills"], schema: testerStep2Schema },
  ],
  builder: [
    {
      id: "identity",
      label: "Identity",
      fields: ["fullName", "country", "phone"],
      schema: builderStep1Schema,
    },
  ],
}

const BANNER_COPY: Record<AccountType, string> = {
  tester: "Twnhall now requires a completed profile before you can test missions. This takes about a minute.",
  builder: "Twnhall now requires a completed profile before you can manage projects. This takes about a minute.",
}

export function VerificationFlow({
  role,
  initialValues,
  initialStep,
}: {
  role: AccountType
  initialValues: VerificationValues
  initialStep: number
}) {
  const router = useRouter()
  const steps = STEPS[role]
  const reviewStep = steps.length

  const [step, setStep] = useState(Math.min(initialStep, reviewStep))
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Detected client-side and only as a default — filling it during render would
  // not match what the server rendered, and overwriting a saved choice would
  // undo the user's own answer on every revisit.
  useEffect(() => {
    if (values.timezone) return
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (TIMEZONES.includes(detected)) set("timezone", detected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function set<K extends keyof VerificationValues>(key: K, value: VerificationValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
    setFormError(null)
  }

  /** Just the fields this step owns — what gets validated and what gets saved. */
  function slice(index: number): Partial<VerificationValues> {
    return Object.fromEntries(steps[index].fields.map((f) => [f, values[f]]))
  }

  function onContinue() {
    const current = steps[step]
    const parsed = current.schema.safeParse(slice(step))
    if (!parsed.success) {
      setErrors(toFieldErrors<VerificationValues>(parsed.error))
      return
    }

    // Persisted per step rather than batched at the end: someone who closes the
    // tab here comes back to this step, not to an empty form.
    startTransition(async () => {
      const result = await saveVerificationStep(role, slice(step))
      if (!result.success) {
        setErrors(result.fieldErrors ?? {})
        setFormError(result.error)
        return
      }
      setStep(step + 1)
    })
  }

  function onComplete() {
    startTransition(async () => {
      const result = await completeVerification(role)
      if (!result.success) {
        setErrors(result.fieldErrors ?? {})
        setFormError(result.error)
        // The missing field lives on an earlier step — send them to it.
        const broken = steps.findIndex((s, i) => !s.schema.safeParse(slice(i)).success)
        if (broken !== -1) setStep(broken)
        return
      }
      if (result.redirectTo) router.push(result.redirectTo)
    })
  }

  const onReview = step === reviewStep

  return (
    <>
      <p className="font-mono text-[12px] text-voltage uppercase tracking-[1.5px] mb-3">
        Complete your profile
      </p>
      <h1 className="font-syne font-bold text-[32px] leading-[40px] tracking-[-0.5px] text-chalk mb-3">
        {role === "tester" ? "Set up your tester profile" : "Set up your builder profile"}
      </h1>

      {/* Rollout note — Mission Instructions block styling, Design.md §6.7 */}
      <div className="bg-voltage/5 border-l-[3px] border-voltage rounded-r-[8px] px-5 py-4 mb-8">
        <p className="font-mono text-[14px] leading-6 text-ash">{BANNER_COPY[role]}</p>
      </div>

      <StepIndicator labels={[...steps.map((s) => s.label), "Review"]} current={step} />

      <div className="bg-graphite border border-iron rounded-[16px] p-10">
        {formError && (
          <div className="mb-6 px-4 py-3 bg-ember/10 border border-ember/20 rounded-[8px]">
            <p className="font-mono text-[14px] text-ember">{formError}</p>
          </div>
        )}

        <div className="flex flex-col gap-6">
          {steps[step]?.id === "identity" && (
            <IdentityStep role={role} values={values} errors={errors} set={set} />
          )}
          {steps[step]?.id === "skills" && (
            <SkillsStep values={values} errors={errors} set={set} />
          )}
          {onReview && (
            <ReviewStep role={role} values={values} steps={steps} onEdit={setStep} />
          )}
        </div>

        <div className="flex items-center gap-3 pt-8">
          {onReview ? (
            <Button size="lg" onClick={onComplete} disabled={pending}>
              {pending ? "Completing…" : "Complete verification"}
            </Button>
          ) : (
            <Button size="default" onClick={onContinue} disabled={pending}>
              {pending ? "Saving…" : "Continue"}
            </Button>
          )}
          {step > 0 && (
            <Button variant="ghost" size={onReview ? "lg" : "default"} onClick={() => setStep(step - 1)} disabled={pending}>
              Back
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

/* ── steps ───────────────────────────────────────────────────────────── */

type StepProps = {
  values: VerificationValues
  errors: Errors
  set: <K extends keyof VerificationValues>(key: K, value: VerificationValues[K]) => void
}

function IdentityStep({ role, values, errors, set }: StepProps & { role: AccountType }) {
  function onPhoneChange(next: string) {
    // Deleting is left alone: re-formatting a shrinking value puts back the
    // separator the user just removed, so backspace looks like it does nothing.
    const deleting = next.length < values.phone.length
    set("phone", deleting ? next : formatPhoneAsYouType(next, values.country))
  }

  function onCountryChange(code: string) {
    set("country", code)
    // Re-group what they already typed rather than clearing it. The number is
    // still their number; only the grouping is a function of the country.
    if (values.phone) set("phone", formatPhoneAsYouType(values.phone, code))
  }

  return (
    <>
      <Field label="Full name" htmlFor="fullName" error={errors.fullName}>
        <input
          id="fullName"
          value={values.fullName}
          maxLength={FULL_NAME_MAX}
          onChange={(e) => set("fullName", e.target.value)}
          className={inputClass(!!errors.fullName?.length)}
        />
      </Field>

      <Field label="Country" htmlFor="country" error={errors.country}>
        <select
          id="country"
          value={values.country}
          onChange={(e) => onCountryChange(e.target.value)}
          className={inputClass(!!errors.country?.length)}
        >
          <option value="">Select your country</option>
          {COUNTRIES.map((code) => (
            <option key={code} value={code}>
              {countryName(code)}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Phone"
        htmlFor="phone"
        error={errors.phone}
        helper="Include your country code — e.g. +234 801 234 5678."
      >
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          value={values.phone}
          placeholder="+234 801 234 5678"
          onKeyDown={(e) => {
            if (!isAllowedPhoneKey(e)) e.preventDefault()
          }}
          onChange={(e) => onPhoneChange(e.target.value)}
          className={inputClass(!!errors.phone?.length)}
        />
      </Field>

      {/* Testers only: builders have no timezone-dependent surface yet. */}
      {role === "tester" && (
        <Field
          label="Timezone"
          htmlFor="timezone"
          error={errors.timezone}
          helper="Detected from your browser — change it if that's wrong."
        >
          <select
            id="timezone"
            value={values.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className={inputClass(!!errors.timezone?.length)}
          >
            <option value="">Select your timezone</option>
            {TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </Field>
      )}
    </>
  )
}

function SkillsStep({ values, errors, set }: StepProps) {
  const [input, setInput] = useState("")
  const [open, setOpen] = useState(false)
  // Errors from trying to add one skill are separate from the step's own
  // errors: "you already added that" is about the attempt, not about the list.
  const [addError, setAddError] = useState<string | null>(null)

  const suggestions = suggestionsFor(input, values.skills)

  function add(raw: string) {
    const { skills, error } = addSkill(values.skills, raw)
    setAddError(error)
    if (error) return
    set("skills", skills)
    setInput("")
  }

  return (
    <Field
      label="Skills"
      htmlFor="skills"
      error={addError ? [addError] : errors.skills}
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
            // this it would submit the step with the tag still unadded.
            if (e.key === "Enter") {
              e.preventDefault()
              add(input)
            }
            if (e.key === "Escape") setOpen(false)
          }}
          className={inputClass(!!addError || !!errors.skills?.length)}
        />

        {open && suggestions.length > 0 && (
          <ul
            id="skill-suggestions"
            className="absolute z-10 mt-2 w-full max-h-[192px] overflow-y-auto bg-graphite border border-iron rounded-[12px] py-2"
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
                  className="w-full h-8 px-4 flex items-center text-left font-mono text-[14px] text-chalk hover:bg-white/[0.04] transition-colors duration-150"
                >
                  {skill}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {values.skills.length > 0 && (
        <ul className="flex flex-wrap gap-2 pt-1">
          {values.skills.map((skill) => (
            <li
              key={skill}
              className="inline-flex items-center gap-2 bg-voltage/[0.12] text-voltage rounded-[4px] pl-2 pr-1 py-[2px] font-mono text-[12px] font-medium tracking-[0.5px]"
            >
              {skill}
              <button
                type="button"
                aria-label={`Remove ${skill}`}
                onClick={() => {
                  set("skills", removeSkill(values.skills, skill))
                  setAddError(null)
                }}
                className="h-4 w-4 inline-flex items-center justify-center rounded-[2px] text-voltage/70 hover:text-obsidian hover:bg-voltage transition-colors duration-150"
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

function ReviewStep({
  role,
  values,
  steps,
  onEdit,
}: {
  role: AccountType
  values: VerificationValues
  steps: readonly Step[]
  onEdit: (step: number) => void
}) {
  const LABELS: Record<keyof VerificationValues, string> = {
    fullName: "Full name",
    country: "Country",
    phone: "Phone",
    timezone: "Timezone",
    skills: "Skills",
  }

  const display = (field: keyof VerificationValues) => {
    if (field === "country") return values.country ? countryName(values.country) : "—"
    if (field === "skills") return values.skills.length ? values.skills.join(", ") : "—"
    return values[field] || "—"
  }

  return (
    <>
      <p className="font-mono text-[14px] leading-6 text-ash">
        {role === "tester"
          ? "Check this over — builders see your name and skills when they review your feedback."
          : "Check this over before we open up your dashboard."}
      </p>

      {steps.map((s, index) => (
        <div key={s.label} className="border border-iron rounded-[12px] p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <p className="font-mono text-[11px] text-voltage uppercase tracking-[1px]">{s.label}</p>
            <button
              type="button"
              onClick={() => onEdit(index)}
              className="font-mono text-[12px] text-ash hover:text-voltage transition-colors duration-150"
            >
              Edit
            </button>
          </div>
          <dl className="flex flex-col gap-3">
            {s.fields.map((field) => (
              <div key={field} className="flex items-start justify-between gap-6">
                <dt className="font-mono text-[12px] text-ash shrink-0">{LABELS[field]}</dt>
                <dd className="font-mono text-[13px] text-chalk text-right break-words min-w-0">
                  {display(field)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </>
  )
}

/* ── shared bits ─────────────────────────────────────────────────────── */

function StepIndicator({ labels, current }: { labels: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 mb-6">
      {labels.map((label, index) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={[
              "h-8 px-3 inline-flex items-center rounded-[8px] font-mono text-[12px] font-medium border",
              index === current
                ? "bg-voltage/10 border-voltage text-voltage"
                : "border-iron text-ash",
            ].join(" ")}
            aria-current={index === current ? "step" : undefined}
          >
            {index + 1}. {label}
          </span>
        </li>
      ))}
    </ol>
  )
}

function Field({
  label,
  htmlFor,
  error,
  helper,
  children,
}: {
  label: string
  htmlFor: string
  error?: string[]
  helper?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
        {label}
      </label>
      {children}
      {error?.length ? (
        <p className="font-mono text-[12px] text-ember">{error[0]}</p>
      ) : helper ? (
        <p className="font-mono text-[12px] text-ash leading-5">{helper}</p>
      ) : null}
    </div>
  )
}

function inputClass(hasError: boolean): string {
  return [
    "h-10 w-full bg-obsidian border rounded-[8px] px-4 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none transition-colors duration-150",
    hasError ? "border-ember" : "border-iron focus:border-voltage",
  ].join(" ")
}
