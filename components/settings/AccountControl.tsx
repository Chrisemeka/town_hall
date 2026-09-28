"use client"

import { useTransition } from "react"
import { Repeat } from "lucide-react"
import { switchAccount } from "@/actions/accounts"
import { accountSwitchCopy } from "@/lib/accountSwitch"
import type { AccountType } from "@/lib/access"

/**
 * The one place either account can reach the other side.
 *
 * `active` is the validated active account — getActiveAccount(), never the raw
 * th_account cookie — and it is required: this component used to assume the
 * builder was looking, and told testers to "Switch to tester account".
 *
 * Adding an account lands the person on /verify/[role], because
 * accounts.verification_completed_at is per-role and theirs is null. A button
 * that says "Add" and then produces a profile form is a surprise; copy that
 * says so first is not.
 */
export function AccountControl({ active, holdsOther }: { active: AccountType; holdsOther: boolean }) {
  const [isPending, startTransition] = useTransition()
  const copy = accountSwitchCopy(active, holdsOther)

  const BUTTON =
    "h-11 px-6 inline-flex items-center gap-2 rounded-[8px] border border-ink-muted text-ink font-mono font-medium text-[14px] hover:bg-ink/[0.06] transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"

  return (
    <div className="mt-8 pt-8 border-t border-line flex flex-col gap-3">
      <h3 className="font-mono text-[12px] uppercase tracking-[0.5px] text-ink-muted">
        {copy.heading}
      </h3>

      <p className="font-sans text-[14px] leading-6 text-ink">{copy.body}</p>

      {holdsOther ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => switchAccount(copy.other))}
          className={`${BUTTON} self-start`}
        >
          <Repeat className="w-4 h-4 shrink-0" aria-hidden="true" />
          {isPending ? "Switching…" : copy.label}
        </button>
      ) : (
        <a href="/choose-account" className={`${BUTTON} self-start`}>
          <Repeat className="w-4 h-4 shrink-0" aria-hidden="true" />
          {copy.label}
        </a>
      )}
    </div>
  )
}
