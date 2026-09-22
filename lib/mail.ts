import "server-only"

import { Resend } from "resend"
import { render } from "@react-email/render"
import FeedbackNotification, {
  type FeedbackNotificationProps,
} from "@/emails/feedback-notification"
import AdminBroadcast, {
  type AdminBroadcastProps,
} from "@/emails/admin-broadcast"
import Welcome, { type WelcomeProps } from "@/emails/welcome"

// Until a custom Twnhall domain is verified in Resend, fall back to the
// shared sandbox sender. Override per-env with MAIL_FROM_* if needed.
const FROM_NOTIFICATIONS =
  process.env.MAIL_FROM_NOTIFICATIONS ?? "Twnhall <notifications@twnhall.com>"
const FROM_ADMIN =
  process.env.MAIL_FROM_ADMIN ?? "Twnhall <notifications@twnhall.com>"

const BATCH_SIZE = 50

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
  if (!resend) return

  try {
    const { to, ...rest } = props
    const html = await render(FeedbackNotification(rest))
    const text = await render(FeedbackNotification(rest), { plainText: true })

    const { error } = await resend.emails.send({
      from: FROM_NOTIFICATIONS,
      to,
      subject: `You have new feedback on ${rest.projectName}`,
      html,
      text,
    })

    if (error) {
      console.error("[mail.sendFeedbackNotification] Resend error:", error)
    }
  } catch (err) {
    console.error("[mail.sendFeedbackNotification] unexpected error:", err)
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
  if (!resend) return

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
          ? "You're set up — here's how to pick up your first mission"
          : "You're set up on Twnhall",
      html,
      text,
    })

    if (error) {
      console.error("[mail.sendWelcomeEmail] Resend error:", error)
    }
  } catch (err) {
    console.error("[mail.sendWelcomeEmail] unexpected error:", err)
  }
}

export async function sendAdminBroadcast(
  props: AdminBroadcastProps & { to: string | string[] },
): Promise<{ sent: number }> {
  const resend = getResend()
  if (!resend) return { sent: 0 }

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
        continue
      }
      sent += batch.length
    } catch (err) {
      console.error("[mail.sendAdminBroadcast] batch threw:", err)
    }
  }

  return { sent }
}
