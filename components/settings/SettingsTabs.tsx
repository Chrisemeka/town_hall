"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  SETTINGS_TABS,
  nextTabIndex,
  tabFromParam,
  tabHref,
  tabIndex,
  type SettingsTabId,
} from "@/lib/settingsTabs"

/**
 * The Settings tab strip.
 *
 * Two things about this are deliberate and easy to undo by accident.
 *
 * EVERY PANEL STAYS MOUNTED. Switching toggles `hidden`, it does not swap
 * children. Profile is a form: unmounting it would throw away whatever was
 * typed, and useUnsavedChangesWarning cannot help because it hooks
 * beforeunload, which does not fire on an in-page tab switch. Keeping the
 * subtree alive is what makes switching away and back safe. `hidden` also
 * takes the inactive panels out of the accessibility tree and the tab order,
 * so nothing is reachable that is not on screen.
 *
 * ARROWS MOVE FOCUS WITHOUT ACTIVATING. WAI-ARIA allows either, and automatic
 * activation is usually the nicer one — but a click pushes a history entry so
 * Back walks the tabs, and automatic activation would push one per keypress:
 * arrowing from Profile to Plan would leave three entries for tabs the person
 * only passed over. Enter, Space and click activate.
 */
export function SettingsTabs({
  initialTab,
  panels,
  dirty,
}: {
  initialTab: SettingsTabId
  panels: Record<SettingsTabId, React.ReactNode>
  /** Tabs whose content has unsaved changes. */
  dirty?: Partial<Record<SettingsTabId, boolean>>
}) {
  const params = useSearchParams()
  const urlTab = tabFromParam(params.get("tab") ?? undefined)

  // The URL is the record; this is what renders, so a click is instant rather
  // than waiting for a server round trip. Derived during render when the URL
  // changes underneath — which is how Back and a deep link both land here —
  // rather than in an effect.
  const [active, setActive] = useState<SettingsTabId>(initialTab)
  const [seenUrlTab, setSeenUrlTab] = useState(urlTab)
  if (urlTab !== seenUrlTab) {
    setSeenUrlTab(urlTab)
    setActive(urlTab)
  }

  // Roving tabindex follows the FOCUSED tab while the strip has focus, and
  // returns to the active one when focus leaves. With manual activation that
  // is required: arrow to a tab, press Tab, and the tab order has to make
  // sense from where you actually are.
  const [focused, setFocused] = useState<number | null>(null)
  const activeIndex = tabIndex(active)
  const tabbable = focused ?? activeIndex

  const strip = useRef<HTMLDivElement>(null)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  // Keep the active tab in view on a strip that scrolls horizontally at
  // narrow widths — otherwise the selected tab can be off-screen on arrival
  // from a deep link.
  useEffect(() => {
    buttons.current[activeIndex]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    })
  }, [activeIndex])

  function activate(id: SettingsTabId) {
    setActive(id)
    setSeenUrlTab(id)

    // pushState, not router.push, and not replaceState.
    //
    // push rather than replace because once the URL visibly changes, Back not
    // undoing it is the surprise. The cost is history entries; the
    // alternative costs a Back that skips the whole Settings visit.
    //
    // The NATIVE pushState rather than router.push because the Settings page
    // is a Server Component that reads the profile, the account row and two
    // submission counts — router.push would re-run all four on every tab
    // click, for a change that needs no server at all. Next supports the
    // native call and keeps useSearchParams in sync with it, so Back still
    // works and the strip still follows the URL.
    window.history.pushState(null, "", tabHref(id))
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const from = tabbable
    const to = nextTabIndex(from, e.key)
    if (to !== from) {
      e.preventDefault()
      setFocused(to)
      buttons.current[to]?.focus()
      return
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      activate(SETTINGS_TABS[from].id)
    }
  }

  return (
    <div>
      <div
        ref={strip}
        role="tablist"
        aria-label="Settings sections"
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          // Focus left the strip entirely, not just moved within it.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setFocused(null)
          }
        }}
        // flex-nowrap + overflow-x-auto rather than wrapping: four tabs do not
        // fit 360px, and a ragged two-row grid reads as a mistake.
        className="flex flex-nowrap gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {SETTINGS_TABS.map((tab, i) => {
          const selected = tab.id === active
          const isDirty = !!dirty?.[tab.id]
          return (
            <button
              key={tab.id}
              ref={(el) => {
                buttons.current[i] = el
              }}
              id={`settings-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`settings-panel-${tab.id}`}
              tabIndex={i === tabbable ? 0 : -1}
              onFocus={() => setFocused(i)}
              onClick={() => activate(tab.id)}
              className={[
                "shrink-0 h-11 px-4 inline-flex items-center gap-2 font-mono text-[14px] border-b-2 -mb-px transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                selected
                  ? "border-accent-ink text-ink"
                  : "border-transparent text-ink-muted hover:text-ink",
              ].join(" ")}
            >
              {tab.label}
              {isDirty && (
                <>
                  {/* A dot alone is colour conveying state, so it carries a
                      word for anyone who cannot see it. */}
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-accent-ink shrink-0"
                  />
                  <span className="sr-only">(unsaved changes)</span>
                </>
              )}
            </button>
          )
        })}
      </div>

      {SETTINGS_TABS.map((tab) => (
        <div
          key={tab.id}
          id={`settings-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${tab.id}`}
          hidden={tab.id !== active}
          // Focusable so a keyboard user can Tab from the strip straight into
          // the panel it controls, per the APG.
          tabIndex={0}
          className="pt-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-[8px]"
        >
          {panels[tab.id]}
        </div>
      ))}
    </div>
  )
}
