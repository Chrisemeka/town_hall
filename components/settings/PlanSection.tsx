import Link from "next/link"
import { Check } from "lucide-react"
import { cancelSubscription, scheduleDowngrade, startSubscription } from "@/actions/billing"
import { otherPlans, planFor, priceLine, type Plan } from "@/lib/plans"
import { billingDay, formatNgn, graceEnd, lagosDate, type PlanBilling } from "@/lib/subscriptions"
import type { PlanId } from "@/lib/vocabulary"
import { BillingDialog } from "@/components/settings/BillingDialog"
import { SettingsSection } from "@/components/settings/SettingsSection"

const LINK =
  "text-accent-ink underline underline-offset-2 hover:no-underline rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"

/** What ?billing= says when Paystack sends someone back. Anything else says nothing. */
const RETURN_NOTICES: Record<string, string> = {
  started: "Your plan has started. We've emailed you the details.",
  pending: "We're confirming your payment. It shows here within a minute.",
  not_completed: "No payment was taken.",
  failed: "We couldn't reach Paystack, and no payment was taken. Try again in a minute.",
  review: "Your payment arrived, but we need to check it before it changes your plan. We'll email you.",
  card_failed: "We couldn't open Paystack's card page just now. Try again in a minute.",
  refunding: "You already had this plan, so nothing changed and we're refunding that payment in full. We'll email you when the refund starts.",
}

/** Paystack's own page, fetched fresh on every click (SPEC-paystack-plan-changes §5). A link, not a form: nothing is sent from here. */
const UpdateCard = () => (
  <a
    href="/settings/billing/card"
    className="inline-flex h-12 lg:h-11 w-full medium:w-auto items-center justify-center px-6 rounded-[8px] border border-ink-muted text-ink font-mono font-medium text-[14px] hover:bg-ink/[0.06] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
  >
    Update card
  </a>
)

const PolicyLink = () => (
  <Link href="/refunds" className={LINK}>
    Billing and Refund Policy
  </Link>
)

function SubscribeDialog({ plan, now }: { plan: Plan; now: Date }) {
  const amount = plan.price!.naira
  return (
    <BillingDialog
      label={`Subscribe — ${priceLine(plan)}`}
      title={`${plan.name}, ${amount} a month.`}
      confirm="Continue to payment"
      dismiss="Not now"
      action={startSubscription.bind(null, plan.id as "starter" | "pro", "new")}
    >
      <p>
        You pay {amount} today, then {amount} on the {billingDay(now)} of every month until you cancel. Cancel any time in
        Settings → Plan: you keep {plan.name} until the end of the month you&apos;ve paid for, and you won&apos;t be charged again.
      </p>
      <p>
        Payment is by card, through Paystack. <PolicyLink />
      </p>
    </BillingDialog>
  )
}

/**
 * Starter → Pro, now (SPEC-paystack-plan-changes §2.2). The refund is an
 * estimate ("about"): the database works out the real one from the moment
 * Paystack takes the Pro payment, and nothing is refunded until it has.
 */
function UpgradeDialog({ now, estimate, attention }: { now: Date; estimate: { refundNgn: number; days: number } | null; attention: boolean }) {
  const pro = planFor("pro")
  const amount = pro.price!.naira
  const refund = attention
    ? "There's no refund, because your last Starter payment didn't go through."
    : estimate && estimate.refundNgn > 0
      ? `Once your Pro payment has gone through, we refund about ${formatNgn(estimate.refundNgn)}, for the ${estimate.days} days of Starter you won't use, to the card you paid with. We'll email you when the refund starts and when it's done; your bank may take up to 10 business days to show it.`
      : "There are no unused Starter days to refund."
  return (
    <BillingDialog
      label="Upgrade to Pro"
      title={`Upgrade to Pro — ${amount} a month.`}
      confirm="Continue to payment"
      dismiss="Not now"
      action={startSubscription.bind(null, "pro", "upgrade")}
    >
      <p>
        You pay {amount} now and Pro starts as soon as the payment goes through. Your reports for this month go up to Pro&apos;s{" "}
        {pro.monthlyReports}, counting any you&apos;ve already used.
      </p>
      <p>{refund}</p>
      <p>Pro renews on the {billingDay(now)} of every month until you cancel.</p>
      <p>
        If the payment doesn&apos;t go through, nothing changes: you stay on Starter. <PolicyLink />
      </p>
    </BillingDialog>
  )
}

/** Pro → Starter at the next billing date (SPEC-paystack-plan-changes §4). */
function SwitchDialog({ periodEnd, cardLast4, now }: { periodEnd: string | null; cardLast4: string | null; now: Date }) {
  const on = periodEnd ? lagosDate(periodEnd) : "the end of this month"
  return (
    <BillingDialog label="Switch to Starter" title="Switch to Starter?" confirm="Switch to Starter" dismiss="Keep Pro" action={scheduleDowngrade}>
      <p>
        You keep Pro until {on}. From {on}, Starter is {planFor("starter").price!.naira} a month
        {cardLast4 ? ` on the card ending ${cardLast4}` : ""}, renewing on the {periodEnd ? billingDay(new Date(periodEnd)) : billingDay(now)} until you
        cancel. There&apos;s no refund for the rest of this Pro month: you keep Pro until it ends.
      </p>
    </BillingDialog>
  )
}

/** `ended`: a failed payment, so the paid period is already over and Cancel ends the plan now. */
function CancelDialog({ plan, periodEnd, ended = false }: { plan: Plan; periodEnd: string | null; ended?: boolean }) {
  return (
    <BillingDialog
      label="Cancel plan"
      title={`Cancel ${plan.name}?`}
      confirm="Cancel plan"
      dismiss={`Keep ${plan.name}`}
      confirmVariant="destructive"
      action={cancelSubscription}
    >
      <p>
        You won&apos;t be charged again.{" "}
        {ended ? (
          <>Your last payment didn&apos;t go through, so {plan.name} ends now and your account moves to Community.</>
        ) : (
          <>
            You keep {plan.name}
            {periodEnd ? ` until ${lagosDate(periodEnd)}` : ""}, then your account moves to Community.
          </>
        )}{" "}
        Test cases already live keep their testers, and reports you&apos;ve earned stay yours.
      </p>
    </BillingDialog>
  )
}

/** The account's state and its controls, exactly the ones the state allows (SPEC-paystack-subscriptions §12). */
function CurrentBilling({ plan, billing, now, upgrade }: { plan: Plan; billing: PlanBilling; now: Date; upgrade: { refundNgn: number; days: number } | null }) {
  // Starter on a Paystack subscription can move up now, whether renewing, cancelled or failed.
  const canUpgrade = plan.id === "starter" && billing.configured
  const upgradeButton = canUpgrade ? <UpgradeDialog now={now} estimate={upgrade} attention={billing.kind === "attention"} /> : null
  const line = "font-mono text-[14px] leading-6 text-ink"
  const until = billing.periodEnd ? lagosDate(billing.periodEnd) : null
  const card = billing.cardLast4 ? ` · card ending ${billing.cardLast4}` : ""

  if (billing.kind === "manual") {
    return <p className={line}>{plan.name} — arranged directly{until ? `, ends on ${until}` : ""}.</p>
  }
  if (billing.kind === "cancelled") {
    return (
      <div className="flex flex-col gap-4">
        <p className={line}>{plan.name}{until ? ` until ${until}` : ""}. You won&apos;t be charged again.</p>
        {upgradeButton && <div>{upgradeButton}</div>}
      </div>
    )
  }
  if (billing.kind === "attention") {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="font-sans text-[14px] leading-6 text-danger-ink">
          Your {plan.name} payment{until ? ` on ${until}` : ""} didn&apos;t go through.
          {billing.periodEnd ? ` Pay by ${lagosDate(graceEnd(billing.periodEnd))} to keep ${plan.name}.` : ""}
        </p>
        <div className="flex flex-col medium:flex-row gap-4">
          <BillingDialog
            label="Pay now"
            variant="primary"
            title={`Pay for ${plan.name}`}
            confirm="Continue to payment"
            dismiss="Not now"
            action={startSubscription.bind(null, plan.id as "starter" | "pro", "resubscribe")}
          >
            <p>
              You pay {plan.price!.naira} today, and it renews on the same date every month from now until you cancel. Payment is by
              card, through Paystack. <PolicyLink />
            </p>
          </BillingDialog>
          {upgradeButton}
          <UpdateCard />
          <CancelDialog plan={plan} periodEnd={billing.periodEnd} ended={!!billing.periodEnd && Date.parse(billing.periodEnd) <= now.getTime()} />
        </div>
      </div>
    )
  }
  if (billing.kind === "renewing") {
    return (
      <div className="flex flex-col gap-4">
        <p className={line}>
          {plan.name} — renews{until ? ` on ${until}` : " monthly"} · {formatNgn(billing.amountNgn ?? plan.amountNgn ?? 0)}{card}
        </p>
        <div className="flex flex-col medium:flex-row gap-4">
          {upgradeButton}
          {plan.id === "pro" && billing.configured && <SwitchDialog periodEnd={billing.periodEnd} cardLast4={billing.cardLast4} now={now} />}
          <UpdateCard />
          <CancelDialog plan={plan} periodEnd={billing.periodEnd} />
        </div>
      </div>
    )
  }
  if (billing.kind === "downgrading") {
    return (
      <div className="flex flex-col gap-4">
        <p className={line}>
          {plan.name}{until ? ` until ${until}` : ""}, then Starter at {planFor("starter").price!.naira} a month.
        </p>
        <div>
          <CancelDialog plan={plan} periodEnd={billing.periodEnd} />
        </div>
      </div>
    )
  }
  return null
}

/**
 * Which plan this account is on, what the other tiers include, and the controls
 * its subscription state allows. A builder on a recurring charge must be able
 * to see when and how to stop it (Paystack MSA, Section B), so the renewal date,
 * amount and card are here.
 *
 * It still shows no usage. No "3 of 5 reports used" and no meter: the balance is
 * shown where it is spent, beside the publish button
 * (components/missions/AllowanceNotice.tsx). No tier is "best value".
 */
export function PlanSection({
  planId,
  billing,
  now,
  notice,
  upgrade = null,
  refunds = [],
}: {
  planId: PlanId
  billing: PlanBilling
  now: Date
  notice?: string
  upgrade?: { refundNgn: number; days: number } | null
  refunds?: string[]
}) {
  const current = planFor(planId)
  const others = otherPlans(planId)
  const canSubscribe = billing.kind === "none" && billing.configured
  const message = notice ? RETURN_NOTICES[notice] : undefined

  return (
    <SettingsSection
      title="Plan"
      description="What your account includes, and what the other tiers do."
    >
      {billing.testMode && (
        <p className="inline-block mb-4 rounded-[4px] border border-ink-muted px-2 py-1 font-mono text-[12px] text-ink">
          Test mode — no real money moves
        </p>
      )}
      {refunds.length > 0 && (
        <ul className="mb-6 flex flex-col gap-2 rounded-[8px] border border-line p-4 font-sans text-[14px] leading-6 text-ink">
          {refunds.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {message && (
        <p role="status" className="mb-6 rounded-[8px] border border-line p-4 font-sans text-[14px] leading-6 text-ink">
          {message}
        </p>
      )}

      {/* Stacked below 1024: inside the 640px column two cards are ~264px,
          too narrow for a price line and a five-line list. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2 rounded-[12px] border border-accent-ink p-5 medium:p-6">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h3 className="font-syne font-bold text-[18px] text-ink">
              {current.name}
            </h3>
            {/* The current plan is named in words, not just outlined — colour
                and a border are never the only signal (Design.md §10). */}
            <span className="font-mono text-[12px] uppercase tracking-[0.5px] text-accent-ink">
              Your plan
            </span>
          </div>
          <p className="font-mono text-[14px] text-ink mt-1">{priceLine(current)}</p>
          {billing.kind !== "none" && (
            <div className="mt-4">
              <CurrentBilling plan={current} billing={billing} now={now} upgrade={upgrade} />
            </div>
          )}
          <p className="font-sans text-[14px] leading-6 text-ink mt-3">
            {current.summary}
          </p>
          <ul className="mt-5 flex flex-col gap-2">
            {current.includes.map((line) => (
              <li key={line} className="flex gap-2 font-sans text-[14px] leading-6 text-ink">
                <Check size={14} aria-hidden="true" className="mt-1.5 shrink-0 text-accent-ink" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        {/* The other two side by side from 1024, under the one you are on,
            so "Your plan" is always the first thing in the tab. */}
        {others.map((other) => (
          <div key={other.id} className="rounded-[12px] border border-line p-5 medium:p-6">
            <h3 className="font-syne font-bold text-[18px] text-ink">{other.name}</h3>
            <p className="font-mono text-[14px] text-ink mt-1">{priceLine(other)}</p>
            <p className="font-sans text-[14px] leading-6 text-ink mt-3">
              {other.summary}
            </p>
            <ul className="mt-5 flex flex-col gap-2">
              {other.includes.map((line) => (
                <li key={line} className="flex gap-2 font-sans text-[14px] leading-6 text-ink">
                  <Check size={14} aria-hidden="true" className="mt-1.5 shrink-0 text-ink-muted" />
                  {line}
                </li>
              ))}
            </ul>
            {canSubscribe && other.price && (
              <div className="mt-5">
                <SubscribeDialog plan={other} now={now} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-line">
        {planId !== "community" && (
          <p className="font-sans text-[14px] leading-6 text-ink mb-4">
            {billing.kind === "manual"
              ? "A plan arranged directly doesn't renew. It ends on its end date."
              : billing.kind === "cancelled"
                ? "This plan won't renew."
                : "Your plan renews every month until you cancel."}{" "}
            Cancelling, refunds, and reports testers didn&apos;t deliver:{" "}
            <Link href="/refunds" className={LINK}>
              Billing and refunds
            </Link>
            .
          </p>
        )}
        <p className="font-sans text-[14px] leading-6 text-ink">
          {planId !== "community"
            ? "Need to change something about your plan? Tell us and we'll sort it."
            : canSubscribe
              ? "Questions about a plan first? Tell us what you're building."
              : "Hitting your limit, or want to skip the testing side? Get in touch."}
        </p>
        <Link
          href="/contact"
          className="mt-4 inline-flex h-12 lg:h-11 w-full justify-center medium:w-auto px-6 items-center rounded-[8px] border border-ink-muted text-ink font-mono font-medium text-[14px] hover:bg-ink/[0.06] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
        >
          Get in touch
        </Link>
      </div>
    </SettingsSection>
  )
}
