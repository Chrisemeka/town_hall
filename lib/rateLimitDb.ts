import "server-only"

// The rate limiter's store, and what a store failure means. The numbers and
// the arithmetic are lib/rateLimit.ts; this file calls rate_limit_hit
// (supabase/migrations/20261002_01_rate_limits.sql) and applies the rule's mode
// when it cannot.
//
// WHERE THE CHECKS LIVE. Server Actions are POSTs to the page route: middleware
// sees the POST but cannot tell which action it carries, so every action limit
// is called from inside the action. app/api/** is excluded from middleware's
// matcher, so each route handler calls this itself too. Do not go looking for
// limits in middleware.ts — there are none, by design.
//
// Authentication never consults this. A degraded or disabled limiter means
// abuse is less throttled, never that anyone gets in without credentials.

import { createAdminClient } from "@/lib/supabase/admin"
import {
  RATE_LIMITS,
  hitMemory,
  rateLimitKey,
  tooManyMessage,
  type MemoryBuckets,
  type RateLimitName,
  type RateLimitResult,
} from "@/lib/rateLimit"

/** Per instance, and only touched while the store is down. */
const fallbackBuckets: MemoryBuckets = new Map()

/** What a closed-mode rule answers when the store is down. */
const CLOSED_RETRY_AFTER = 60

/** The kill switch. Recovery from a limiter bug is a config change, not a build. */
function disabled(): boolean {
  return process.env.RATE_LIMIT_DISABLED === "true"
}

async function hit(name: RateLimitName, id: string): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[name]
  const key = rateLimitKey(name, id)
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
      p_key: key,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    })
    if (error) throw new Error(error.message)
    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed: boolean; retry_after: number }
      | undefined
    if (!row) throw new Error("rate_limit_hit returned no row")
    return row.allowed ? { ok: true } : { ok: false, retryAfter: row.retry_after }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    if (rule.mode === "closed") {
      console.error(`[rate-limit] store unavailable, refusing ${name}:`, reason)
      return { ok: false, retryAfter: CLOSED_RETRY_AFTER }
    }
    // Loud on purpose: silent degradation is how a store stays broken for a week.
    console.error(`[rate-limit] store unavailable, degrading ${name} to in-memory:`, reason)
    return hitMemory(fallbackBuckets, key, rule.fallback, rule.windowSeconds, Date.now())
  }
}

/**
 * Count one attempt against every key given and answer for the worst of them.
 * All keys are counted even when one is already over, so an attacker cannot
 * spend one bucket while sparing the other.
 */
export async function checkRateLimit(
  ...checks: [RateLimitName, string][]
): Promise<RateLimitResult> {
  if (disabled()) {
    console.warn("[rate-limit] DISABLED by RATE_LIMIT_DISABLED — nothing is being limited")
    return { ok: true }
  }
  const results = await Promise.all(checks.map(([name, id]) => hit(name, id)))
  const refused = results.filter((r): r is { ok: false; retryAfter: number } => !r.ok)
  if (refused.length === 0) return { ok: true }
  return { ok: false, retryAfter: Math.max(...refused.map((r) => r.retryAfter)) }
}

/**
 * The caller's IP. On Vercel `x-real-ip` and the first `x-forwarded-for` entry
 * are set by the platform, not the client. "unknown" shares one bucket, which
 * only happens off-platform.
 */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  )
}

/** A 429 an API route can return as-is. The body never states the limit. */
export function tooManyResponse(retryAfter: number): Response {
  return new Response(tooManyMessage(retryAfter), {
    status: 429,
    headers: { "Retry-After": String(retryAfter), "Content-Type": "text/plain; charset=utf-8" },
  })
}
