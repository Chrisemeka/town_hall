import {
  AsYouType,
  getCountryCallingCode,
  isSupportedCountry,
  type CountryCode,
} from "libphonenumber-js"

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

/**
 * The dial code for a country — "+234" for NG — or null when there is not one.
 *
 * The null case is not defensive padding. COUNTRIES carries all 249 ISO 3166-1
 * codes and libphonenumber has metadata for fewer: Bouvet Island, Heard &
 * McDonald and a few other uninhabited territories are real options in the
 * dropdown with no calling code behind them. getCountryCallingCode() throws on
 * those, so the support check runs before the call rather than as a try/catch
 * around it — a throw here would take the whole form down on a dropdown change.
 */
export function dialCodeFor(country: string): string | null {
  if (!country || !isSupportedCountry(country)) return null
  return `+${getCountryCallingCode(country)}`
}

/**
 * Whether the field holds nothing but `country`'s dial code.
 *
 * This is the whole question the country dropdown needs answered: a value the
 * form filled in may be replaced when the country changes, a number the user
 * typed may not. Getting it wrong in the permissive direction silently deletes
 * someone's phone number, so the check is exact rather than a prefix match —
 * "+2348012345678" starts with "+234" and is emphatically not a bare dial code.
 *
 * Whitespace-insensitive because the autofill leaves a trailing space to type
 * after, and that space is not the user's input.
 */
export function isBareDialCode(value: string, country: string): boolean {
  const dial = dialCodeFor(country)
  return dial !== null && value.trim() === dial
}

/**
 * What the phone field should become when the country dropdown changes, or null
 * to leave it exactly as it is.
 *
 * Pure, and separate from the component, because this is the branch that can
 * silently delete someone's phone number — it is worth being able to test every
 * path of it without standing up a DOM. The component applies the answer and
 * decides nothing.
 *
 * `prevCountry` is the country the field was filled against, not the new one.
 * The question being asked is whether what is sitting there came from the old
 * country's autofill, and only the old country can answer that.
 */
export function phoneForCountryChange(
  phone: string,
  prevCountry: string,
  nextCountry: string,
): string | null {
  const dial = dialCodeFor(nextCountry)
  // No metadata for this country (BV, HM and AQ are all selectable). Nothing to
  // fill in, and reformatting what is there would only churn it.
  if (!dial) return null
  // Ours to replace. Trailing space so the caret sits where the national number
  // begins. Replacing rather than prepending is what keeps US->CA, which share
  // +1, from producing "+1+1 ".
  if (!phone.trim() || isBareDialCode(phone, prevCountry)) return `${dial} `
  // Theirs to keep. The number is still their number; only the grouping is a
  // function of the country.
  return formatPhoneAsYouType(phone, nextCountry)
}
