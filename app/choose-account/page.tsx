import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { accountTypesFor } from "@/lib/auth"
import { createAccount, switchAccount } from "@/actions/accounts"
import { SetupShell } from "@/components/setup/SetupShell"
import { StepIndicator } from "@/components/setup/StepIndicator"
import { setupStages } from "@/lib/setup"
import { RoleCards } from "@/components/setup/RoleCards"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Choose your account — Twnhall" }

export default async function ChooseAccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("role, accepted_terms_at")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role === "admin") redirect("/admin")

  const held = await accountTypesFor(user.id)
  const isFirstChoice = held.length === 0

  /*
   * This page is not only a setup step.
   *
   * It lives in SHARED_PREFIXES, is reachable at any time, and is how an
   * existing verified user adds or switches a role. Telling a two-year-old
   * account that it is "setting up" — and showing it progress through a
   * journey it is not on — would be a lie the shell tells on its behalf.
   *
   * So the indicator and the context line are conditional on this being the
   * first choice. One component, two honest modes.
   */
  const bar = isFirstChoice
    ? setupStages({
        termsAcceptedAt: profile?.accepted_terms_at ?? null,
        role: null,
        hasAccount: false,
        verified: false,
      })
    : null

  return (
    <SetupShell
      context={isFirstChoice ? "Setting up your account" : "Add a role"}
      width="wide"
      indicator={bar ? <StepIndicator bar={bar} /> : undefined}
    >
      <div className="mb-10">
        <h1 className="font-syne font-bold text-[28px] leading-9 lg:text-[32px] lg:leading-10 tracking-[-0.5px] text-ink">
          {isFirstChoice ? "Builder or Tester?" : "You can hold both."}
        </h1>
        <p className="font-sans text-[14px] leading-7 text-ink mt-3 max-w-[560px]">
          These are two separate accounts, not two modes of one profile. Each has
          its own dashboard and its own history. You can create the other one
          later from Settings — nothing is locked in.
        </p>
      </div>

      {/* The server decides create vs switch per card; the client only holds
          the one pending state that has to lock both. */}
      <RoleCards
        held={held}
        actions={{
          builder: held.includes("builder")
            ? switchAccount.bind(null, "builder")
            : createAccount.bind(null, "builder"),
          tester: held.includes("tester")
            ? switchAccount.bind(null, "tester")
            : createAccount.bind(null, "tester"),
        }}
      />
    </SetupShell>
  )
}
