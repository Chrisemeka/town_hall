import { getExampleNumber, isSupportedCountry } from "libphonenumber-js"
import examples from "libphonenumber-js/mobile/examples"
import { countryName } from "@/lib/vocabulary"

/**
 * The selected country's example number, for the phone field's hint.
 *
 * Its own module, and imported only by the client forms, because the examples
 * dataset is a large payload: lib/validation/schemas.ts runs on every submit
 * and under plain node in scripts/*.test.mts, and has no use for it. The schema
 * keeps a generic message; the form says what the selected country expects.
 */

/** "+267 71 123 456" for BW, or null where there is nothing to show. */
export function phoneExampleFor(country: string): string | null {
  // Same guard as dialCodeFor(): BV, HM and AQ are selectable with no metadata,
  // and a throw here would take the form down on a dropdown change.
  if (!country || !isSupportedCountry(country)) return null
  return getExampleNumber(country, examples)?.formatInternational() ?? null
}

/** The helper under the field, shown before anything goes wrong. */
export function phoneHintFor(country: string): string {
  const example = phoneExampleFor(country)
  return example ? `Include your country code — e.g. ${example}.` : "Include your country code."
}

/**
 * The phone error with the country's example on the end.
 *
 * Field shows an error *instead of* its helper, so without this the example
 * disappears at exactly the moment someone needs it.
 */
export function phoneErrorFor(errors: string[] | undefined, country: string): string[] | undefined {
  if (!errors?.length) return errors
  const example = phoneExampleFor(country)
  if (!example) return errors
  return [`${errors[0]} A ${countryName(country)} number looks like ${example}.`, ...errors.slice(1)]
}
