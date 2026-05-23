import { Mail, ShieldCheck } from "lucide-react"
import { createAdminClient } from "@/lib/supabase/admin"
import { BroadcastForm } from "@/components/admin/BroadcastForm"

export const metadata = { title: "Email Broadcast — Admin · Townhall" }

export default async function AdminEmailPage() {
  const admin = createAdminClient()
  const { count } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .not("email", "is", null)

  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-8 md:py-10">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="w-4 h-4 text-voltage" />
        <p className="font-mono text-[11px] font-medium text-voltage uppercase tracking-[1px]">
          Admin · Email
        </p>
      </div>
      <h1 className="font-syne font-bold text-[26px] leading-[32px] sm:text-[32px] sm:leading-[38px] md:text-[36px] md:leading-[40px] tracking-[-0.5px] text-chalk mb-1">
        Send a broadcast
      </h1>
      <p className="font-mono text-[14px] text-ash mb-8">
        Compose a message to a single user or every account on TownHall. Sent
        via Resend from the TownHall admin sender.
      </p>

      <div
        className="bg-graphite border border-iron rounded-[12px] overflow-hidden"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
      >
        <div className="px-5 py-4 border-b border-iron flex items-center gap-2">
          <Mail className="w-4 h-4 text-voltage" />
          <h2 className="font-syne font-bold text-[16px] text-chalk">
            Compose
          </h2>
          <span className="ml-auto font-mono text-[11px] text-ash">
            {count ?? 0} reachable user{count === 1 ? "" : "s"}
          </span>
        </div>
        <div className="p-5">
          <BroadcastForm totalUsers={count ?? 0} />
        </div>
      </div>
    </div>
  )
}
