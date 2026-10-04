import Link from "next/link"
import { LINK_INLINE } from "@/components/public/prose"
import { mailto } from "@/lib/contact"
import type { AllowanceView } from "@/lib/allowanceDb"

/**
 * What publishing will do, said where the builder is about to do it. The only
 * place the balance appears: /settings keeps its no-meter rule.
 *
 * The capped line is the free tier's whole growth mechanism, said at the
 * moment it is relevant — so it points at testing, not at Pro. Only an empty
 * balance offers both. There is no checkout; Pro is a conversation.
 */
export function AllowanceNotice({ view }: { view: AllowanceView }) {
  const { total, testersPerMission, activeMissions, activeLimit } = view

  const earn = (
    <Link href="/choose-account" className={LINK_INLINE}>
      Write a report for someone else
    </Link>
  )

  // Each case says what publishing reserves and what it leaves, not just the
  // balance: "3 available" read as a per-mission number, and a builder whose
  // second mission stayed a draft took it for a one-mission limit.
  const reports = (n: number) => `${n} ${n === 1 ? "report" : "reports"}`
  const slots = `${activeMissions} of ${activeLimit} active missions in use.`

  let body: React.ReactNode
  if (total === 0) {
    body = (
      <>
        You have no reports available — each live mission holds one per tester it is open to.
        Publishing will keep this as a draft. {earn} to earn one, close a live mission to get its
        unused reports back, or{" "}
        <a href={mailto("Twnhall Pro")} className={LINK_INLINE}>
          get in touch about Pro
        </a>
        . {slots}
      </>
    )
  } else if (activeMissions >= activeLimit) {
    body = (
      <>
        You have {activeMissions} active missions, the most your plan allows. Close one to
        publish another.
      </>
    )
  } else if (total <= testersPerMission) {
    // Spends the whole balance — say so, or the next mission's draft is a surprise.
    body = (
      <>
        You have {reports(total)} available. Publishing reserves {total === 1 ? "it" : `all ${total}`}{" "}
        — one per tester — so this mission opens to {total} {total === 1 ? "tester" : "testers"} and
        your next one waits until you earn more. {earn} to earn one. {slots}
      </>
    )
  } else {
    body = (
      <>
        You have {reports(total)} available. Publishing reserves {testersPerMission}, one per
        tester, leaving {reports(total - testersPerMission)} for your next mission. {slots}
      </>
    )
  }

  // Empty or at the limit means publishing is refused, so it reads as an
  // error; a capped or full balance is information.
  const refused = total === 0 || activeMissions >= activeLimit
  return (
    <p
      role={refused ? "alert" : undefined}
      className={`font-mono text-[12px] leading-5 ${refused ? "text-danger-ink" : "text-ink"}`}
    >
      {body}
    </p>
  )
}

/**
 * On a live mission that opened with fewer testers than the plan allows,
 * because that was the balance. Derived from testers_needed, not a query
 * param, so it is true for as long as the mission is live.
 */
export function CappedNotice({ testers, max }: { testers: number; max: number }) {
  if (testers >= max) return null
  return (
    <p className="font-mono text-[13px] text-ink leading-5 mt-4 max-w-3xl">
      This mission is open to {testers} {testers === 1 ? "tester" : "testers"} — the reports you
      had available.{" "}
      <Link href="/choose-account" className={LINK_INLINE}>
        Write a report for someone else
      </Link>{" "}
      to earn more.
    </p>
  )
}
