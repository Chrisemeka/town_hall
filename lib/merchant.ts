// Who a customer is paying. Paystack's MSA (Section B, Card payments) requires
// the site to show the official name, a contact and an address for every
// transaction. Written by hand, never derived. Checked: 3 Nov 2026.
//
// Twnhall is not registered with CAC yet, so the legal name is the people
// running it. Registering later changes legalName and registration, nothing
// else.
//
// Every public surface reads from here. A second copy anywhere fails
// lib/__tests__/merchant.test.ts. Pure and React-free, like lib/docNav.ts.

export type Registration = { kind: "RC" | "BN"; number: string }

export type Merchant = {
  tradingName: string
  legalName: string
  registration: Registration | null
  /** One line per entry. */
  address: readonly string[]
  supportEmail: string
  /** E.164, or null. */
  phone: string | null
}

export const MERCHANT: Merchant = {
  tradingName: "Twnhall",
  legalName: "Awoniyi Amos and Anyanwu Chukwuemeka",
  registration: null,
  address: ["23 Olatunji Idowu Street", "off Alidada, Okota", "Lagos State", "Nigeria"],
  supportEmail: "twnhallhq@gmail.com",
  phone: "+2348127984934",
}

/** "23 Olatunji Idowu Street, off Alidada, Okota, Lagos State, Nigeria" */
export function addressLine(m: Merchant = MERCHANT): string {
  return m.address.join(", ")
}

/** "+234 812 798 4934" — for reading; a tel: link takes MERCHANT.phone as is. */
export function phoneDisplay(phone: string): string {
  return phone.replace(/^\+234(\d{3})(\d{3})(\d{4})$/, "+234 $1 $2 $3")
}

/** The sentence that says who you are paying. */
export function legalLine(m: Merchant = MERCHANT): string {
  const where = addressLine(m)
  if (!m.registration) return `${m.tradingName} is operated by ${m.legalName}, ${where}.`
  const reg = `${m.registration.kind} ${m.registration.number}`
  return m.legalName === m.tradingName
    ? `${m.tradingName} (${reg}), ${where}.`
    : `${m.tradingName} is a trading name of ${m.legalName} (${reg}), ${where}.`
}
