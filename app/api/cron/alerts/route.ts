import { runAlerts } from "@/lib/alerts/run"

// Every alert rule, evaluated. Meant for every 10 minutes — see the scheduling
// note in supabase/migrations/20261027_03_alerts.sql (Vercel Hobby runs cron
// daily only, so the daily job calls runAlerts too). app/api has no
// middleware: the bearer check is the only gate.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response(null, { status: 401 })
  }
  return Response.json({ evaluated: await runAlerts() })
}
