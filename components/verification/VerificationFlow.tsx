"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import type { z } from "zod"
import { completeVerification, saveVerificationStep } from "@/actions/verification"
import { fieldErrorProps } from "@/components/ui/FieldError"
import { SetupCard, SetupField, setupInputClass } from "@/components/setup/chrome"
import { StepIndicator } from "@/components/setup/StepIndicator"
import {
  completionHeadlineFor,
  nextStepsFor,
  setupStages,
} from "@/lib/setup"
import { ArrowRight, Check } from "lucide-react"
import { useFocusFirstError } from "@/lib/hooks/useFocusFirstError"
import { SkillsInput } from "@/components/ui/SkillsInput"
import type { AccountType } from "@/lib/access"
import { formatPhoneAsYouType, isAllowedPhoneKey, phoneForCountryChange } from "@/lib/phone"
import { COUNTRIES, TIMEZONES, countryName } from "@/lib/vocabulary"
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
      fields: ["fullName", "country", "phone", "timezone"],
      schema: builderStep1Schema,
    },
  ],
}

export function VerificationFlow({
  role,
  initialValues,
  initialStep,
  gates,
}: {
  role: AccountType
  initialValues: VerificationValues
  initialStep: number
  /**
   * What the earlier gates say, so the indicator reports the chain rather than
   * this wizard's position. Someone adding a second role passed terms and the
   * picker months ago and must not be shown them as pending — see lib/setup.ts.
   */
  gates: { termsAcceptedAt: string | null; hasAccount: boolean }
}) {
  const steps = STEPS[role]
  const reviewStep = steps.length

  const [step, setStep] = useState(Math.min(initialStep, reviewStep))
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  // Set once the gate is open. Terminal: the flow is finished and what is on
  // screen is the hand-off, not a step.
  const [done, setDone] = useState<string | null>(null)
  const banner = useRef<HTMLDivElement>(null)

  // A field on an earlier step is not mounted, so the hook cannot focus it
  // until this puts its step on screen. Same shape as the disclosure case:
  // reveal, then it retries on the next frame.
  const revealStep = useCallback(
    (field: string) => {
      const owner = steps.findIndex((s) =>
        (s.fields as readonly string[]).includes(field),
      )
      if (owner !== -1) setStep(owner)
    },
    [steps],
  )
  const focusFirstError = useFocusFirstError({ reveal: revealStep, fallback: banner })

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
      const next = toFieldErrors<VerificationValues>(parsed.error)
      setErrors(next)
      focusFirstError(next)
      return
    }

    // Persisted per step rather than batched at the end: someone who closes the
    // tab here comes back to this step, not to an empty form.
    startTransition(async () => {
      const result = await saveVerificationStep(role, slice(step))
      if (!result.success) {
        setErrors(result.fieldErrors ?? {})
        setFormError(result.error)
        if (result.fieldErrors) focusFirstError(result.fieldErrors)
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
        // The missing field lives on an earlier step — send them to it. The
        // findIndex stays because the server can refuse without naming a field,
        // and then there is nothing for the hook to resolve.
        const broken = steps.findIndex((s, i) => !s.schema.safeParse(slice(i)).success)
        if (broken !== -1) setStep(broken)
        if (result.fieldErrors) focusFirstError(result.fieldErrors)
        return
      }
      if (result.redirectTo) {
        // Set, never cleared. The flow is over; turning this back off would
        // flash the review step behind the completion screen.
        setDone(result.redirectTo)
      }
    })
  }

  const onReview = step === reviewStep

  const bar = setupStages({
    termsAcceptedAt: gates.termsAcceptedAt,
    role,
    hasAccount: gates.hasAccount,
    verified: !!done,
    profileStep: step,
  })

  // Terminal. Returning early is what guarantees no field, button or step is
  // left on screen to be clicked once the gate is open.
  if (done) {
    return (
      <>
        <StepIndicator bar={bar} />
        <CompletionPanel role={role} href={done} />
      </>
    )
  }

  return (
    <>
      <StepIndicator bar={bar} />

      <SetupCard
        title={
          role === "tester"
            ? "Set up your tester profile"
            : "Set up your builder profile"
        }
        subhead={
          role === "tester"
            ? "Builders see your name and skills on every report you file."
            : "This takes about a minute, and it is the last thing before your dashboard."
        }
      >
        {formError && (
          <div
            ref={banner}
            role="alert"
            className="mb-6 px-4 py-3 rounded-[8px] border border-danger-ink bg-danger-ink/[0.08]"
          >
            <p className="font-mono text-[13px] leading-5 text-danger-ink">{formError}</p>
          </div>
        )}

        <div className="flex flex-col gap-6">
          {steps[step]?.id === "identity" && (
            <IdentityStep values={values} errors={errors} set={set} />
          )}
          {steps[step]?.id === "skills" && (
            <SkillsInput
              surface="setup"
              value={values.skills}
              onChange={(skills) => set("skills", skills)}
              error={errors.skills}
            />
          )}
          {onReview && (
            <ReviewStep role={role} values={values} steps={steps} onEdit={setStep} />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-8">
          {/* Live whatever the form holds — validated on click, naming the
              outstanding field. Disabled only while the action is in flight,
              which the label says. */}
          <button
            type="button"
            onClick={onReview ? onComplete : onContinue}
            disabled={pending}
            className="h-11 px-6 inline-flex items-center rounded-[8px] bg-accent text-obsidian font-mono font-medium text-[14px] tracking-[0.2px] hover:bg-voltage-dark transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
          >
            {pending
              ? onReview
                ? "Finishing…"
                : "Saving…"
              : onReview
                ? "Finish setup"
                : "Continue"}
          </button>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              disabled={pending}
              className="h-11 px-6 inline-flex items-center rounded-[8px] border border-ink-muted text-ink font-mono font-medium text-[14px] hover:bg-ink/[0.06] transition-colors duration-150 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
            >
              Back
            </button>
          )}
        </div>
      </SetupCard>
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
    // Decided against the *previous* country: values.country is still the old
    // one until the state update below lands.
    const phone = phoneForCountryChange(values.phone, values.country, code)
    set("country", code)
    if (phone !== null) set("phone", phone)
  }

  return (
    <>
      <SetupField label="Full name" htmlFor="fullName" error={errors.fullName}>
        <input
          id="fullName"
          value={values.fullName}
          maxLength={FULL_NAME_MAX}
          onChange={(e) => set("fullName", e.target.value)}
          {...fieldErrorProps("fullName", errors.fullName)}
          className={setupInputClass(!!errors.fullName?.length)}
        />
      </SetupField>

      <SetupField label="Country" htmlFor="country" error={errors.country}>
        <select
          id="country"
          value={values.country}
          onChange={(e) => onCountryChange(e.target.value)}
          {...fieldErrorProps("country", errors.country)}
          className={setupInputClass(!!errors.country?.length)}
        >
          <option value="">Select your country</option>
          {COUNTRIES.map((code) => (
            <option key={code} value={code}>
              {countryName(code)}
            </option>
          ))}
        </select>
      </SetupField>

      <SetupField
        label="Phone"
        htmlFor="phone"
        error={errors.phone}
        helper="We've filled in your country code."
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
          {...fieldErrorProps("phone", errors.phone)}
          className={setupInputClass(!!errors.phone?.length)}
        />
      </SetupField>

      <SetupField
        label="Timezone"
        htmlFor="timezone"
        error={errors.timezone}
        helper="Detected from your browser — change it if that's wrong."
      >
        <select
          id="timezone"
          value={values.timezone}
          onChange={(e) => set("timezone", e.target.value)}
          {...fieldErrorProps("timezone", errors.timezone)}
          className={setupInputClass(!!errors.timezone?.length)}
        >
          <option value="">Select your timezone</option>
          {TIMEZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </SetupField>
    </>
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
      <p className="font-sans text-[14px] leading-6 text-ink">
        {role === "tester"
          ? "Check this over — builders see your name and skills when they review your feedback."
          : "Check this over before we open up your dashboard."}
      </p>

      {steps.map((s, index) => (
        <div key={s.label} className="border border-line rounded-[12px] p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <p className="font-mono text-[12px] text-accent-ink uppercase tracking-[1px]">{s.label}</p>
            <button
              type="button"
              onClick={() => onEdit(index)}
              className="font-mono text-[12px] text-ink-muted hover:text-accent-ink underline underline-offset-2 rounded-[4px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
            >
              Edit
            </button>
          </div>
          <dl className="flex flex-col gap-3">
            {s.fields.map((field) => (
              <div key={field} className="flex items-start justify-between gap-6">
                <dt className="font-mono text-[12px] text-ink-muted shrink-0">{LABELS[field]}</dt>
                <dd className="font-mono text-[13px] text-ink text-right break-words min-w-0">
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

/**
 * The hand-off, once the gate is open.
 *
 * A terminal state of this flow rather than a route of its own: a fourth
 * gated route is exactly what the three-routes decision says not to add, and
 * the gate has just closed behind the user. Refreshing here lands on the
 * dashboard, because /verify/[role] redirects a verified account away — which
 * is right for a hand-off and is why it needs no route.
 *
 * The next steps are data in lib/setup.ts, sourced from the guides, so they
 * can be asserted without rendering anything and cannot promise a feature
 * that does not exist.
 */
function CompletionPanel({ role, href }: { role: AccountType; href: string }) {
  const steps = nextStepsFor(role)
  const [leaving, setLeaving] = useState(false)

  // The hand-off is deliberate rather than instant. Going straight from a full
  // screen of content to a blank one while the dashboard fetches reads as a
  // stall; a beat of "this is happening" reads as a transition. Long enough to
  // register, short enough not to be a wait.
  const HANDOFF_MS = 1000

  function handOff(e: React.MouseEvent<HTMLAnchorElement>) {
    // Leave modified clicks alone — open-in-new-tab should still work.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    setLeaving(true)
    window.setTimeout(() => {
      window.location.href = href
    }, HANDOFF_MS)
  }

  // Terminal, and deliberately not a state the user can click out of: the
  // navigation is already scheduled.
  if (leaving) {
    return (
      <SetupCard title={completionHeadlineFor(role)}>
        <div
          className="flex flex-col items-center justify-center gap-4 py-12"
          role="status"
          aria-live="polite"
        >
          {/* The one rotation Design.md §9 allows: it reports ongoing work
              rather than decorating. Stilled for anyone who asked for less
              motion, who gets the message without the spin. */}
          <span
            aria-hidden="true"
            className="h-8 w-8 rounded-full border-2 border-line border-t-accent-ink animate-spin motion-reduce:animate-none"
          />
          <p className="font-mono text-[14px] text-ink-muted">
            {role === "tester"
              ? "Opening the mission board…"
              : "Opening your dashboard…"}
          </p>
        </div>
      </SetupCard>
    )
  }

  return (
    <SetupCard
      title={completionHeadlineFor(role)}
      subhead="Your profile is saved and your account is open."
    >
      <ol className="flex flex-col gap-6">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span
              aria-hidden="true"
              className="h-6 w-6 shrink-0 rounded-full border border-accent-ink text-accent-ink inline-flex items-center justify-center font-mono text-[12px]"
            >
              {i + 1}
            </span>
            <div className="flex flex-col gap-1 min-w-0">
              <p className="font-mono font-medium text-[14px] text-ink">{s.title}</p>
              <p className="font-sans text-[14px] leading-6 text-ink">{s.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-col gap-4">
        <a
          href={href}
          onClick={handOff}
          className="h-11 px-6 self-start inline-flex items-center gap-2 rounded-[8px] bg-accent text-obsidian font-mono font-medium text-[14px] tracking-[0.2px] hover:bg-voltage-dark transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
        >
          {role === "tester" ? "Find a mission" : "Go to your dashboard"}
          <ArrowRight size={14} aria-hidden="true" />
        </a>
        {/* Written now, inert until the welcome email ships. */}
        <p className="font-mono text-[12px] leading-5 text-ink-muted inline-flex items-start gap-2">
          <Check size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-accent-ink" />
          We&apos;ve sent you a note with these steps, so you have them later.
        </p>
      </div>
    </SetupCard>
  )
}
