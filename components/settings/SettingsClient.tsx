"use client"

import { useState } from "react"
import { SettingsForm, type ProfileValues } from "@/components/SettingsForm"
import { AccountPanel } from "@/components/settings/AccountPanel"
import { ThemePreference } from "@/components/ThemePreference"
import { SettingsTabs } from "@/components/settings/SettingsTabs"
import { tabsFor, type SettingsTabId } from "@/lib/settingsTabs"
import type { AccountType } from "@/lib/access"
import type { Theme } from "@/lib/theme"

/**
 * Composes the four panels.
 *
 * It exists because the tab strip needs to know whether the Profile form has
 * unsaved edits, and that state lives inside the form — so one client
 * component has to render both. The panels that are pure server rendering
 * (Activity and Plan) arrive as nodes rather than being imported, which keeps
 * them off the client bundle.
 *
 * Appearance sits inside Profile rather than carrying a tab: a theme is a
 * personal preference, and one control does not justify a quarter of the nav.
 */
export function SettingsClient({
  initialTab,
  initialEmail,
  initialProfile,
  active,
  types,
  theme,
  projects,
  hasFeedback,
  activity,
  plan,
}: {
  initialTab: SettingsTabId
  initialEmail: string
  initialProfile: ProfileValues
  /**
   * The validated active account (getActiveAccount), never the raw cookie.
   * Required: the account switch and the tab set both depend on which side
   * is looking, and both were wrong while nothing told them.
   */
  active: AccountType
  /** Every account type this person holds. */
  types: AccountType[]
  theme: Theme
  /** The caller's own projects, for the export scope select. */
  projects: { id: string; name: string }[]
  hasFeedback: boolean
  activity: React.ReactNode
  plan: React.ReactNode
}) {
  const [profileDirty, setProfileDirty] = useState(false)

  return (
    <SettingsTabs
      initialTab={initialTab}
      tabs={tabsFor(active)}
      dirty={{ profile: profileDirty }}
      panels={{
        profile: (
          <div className="flex flex-col gap-10">
            <SettingsForm
              initialEmail={initialEmail}
              initialProfile={initialProfile}
              hasTesterAccount={types.includes("tester")}
              onDirtyChange={setProfileDirty}
            />
            <ThemePreference theme={theme} />
          </div>
        ),
        account: (
          <AccountPanel
            active={active}
            holdsOther={types.length > 1}
            projects={projects}
            hasFeedback={hasFeedback}
          />
        ),
        activity,
        // Builder-only; tabsFor() leaves the tab out for a tester.
        ...(active === "builder" ? { plan } : {}),
      }}
    />
  )
}
