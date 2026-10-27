"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import type { AccountType } from "@/lib/access"

async function ensureModerable(
  admin: ReturnType<typeof createAdminClient>,
  targetUserId: string,
  adminUserId: string,
) {
  if (targetUserId === adminUserId) throw new Error("You cannot moderate yourself.")

  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", targetUserId)
    .maybeSingle()

  if (target?.role === "admin") throw new Error("Cannot moderate another admin.")
}

const ALLOWED_SUSPEND_DAYS = [7, 30, 90] as const

export async function suspendUser(targetUserId: string, reason: string, durationDays: number) {
  const trimmed = reason.trim()
  if (trimmed.length < 3) throw new Error("Reason must be at least 3 characters.")
  if (trimmed.length > 500) throw new Error("Reason must be 500 characters or fewer.")
  if (!ALLOWED_SUSPEND_DAYS.includes(durationDays as 7 | 30 | 90)) {
    throw new Error("Invalid suspension duration.")
  }

  const { admin, adminUserId } = await requireAdmin()
  await ensureModerable(admin, targetUserId, adminUserId)

  const hours = durationDays * 24
  const { error: authErr } = await admin.auth.admin.updateUserById(targetUserId, {
    ban_duration: `${hours}h`,
  })
  if (authErr) throw new Error(authErr.message)

  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      moderation_status: "suspended",
      ban_reason: trimmed,
      banned_at: new Date().toISOString(),
      banned_by: adminUserId,
    })
    .eq("id", targetUserId)
  if (profileErr) throw new Error(profileErr.message)

  revalidatePath("/admin/accounts", "layout")
  revalidatePath("/admin")
}

export async function banUser(targetUserId: string, reason: string) {
  const trimmed = reason.trim()
  if (trimmed.length < 3) throw new Error("Reason must be at least 3 characters.")
  if (trimmed.length > 500) throw new Error("Reason must be 500 characters or fewer.")

  const { admin, adminUserId } = await requireAdmin()
  await ensureModerable(admin, targetUserId, adminUserId)

  // ~100 years — Supabase auth has no "permanent" flag, so a far-future
  // banned_until is the canonical pattern.
  const { error: authErr } = await admin.auth.admin.updateUserById(targetUserId, {
    ban_duration: "876000h",
  })
  if (authErr) throw new Error(authErr.message)

  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      moderation_status: "banned",
      ban_reason: trimmed,
      banned_at: new Date().toISOString(),
      banned_by: adminUserId,
    })
    .eq("id", targetUserId)
  if (profileErr) throw new Error(profileErr.message)

  revalidatePath("/admin/accounts", "layout")
  revalidatePath("/admin")
}

export async function reactivateUser(targetUserId: string) {
  const { admin, adminUserId } = await requireAdmin()
  await ensureModerable(admin, targetUserId, adminUserId)

  const { error: authErr } = await admin.auth.admin.updateUserById(targetUserId, {
    ban_duration: "none",
  })
  if (authErr) throw new Error(authErr.message)

  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      moderation_status: "active",
      ban_reason: null,
      banned_at: null,
      banned_by: null,
    })
    .eq("id", targetUserId)
  if (profileErr) throw new Error(profileErr.message)

  revalidatePath("/admin/accounts", "layout")
  revalidatePath("/admin")
}

/**
 * Applies a cohort change and logs it, in one transaction
 * (set_account_field). Plans no longer come through here: apply_subscription
 * (actions/admin/subscriptions.ts) is their one writer.
 */
async function setAccountField(
  admin: ReturnType<typeof createAdminClient>,
  adminUserId: string,
  targetUserId: string,
  role: AccountType,
  field: "cohort",
  value: string | null,
) {
  const { data, error } = await admin.rpc("set_account_field", {
    p_user_id: targetUserId,
    p_type: role,
    p_field: field,
    p_value: value,
    p_admin_id: adminUserId,
  })
  if (error) throw new Error(error.message)
  if (data === "no_account") throw new Error(`That user has no ${role} account.`)
  if (data !== "ok" && data !== "unchanged") throw new Error("Could not make that change.")
}

/**
 * Adds a tester to the paid cohort, or takes them out. Tester accounts only —
 * membership is a property of the tester role. Leaving records a leave date
 * rather than clearing the join date, so a month already paid never changes.
 */
export async function setCohortMember(targetUserId: string, member: boolean) {
  const { admin, adminUserId } = await requireAdmin()
  await setAccountField(admin, adminUserId, targetUserId, "tester", "cohort", member ? "member" : "not_member")
  revalidatePath("/admin/accounts", "layout")
  revalidatePath("/admin/payouts")
}
