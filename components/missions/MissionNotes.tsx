"use client"

import { FieldError, fieldErrorProps } from "@/components/ui/FieldError"
import { MISSION_DESCRIPTION_MIN } from "@/lib/validation/schemas"

/**
 * The optional brief, behind a disclosure.
 *
 * Since the test-case migration the real brief is the ordered steps above this,
 * and task_description is supplementary. It was still mandatory and still the
 * largest control on the form, so the form asked for the brief twice and
 * refused to save without the redundant copy.
 *
 * Shared by both mission forms for the same reason TestCaseEditor is: they were
 * near-duplicates, and a second copy of a disclosure is a second place for the
 * two to drift.
 *
 * `open` is lifted to the parent rather than held here, because the parent's
 * focus hook has to be able to open the section before it can focus the field
 * inside it — see the `reveal` option on useFocusFirstError.
 */
export function MissionNotes({
  open,
  onOpenChange,
  value,
  onChange,
  errors,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  onChange: (value: string) => void
  errors?: string[]
}) {
  const short = value.length > 0 && value.length < MISSION_DESCRIPTION_MIN

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-3 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={open}
          onChange={(e) => onOpenChange(e.target.checked)}
          className="w-4 h-4 accent-voltage rounded-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-voltage focus-visible:ring-offset-2 focus-visible:ring-offset-graphite"
        />
        <span className="font-mono text-[14px] text-chalk">Add notes for testers</span>
      </label>

      {/* Closed still has to submit the field. FormData.get returns null for an
          absent control, and the schema asks for a string — so the empty value
          is sent explicitly rather than left to be missing. */}
      {!open && <input type="hidden" name="task_description" value="" />}

      {open && (
        <>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="task_description"
              className="font-mono text-[12px] text-ash uppercase tracking-[0.5px]"
            >
              Notes for Testers
            </label>
            <textarea
              id="task_description"
              name="task_description"
              rows={8}
              placeholder="Anything the steps above don't cover — what the product is, what's already broken, logins testers will need."
              value={value}
              onChange={(e) => onChange(e.target.value)}
              {...fieldErrorProps("task_description", errors)}
              className={[
                "w-full bg-obsidian border rounded-[8px] px-4 py-3 font-mono text-[14px] text-chalk placeholder:text-ash focus:outline-none focus-visible:ring-2 focus-visible:ring-voltage focus-visible:ring-offset-2 focus-visible:ring-offset-graphite transition-colors duration-150 resize-none",
                errors?.length ? "border-ember" : "border-iron focus:border-voltage",
              ].join(" ")}
            />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <FieldError field="task_description" errors={errors} />
                {!errors?.length && (
                  <p className={`font-mono text-[12px] ${short ? "text-voltage" : "text-ash"}`}>
                    {short
                      ? `${MISSION_DESCRIPTION_MIN - value.length} more characters needed.`
                      : "Optional. The steps say what to do; this says what to know first."}
                  </p>
                )}
              </div>
              <span className="font-mono text-[12px] text-ash shrink-0">{value.length} chars</span>
            </div>
          </div>

          {/* The old tips ("Start with a verb…", "Describe the exact flow…")
              were instructions for writing a brief. The test case does that job
              now, so these are about the context the steps cannot carry. */}
          <div className="bg-obsidian border border-iron rounded-[12px] p-6">
            <p className="font-mono text-[12px] font-medium text-voltage uppercase tracking-[1px] mb-4">
              Writing Useful Notes
            </p>
            <div className="flex flex-col gap-3">
              {[
                "What the product is and who it's for — testers arrive with no context.",
                "What state it's in: seeded data, half-built screens, anything already known broken.",
                "Logins, test cards, or sample data they'll need — and anything they should not touch.",
              ].map((tip) => (
                <p key={tip} className="font-mono text-[13px] text-ash leading-5 italic">
                  {tip}
                </p>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
