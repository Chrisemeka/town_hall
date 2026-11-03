// Where "get in touch" goes. One definition, because the footer, the contact
// page and the pricing CTA all point at it and a stale address in one of them
// silently drops the Pro conversation.

import { MERCHANT } from "@/lib/merchant"

// The address itself lives in lib/merchant.ts, the one place it is written.
export const CONTACT_EMAIL = MERCHANT.supportEmail

export const X_URL = "https://x.com/UseTwnhall"

/** A mailto with the subject prefilled, so replies arrive pre-sorted. */
export function mailto(subject?: string): string {
  return subject
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${CONTACT_EMAIL}`
}
