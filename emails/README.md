# Twnhall — Email Notifications

Server-side transactional email via [Resend](https://resend.com) and
[React Email](https://react.email). Two flows:

1. **Feedback notification (automated)** — a tester submits a test result
   → Supabase database webhook → `/api/webhooks/submission` → the project
   owner gets an email.
2. **Admin broadcast (manual)** — an admin uses
   `/admin/email` to send a custom message to a single user or every account.

## Environment variables

Add these to `.env.local` (and to the production env):

```bash
# Resend
RESEND_API_KEY=re_xxx

# Public site URL used in email links (no trailing slash)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Service role key (already required by /lib/supabase/admin.ts)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...

# Webhook secret — any random string. Must match the
# x-webhook-secret header configured in Supabase.
WEBHOOK_SECRET=replace-with-a-long-random-string

# ngrok — used by `npm run tunnel` (scripts/ngrok.mjs).
# Grab from https://dashboard.ngrok.com/get-started/your-authtoken
NGROK_AUTHTOKEN=replace-with-your-ngrok-authtoken

# Optional: override the sender once a custom Twnhall domain
# is verified in Resend. Defaults to the Resend sandbox sender.
# MAIL_FROM_NOTIFICATIONS=Twnhall <notifications@yourdomain.com>
# MAIL_FROM_ADMIN=Twnhall <admin@yourdomain.com>
```

> Until a custom domain is verified in Resend, the system falls back to
> `onboarding@resend.dev`, which is fine for development and beta testing.

## Supabase database webhook

After deploying the API route, configure the webhook in Supabase:

1. Dashboard → **Database** → **Webhooks** → **Create a new hook**.
2. Settings:
   - **Name**: `on_submission_insert`
   - **Table**: `test_results` *(Twnhall's submissions table)*
   - **Events**: `Insert`
   - **Type**: HTTP request
   - **Method**: `POST`
   - **URL**: `https://your-domain.com/api/webhooks/submission`
   - **HTTP headers**: add `x-webhook-secret` = the value of `WEBHOOK_SECRET`.
3. Save.

### Local development tunnel

`@ngrok/ngrok` is installed as a dev dependency, plus a helper script:

```bash
# 1. Run the Next.js dev server (port 3000)
npm run dev

# 2. In another terminal, open an HTTPS tunnel
npm run tunnel
```

The tunnel script ([scripts/ngrok.mjs](../scripts/ngrok.mjs)) reads
`NGROK_AUTHTOKEN` from `.env.local`, prints the public URL, and tells you
exactly what to paste into the Supabase webhook form
(`<public-url>/api/webhooks/submission` + the `x-webhook-secret` header).
Stop the tunnel with `Ctrl+C`.

Note: the free ngrok tier issues a new URL each time you start the tunnel
— update the Supabase webhook URL whenever it changes.

## File map

```
emails/
  feedback-notification.tsx     React Email template — feedback flow
  admin-broadcast.tsx           React Email template — admin broadcast
  README.md                     This file

lib/
  mail.ts                       Resend client + send helpers
  supabase/admin.ts             Existing service-role client (re-used)

app/api/webhooks/submission/
  route.ts                      POST handler called by Supabase webhook

actions/admin/
  broadcast.ts                  broadcastAdminEmail() server action

app/(admin)/admin/email/
  page.tsx                      Admin broadcast UI

components/admin/
  BroadcastForm.tsx             Client form used by the page above
```

## Out of scope

- No WebSockets / Supabase Realtime triggers
- No in-app notification bell
- No unsubscribe system (not needed for beta)
- No other mail providers (Resend only)
- Sent emails are not persisted to the database
