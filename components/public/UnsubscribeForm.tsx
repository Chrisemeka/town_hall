"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { unsubscribeFromEmail, type UnsubscribeState } from "@/actions/notifications"

/** The one control on /unsubscribe. The page asked; this is the answer. */
export function UnsubscribeForm({ a, t }: { a: string; t: string }) {
  const [state, action, pending] = useActionState<UnsubscribeState, FormData>(unsubscribeFromEmail, { status: "idle" })

  if (state.status === "done") {
    return (
      <p role="status" className="font-sans text-[16px] leading-8 text-ink">
        Done. You won&apos;t get the daily email. Turn it back on any time in{" "}
        <Link href="/settings?tab=account" className="text-accent-ink underline underline-offset-4">
          Settings
        </Link>
        .
      </p>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="font-sans text-[16px] leading-8 text-ink">
        You&apos;ll stop getting the daily list of new test cases. Nothing else changes, and you can
        turn it back on in Settings.
      </p>
      <input type="hidden" name="a" value={a} />
      <input type="hidden" name="t" value={t} />
      <Button type="submit" disabled={pending} className="self-start w-full medium:w-auto">
        {pending ? "Unsubscribing…" : "Unsubscribe"}
      </Button>
      {state.status === "invalid" && (
        <p role="alert" className="font-mono text-[14px] text-danger-ink">
          This unsubscribe link isn&apos;t valid. You can turn the email off in Settings → Account.
        </p>
      )}
      {state.status === "limited" && (
        <p role="alert" className="font-mono text-[14px] text-danger-ink">{state.message}</p>
      )}
    </form>
  )
}
