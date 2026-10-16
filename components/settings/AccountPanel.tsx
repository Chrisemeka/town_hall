"use client"

import type { ExportProject } from "@/components/settings/ExportPanel"
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
  projects: ExportProject[]
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
      {/* A linked-accounts row with a Manage button used to open this tab.
          It did nothing — no onClick, and no GitHub sign-in to link — so it
          promised a feature that does not exist, and is gone. */}
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
        <h2 className="font-syne font-bold text-[20px] text-danger-ink">
          Danger Zone
        </h2>
        <p className="font-mono text-[14px] text-ink-muted mt-2 mb-6">
          Destructive actions that cannot be undone.
        </p>

        <div
          className="rounded-[12px] p-5 flex flex-col gap-4 bg-danger-ink/[0.05] border border-danger-ink/20"
        >
          <div className="flex flex-col items-stretch gap-4 medium:flex-row medium:items-center medium:justify-between">
            <div>
              <p className="font-mono text-[14px] text-ink">Delete Account</p>
              <p className="font-mono text-[13px] text-ink-muted mt-0.5">
                Permanently removes your account, projects, missions, and all feedback.
              </p>
            </div>
            {deleteStep === "idle" && (
              <button
                onClick={() => setDeleteStep("confirm")}
                className="shrink-0 h-12 lg:h-9 w-full medium:w-auto px-4 rounded-[8px] font-mono text-[13px] font-medium border border-danger-ink/50 text-danger-ink hover:bg-danger-ink/10 active:bg-danger-ink/10 transition-colors duration-150"
              >
                Delete Account
              </button>
            )}
          </div>

          {deleteStep === "confirm" && (
            <div className="border-t border-danger-ink/20 pt-4">
              <p className="font-mono text-[13px] text-ink mb-4">
                This cannot be undone. All your data will be permanently deleted. Are you sure?
              </p>
              {/* Compact: Cancel sits above the destructive button, so the thumb
                  that just tapped Delete Account does not land on it next. DOM
                  and focus order are unchanged; only the stack flips. */}
              <div className="flex flex-col-reverse gap-3 medium:flex-row medium:items-center">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="h-12 lg:h-9 px-4 rounded-[8px] font-mono text-[13px] font-medium bg-danger-ink text-surface transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {deleting ? "Deleting…" : "Yes, delete my account"}
                </button>
                <button
                  onClick={() => { setDeleteStep("idle"); setDeleteError(null) }}
                  disabled={deleting}
                  className="h-12 lg:h-9 px-4 rounded-[8px] font-mono text-[13px] text-ink-muted border border-ink-muted hover:text-ink transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none"
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
