// Rate limits: the numbers and the arithmetic.
//
// Pure and import-free, in the shape of lib/access.ts and lib/allowance.ts.
// The store and the failure modes are lib/rateLimitDb.ts.
//
// A rate limit is not an allowance. The allowance (lib/allowance.ts) is a
// business quota spent at publish; this is a short-window abuse guard. Neither
// module imports the other, and a limited request must never read as "quota
// exceeded".

export type RateLimitMode =
  /** Store down → stricter in-memory per-instance limit. Never a lockout. */
  | "degrade"
  /** Store down → refused. Cost-bearing actions only. */
  | "closed"

export type RateLimitRule = {
  limit: number
  windowSeconds: number
  /** Per-instance limit used when the store is down (degrade mode only).
   *  About a third of `limit`: someone hitting several instances gets a
   *  bucket on each. */
  fallback: number
  mode: RateLimitMode
}

const MIN = 60
const HOUR = 60 * MIN

export const RATE_LIMITS = {
  // Tier 1 — unauthenticated, email-sending.
  "signup:ip": { limit: 10, windowSeconds: HOUR, fallback: 3, mode: "degrade" },
  "signin:ip": { limit: 30, windowSeconds: 15 * MIN, fallback: 10, mode: "degrade" },
  // 5, not a third: a legitimate person with a few typos still gets in during an outage.
  "signin:email": { limit: 10, windowSeconds: 15 * MIN, fallback: 5, mode: "degrade" },
  "reset:ip": { limit: 10, windowSeconds: HOUR, fallback: 3, mode: "degrade" },
  "reset:email": { limit: 5, windowSeconds: HOUR, fallback: 2, mode: "degrade" },
  "resend:ip": { limit: 10, windowSeconds: HOUR, fallback: 3, mode: "degrade" },
  "resend:email": { limit: 5, windowSeconds: HOUR, fallback: 2, mode: "degrade" },
  "callback:ip": { limit: 30, windowSeconds: 10 * MIN, fallback: 10, mode: "degrade" },
  // The legitimate caller is Supabase itself: this caps a flood, it does not meter submissions.
  "webhook:ip": { limit: 120, windowSeconds: MIN, fallback: 40, mode: "degrade" },

  // Tier 2 — authenticated, cost-bearing. Keyed on the profile id.
  "submit:account": { limit: 10, windowSeconds: HOUR, fallback: 0, mode: "closed" },
  "publish:account": { limit: 20, windowSeconds: HOUR, fallback: 0, mode: "closed" },
  "project:account": { limit: 10, windowSeconds: HOUR, fallback: 0, mode: "closed" },
  "export:account": { limit: 10, windowSeconds: HOUR, fallback: 0, mode: "closed" },
} as const satisfies Record<string, RateLimitRule>

export type RateLimitName = keyof typeof RATE_LIMITS

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number }

/** Case and whitespace, or `Test@x.com` and `test@x.com` get separate buckets. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function rateLimitKey(name: RateLimitName, id: string): string {
  return `${name}:${id}`
}

/** Seconds until the fixed window containing `nowMs` ends. Never 0. */
export function retryAfterSeconds(nowMs: number, windowSeconds: number): number {
  const now = Math.floor(nowMs / 1000)
  return Math.max(1, windowSeconds - (now % windowSeconds))
}

export type MemoryBuckets = Map<string, { start: number; hits: number }>

/**
 * The same fixed window the RPC implements, in memory. Synchronous, so it is
 * atomic within one instance. Only used when the store is down.
 */
export function hitMemory(
  buckets: MemoryBuckets,
  key: string,
  limit: number,
  windowSeconds: number,
  nowMs: number,
): RateLimitResult {
  const now = Math.floor(nowMs / 1000)
  const start = now - (now % windowSeconds)
  const bucket = buckets.get(key)
  const hits = bucket && bucket.start === start ? bucket.hits + 1 : 1
  buckets.set(key, { start, hits })
  return hits <= limit ? { ok: true } : { ok: false, retryAfter: retryAfterSeconds(nowMs, windowSeconds) }
}

/**
 * When to try again, in plain words. Never the limit, the count or the window:
 * "5 of 5 in 300 seconds" is a map of how to stay under it.
 */
export function tooManyMessage(retryAfter: number): string {
  if (retryAfter <= 90) return "Too many attempts. Try again in a minute."
  return `Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`
}
