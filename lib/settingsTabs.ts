// Which Settings tab a URL means, and where a key press moves.
//
// Pure and import-free, like lib/access.ts and lib/setup.ts: the resolution
// and the keyboard arithmetic are the parts worth testing, and there is no DOM
// test environment in this repo to test a tab strip with.

export type SettingsTabId = "profile" | "account" | "activity" | "plan"

export type SettingsTab = {
  id: SettingsTabId
  label: string
}

/** Display order, which is also arrow-key order. Profile is the default. */
export const SETTINGS_TABS: readonly SettingsTab[] = [
  { id: "profile", label: "Profile" },
  { id: "account", label: "Account" },
  { id: "activity", label: "Activity" },
  { id: "plan", label: "Plan" },
]

export const DEFAULT_TAB: SettingsTabId = "profile"

/**
 * Resolves `?tab=` to a tab.
 *
 * Anything unrecognised — absent, misspelt, wrong case, an array from a
 * repeated query param — opens Profile. A bad URL should open the page, not
 * produce an error: someone editing the address bar is not a threat, and a
 * 404 for a query string nobody typed deliberately is a worse answer than the
 * default tab.
 */
export function tabFromParam(value: string | string[] | undefined): SettingsTabId {
  const raw = Array.isArray(value) ? value[0] : value
  return SETTINGS_TABS.some((t) => t.id === raw) ? (raw as SettingsTabId) : DEFAULT_TAB
}

export function tabIndex(id: SettingsTabId): number {
  const at = SETTINGS_TABS.findIndex((t) => t.id === id)
  return at === -1 ? 0 : at
}

/**
 * Where an arrow, Home or End moves focus — the WAI-ARIA tabs contract.
 *
 * Wraps at both ends, which is what the pattern specifies and what makes a
 * four-tab strip navigable without counting. Returns the same index for a key
 * that is not one of these, so the caller can use the answer to decide whether
 * to preventDefault.
 */
export function nextTabIndex(
  current: number,
  key: "ArrowLeft" | "ArrowRight" | "Home" | "End" | string,
): number {
  const last = SETTINGS_TABS.length - 1
  switch (key) {
    case "ArrowLeft":
      return current <= 0 ? last : current - 1
    case "ArrowRight":
      return current >= last ? 0 : current + 1
    case "Home":
      return 0
    case "End":
      return last
    default:
      return current
  }
}

/** The href a tab links to. Used for the anchor and for the pushed URL. */
export function tabHref(id: SettingsTabId): string {
  return `/settings?tab=${id}`
}
