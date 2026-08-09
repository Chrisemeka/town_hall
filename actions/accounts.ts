"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { accountTypesFor } from "@/lib/auth"
import { ACCOUNT_COOKIE, homeFor, type AccountType } from "@/lib/access"

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
 * makes it active, and drops them into that account's home.
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
  const { error } = await admin
    .from("accounts")
    .upsert({ user_id: user.id, type }, { onConflict: "user_id,type", ignoreDuplicates: true })

  if (error) {
    console.error("[createAccount] insert failed:", error.message)
    throw new Error("Could not create that account. Please try again.")
  }

  await setActive(type)
  redirect(homeFor(type))
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

  const types = await accountTypesFor(user.id)
  if (!types.includes(type)) throw new Error("You don't have a " + type + " account.")

  await setActive(type)
  redirect(homeFor(type))
}
