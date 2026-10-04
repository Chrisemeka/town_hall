// Where "get in touch" goes. One definition, because the footer, the contact
// page and the pricing CTA all point at it and a stale address in one of them
// silently drops the Pro conversation.

export const CONTACT_EMAIL = "twnhallhq@gmail.com"

export const X_URL = "https://x.com/UseTwnhall"

/** A mailto with the subject prefilled, so replies arrive pre-sorted. */
export function mailto(subject?: string): string {
  return subject
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${CONTACT_EMAIL}`
}
