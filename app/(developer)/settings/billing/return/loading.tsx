// Verifying with Paystack takes a moment, and this page ends in a redirect.
export default function Loading() {
  return (
    <div className="max-w-[640px] mx-auto px-4 medium:px-6 pt-16 medium:pt-20 expanded:py-10">
      <p role="status" className="font-mono text-[14px] text-ink-muted">
        Confirming your payment…
      </p>
    </div>
  )
}
