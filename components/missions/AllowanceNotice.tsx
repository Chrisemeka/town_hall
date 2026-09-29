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

  let body: React.ReactNode
  if (total === 0) {
    body = (
      <>
        You have no reports available, so publishing will keep this as a draft. {earn} to earn
        one, or{" "}
        <a href={mailto("Twnhall Pro")} className={LINK_INLINE}>
          get in touch about Pro
        </a>
        .
      </>
    )
  } else if (activeMissions >= activeLimit) {
    body = (
      <>
        You have {activeMissions} active missions, the most your plan allows. Close one to
        publish another.
      </>
    )
  } else if (total < testersPerMission) {
    body = (
      <>
        You have {total} {total === 1 ? "report" : "reports"} available, so this mission opens
        to {total} {total === 1 ? "tester" : "testers"}. {earn} to earn more.
      </>
    )
  } else {
    body = <>You have {total} reports available. Publishing opens this mission to {testersPerMission} testers.</>
  }

  return <p className="font-mono text-[12px] text-ink leading-5">{body}</p>
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
