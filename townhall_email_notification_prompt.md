# Twnhall Email Notification System


## What to build

A server-side email notification system using **Resend** (free tier) and **React Email**
for transactional email templates. No WebSockets. No client-side polling.
Pure server-side, event-driven email triggers.

There are **two notification flows** to implement:

### Flow 1 — Feedback notification (automated)
When a tester submits a test result (a "submission") on a developer's project mission,
the project owner receives an email notifying them that new feedback is ready to view and who sent the feedback.

### Flow 2 — Admin broadcast (manual)
An admin can send a custom message to either:
- A single user (by email)
- All users on the platform

---

## Setup instructions

### 1. Install dependencies

```bash
npm install resend @react-email/components @react-email/render
```

### 2. Environment variables

Add the following to `.env.local`:

```
RESEND_API_KEY=your_resend_api_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> Get the Resend API key from https://resend.com — free tier supports 3,000 emails/month.
> In production, replace NEXT_PUBLIC_APP_URL with the live domain.

---

## Files to create

### A. Email templates (React Email components)

#### `/emails/feedback-notification.tsx`

A clean, branded email template sent to a project owner when they receive new feedback.

Must include:
- Twnhall branding (name + tagline in header)
- Tester's name (or "A tester")
- The project name being tested
- The mission title
- A short excerpt or summary of what was tested (passed as a prop)
- A CTA button: "View Feedback" — links to the submission page on Twnhall
- Clean footer with unsubscribe note

Props interface:
```ts
interface FeedbackNotificationProps {
  ownerName: string;
  testerName: string;
  projectName: string;
  missionTitle: string;
  submissionSummary: string;  // short excerpt from the tester's written summary
  feedbackUrl: string;        // direct link to the submission in the app
}
```

#### `/emails/admin-broadcast.tsx`

A clean, general-purpose email template for admin messages.

Must include:
- Twnhall branding in header
- Subject/headline (passed as prop)
- Message body (passed as prop, support basic line breaks)
- Optional CTA button (label + URL, both optional props)
- Footer with "This message was sent by the Twnhall admin team"

Props interface:
```ts
interface AdminBroadcastProps {
  recipientName: string;
  subject: string;
  messageBody: string;
  ctaLabel?: string;
  ctaUrl?: string;
}
```

---

### B. Resend client utility

#### `/lib/mail.ts`

A shared utility that initialises the Resend client and exports two send functions.

```ts
// Initialise Resend with RESEND_API_KEY
// Export:

sendFeedbackNotification(props: FeedbackNotificationProps & { to: string }): Promise<void>
// - Renders the FeedbackNotification email template
// - Sends via Resend from "Twnhall <notifications@yourdomain.com>"
// - Subject: "You have new feedback on [projectName]"
// - Handles and logs errors without throwing (fire-and-forget)

sendAdminBroadcast(props: AdminBroadcastProps & { to: string | string[] }): Promise<void>
// - Renders the AdminBroadcast email template
// - Sends via Resend from "Twnhall <admin@yourdomain.com>"
// - Subject: passed in as props.subject
// - If `to` is an array, send in batches of 50 (Resend batch limit)
// - Handles and logs errors without throwing
```

> Note: Until a custom domain is verified in Resend, use the Resend sandbox sender:
> `onboarding@resend.dev` — this is fine for development and beta testing.

---

### C. API route — Supabase webhook receiver

#### `/app/api/webhooks/submission/route.ts`

A POST endpoint that Supabase calls via a Database Webhook whenever a new row
is inserted into the `submissions` table.

Logic:
1. Parse the incoming JSON body — Supabase sends `{ type: "INSERT", record: {...}, ... }`
2. Validate the payload has `record.id`, `record.mission_id`, `record.tester_id`
3. Use the Supabase service role client (not the anon client) to:
   - Fetch the mission by `mission_id` → get `mission.title` and `mission.project_id`
   - Fetch the project by `project_id` → get `project.name` and `project.owner_id`
   - Fetch the owner user by `owner_id` → get `owner.email` and `owner.full_name`
   - Fetch the tester user by `tester_id` → get `tester.full_name`
   - Fetch the submission by `record.id` → get `submission.summary` (tester's written summary)
4. Construct the `feedbackUrl`:
   `${process.env.NEXT_PUBLIC_APP_URL}/developer/projects/[projectId]/submissions/[submissionId]`
   (adjust the path to match the actual route structure in the app)
5. Call `sendFeedbackNotification(...)` from `/lib/mail.ts`
6. Return `{ success: true }` with status 200

Security:
- Add a simple webhook secret check. Supabase allows you to set a custom header.
  Check for `x-webhook-secret` header matching `process.env.WEBHOOK_SECRET`.
  Return 401 if missing or wrong.
- Add `WEBHOOK_SECRET=your_random_secret` to `.env.local`

Error handling:
- If any DB fetch fails, return 500 with an error message
- Never expose internal error details in the response body

---

### D. Supabase service role client

#### `/lib/supabase-admin.ts`

A Supabase client initialised with the **service role key** (bypasses RLS).
Only used server-side, never exposed to the client.

```ts
// Uses:
// SUPABASE_SERVICE_ROLE_KEY (add to .env.local — get from Supabase dashboard > Settings > API)
// NEXT_PUBLIC_SUPABASE_URL (already exists)

import { createClient } from '@supabase/supabase-js'
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

> Important: Never import this file from any client component. Only use in API routes and server actions.

---

### E. Admin broadcast server action

#### `/actions/admin.ts` (add to existing admin actions file if it exists, or create new)

```ts
// Server Action: broadcastAdminEmail
// 
// Parameters:
//   subject: string
//   messageBody: string
//   ctaLabel?: string
//   ctaUrl?: string
//   targetType: 'all' | 'single'
//   targetEmail?: string   // required if targetType === 'single'
//
// Logic:
// 1. Verify the calling user is an admin (check is_admin flag on their profile via Supabase)
//    If not admin, throw an error / return { error: 'Unauthorized' }
// 2. If targetType === 'single': send to targetEmail only
// 3. If targetType === 'all':
//    - Fetch all user emails from the profiles/users table using supabaseAdmin
//    - Call sendAdminBroadcast with the full array of emails
// 4. Return { success: true, count: number } — count of emails sent
//
// Validate all inputs with Zod before processing
```

---

### F. Admin UI — broadcast email form

#### `/app/(developer)/admin/email/page.tsx` (or wherever the admin pages live)

A simple server component page with a client form component for sending broadcasts.

The form must have:
- Subject line input (required)
- Message body textarea (required, min 10 chars)
- Optional CTA label input
- Optional CTA URL input
- Target toggle: "All users" or "Single user"
  - If "Single user" is selected, show an email input field
- Submit button: "Send Email"
- Success state: show "Email sent to X recipients"
- Error state: show the error message

Use existing Tailwind + component conventions from the rest of the admin UI.
Validate with Zod on the server action side, show Zod errors inline on the form.

---

## Supabase webhook configuration (document as a comment or README note)

After the API route is deployed, configure the webhook in Supabase:

1. Go to Supabase Dashboard → Database → Webhooks
2. Create a new webhook:
   - Name: `on_submission_insert`
   - Table: `submissions`
   - Events: `INSERT`
   - URL: `https://your-domain.com/api/webhooks/submission`
   - HTTP headers: add `x-webhook-secret: your_WEBHOOK_SECRET_value`
3. Save

For local development, use a tunnel tool like **ngrok** to expose localhost
and point the webhook at the tunnel URL temporarily.

---

## What NOT to build

- Do not use WebSockets or Supabase Realtime for email triggers
- Do not build an in-app notification bell (out of scope for this task)
- Do not build an email unsubscribe system (not needed for beta)
- Do not use SendGrid, Nodemailer, or any other mail provider — use Resend only
- Do not store sent emails in the database (not needed for now)

---

## Summary of new files

```
/emails/
  feedback-notification.tsx
  admin-broadcast.tsx

/lib/
  mail.ts
  supabase-admin.ts

/app/api/webhooks/submission/
  route.ts

/actions/
  admin.ts               ← add broadcastAdminEmail server action

/app/(developer)/admin/email/
  page.tsx               ← admin broadcast UI page
```

## Summary of .env.local additions

```
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=
SUPABASE_SERVICE_ROLE_KEY=
WEBHOOK_SECRET=
```
