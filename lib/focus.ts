// Carrying the user to the first field in error, and the id convention that
// ties an error message to the input it belongs to.
//
// Kept out of lib/hooks/ and free of any React import so scripts/focus.test.mts
// can import it under plain node — the same arrangement as lib/access.ts and
// lib/searchHref.ts. The hook next door is a four-line wrapper over
// focusFirstError().

/** Anything with a `.current`. Shaped like a React ref without importing one. */
type Box<T> = { current: T | null }

export type FocusFirstErrorOptions = {
  /**
   * Reveal a collapsed section holding `field`, after which this retries.
   * A field inside a closed disclosure cannot be focused.
   */
  reveal?: (field: string) => void
  /** Scrolled to when no errored field resolves to an element at all. */
  fallback?: Box<HTMLElement>
}

/** The id an error message carries, so its input can point at it. */
export const errorId = (field: string) => `${field}-error`

/**
 * Whichever node comes first in the document.
 *
 * Not the first key of the errors object: that order comes from the Zod schema,
 * and on the mission form the schema runs title → task_description → category
 * while the page renders title → the whole test-case editor → task_description.
 * Taking object order would scroll a builder past the mistake they made first.
 *
 * Typed on the one method it uses, so a test can pass a stub instead of
 * standing up a DOM.
 */
export function firstInDocumentOrder<
  T extends { compareDocumentPosition(other: never): number },
>(nodes: T[]): T | null {
  return nodes.reduce<T | null>((first, node) => {
    if (!first) return node
    // DOCUMENT_POSITION_PRECEDING — node comes before the one we are holding.
    return first.compareDocumentPosition(node as never) & 2 ? node : first
  }, null)
}

/**
 * Whether the user has asked for less motion.
 *
 * Read at call time rather than through useMediaQuery: this runs inside an
 * event handler, not a render, so a subscription would be one that never
 * re-renders anything.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

function hasError(value: unknown): boolean {
  return Array.isArray(value) ? value.length > 0 : value != null && value !== ""
}

/**
 * Resolve a field name to its control.
 *
 * name before id, because name is what FormData and the Zod schema agree on.
 * id is the fallback for controls with no form around them (Settings) and for
 * the audit log's status group, which is a button and so has no name at all.
 *
 * getElementsByName / getElementById rather than querySelector: audit-log field
 * names contain dots — `entries.3.actual_result` — which a CSS selector reads
 * as a class chain.
 *
 * Anything with no layout box is skipped. The test-case editor mirrors its
 * state into `<input type="hidden" name="category">` and two more like it, and
 * those win the name lookup — scrolling to a hidden input moves nothing and
 * focusing one does nothing, so the user would be told there is an error and
 * then left where they were.
 */
function elementFor(field: string): HTMLElement | null {
  const named = Array.from(document.getElementsByName(field)) as HTMLElement[]
  const byId = document.getElementById(field)
  for (const el of byId ? [...named, byId] : named) {
    if (el.getClientRects().length > 0) return el
  }
  return null
}

function resolve(fields: string[]): HTMLElement | null {
  const found: HTMLElement[] = []
  for (const field of fields) {
    const el = elementFor(field)
    if (el) found.push(el)
  }
  return firstInDocumentOrder(found)
}

function scrollTo(el: HTMLElement) {
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "center",
  })
}

function moveTo(el: HTMLElement) {
  scrollTo(el)
  // preventScroll, or the browser's own focus scroll races the smooth one and
  // parks the field under the 56px sticky top nav.
  el.focus({ preventScroll: true })
}

/**
 * Scroll to and focus the first field in error, if there is one.
 *
 * Called on the submit rather than watched as a value: the merged fieldErrors
 * object these forms build is a fresh spread on every render, so an effect
 * keyed on its identity fires constantly, and one keyed on its contents misses
 * the case that matters most — a user submitting twice without fixing
 * anything has to be moved twice, and those two objects are equal.
 */
export function focusFirstError(
  fieldErrors: Record<string, unknown>,
  { reveal, fallback }: FocusFirstErrorOptions = {},
): void {
  const fields = Object.keys(fieldErrors).filter((key) => hasError(fieldErrors[key]))
  if (fields.length === 0) return

  const target = resolve(fields)
  if (target) {
    moveTo(target)
    return
  }

  if (reveal) {
    reveal(fields[0])
    // One frame is enough for a setState made from an event handler to have
    // committed. flushSync would also do it, and is the heavier tool for a path
    // that runs once per failed submit.
    requestAnimationFrame(() => {
      const revealed = resolve(fields)
      if (revealed) moveTo(revealed)
      else if (fallback?.current) scrollTo(fallback.current)
    })
    return
  }

  // Something is in error and nothing on the page carries its name. Better to
  // land the user on the error summary than to leave the submit looking inert.
  if (fallback?.current) scrollTo(fallback.current)
}
