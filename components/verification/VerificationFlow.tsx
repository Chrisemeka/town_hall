"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { z } from "zod"
import { completeVerification, saveVerificationStep } from "@/actions/verification"
import { Button } from "@/components/ui/Button"
import type { AccountType } from "@/lib/access"
import { formatPhoneAsYouType, isAllowedPhoneKey } from "@/lib/phone"
import { COUNTRIES, SKILLS, SKILLS_MAX, TIMEZONES, countryName } from "@/lib/vocabulary"
import {
  BIO_MAX,
  BIO_MIN,
  FULL_NAME_MAX,
  builderStep1Schema,
  testerStep1Schema,
  testerStep2Schema,
  testerStep3Schema,
  toFieldErrors,
} from "@/lib/validation/schemas"

export type VerificationValues = {
  fullName: string
  country: string
  phone: string
  timezone: string
  bio: string
  skills: string[]
}

type Errors = Partial<Record<keyof VerificationValues, string[]>>

/**
 * A step knows its own label, which fields it owns, and how to validate them.
 * Keeping the field list on the step is what lets "Continue" save exactly what
 * the user just filled in rather than the whole form.
 */
type Step = {
  label: string
  fields: readonly (keyof VerificationValues)[]
  schema: z.ZodType
}

const STEPS: Record<AccountType, readonly Step[]> = {
  tester: [
    { label: "Identity", fields: ["fullName", "country", "phone"], schema: testerStep1Schema },
    { label: "About you", fields: ["bio", "timezone"], schema: testerStep2Schema },
    { label: "Skills", fields: ["skills"], schema: testerStep3Schema },
  ],
  builder: [
    { label: "Identity", fields: ["fullName", "country", "phone"], schema: builderStep1Schema },
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
          {step === 0 && <IdentityStep values={values} errors={errors} set={set} />}
          {role === "tester" && step === 1 && <AboutStep values={values} errors={errors} set={set} />}
          {role === "tester" && step === 2 && <SkillsStep values={values} errors={errors} set={set} />}
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

function IdentityStep({ values, errors, set }: StepProps) {
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
    </>
  )
}

function AboutStep({ values, errors, set }: StepProps) {
  const count = values.bio.trim().length
  return (
    <>
      <Field label="Bio" htmlFor="bio" error={errors.bio}>
        <textarea
          id="bio"
          rows={5}
          value={values.bio}
          maxLength={BIO_MAX}
          placeholder="What do you look for when you test something? What kind of apps do you use most?"
          onChange={(e) => set("bio", e.target.value)}
          className={`${inputClass(!!errors.bio?.length)} h-auto min-h-[120px] py-3 resize-none`}
        />
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-[12px] text-ash leading-5 min-w-0">
            Builders read this when they review your feedback.
          </p>
          <span className={`font-mono text-[12px] shrink-0 ${count < BIO_MIN ? "text-ash" : "text-mint"}`}>
            {count} / {BIO_MIN} min
          </span>
        </div>
      </Field>

      <Field label="Timezone" htmlFor="timezone" error={errors.timezone}>
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
    </>
  )
}

function SkillsStep({ values, errors, set }: StepProps) {
  const toggle = (skill: string) =>
    set(
      "skills",
      values.skills.includes(skill)
        ? values.skills.filter((s) => s !== skill)
        : [...values.skills, skill],
    )

  return (
    <Field
      label="Skills"
      htmlFor="skills"
      error={errors.skills}
      helper={`Pick up to ${SKILLS_MAX}. "Non-technical user" is a real answer — builders need those testers most.`}
    >
      <div id="skills" className="flex flex-wrap gap-2">
        {SKILLS.map((skill) => {
          const on = values.skills.includes(skill)
          const full = !on && values.skills.length >= SKILLS_MAX
          return (
            <button
              key={skill}
              type="button"
              aria-pressed={on}
              disabled={full}
              onClick={() => toggle(skill)}
              className={[
                "h-8 px-3 rounded-[8px] border font-mono text-[12px] font-medium transition-colors duration-150",
                on
                  ? "bg-voltage/10 border-voltage text-voltage"
                  : "bg-obsidian border-iron text-ash hover:border-voltage/40 hover:text-chalk",
                full && "opacity-40 cursor-not-allowed",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {on ? "✓ " : ""}
              {skill}
            </button>
          )
        })}
      </div>
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
    bio: "Bio",
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
