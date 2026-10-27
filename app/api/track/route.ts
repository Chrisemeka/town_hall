import { cookies } from "next/headers"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, clientIp } from "@/lib/rateLimitDb"
import { ACCOUNT_COOKIE } from "@/lib/access"
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  VISITOR_COOKIE,
  VISITOR_MAX_AGE,
  countryFrom,
  deviceFrom,
  isBot,
  isUntracked,
  isUuid,
  normalisePath,
  referrerHost,
} from "@/lib/track"

// The page-view beacon, from components/Tracker.tsx. Public by design — a
// logged-out visit is the point — so it gates nothing and answers 204 to
// everything, including its own failures: a dead database must never reach a
// page as an error, and a beacon has no one to show one to.
//
// Not counted: bots, /admin and /api paths, and admin profiles.

const utm = z.string().trim().max(100).optional().nullable()
const beaconSchema = z.object({
  path: z.string().max(2000),
  referrer: z.string().max(2000).optional().nullable(),
  utm_source: utm,
  utm_medium: utm,
  utm_campaign: utm,
})

const done = () => new Response(null, { status: 204 })

export async function POST(request: Request) {
  try {
    const ua = request.headers.get("user-agent")
    if (isBot(ua)) return done()

    // sendBeacon posts text/plain, so the body is parsed by hand.
    const parsed = beaconSchema.safeParse(JSON.parse(await request.text()))
    if (!parsed.success) return done()
    const path = normalisePath(parsed.data.path)
    if (isUntracked(path)) return done()

    const rate = await checkRateLimit(["track:ip", clientIp(request.headers)])
    if (!rate.ok) return done()

    const store = await cookies()
    const visitorId = isUuid(store.get(VISITOR_COOKIE)?.value) ? store.get(VISITOR_COOKIE)!.value : crypto.randomUUID()
    const sessionId = isUuid(store.get(SESSION_COOKIE)?.value) ? store.get(SESSION_COOKIE)!.value : crypto.randomUUID()
    const cookie = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" }
    store.set(VISITOR_COOKIE, visitorId, { ...cookie, maxAge: VISITOR_MAX_AGE })
    store.set(SESSION_COOKIE, sessionId, { ...cookie, maxAge: SESSION_MAX_AGE })

    // getClaims verifies the session JWT without a round trip to Auth on
    // every beacon. Attribution only — nothing here grants anything.
    const { data: claims } = await (await createClient()).auth.getClaims()
    const profileId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null

    const admin = createAdminClient()
    let accountType: string | null = null
    if (profileId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("role, accounts(type)")
        .eq("id", profileId)
        .maybeSingle()
      if (profile?.role === "admin") return done()
      // The th_account cookie is a preference, never authority: believed only
      // when it names an account this person holds (CLAUDE.md, Auth).
      const held = ((profile?.accounts ?? []) as { type: string }[]).map((a) => a.type)
      const preferred = store.get(ACCOUNT_COOKIE)?.value
      accountType = preferred && held.includes(preferred) ? preferred : (held[0] ?? null)
    }

    const { error } = await admin.from("page_views").insert({
      visitor_id: visitorId,
      session_id: sessionId,
      profile_id: profileId,
      account_type: accountType,
      path,
      referrer_host: referrerHost(parsed.data.referrer, request.headers.get("host")),
      utm_source: parsed.data.utm_source || null,
      utm_medium: parsed.data.utm_medium || null,
      utm_campaign: parsed.data.utm_campaign || null,
      country: countryFrom(request.headers.get("x-vercel-ip-country")),
      device: deviceFrom(ua),
    })
    if (error) console.error("[track] insert failed:", error.message)
  } catch (err) {
    console.error("[track] unexpected error:", err)
  }
  return done()
}
