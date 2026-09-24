"use client"

import { useState } from "react"
import { SettingsForm, type ProfileValues } from "@/components/SettingsForm"
import { AccountPanel } from "@/components/settings/AccountPanel"
import { ThemePreference } from "@/components/ThemePreference"
import { SettingsTabs } from "@/components/settings/SettingsTabs"
import type { SettingsTabId } from "@/lib/settingsTabs"
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
  hasTesterAccount,
  theme,
  projects,
  hasFeedback,
  activity,
  plan,
}: {
  initialTab: SettingsTabId
  initialEmail: string
  initialProfile: ProfileValues
  hasTesterAccount: boolean
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
      dirty={{ profile: profileDirty }}
      panels={{
        profile: (
          <div className="flex flex-col gap-10">
            <SettingsForm
              initialEmail={initialEmail}
              initialProfile={initialProfile}
              hasTesterAccount={hasTesterAccount}
              onDirtyChange={setProfileDirty}
            />
            <ThemePreference theme={theme} />
          </div>
        ),
        account: (
          <AccountPanel
            hasTesterAccount={hasTesterAccount}
            projects={projects}
            hasFeedback={hasFeedback}
          />
        ),
        activity,
        plan,
      }}
    />
  )
}
