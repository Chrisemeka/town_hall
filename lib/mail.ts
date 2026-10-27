import "server-only"

import { Resend } from "resend"
import { render } from "@react-email/render"
import { recordEvent } from "@/lib/events"
import FeedbackNotification, {
  type FeedbackNotificationProps,
} from "@/emails/feedback-notification"
import AdminBroadcast, {
  type AdminBroadcastProps,
} from "@/emails/admin-broadcast"
import Welcome, { type WelcomeProps } from "@/emails/welcome"
import ApprovalNotification, {
  type ApprovalNotificationProps,
} from "@/emails/approval-notification"

// Until a custom Twnhall domain is verified in Resend, fall back to the
// shared sandbox sender. Override per-env with MAIL_FROM_* if needed.
const FROM_NOTIFICATIONS =
  process.env.MAIL_FROM_NOTIFICATIONS ?? "Twnhall <notifications@twnhall.com>"
const FROM_ADMIN =
  process.env.MAIL_FROM_ADMIN ?? "Twnhall <notifications@twnhall.com>"

const BATCH_SIZE = 50

/**
 * email.sent / email.failed, by template — never the address or the body.
 * Awaited: every sender already runs inside after(), off the response path.
 */
async function logged(template: string, failure?: unknown): Promise<void> {
  await recordEvent(
    failure === undefined
      ? { name: "email.sent", props: { template } }
      : { name: "email.failed", props: { template, error: describe(failure) } },
  )
}

function describe(failure: unknown): string {
  const text = failure instanceof Error ? failure.message : typeof failure === "string" ? failure : JSON.stringify(failure)
  return (text ?? "unknown").slice(0, 300)
}

let cachedResend: Resend | null = null
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.error("[mail] RESEND_API_KEY is not set — emails will not be sent.")
    return null
  }
  if (!cachedResend) cachedResend = new Resend(key)
  return cachedResend
}

export async function sendFeedbackNotification(
  props: FeedbackNotificationProps & { to: string },
): Promise<void> {
  const resend = getResend()
  if (!resend) return logged("feedback-notification", "RESEND_API_KEY is not set")

  try {
    const { to, ...rest } = props
    const html = await render(FeedbackNotification(rest))
    const text = await render(FeedbackNotification(rest), { plainText: true })

    const { error } = await resend.emails.send({
      from: FROM_NOTIFICATIONS,
      to,
      subject: `You have a new test report on ${rest.projectName}`,
      html,
      text,
    })

    if (error) {
      console.error("[mail.sendFeedbackNotification] Resend error:", error)
      await logged("feedback-notification", error)
    } else {
      await logged("feedback-notification")
    }
  } catch (err) {
    console.error("[mail.sendFeedbackNotification] unexpected error:", err)
    await logged("feedback-notification", err)
  }
}

/**
 * Sent once, when someone finishes setup and their account opens.
 *
 * Swallows everything — a missing key, a render failure, a Resend error, an
 * unexpected throw — and returns void, exactly like sendFeedbackNotification.
 * The non-fatal contract lives HERE rather than at the call site, so no future
 * caller has to remember to wrap it: the gate is already open by the time this
 * runs, and a welcome email is not worth failing that over.
 */
export async function sendWelcomeEmail(
  props: WelcomeProps & { to: string },
): Promise<void> {
  const resend = getResend()
  if (!resend) return logged("welcome", "RESEND_API_KEY is not set")

  try {
    const { to, ...rest } = props
    const html = await render(Welcome(rest))
    // A text part on every send. HTML-only is one of the cheapest spam
    // signals there is, and this is a first-contact email.
    const text = await render(Welcome(rest), { plainText: true })

    const { error } = await resend.emails.send({
      // The existing verified sender. A fresh address or subdomain has no
      // reputation, and first contact is the worst place to spend that.
      from: FROM_NOTIFICATIONS,
      to,
      subject:
        rest.role === "tester"
          ? "You're set up — here's how to pick up your first test case"
          : "You're set up on Twnhall",
      html,
      text,
    })

    if (error) {
      console.error("[mail.sendWelcomeEmail] Resend error:", error)
      await logged("welcome", error)
    } else {
      await logged("welcome")
    }
  } catch (err) {
    console.error("[mail.sendWelcomeEmail] unexpected error:", err)
    await logged("welcome", err)
  }
}

/**
 * Sent to the tester when a builder approves their report.
 *
 * Same non-fatal contract as sendWelcomeEmail, and it lives here for the same
 * reason: the approval and its rating are already saved when this runs, and
 * a mail problem must never reach the builder as an error.
 */
export async function sendApprovalNotification(
  props: ApprovalNotificationProps & { to: string },
): Promise<void> {
  const resend = getResend()
  if (!resend) return logged("approval-notification", "RESEND_API_KEY is not set")

  try {
    const { to, ...rest } = props
    const html = await render(ApprovalNotification(rest))
    const text = await render(ApprovalNotification(rest), { plainText: true })

    const { error } = await resend.emails.send({
      from: FROM_NOTIFICATIONS,
      to,
      // The mission, not the project: the tester did the mission and may not
      // know the project by name.
      subject: `Your report on "${rest.missionTitle}" was approved`,
      html,
      text,
    })

    if (error) {
      console.error("[mail.sendApprovalNotification] Resend error:", error)
      await logged("approval-notification", error)
    } else {
      await logged("approval-notification")
    }
  } catch (err) {
    console.error("[mail.sendApprovalNotification] unexpected error:", err)
    await logged("approval-notification", err)
  }
}

export async function sendAdminBroadcast(
  props: AdminBroadcastProps & { to: string | string[] },
): Promise<{ sent: number }> {
  const resend = getResend()
  if (!resend) {
    await logged("admin-broadcast", "RESEND_API_KEY is not set")
    return { sent: 0 }
  }

  const { to, ...rest } = props
  const recipients = Array.isArray(to) ? to : [to]
  if (recipients.length === 0) return { sent: 0 }

  let html: string
  let text: string
  try {
    html = await render(AdminBroadcast(rest))
    text = await render(AdminBroadcast(rest), { plainText: true })
  } catch (err) {
    console.error("[mail.sendAdminBroadcast] render error:", err)
    await logged("admin-broadcast", err)
    return { sent: 0 }
  }

  let sent = 0
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE)
    try {
      const payload = batch.map((address) => ({
        from: FROM_ADMIN,
        to: [address],
        subject: rest.subject,
        html,
        text,
      }))
      const { error } = await resend.batch.send(payload)
      if (error) {
        console.error("[mail.sendAdminBroadcast] batch error:", error)
        await logged("admin-broadcast", error)
        continue
      }
      sent += batch.length
    } catch (err) {
      console.error("[mail.sendAdminBroadcast] batch threw:", err)
      await logged("admin-broadcast", err)
    }
  }

  if (sent > 0) await recordEvent({ name: "email.sent", props: { template: "admin-broadcast", count: sent } })
  return { sent }
}

/**
 * A plain notice to one person — a plan change, a plan ending, an admin
 * alert — through the broadcast template, which is already a subject, a body
 * and an optional button. Same non-fatal contract as the others; `template`
 * names it in email.sent / email.failed.
 */
export async function sendNotice(
  props: AdminBroadcastProps & { to: string; template: string },
): Promise<void> {
  const { to, template, ...rest } = props
  const resend = getResend()
  if (!resend) return logged(template, "RESEND_API_KEY is not set")

  try {
    const html = await render(AdminBroadcast(rest))
    const text = await render(AdminBroadcast(rest), { plainText: true })
    const { error } = await resend.emails.send({ from: FROM_NOTIFICATIONS, to, subject: rest.subject, html, text })
    if (error) {
      console.error("[mail.sendNotice] Resend error:", template, error)
      await logged(template, error)
    } else {
      await logged(template)
    }
  } catch (err) {
    console.error("[mail.sendNotice] unexpected error:", template, err)
    await logged(template, err)
  }
}
