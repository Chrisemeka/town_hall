"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Moon, Sun } from "lucide-react"
import { writeThemeCookie, type Theme } from "@/lib/theme"

/**
 * The theme as a labelled setting rather than an icon in a header.
 *
 * The header toggle (components/public/ThemeToggle) is a single button that
 * flips: right for a nav bar, wrong for a settings page, where a preference
 * should show you what the options are and which one you are on. Same cookie,
 * same server-rendered attribute — this is a second presentation of one
 * setting, not a second setting.
 */
const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
]

export function ThemePreference({ theme }: { theme: Theme }) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  function choose(next: Theme) {
    if (next === theme) return
    writeThemeCookie(next)
    startTransition(() => router.refresh())
  }

  return (
    <fieldset className="border border-line rounded-[12px] bg-surface-raised p-6">
      <legend className="sr-only">Theme</legend>
      <p className="font-mono text-[12px] text-ink-muted uppercase tracking-[0.5px]">
        Appearance
      </p>
      <p className="font-sans text-[14px] leading-6 text-ink mt-2 mb-5">
        Applies everywhere you are signed in, on this device.
      </p>

      <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Theme">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const on = value === theme
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => choose(value)}
              className={[
                "h-11 px-5 inline-flex items-center gap-2 rounded-[8px] border font-mono text-[14px] transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised",
                // The selected state is a border and a word, never colour
                // alone — Design.md §10.
                on
                  ? "border-accent-ink text-accent-ink bg-accent-ink/[0.08]"
                  : "border-ink-muted text-ink hover:bg-ink/[0.06]",
              ].join(" ")}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
              {on && <span className="sr-only">(selected)</span>}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
