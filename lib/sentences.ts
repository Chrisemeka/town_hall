/**
 * Sentence counting for the project summary rule.
 *
 * This is a nudge, not a parser, and it will be wrong sometimes. An
 * abbreviation missing from the list below inflates the count; a run-on joined
 * by semicolons sails through. The real constraint on a summary is
 * PROJECT_SUMMARY_MAX, which is exact and costs nothing to enforce — this only
 * catches the shape of over-writing that a character cap alone lets past.
 *
 * If it turns out to annoy builders more than it helps, the fallback is to drop
 * the .refine() from projectSchema and keep the cap. That is a one-line change
 * and no data has to move.
 */

/**
 * Abbreviations whose full stop does not end a sentence.
 *
 * Deliberately short. Every entry here is a word the counter will undercount if
 * a builder uses it mid-sentence in some other way, so the list earns its length
 * by covering what actually turns up in product copy rather than by being
 * exhaustive.
 */
const ABBREVIATIONS =
  /\b(?:e\.g|i\.e|etc|vs|approx|no|vol|Inc|Ltd|Corp|Co|Dr|Mr|Mrs|Ms|St|Jr|Sr|U\.S|U\.K)\./gi

/** "v2.0", "3.5x" — the dot is a decimal point, not a full stop. */
const DECIMALS = /\b\d+\.\d+/g

/** A URL's dots are not sentence ends, and its path can hold several. */
const URLS = /https?:\/\/\S+|\bwww\.\S+/gi

/** A full stop, bang or question mark that is actually ending something. */
const TERMINATORS = /[.!?](\s|$)/g

/**
 * How many sentences `text` reads as.
 *
 * Text with no terminator at all counts as **one**, not zero. "HR ERP" and
 * "End-to-end WhatsApp automation for businesses" are summaries, not fragments,
 * and four of the ten projects live at the time of writing were punctuated
 * exactly that way. Demanding a full stop before a builder can save would reject
 * the terse summary this rule is trying to encourage.
 *
 * Empty or whitespace-only input counts as zero, which the schema's own
 * `.min(1)` reports with a better message than a sentence rule could.
 */
export function countSentences(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0

  const stripped = trimmed
    .replace(URLS, " ")
    .replace(ABBREVIATIONS, " ")
    .replace(DECIMALS, " ")

  const terminators = stripped.match(TERMINATORS)?.length ?? 0
  return Math.max(1, terminators)
}
