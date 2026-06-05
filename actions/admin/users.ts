"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"

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

  revalidatePath("/admin/users")
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

  revalidatePath("/admin/users")
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

  revalidatePath("/admin/users")
  revalidatePath("/admin")
}
