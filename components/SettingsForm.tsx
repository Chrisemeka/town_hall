"use client"

import { useState, useRef } from "react"
import { updateProfile } from "@/actions/profile"
import { Field, inputClass, textareaClass } from "@/components/ui/Field"
import { SkillsInput } from "@/components/ui/SkillsInput"
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning"
import { useFocusFirstError } from "@/lib/hooks/useFocusFirstError"
import { fieldErrorProps } from "@/components/ui/FieldError"
import { formatPhoneAsYouType, isAllowedPhoneKey } from "@/lib/phone"
import { COUNTRIES, TIMEZONES, countryName } from "@/lib/vocabulary"
import {
  BIO_MAX,
  FULL_NAME_MAX,
  type FieldErrors,
  type UpdateProfileInput,
} from "@/lib/validation/schemas"

/** The editable half of a profile, as the form holds it. */
export type ProfileValues = {
  full_name: string
  country: string
  phone: string
  timezone: string
  bio: string
  skills: string[]
}

/**
 * What actually gets sent.
 *
 * A blank field is omitted rather than sent as "", because the two mean different
 * things to the action: an absent key leaves the column alone, while "" is a value
 * that has to clear validation. Without this a verified builder — who has no
 * timezone, because the builder flow never asks for one — could not save a change
 * to their name without first being told to pick a timezone they were never asked
 * for.
 *
 * `bio` is the deliberate exception: empty is a real answer there, and it is how
 * the column gets cleared back to NULL.
 */
function payloadFrom(values: ProfileValues, hasTesterAccount: boolean): UpdateProfileInput {
  const payload: UpdateProfileInput = { bio: values.bio }
  if (values.full_name.trim()) payload.full_name = values.full_name
  if (values.country) payload.country = values.country
  if (values.phone.trim()) payload.phone = values.phone
  if (values.timezone) payload.timezone = values.timezone
  // Sent even when empty, so that emptying the list is refused by the min-1 rule
  // rather than silently leaving the old skills in place.
  if (hasTesterAccount) payload.skills = values.skills
  return payload
}


export function SettingsForm({
  initialEmail,
  initialProfile,
  hasTesterAccount,
  onDirtyChange,
}: {
  initialEmail: string
  initialProfile: ProfileValues
  /**
   * Reports whether there are unsaved edits, so the Profile tab can show an
   * indicator. The same boolean the beforeunload hook below uses — not a
   * second definition of "dirty", which would drift.
   */
  onDirtyChange?: (dirty: boolean) => void
  /** Whether the person holds a tester account at all — not which role they are
   *  currently acting as. The profile row is per-person, so their skills are
   *  theirs to edit from either hat. */
  hasTesterAccount: boolean
}) {
  const [values,  setValues]  = useState<ProfileValues>(initialProfile)
  const [errors,  setErrors]  = useState<FieldErrors<UpdateProfileInput>>({})
  const [saving,  setSaving]  = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const banner = useRef<HTMLDivElement>(null)
  const focusFirstError = useFocusFirstError({ fallback: banner })

  // `saved` is not redundant with the value comparison. The phone is stored E.164
  // but displayed grouped, so a successful save leaves the field looking different
  // from the column it was just written to — without this, saving a phone number
  // and then reloading would still be met with "leave site?".
  const dirty = !saved && JSON.stringify(values) !== JSON.stringify(initialProfile)
  useUnsavedChangesWarning(dirty)

  // beforeunload does not fire on an in-page tab switch, so the hook above
  // cannot warn about leaving Profile for Plan. Nothing is lost either way —
  // the panels stay mounted, so this state survives — but the tab strip shows
  // an indicator so that is visible rather than merely true.
  //
  // Derived during render from a value that changed, rather than in an effect:
  // the pattern React documents for adjusting state on an input change, and
  // the one the set-state-in-effect rule leaves alone.
  const [reportedDirty, setReportedDirty] = useState(dirty)
  if (reportedDirty !== dirty) {
    setReportedDirty(dirty)
    onDirtyChange?.(dirty)
  }


  function set<K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
    setFormError(null)
    setSaved(false)
  }

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

  async function handleSaveProfile() {
    setSaving(true)
    setSaveMsg(null)
    setFormError(null)
    setErrors({})
    try {
      const result = await updateProfile(payloadFrom(values, hasTesterAccount))
      if (!result.success) {
        setErrors(result.fieldErrors ?? {})
        // Field errors are shown against their fields; the banner is for the
        // rest, which the user cannot fix by editing one input.
        if (result.fieldErrors) focusFirstError(result.fieldErrors)
        else setFormError(result.error)
        return
      }
      setSaved(true)
      setSaveMsg("Profile saved.")
      setTimeout(() => setSaveMsg(null), 3000)
    } catch {
      setFormError("Something went wrong saving your profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }


  return (
    <div>

      {/* ── Profile ─────────────────────────────────────── */}
      <div>
        <h5 className="font-syne font-bold text-[20px] text-ink mb-6">Profile</h5>

        <div className="flex flex-col gap-5">
          <Field label="Display Name" htmlFor="full_name" error={errors.full_name}>
            <input
              id="full_name"
              type="text"
              maxLength={FULL_NAME_MAX}
              value={values.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              placeholder="Your name"
              {...fieldErrorProps("full_name", errors.full_name)}
              className={inputClass(!!errors.full_name?.length)}
            />
          </Field>

          <Field label="Country" htmlFor="country" error={errors.country}>
            <select
              id="country"
              value={values.country}
              onChange={(e) => onCountryChange(e.target.value)}
              {...fieldErrorProps("country", errors.country)}
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
              {...fieldErrorProps("phone", errors.phone)}
              className={inputClass(!!errors.phone?.length)}
            />
          </Field>

          <Field label="Timezone" htmlFor="timezone" error={errors.timezone}>
            <select
              id="timezone"
              value={values.timezone}
              onChange={(e) => set("timezone", e.target.value)}
              {...fieldErrorProps("timezone", errors.timezone)}
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

          <Field label="Bio" htmlFor="bio" error={errors.bio}>
            <textarea
              id="bio"
              value={values.bio}
              maxLength={BIO_MAX}
              rows={5}
              onChange={(e) => set("bio", e.target.value)}
              placeholder="A line or two about yourself. Optional."
              {...fieldErrorProps("bio", errors.bio)}
              className={textareaClass(!!errors.bio?.length)}
            />
            {/* §5.2 character counter: DM Mono 12px, Ash, right-aligned. */}
            <span className="font-mono text-[12px] text-ink-muted text-right">
              {values.bio.length}/{BIO_MAX}
            </span>
          </Field>

          {/* Per the spec: shown to anyone holding a tester account, whichever
              role they are acting as. The action drops the field for everyone
              else regardless of what the form sends. */}
          {hasTesterAccount && (
            <SkillsInput
              value={values.skills}
              onChange={(skills) => set("skills", skills)}
              error={errors.skills}
            />
          )}

          {/* Email (read-only) */}
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.5px]">
              Email
            </label>
            <div className="h-10 w-full bg-surface border border-line rounded-[8px] px-4 font-mono text-[14px] text-ink-muted flex items-center opacity-60 cursor-not-allowed">
              {initialEmail}
            </div>
            <p className="font-mono text-[12px] text-ink-muted/60">
              Email cannot be changed here.
            </p>
          </div>
        </div>

        {formError && (
          <div ref={banner} className="mt-6 px-4 py-3 bg-ember/10 border border-danger-ink/20 rounded-[8px]">
            <p className="font-mono text-[14px] text-danger-ink">{formError}</p>
          </div>
        )}

        <div className="flex items-center gap-4 mt-6">
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="h-10 px-5 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>
          {saveMsg && (
            <p className="font-mono text-[13px] text-ink-muted">{saveMsg}</p>
          )}
        </div>
      </div>
    </div>
  )
}
