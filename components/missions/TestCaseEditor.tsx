"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react"
import { TEST_TEMPLATES, instantiate, templatesFor } from "@/lib/testTemplates"
import {
  DEVICE_TARGETS,
  TEST_CATEGORIES,
  TEST_CATEGORY_BLURBS,
  deviceTargetLabel,
  testCategoryLabel,
  type DeviceTarget,
  type TestCategory,
} from "@/lib/vocabulary"
import {
  STEP_ACTION_MAX,
  STEP_EXPECTED_MAX,
  TEST_STEPS_MAX,
  type TestStep,
} from "@/lib/validation/schemas"

/**
 * The test-case half of both mission forms — category, template, steps, device.
 *
 * One component used by AddMissionForm and EditMissionForm, the way
 * MissionRewardFields already is. The two forms were near-duplicates before
 * this; giving each its own copy of a step editor is how they would have
 * genuinely diverged.
 *
 * Owns its state and mirrors it into hidden inputs, so the parent forms keep
 * submitting plain FormData and neither has to know how a step is shaped.
 */
export function TestCaseEditor({
  initialCategory,
  initialDeviceTarget,
  initialSteps,
  initialTemplateId,
  errors,
  onDirtyChange,
}: {
  initialCategory: string | null
  initialDeviceTarget: string
  initialSteps: TestStep[]
  initialTemplateId: string | null
  errors: Record<string, string[] | undefined>
  onDirtyChange?: (dirty: boolean) => void
}) {
  const [category, setCategory] = useState<TestCategory | "">(
    (TEST_CATEGORIES as readonly string[]).includes(initialCategory ?? "")
      ? (initialCategory as TestCategory)
      : "",
  )
  const [deviceTarget, setDeviceTarget] = useState<DeviceTarget>(
    (DEVICE_TARGETS as readonly string[]).includes(initialDeviceTarget)
      ? (initialDeviceTarget as DeviceTarget)
      : "both",
  )
  const [steps, setSteps] = useState<TestStep[]>(initialSteps)
  const [templateId, setTemplateId] = useState<string | null>(initialTemplateId)

  function update(next: TestStep[]) {
    setSteps(next)
    onDirtyChange?.(true)
  }

  function addStep() {
    if (steps.length >= TEST_STEPS_MAX) return
    update([...steps, { id: crypto.randomUUID(), action: "", expected_result: "" }])
  }

  function removeStep(id: string) {
    update(steps.filter((s) => s.id !== id))
  }

  function editStep(id: string, field: "action" | "expected_result", value: string) {
    update(steps.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  /** Swap with the neighbour. Ids travel with the step, which is the point. */
  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= steps.length) return
    const next = [...steps]
    ;[next[index], next[target]] = [next[target], next[index]]
    update(next)
  }

  function chooseCategory(next: TestCategory) {
    setCategory(next)
    // A template from the old category no longer applies, but anything the
    // builder typed does — only the provenance is cleared.
    if (templateId && !templatesFor(next).some((t) => t.id === templateId)) {
      setTemplateId(null)
    }
    onDirtyChange?.(true)
  }

  function applyTemplate(id: string) {
    const template = TEST_TEMPLATES.find((t) => t.id === id)
    if (!template) return
    setTemplateId(id)
    update(instantiate(template))
  }

  function startBlank() {
    setTemplateId(null)
    update([{ id: crypto.randomUUID(), action: "", expected_result: "" }])
  }

  const available = category ? templatesFor(category) : []

  return (
    <div className="flex flex-col gap-8">
      {/* Hidden inputs are what the parent form actually submits. */}
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="device_target" value={deviceTarget} />
      <input type="hidden" name="test_steps" value={JSON.stringify(steps)} />
      {templateId && <input type="hidden" name="template_id" value={templateId} />}

      {/* ── 1. Category ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <p className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
          What kind of testing is this?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TEST_CATEGORIES.map((option) => {
            const active = category === option
            return (
              <button
                key={option}
                type="button"
                onClick={() => chooseCategory(option)}
                aria-pressed={active}
                className={[
                  "text-left rounded-[12px] border p-4 transition-colors duration-150",
                  active
                    ? "border-voltage bg-voltage/5"
                    : "border-iron bg-obsidian hover:border-ash",
                ].join(" ")}
              >
                <span
                  className={[
                    "block font-mono text-[13px] font-medium mb-1",
                    active ? "text-voltage" : "text-chalk",
                  ].join(" ")}
                >
                  {testCategoryLabel(option)}
                </span>
                <span className="block font-mono text-[12px] leading-5 text-ash">
                  {TEST_CATEGORY_BLURBS[option]}
                </span>
              </button>
            )
          })}
        </div>
        <FieldError errors={errors.category} />
      </section>

      {/* ── 2. Start from ───────────────────────────────────────────── */}
      {category && (
        <section className="flex flex-col gap-3">
          <p className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">Start from</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={startBlank}
              className="text-left rounded-[8px] border border-iron bg-obsidian px-4 py-3 font-mono text-[13px] text-chalk hover:border-ash transition-colors duration-150"
            >
              Blank test case
              <span className="block text-[12px] text-ash mt-0.5">Write every step yourself.</span>
            </button>
            {available.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template.id)}
                className={[
                  "text-left rounded-[8px] border px-4 py-3 font-mono text-[13px] transition-colors duration-150",
                  templateId === template.id
                    ? "border-voltage text-voltage bg-voltage/5"
                    : "border-iron text-chalk bg-obsidian hover:border-ash",
                ].join(" ")}
              >
                {template.name}
                <span className="block text-[12px] text-ash mt-0.5">
                  {template.description} · {template.steps.length} steps
                </span>
              </button>
            ))}
          </div>
          <p className="font-mono text-[12px] text-ash leading-5">
            Templates are a starting point — every step stays editable, and picking one replaces
            whatever is below.
          </p>
        </section>
      )}

      {/* ── 3. Steps ────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">Test steps</p>
          <span className="font-mono text-[12px] text-ash">
            {steps.length} / {TEST_STEPS_MAX}
          </span>
        </div>

        {steps.length === 0 ? (
          /* Every mission written before test cases existed lands here. */
          <div className="flex flex-col items-center justify-center py-12 border border-dashed border-iron rounded-[12px] text-center px-6">
            <p className="font-syne font-bold text-[20px] text-chalk mb-2">No steps yet.</p>
            <p className="font-mono text-[13px] text-ash mb-6 leading-5">
              Add the first thing a tester should do, and what should happen when they do it.
            </p>
            <button
              type="button"
              onClick={addStep}
              className="h-10 px-4 border border-iron text-chalk rounded-[8px] font-mono text-[13px] hover:border-ash transition-colors duration-150 flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Add first step
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="bg-obsidian border border-iron rounded-[12px] p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[12px] font-medium text-voltage">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="flex items-center gap-1">
                    <IconButton
                      label={`Move step ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton
                      label={`Move step ${index + 1} down`}
                      disabled={index === steps.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton
                      label={`Remove step ${index + 1}`}
                      onClick={() => removeStep(step.id)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </IconButton>
                  </div>
                </div>

                <StepField
                  label="What the tester does"
                  value={step.action}
                  max={STEP_ACTION_MAX}
                  placeholder="Enter a valid email and submit the form"
                  onChange={(v) => editStep(step.id, "action", v)}
                  errors={errors[`test_steps.${index}.action`]}
                />
                <StepField
                  label="What should happen"
                  value={step.expected_result}
                  max={STEP_EXPECTED_MAX}
                  placeholder="A verification email arrives within 60 seconds"
                  onChange={(v) => editStep(step.id, "expected_result", v)}
                  errors={errors[`test_steps.${index}.expected_result`]}
                />
              </div>
            ))}

            {steps.length < TEST_STEPS_MAX && (
              <button
                type="button"
                onClick={addStep}
                className="h-10 px-4 self-start border border-iron text-chalk rounded-[8px] font-mono text-[13px] hover:border-ash transition-colors duration-150 flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Add step
              </button>
            )}
          </div>
        )}

        {/* The array-level errors — too few, too many, duplicate ids. */}
        <FieldError errors={errors.test_steps} />
      </section>

      {/* ── 4. Device target ────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <p className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]">
          Where should this be tested?
        </p>
        <div className="flex flex-wrap gap-2">
          {DEVICE_TARGETS.map((option) => {
            const active = deviceTarget === option
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setDeviceTarget(option)
                  onDirtyChange?.(true)
                }}
                aria-pressed={active}
                className={[
                  "h-10 px-4 rounded-[8px] border font-mono text-[13px] transition-colors duration-150",
                  active
                    ? "border-voltage text-voltage bg-voltage/5"
                    : "border-iron text-ash bg-obsidian hover:border-ash hover:text-chalk",
                ].join(" ")}
              >
                {deviceTargetLabel(option)}
              </button>
            )
          })}
        </div>
        <FieldError errors={errors.device_target} />
      </section>
    </div>
  )
}

function StepField({
  label,
  value,
  max,
  placeholder,
  onChange,
  errors,
}: {
  label: string
  value: string
  max: number
  placeholder: string
  onChange: (value: string) => void
  errors?: string[]
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] text-ash uppercase tracking-[0.5px]">{label}</span>
      <input
        value={value}
        maxLength={max}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "h-10 w-full bg-graphite border rounded-[8px] px-3 font-mono text-[13px] text-chalk placeholder:text-ash focus:outline-none transition-colors duration-150",
          errors?.length ? "border-ember" : "border-iron focus:border-voltage",
        ].join(" ")}
      />
      <FieldError errors={errors} />
    </label>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 flex items-center justify-center rounded-[6px] border border-iron text-ash hover:text-chalk hover:border-ash transition-colors duration-150 disabled:opacity-30 disabled:pointer-events-none"
    >
      {children}
    </button>
  )
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null
  return <p className="font-mono text-[12px] text-ember">{errors[0]}</p>
}
