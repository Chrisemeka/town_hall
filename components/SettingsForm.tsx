"use client"

import { useState } from "react"
import { deleteAccountAction } from "@/actions/auth"
import { updateProfile } from "@/actions/profile"
import { Field, inputClass, textareaClass } from "@/components/ui/Field"
import { SkillsInput } from "@/components/ui/SkillsInput"
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning"
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

function SectionDivider() {
  return <div style={{ height: 1, background: "#2C2C35", margin: "32px 0" }} />
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-voltage focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
      style={{ background: checked ? "#E8FF47" : "#2C2C35" }}
    >
      <span
        className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-obsidian transition-transform duration-150"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <p className="font-mono text-[14px] text-chalk">{label}</p>
        <p className="font-mono text-[13px] text-ash mt-0.5">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

export function SettingsForm({
  initialEmail,
  initialProfile,
  hasTesterAccount,
}: {
  initialEmail: string
  initialProfile: ProfileValues
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

  // `saved` is not redundant with the value comparison. The phone is stored E.164
  // but displayed grouped, so a successful save leaves the field looking different
  // from the column it was just written to — without this, saving a phone number
  // and then reloading would still be met with "leave site?".
  useUnsavedChangesWarning(!saved && JSON.stringify(values) !== JSON.stringify(initialProfile))

  const [notifFeedback, setNotifFeedback] = useState(true)
  const [notifMission,  setNotifMission]  = useState(false)

  const [deleteStep, setDeleteStep]   = useState<"idle" | "confirm">("idle")
  const [deleting,   setDeleting]     = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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
        if (!result.fieldErrors) setFormError(result.error)
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

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccountAction()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account.")
      setDeleting(false)
      setDeleteStep("idle")
    }
  }

  return (
    <div>

      {/* ── Profile ─────────────────────────────────────── */}
      <div>
        <h5 className="font-syne font-bold text-[20px] text-chalk mb-6">Profile</h5>

        <div className="flex flex-col gap-5">
          <Field label="Display Name" htmlFor="display-name" error={errors.full_name}>
            <input
              id="display-name"
              type="text"
              maxLength={FULL_NAME_MAX}
              value={values.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              placeholder="Your name"
              className={inputClass(!!errors.full_name?.length)}
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

          <Field label="Bio" htmlFor="bio" error={errors.bio}>
            <textarea
              id="bio"
              value={values.bio}
              maxLength={BIO_MAX}
              rows={5}
              onChange={(e) => set("bio", e.target.value)}
              placeholder="A line or two about yourself. Optional."
              className={textareaClass(!!errors.bio?.length)}
            />
            {/* §5.2 character counter: DM Mono 12px, Ash, right-aligned. */}
            <span className="font-mono text-[12px] text-ash text-right">
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
            <label className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
              Email
            </label>
            <div className="h-10 w-full bg-obsidian border border-iron rounded-[8px] px-4 font-mono text-[14px] text-ash flex items-center opacity-60 cursor-not-allowed">
              {initialEmail}
            </div>
            <p className="font-mono text-[12px] text-ash/60">
              Email cannot be changed here.
            </p>
          </div>
        </div>

        {formError && (
          <div className="mt-6 px-4 py-3 bg-ember/10 border border-ember/20 rounded-[8px]">
            <p className="font-mono text-[14px] text-ember">{formError}</p>
          </div>
        )}

        <div className="flex items-center gap-4 mt-6">
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="h-10 px-5 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-[#C8E000] transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>
          {saveMsg && (
            <p className="font-mono text-[13px] text-ash">{saveMsg}</p>
          )}
        </div>
      </div>

      <SectionDivider />

      {/* ── Account ─────────────────────────────────────── */}
      <div>
        <h5 className="font-syne font-bold text-[20px] text-chalk mb-6">Account</h5>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[14px] text-chalk">Linked Accounts</p>
            <p className="font-mono text-[13px] text-ash mt-0.5">
              GitHub, Google, and other OAuth providers.
            </p>
          </div>
          <button className="h-9 px-4 border border-iron text-chalk rounded-[8px] font-mono text-[13px] hover:border-ash transition-colors duration-150 shrink-0">
            Manage
          </button>
        </div>
      </div>

      <SectionDivider />

      {/* ── Notifications ───────────────────────────────── */}
      {/* <div>
        <h5 className="font-syne font-bold text-[20px] text-chalk mb-6">Notifications</h5>

        <div className="flex flex-col gap-5">
          <ToggleRow
            label="Feedback received"
            description="Email when a tester submits feedback on your mission."
            checked={notifFeedback}
            onChange={setNotifFeedback}
          />
          <ToggleRow
            label="New mission added"
            description="Email when a new mission is available to test."
            checked={notifMission}
            onChange={setNotifMission}
          />
        </div>
      </div> */}

      <SectionDivider />

      {/* ── Danger Zone ─────────────────────────────────── */}
      <div>
        <h5 className="font-syne font-bold text-[20px]" style={{ color: "#FF4F4F" }}>
          Danger Zone
        </h5>
        <p className="font-mono text-[14px] text-ash mt-2 mb-6">
          Destructive actions that cannot be undone.
        </p>

        <div
          className="rounded-[12px] p-5 flex flex-col gap-4"
          style={{ background: "rgba(255,79,79,0.05)", border: "1px solid rgba(255,79,79,0.2)" }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[14px] text-chalk">Delete Account</p>
              <p className="font-mono text-[13px] text-ash mt-0.5">
                Permanently removes your account, projects, missions, and all feedback.
              </p>
            </div>
            {deleteStep === "idle" && (
              <button
                onClick={() => setDeleteStep("confirm")}
                className="shrink-0 h-9 px-4 rounded-[8px] font-mono text-[13px] font-medium border transition-colors duration-150"
                style={{ borderColor: "rgba(255,79,79,0.5)", color: "#FF4F4F", background: "transparent" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,79,79,0.1)" }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
              >
                Delete Account
              </button>
            )}
          </div>

          {deleteStep === "confirm" && (
            <div className="border-t pt-4" style={{ borderColor: "rgba(255,79,79,0.2)" }}>
              <p className="font-mono text-[13px] text-chalk mb-4">
                This cannot be undone. All your data will be permanently deleted. Are you sure?
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="h-9 px-4 rounded-[8px] font-mono text-[13px] font-medium transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
                  style={{ background: "#FF4F4F", color: "#0E0E10", border: "none" }}
                >
                  {deleting ? "Deleting…" : "Yes, delete my account"}
                </button>
                <button
                  onClick={() => { setDeleteStep("idle"); setDeleteError(null) }}
                  disabled={deleting}
                  className="h-9 px-4 rounded-[8px] font-mono text-[13px] text-ash border border-iron hover:text-chalk transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {deleteError && (
          <p className="font-mono text-[13px] text-ember mt-3">{deleteError}</p>
        )}
      </div>

    </div>
  )
}
