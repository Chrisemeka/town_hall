import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { accountTypesFor } from "@/lib/auth"
import { createAccount, switchAccount } from "@/actions/accounts"
import { SetupShell } from "@/components/setup/SetupShell"
import { StepIndicator } from "@/components/setup/StepIndicator"
import { setupStages } from "@/lib/setup"
import { Hammer, FlaskConical, ArrowRight } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Choose your account — Twnhall" }

const ROLES = [
  {
    type: "builder" as const,
    icon: Hammer,
    label: "I'm a Builder",
    blurb: "Submit products for real people to test, write missions, and review the feedback that comes back.",
    bullets: ["Submit projects", "Write missions", "Review + rate submissions"],
  },
  {
    type: "tester" as const,
    icon: FlaskConical,
    label: "I'm a Tester",
    blurb: "Pick up missions, work through the builder's test case step by step, and file feedback they have to answer.",
    bullets: ["Browse open missions", "File a step-by-step audit log", "See what the builder did with it"],
  },
]

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {ROLES.map(({ type, icon: Icon, label, blurb, bullets }) => {
              const alreadyHeld = held.includes(type)
              const action = alreadyHeld
                ? switchAccount.bind(null, type)
                : createAccount.bind(null, type)

              return (
                <form key={type} action={action}>
                  <button
                    type="submit"
                    className="group w-full h-full text-left bg-surface-raised border border-line rounded-[12px] p-6 flex flex-col hover:border-accent-ink transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-[8px] bg-accent-ink/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-accent-ink" strokeWidth={1.8} />
                      </div>
                      {alreadyHeld && (
                        <span className="font-mono text-[12px] uppercase tracking-[1px] text-accent-ink">
                          You have this
                        </span>
                      )}
                    </div>

                    <h2 className="font-syne font-bold text-[20px] text-ink mb-2">
                      {label}
                    </h2>
                    <p className="font-sans text-[13px] leading-6 text-ink mb-5">
                      {blurb}
                    </p>

                    <ul className="flex flex-col gap-1.5 mb-6">
                      {bullets.map((b) => (
                        <li key={b} className="font-mono text-[12px] text-ink-muted flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-accent-ink shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>

                    <span className="mt-auto font-mono text-[13px] font-medium text-ink flex items-center gap-1.5 group-hover:text-accent-ink transition-colors duration-150">
                      {alreadyHeld ? "Continue" : "Create this account"}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                </form>
              )
            })}
      </div>
    </SetupShell>
  )
}
