// Page-view shaping for app/api/track. Pure and import-free, so it is tested
// directly. Nothing here identifies a person: paths lose their ids, referrers
// keep only their host, and the device is a three-way bucket.

/** One year: the visitor cookie. */
export const VISITOR_COOKIE = "th_vid"
export const VISITOR_MAX_AGE = 60 * 60 * 24 * 365
/** Rolling 30 minutes: re-set on every view. */
export const SESSION_COOKIE = "th_sid"
export const SESSION_MAX_AGE = 30 * 60

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NUMERIC = /^\d+$/

/** `/mission/9f…?x=1` → `/mission/[id]`. Ids and numbers only; slugs stay. */
export function normalisePath(raw: string): string {
  const path = raw.split(/[?#]/)[0] || "/"
  const segments = path
    .split("/")
    .filter(Boolean)
    .map((s) => (UUID.test(s) || NUMERIC.test(s) ? "[id]" : s.slice(0, 80)))
  return ("/" + segments.join("/")).slice(0, 200)
}

/** Not counted: the console looking at itself, and the API. */
export function isUntracked(path: string): boolean {
  return /^\/(admin|api)(\/|$)/.test(path)
}

// ponytail: a substring list, not a bot database. JS-only collection already
// drops most crawlers; this catches the headless ones that run scripts.
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|curl|wget|python|axios|node-fetch|go-http/i

export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT.test(userAgent)
}

export function deviceFrom(userAgent: string | null): "mobile" | "tablet" | "desktop" {
  const ua = userAgent ?? ""
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(ua)) return "tablet"
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile"
  return "desktop"
}

/** The referrer's host, or null for none, a bad URL, or our own site. */
export function referrerHost(referrer: string | null | undefined, ownHost: string | null): string | null {
  if (!referrer) return null
  try {
    const host = new URL(referrer).hostname.toLowerCase()
    if (!host || (ownHost && host === ownHost.split(":")[0].toLowerCase())) return null
    return host.slice(0, 120)
  } catch {
    return null
  }
}

/** A two-letter country code, or null. */
export function countryFrom(header: string | null): string | null {
  return header && /^[A-Z]{2}$/i.test(header) ? header.toUpperCase() : null
}

export function isUuid(value: string | undefined | null): value is string {
  return !!value && UUID.test(value)
}
