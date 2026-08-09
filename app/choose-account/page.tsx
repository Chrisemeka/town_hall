import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { accountTypesFor } from "@/lib/auth"
import { createAccount, switchAccount } from "@/actions/accounts"
import { Logo } from "@/components/Logo"
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
    blurb: "Pick up missions, submit real feedback with proof, get paid, and build a reputation.",
    bullets: ["Browse open missions", "Submit feedback + screenshots", "Earn and build a rank"],
  },
]

export default async function ChooseAccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/")

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role === "admin") redirect("/admin")

  const held = await accountTypesFor(user.id)
  const isFirstChoice = held.length === 0

  return (
    <div className="min-h-screen bg-bone text-midnight font-mono flex flex-col selection:bg-voltage selection:text-obsidian">

      <header className="border-b border-midnight/10 bg-bone/85 backdrop-blur-md">
        <div className="max-w-[1128px] mx-auto px-6 h-[60px] flex items-center">
          <div className="flex items-center gap-2">
            <Logo size={40} />
            <span className="font-syne font-bold text-[18px] text-midnight">Twnhall</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[760px]">

          <p className="font-mono text-[12px] text-forest uppercase tracking-[1.5px] mb-3">
            {isFirstChoice ? "Pick how you'll use Twnhall" : "Add another account"}
          </p>
          <h1 className="font-syne font-bold text-[32px] leading-[40px] tracking-[-0.5px] text-midnight mb-3">
            {isFirstChoice ? "Builder or Tester?" : "You can hold both."}
          </h1>
          <p className="font-mono text-[14px] leading-7 text-midnight/70 mb-10 max-w-[560px]">
            These are two separate accounts, not two modes of one profile. Each has its own
            dashboard and its own history. You can create the other one later from Settings —
            nothing is locked in.
          </p>

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
                    className="group w-full h-full text-left bg-white border border-midnight/10 rounded-[12px] p-6 flex flex-col hover:border-forest transition-colors duration-150 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-[8px] bg-forest/10 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-forest" strokeWidth={1.8} />
                      </div>
                      {alreadyHeld && (
                        <span className="font-mono text-[11px] uppercase tracking-[1px] text-forest">
                          You have this
                        </span>
                      )}
                    </div>

                    <h2 className="font-syne font-bold text-[20px] text-midnight mb-2">
                      {label}
                    </h2>
                    <p className="font-mono text-[13px] leading-6 text-midnight/70 mb-5">
                      {blurb}
                    </p>

                    <ul className="flex flex-col gap-1.5 mb-6">
                      {bullets.map((b) => (
                        <li key={b} className="font-mono text-[12px] text-midnight/60 flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-forest shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>

                    <span className="mt-auto font-mono text-[13px] font-medium text-midnight flex items-center gap-1.5 group-hover:text-forest transition-colors duration-150">
                      {alreadyHeld ? "Continue" : "Create this account"}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                </form>
              )
            })}
          </div>

        </div>
      </main>
    </div>
  )
}
