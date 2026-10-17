"use client"

import { Avatar } from "@/components/ui/Avatar"
import { Sheet } from "@/components/ui/Sheet"
import { AccountActions } from "./Sidebar"
import type { AccountType } from "@/lib/access"

/** The avatar below 840px, and the account actions it opens. */
export function AccountSheet({
  avatarUrl,
  displayName,
  account,
}: {
  avatarUrl: string | null
  displayName: string | null
  account: AccountType
}) {
  const avatar = <Avatar src={avatarUrl} name={displayName} size={40} />

  return (
    <Sheet
      id="account-sheet"
      label="Account"
      openLabel="Account menu"
      closeLabel="Close account menu"
      trigger={{ kind: "avatar", node: avatar, title: displayName ?? undefined }}
      width="w-[min(20rem,85vw)]"
      band={
        <div className="flex items-center gap-3 pl-2">
          {avatar}
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[14px] text-ink truncate">{displayName ?? "Your account"}</p>
            <p className="font-mono text-[12px] font-medium text-ink-muted uppercase tracking-[1px]">
              Account · {account}
            </p>
          </div>
        </div>
      }
    >
      {(close) => (
        <div className="mt-4 pt-4 border-t border-line">
          <AccountActions onNavigate={close} rowClassName="h-auto min-h-12 text-[16px]" />
        </div>
      )}
    </Sheet>
  )
}
