import type { Instrumentation } from "next"

// Server errors, recorded where an admin can see them rather than only in
// Vercel's logs. One app_events row per error: path, digest, a capped message.
// Never the request body, headers or cookies.
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  // Middleware runs on the edge; the Supabase admin client wants Node.
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { recordEvent } = await import("@/lib/events")
  const { normalisePath } = await import("@/lib/track")
  const err = error as Error & { digest?: string }
  await recordEvent({
    name: "error.server",
    props: {
      path: normalisePath(request.path),
      method: request.method,
      digest: err.digest ?? null,
      message: String(err.message ?? err).slice(0, 500),
    },
  })
  // A burst is critical and does not wait for the cron.
  const { runAlerts } = await import("@/lib/alerts/run")
  await runAlerts(["server_errors"])
}
