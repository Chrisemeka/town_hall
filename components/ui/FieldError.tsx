import { errorId } from "@/lib/focus"
import { cn } from "@/lib/utils"

/**
 * One line of error under a field — Design.md §5.2.
 *
 * There were six byte-identical copies of this at the bottom of six form files.
 * Shared not for the four lines it saves but for the id: an error message that
 * a screen reader is never told about is a red message only sighted users get,
 * and the convention that connects the two has to have exactly one owner.
 *
 * `field` is required for that reason. Pair it with fieldErrorProps() on the
 * input and the association is complete in two places that cannot drift.
 */
export function FieldError({
  errors,
  field,
  className,
}: {
  errors?: string[]
  field: string
  className?: string
}) {
  if (!errors || errors.length === 0) return null
  return (
    <p id={errorId(field)} className={cn("font-mono text-[12px] text-ember mt-1", className)}>
      {errors[0]}
    </p>
  )
}

/**
 * What the input in error has to say about itself.
 *
 * Nothing when there is no error, rather than aria-invalid="false": that is a
 * claim, and every unerrored input in the product making it out loud is noise.
 */
export function fieldErrorProps(
  field: string,
  errors?: string[],
): { "aria-invalid"?: true; "aria-describedby"?: string } {
  return errors?.length ? { "aria-invalid": true, "aria-describedby": errorId(field) } : {}
}
