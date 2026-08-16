import { AsYouType, type CountryCode } from "libphonenumber-js"

/**
 * Phone input behaviour for the verification form. UX only — the schema in
 * lib/validation/schemas.ts stays the authority on whether a number is valid,
 * and neither of these functions can make an invalid number pass it.
 */

/** The shape of a keydown this needs. React's event satisfies it structurally. */
export type PhoneKeyEvent = {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  currentTarget: { selectionStart: number | null }
}

/**
 * Whether a keystroke belongs in a phone field.
 *
 * Filtering on keydown rather than change is deliberate: change fires after the
 * character is already in the DOM, so the user sees the letter appear and then
 * vanish. Here it never lands.
 *
 * Non-printing keys are allowed wholesale rather than enumerated — that covers
 * Backspace, Delete, Tab, the arrows, Home and End without a list that quietly
 * omits whatever the next keyboard does. Modified keys are allowed for the same
 * reason: blocking Ctrl+V is the point of failure the user would hit first, and
 * blocking Ctrl+Z would be a fresh bug.
 */
export function isAllowedPhoneKey(event: PhoneKeyEvent): boolean {
  if (event.ctrlKey || event.metaKey) return true
  if (event.key.length > 1) return true
  // A plus sign is only a country prefix at the very front. Anywhere else it is
  // a typo, and libphonenumber would stop parsing at it.
  if (event.key === "+") return event.currentTarget.selectionStart === 0
  return /[\d ]/.test(event.key)
}

/**
 * Formats as the user types: "+2348012345678" becomes "+234 801 234 5678".
 *
 * `country` only matters for a number typed without a leading "+" — once the
 * country prefix is there, it is the prefix that decides the grouping. It is
 * still passed so that changing the dropdown re-groups a national number.
 *
 * This is also what makes paste safe. onKeyDown cannot see a paste (Ctrl+V has
 * to be allowed), but AsYouType stops at the first character that is not part
 * of a number, so pasting "+234ddddfd" yields "+234" rather than junk sitting
 * in the field until submit.
 *
 * ponytail: formatting the whole value on every keystroke moves the caret to
 * the end, so editing the middle of a number jumps to the end. Fine while
 * people type left to right; if that stops being true, track the caret offset
 * across the reformat rather than reaching for an input-mask dependency.
 */
export function formatPhoneAsYouType(value: string, country?: string): string {
  if (!value) return value
  // An unknown or empty country is not an error here — AsYouType ignores it and
  // falls back to reading the country from the "+" prefix.
  return new AsYouType(country as CountryCode | undefined).input(value) || value
}
