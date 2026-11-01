import { checkRateLimit, clientIp, tooManyResponse } from "@/lib/rateLimitDb"
import { unsubscribeByLink } from "@/lib/unsubscribe"

/*
 * RFC 8058 one-click unsubscribe: what Gmail's and Yahoo's own Unsubscribe
 * button posts to, from the digest's List-Unsubscribe header. The token rides
 * in the URL's query; the body is only "List-Unsubscribe=One-Click".
 *
 * THIS ROUTE HAS NO MIDDLEWARE and no sign-in. The token is the only gate,
 * and a bad one gets the same 400 whether or not the account exists.
 */
export async function POST(request: Request) {
  const rate = await checkRateLimit(["unsubscribe:ip", clientIp(request.headers)])
  if (!rate.ok) return tooManyResponse(rate.retryAfter)

  const params = new URL(request.url).searchParams
  const ok = await unsubscribeByLink(params.get("a"), params.get("t"))
  return ok ? new Response(null, { status: 200 }) : new Response("This unsubscribe link isn't valid.", { status: 400 })
}
