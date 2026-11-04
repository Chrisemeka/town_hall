export type PaystackOutcome = "ignored" | "settled" | "duplicate" | "unmatched" | "mismatch" | "duplicate_charge" | "stray" | "error"

const text = (v: unknown): string | null => (typeof v === "string" && v ? v : null)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {})

/** The only fields of a payload that are kept: the rest carries a customer's email and card. */
export function eventFields(event: unknown): { event: string; reference: string | null; subscription_code: string | null } {
  const root = obj(event)
  const data = obj(root.data)
  return {
    event: text(root.event) ?? "unknown",
    reference: text(data.reference) ?? text(data.transaction_reference),
    subscription_code: text(data.subscription_code) ?? text(obj(data.subscription).subscription_code),
  }
}
