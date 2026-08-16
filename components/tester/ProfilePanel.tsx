import { Check, Plus, Star } from "lucide-react"
import { formatMoney, rankFor, type Earnings } from "@/lib/tester"

export type TrustSignal = { label: string; earned: boolean }

export function ProfilePanel({
  earnings,
  avgRating,
  signals,
}: {
  earnings: Earnings
  avgRating: number | null
  signals: TrustSignal[]
}) {
  const rank = rankFor(earnings.completed)

  return (
    <aside
      className="bg-graphite border border-iron rounded-[12px] p-6 flex flex-col gap-6"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
    >
      <p className="font-mono text-[11px] font-medium text-ash uppercase tracking-[1px]">
        Earnings &amp; Reputation
      </p>

      {/* Balance */}
      <div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-syne font-bold text-[40px] leading-none tracking-[-1px] text-chalk">
            {formatMoney(earnings.available)}
          </span>
          <span className="font-mono text-[13px] text-ash">available</span>
        </div>
        <p className="font-mono text-[12px] text-ash mt-2">
          {formatMoney(earnings.pendingApproval)} pending approval
          {earnings.lifetimePaid > 0 && ` · ${formatMoney(earnings.lifetimePaid)} paid out`}
        </p>

        {/* ponytail: payout rails don't exist yet, so Withdraw is inert rather
            than flipping approved -> paid. That transition belongs to a payout
            process, not to the tester clicking a button. */}
        <button
          type="button"
          disabled
          title="Payouts aren't live yet — your approved balance is being held."
          className="mt-4 w-full h-11 rounded-[8px] bg-voltage text-obsidian font-mono font-medium text-[14px] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Withdraw
        </button>
        <p className="font-mono text-[11px] text-ash/70 mt-2 text-center">
          Payouts aren&apos;t live yet.
        </p>
      </div>

      <div className="h-px bg-iron" />

      {/* Reputation */}
      <div className="flex flex-col gap-3">
        <Row label="Rank" value={rank.current.name} />
        <Row
          label="Average rating"
          value={
            avgRating === null ? (
              <span className="text-ash">—</span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5" style={{ fill: "#E8FF47", color: "#E8FF47" }} />
                {avgRating.toFixed(1)}
              </span>
            )
          }
        />
        <Row label="Missions completed" value={String(earnings.completed)} />
      </div>

      {/* Progress to next rank */}
      {rank.next && (
        <div>
          <div className="h-1.5 rounded-full bg-iron overflow-hidden">
            <div
              className="h-full bg-voltage rounded-full transition-[width] duration-300"
              style={{ width: `${Math.round(rank.progress * 100)}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 font-mono text-[11px] tracking-[0.5px] text-ash">
            <span className="uppercase truncate">
              {rank.toNext} more to {rank.next.name}
            </span>
            <span className="text-voltage shrink-0">
              {earnings.completed}/{rank.next.at}
            </span>
          </div>
        </div>
      )}

      <div className="h-px bg-iron" />

      {/* Trust signals */}
      <div className="flex flex-col gap-3">
        <p className="font-mono text-[11px] font-medium text-ash uppercase tracking-[1px]">
          Trust Signals
        </p>
        <div className="flex flex-wrap gap-2">
          {signals.map(({ label, earned }) => (
            <span
              key={label}
              className={[
                "font-mono text-[12px] px-2.5 py-1.5 rounded-[8px] border flex items-center gap-1.5",
                earned
                  ? "text-mint border-mint/25 bg-mint/10"
                  : "text-ash border-iron bg-obsidian",
              ].join(" ")}
            >
              {earned ? <Check className="w-3 h-3" strokeWidth={3} /> : <Plus className="w-3 h-3" />}
              {label}
            </span>
          ))}
        </div>
      </div>
    </aside>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-mono text-[12px] text-ash">{label}</span>
      <span className="font-mono text-[14px] font-medium text-chalk">{value}</span>
    </div>
  )
}
