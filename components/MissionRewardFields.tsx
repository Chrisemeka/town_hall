"use client"

import { MISSION_PAYOUT_MAX } from "@/lib/validation/schemas"

/**
 * Payout, shared by the create and edit mission forms so the two can't drift.
 *
 * Category used to live here as a free-text tag. It moved to TestCaseEditor
 * when it became the test-category enum — it is now the first question of the
 * test case, not a reward field.
 */
export function MissionRewardFields({
  defaultPayout,
  payoutError,
}: {
  defaultPayout?: number
  payoutError?: string[]
}) {
  const inputClass = (hasError?: string[]) =>
    [
      "h-10 w-full bg-obsidian border rounded-[8px] px-4 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none transition-colors duration-150",
      hasError?.length ? "border-ember" : "border-iron focus:border-voltage",
    ].join(" ")

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="payout" className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
          Payout <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-[14px] text-ash pointer-events-none">
            $
          </span>
          <input
            id="payout"
            name="payout"
            type="number"
            min={0}
            max={MISSION_PAYOUT_MAX}
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={defaultPayout ?? ""}
            className={inputClass(payoutError) + " pl-7"}
          />
        </div>
        {payoutError?.length ? (
          <p className="font-mono text-[12px] text-ember">{payoutError[0]}</p>
        ) : (
          <p className="font-mono text-[12px] text-ash">Leave blank for an unpaid mission.</p>
        )}
      </div>

    </div>
  )
}
