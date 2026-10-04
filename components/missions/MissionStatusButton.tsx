"use client"

import { useFormStatus } from "react-dom"
import { Loader2, Power, PowerOff } from "lucide-react"

/**
 * The submit button inside the mission page's Deactivate/Reactivate form.
 * Client-side only for useFormStatus: without a pending state the click gave
 * no sign it had landed, and builders clicked again.
 */
export function MissionStatusButton({ isActive }: { isActive: boolean }) {
  const { pending } = useFormStatus()
  const Icon = pending ? Loader2 : isActive ? PowerOff : Power
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`h-8 px-3 rounded-[6px] font-mono text-[13px] transition-colors duration-150 flex items-center gap-1.5 cursor-pointer disabled:cursor-wait disabled:opacity-70 ${
        isActive
          ? "bg-ember/10 border border-danger-ink/30 text-danger-ink hover:bg-ember/20"
          : "bg-voltage/10 border border-accent-ink/30 text-accent-ink hover:bg-voltage/20"
      }`}
    >
      <Icon className={`w-3 h-3 ${pending ? "animate-spin" : ""}`} />
      {isActive
        ? pending ? "Deactivating…" : "Deactivate"
        : pending ? "Reactivating…" : "Reactivate"}
    </button>
  )
}
