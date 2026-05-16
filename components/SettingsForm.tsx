"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { deleteAccountAction } from "@/actions/auth"

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
  initialDisplayName,
}: {
  initialEmail: string
  initialDisplayName: string
}) {
  const [displayName, setDisplayName]   = useState(initialDisplayName)
  const [saving,      setSaving]        = useState(false)
  const [saveMsg,     setSaveMsg]       = useState<string | null>(null)

  const [notifFeedback, setNotifFeedback] = useState(true)
  const [notifMission,  setNotifMission]  = useState(false)

  const [deleteStep, setDeleteStep]   = useState<"idle" | "confirm">("idle")
  const [deleting,   setDeleting]     = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleSaveProfile() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName },
      })
      if (error) throw error
      setSaveMsg("Profile saved.")
    } catch (err: any) {
      setSaveMsg(err.message)
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccountAction()
    } catch (err: any) {
      setDeleteError(err.message)
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
          {/* Display Name */}
          <div className="flex flex-col gap-2">
            <label htmlFor="display-name" className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
              Display Name
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="h-10 w-full bg-obsidian border border-iron rounded-[8px] px-4 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none focus:border-voltage transition-colors duration-150"
            />
          </div>

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
      <div>
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
      </div>

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
