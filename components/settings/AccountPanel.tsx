"use client"

import { useState } from "react"
import { deleteAccountAction } from "@/actions/auth"
import { AccountControl } from "@/components/settings/AccountControl"
import { ExportPanel } from "@/components/settings/ExportPanel"
import type { AccountType } from "@/lib/access"

/**
 * The Account tab: linked accounts, the account switch, and the danger
 * zone.
 *
 * Lifted out of SettingsForm unchanged — same elements, same classes, same
 * copy — because Profile and Account are now different tabs and the two
 * halves never shared state: the profile form owns `values` and `errors`,
 * this owns the delete flow.
 *
 * Export sits directly above Danger Zone: delete and export belong together,
 * because both are operations on your own data.
 */
function SectionDivider() {
  return <div className="h-px bg-line my-10" />
}

export function AccountPanel({
  active,
  holdsOther,
  projects,
  hasFeedback,
}: {
  active: AccountType
  holdsOther: boolean
  projects: { id: string; name: string }[]
  hasFeedback: boolean
}) {
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle")
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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
      {/* ── Account ─────────────────────────────────────── */}
      <div>
        <h5 className="font-syne font-bold text-[20px] text-ink mb-6">Account</h5>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[14px] text-ink">Linked Accounts</p>
            <p className="font-mono text-[13px] text-ink-muted mt-0.5">
              GitHub, Google, and other OAuth providers.
            </p>
          </div>
          <button className="h-9 px-4 border border-line text-ink rounded-[8px] font-mono text-[13px] hover:border-ink-muted transition-colors duration-150 shrink-0">
            Manage
          </button>
        </div>
      </div>

      <SectionDivider />

      {/* Moved down from the sidebar, where there was no room to say that
          adding an account means completing that role's profile first. */}
      <AccountControl active={active} holdsOther={holdsOther} />

      <SectionDivider />

      {/* Builder-only. The export is feedback received on your own missions,
          and a tester has none — hidden rather than an empty state, because an
          empty state is for something that will fill in and this never will.
          Not gated on hasFeedback: a builder with nothing yet still gets the
          section and its empty state. A tester exporting their own report
          history would be a different feature — different data, query and
          copy. */}
      {active === "builder" && (
        <>
          <ExportPanel projects={projects} hasFeedback={hasFeedback} />
          <SectionDivider />
        </>
      )}

      {/* ── Danger Zone ─────────────────────────────────── */}
      <div>
        <h5 className="font-syne font-bold text-[20px]" style={{ color: "var(--color-danger-ink)" }}>
          Danger Zone
        </h5>
        <p className="font-mono text-[14px] text-ink-muted mt-2 mb-6">
          Destructive actions that cannot be undone.
        </p>

        <div
          className="rounded-[12px] p-5 flex flex-col gap-4"
          style={{ background: "rgba(255,79,79,0.05)", border: "1px solid rgba(255,79,79,0.2)" }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[14px] text-ink">Delete Account</p>
              <p className="font-mono text-[13px] text-ink-muted mt-0.5">
                Permanently removes your account, projects, missions, and all feedback.
              </p>
            </div>
            {deleteStep === "idle" && (
              <button
                onClick={() => setDeleteStep("confirm")}
                className="shrink-0 h-9 px-4 rounded-[8px] font-mono text-[13px] font-medium border transition-colors duration-150"
                style={{ borderColor: "rgba(255,79,79,0.5)", color: "var(--color-danger-ink)", background: "transparent" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,79,79,0.1)" }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent" }}
              >
                Delete Account
              </button>
            )}
          </div>

          {deleteStep === "confirm" && (
            <div className="border-t pt-4" style={{ borderColor: "rgba(255,79,79,0.2)" }}>
              <p className="font-mono text-[13px] text-ink mb-4">
                This cannot be undone. All your data will be permanently deleted. Are you sure?
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="h-9 px-4 rounded-[8px] font-mono text-[13px] font-medium transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
                  style={{ background: "var(--color-danger-ink)", color: "var(--color-surface)", border: "none" }}
                >
                  {deleting ? "Deleting…" : "Yes, delete my account"}
                </button>
                <button
                  onClick={() => { setDeleteStep("idle"); setDeleteError(null) }}
                  disabled={deleting}
                  className="h-9 px-4 rounded-[8px] font-mono text-[13px] text-ink-muted border border-line hover:text-ink transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {deleteError && (
          <p className="font-mono text-[13px] text-danger-ink mt-3">{deleteError}</p>
        )}
      </div>
    </div>
  )
}
