// Launch an ngrok HTTPS tunnel pointing at the local Next.js dev server.
// Used to receive Supabase Database Webhooks during local development:
//
//   1. Start Next.js:        npm run dev
//   2. In another shell:     npm run tunnel
//   3. Copy the printed URL into Supabase webhook config:
//        URL: <printed-url>/api/webhooks/submission
//        Header: x-webhook-secret = <value of WEBHOOK_SECRET>
//
// Reads NGROK_AUTHTOKEN, PORT, and WEBHOOK_SECRET from .env.local.

import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import ngrok from "@ngrok/ngrok"

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, "..")
const envFile = resolve(projectRoot, ".env.local")

function loadEnvFile(path) {
  if (!existsSync(path)) return
  const raw = readFileSync(path, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key]) continue
    const value = rawValue.replace(/^['"]|['"]$/g, "")
    process.env[key] = value
  }
}

loadEnvFile(envFile)

const authtoken = process.env.NGROK_AUTHTOKEN
if (!authtoken) {
  console.error(
    "[tunnel] NGROK_AUTHTOKEN is missing. Add it to .env.local — grab a token from\n" +
      "         https://dashboard.ngrok.com/get-started/your-authtoken",
  )
  process.exit(1)
}

const port = Number(process.env.PORT ?? 3000)
const webhookSecretSet = Boolean(process.env.WEBHOOK_SECRET)

let listener
try {
  listener = await ngrok.forward({
    addr: port,
    authtoken,
  })
} catch (err) {
  console.error("[tunnel] failed to start ngrok:", err?.message ?? err)
  process.exit(1)
}

const publicUrl = listener.url()
const webhookUrl = `${publicUrl}/api/webhooks/submission`

const bar = "─".repeat(64)
console.log("")
console.log(bar)
console.log("  ngrok tunnel is live")
console.log(bar)
console.log(`  Public URL       : ${publicUrl}`)
console.log(`  Forwarding to    : http://localhost:${port}`)
console.log("")
console.log("  Supabase webhook")
console.log(`  ─ URL            : ${webhookUrl}`)
console.log(
  `  ─ Header         : x-webhook-secret = ${
    webhookSecretSet ? "(value of WEBHOOK_SECRET in .env.local)" : "[MISSING — set WEBHOOK_SECRET in .env.local]"
  }`,
)
console.log(bar)
console.log("")
console.log("Press Ctrl+C to stop.")

// Keep the event loop alive — the SDK's listener handle doesn't always
// ref the loop on Windows, so the process can exit prematurely.
const heartbeat = setInterval(() => {}, 1 << 30)

let shuttingDown = false
async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  clearInterval(heartbeat)
  try {
    await listener.close()
  } catch {
    // ignore — process is exiting anyway
  }
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
