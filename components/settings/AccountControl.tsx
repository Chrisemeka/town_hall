"use client"

import { useTransition } from "react"
import { Repeat } from "lucide-react"
import { switchAccount } from "@/actions/accounts"

/**
 * The one place a builder can reach the tester side.
 *
 * It used to be a sidebar item. It lives here because Settings is where
 * account facts belong, and because the sidebar's bottom section is now
 * exactly three things — but mostly because this is where there is room to say
 * what "Add" actually does.
 *
 * Adding a tester account lands the person on /verify/tester, because
 * accounts.verification_completed_at is per-role and theirs is null. A button
 * that says "Add tester account" and then produces a profile form is a
 * surprise; one that says so first is not.
 */
export function AccountControl({ hasTesterAccount }: { hasTesterAccount: boolean }) {
  const [isPending, startTransition] = useTransition()

  const BUTTON =
    "h-11 px-6 inline-flex items-center gap-2 rounded-[8px] border border-ink-muted text-ink font-mono font-medium text-[14px] hover:bg-ink/[0.06] transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"

  return (
    <div className="mt-8 pt-8 border-t border-line flex flex-col gap-3">
      <h3 className="font-mono text-[12px] uppercase tracking-[0.5px] text-ink-muted">
        Tester account
      </h3>

      {hasTesterAccount ? (
        <>
          <p className="font-sans text-[14px] leading-6 text-ink">
            You hold both. They are separate accounts with their own dashboards
            and their own history — switching changes which one you are using,
            not what your profile says.
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => switchAccount("tester"))}
            className={`${BUTTON} self-start`}
          >
            <Repeat className="w-4 h-4 shrink-0" aria-hidden="true" />
            {isPending ? "Switching…" : "Switch to tester account"}
          </button>
        </>
      ) : (
        <>
          <p className="font-sans text-[14px] leading-6 text-ink">
            Testing someone else&apos;s product is how you earn reports on your
            own. You&apos;ll complete a short tester profile first — a few
            fields and your skills.
          </p>
          <a href="/choose-account" className={`${BUTTON} self-start`}>
            <Repeat className="w-4 h-4 shrink-0" aria-hidden="true" />
            Add tester account
          </a>
        </>
      )}
    </div>
  )
}
