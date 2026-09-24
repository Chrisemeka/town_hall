"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import type { AccountType } from "@/lib/access"
import { planIdSchema } from "@/lib/validation/schemas"

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

/**
 * Records which plan an account is on.
 *
 * This is the whole manual upgrade path: there is no checkout, so a sale is
 * recorded here or it is not recorded at all. Without it the plan_id column
 * would be decorative.
 *
 * NOT moderation, so it deliberately does not call ensureModerable(): setting
 * an admin's own plan, or another admin's, is a billing fact rather than an
 * action taken against someone. The requireAdmin() guard is the whole
 * authorisation question here.
 *
 * Per-role by construction — `.eq("type", role)` — because plan_id lives on
 * accounts. Upgrading somebody's builder account must not touch their tester
 * one.
 */
export async function setUserPlan(
  targetUserId: string,
  role: AccountType,
  planId: string,
) {
  const { admin } = await requireAdmin()

  // The column has no CHECK constraint, so this parse is the only thing
  // between a typo and the database. Zod at the boundary, per CLAUDE.md.
  const parsed = planIdSchema.safeParse(planId)
  if (!parsed.success) throw new Error("Unknown plan.")

  const { error, data } = await admin
    .from("accounts")
    // Explicit single-column write: this runs as service role, so anything
    // reaching the UPDATE is written.
    .update({ plan_id: parsed.data })
    .eq("user_id", targetUserId)
    .eq("type", role)
    .select("id")

  if (error) throw new Error(error.message)
  if ((data?.length ?? 0) === 0) {
    throw new Error(`That user has no ${role} account to put on a plan.`)
  }

  revalidatePath("/admin/users")
  revalidatePath("/settings")
}
