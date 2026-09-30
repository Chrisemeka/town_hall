"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { accountRowsFor } from "@/lib/auth"
import { grantSignup } from "@/lib/allowanceDb"
import { ACCOUNT_COOKIE, landingFor, type AccountType } from "@/lib/access"

const VALID: AccountType[] = ["builder", "tester"]

async function setActive(type: AccountType) {
  const store = await cookies()
  store.set(ACCOUNT_COOKIE, type, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
}

/**
 * Creates the account record for `type` if this person doesn't hold one yet,
 * makes it active, and sends them where that account belongs — its home, or
 * /verify/[role] while the gate is closed, which for a new account it always is.
 *
 * Idempotent — the unique (user_id, type) constraint means picking a type you
 * already hold is just a switch. Uses the service-role client because
 * `accounts` has RLS on with no policies.
 */
export async function createAccount(type: AccountType) {
  if (!VALID.includes(type)) throw new Error("Unknown account type.")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const admin = createAdminClient()
  const { data: created, error } = await admin
    .from("accounts")
    .upsert({ user_id: user.id, type }, { onConflict: "user_id,type", ignoreDuplicates: true })
    .select("id")

  if (error) {
    console.error("[createAccount] insert failed:", error.message)
    throw new Error("Could not create that account. Please try again.")
  }

  // The signup grant, once per profile. `created` is empty when the account
  // already existed; when it is new, the unique index on report_ledger still
  // refuses a second grant — a person's second account, or one re-created.
  if (created?.[0]) await grantSignup(user.id, created[0].id as string)

  // Read back rather than assumed unverified: picking a type already held and
  // verified is a switch, and belongs at home.
  const rows = await accountRowsFor(user.id)
  const verified = !!rows.find((a) => a.type === type)?.verification_completed_at

  await setActive(type)
  redirect(landingFor(type, verified))
}

/**
 * Switches which of this person's existing accounts is active. Will not create
 * one — a type the user doesn't hold is rejected rather than silently granted,
 * so this can never widen access.
 */
export async function switchAccount(type: AccountType) {
  if (!VALID.includes(type)) throw new Error("Unknown account type.")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const row = (await accountRowsFor(user.id)).find((a) => a.type === type)
  if (!row) throw new Error("You don't have a " + type + " account.")

  await setActive(type)
  redirect(landingFor(type, !!row.verification_completed_at))
}
