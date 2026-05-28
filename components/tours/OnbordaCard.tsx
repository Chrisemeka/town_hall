"use client"

import type { CardComponentProps } from "onborda/dist/types"
import { useOnborda } from "onborda"
import { X, ArrowLeft, ArrowRight } from "lucide-react"

export function OnbordaCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  arrow,
}: CardComponentProps) {
  const { closeOnborda } = useOnborda()
  const isLast = currentStep === totalSteps - 1
  const isFirst = currentStep === 0

  return (
    <div
      className="w-[min(340px,calc(100vw-24px))] bg-graphite border border-iron rounded-[12px] p-4 sm:p-5 text-chalk font-mono"
      style={{ boxShadow: "0 12px 32px rgba(0,0,0,0.6)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {step.icon && (
            <span className="text-[18px] leading-[22px] shrink-0" aria-hidden>
              {step.icon}
            </span>
          )}
          <h3 className="font-syne font-bold text-[16px] leading-[22px] text-chalk break-words">
            {step.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={closeOnborda}
          aria-label="Close tour"
          className="p-1 -m-1 text-ash hover:text-chalk transition-colors duration-150 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="font-mono text-[13px] leading-6 text-ash mb-5">
        {step.content}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] text-ash uppercase tracking-[1px]">
          {currentStep + 1} / {totalSteps}
        </span>

        <div className="flex items-center gap-2">
          {!isFirst && (
            <button
              type="button"
              onClick={prevStep}
              className="h-8 px-3 inline-flex items-center gap-1.5 rounded-[8px] border border-iron text-ash hover:text-chalk hover:border-ash transition-colors duration-150 font-mono text-[12px]"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          )}

          {isLast ? (
            <button
              type="button"
              onClick={closeOnborda}
              className="h-8 px-3 inline-flex items-center gap-1.5 rounded-[8px] bg-voltage text-obsidian hover:bg-voltage-dark transition-colors duration-150 font-mono font-medium text-[12px]"
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              onClick={nextStep}
              className="h-8 px-3 inline-flex items-center gap-1.5 rounded-[8px] bg-voltage text-obsidian hover:bg-voltage-dark transition-colors duration-150 font-mono font-medium text-[12px]"
            >
              Next <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {arrow}
    </div>
  )
}
