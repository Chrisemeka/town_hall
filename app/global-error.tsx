"use client"

// The root layout itself threw, so nothing from it — fonts, theme, tokens —
// can be relied on. Plain markup with system fonts; instrumentation.ts has
// already recorded the error server-side.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", padding: 16, textAlign: "center" }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Something went wrong.</h1>
          <p style={{ fontSize: 14, marginBottom: 24 }}>
            We&apos;ve recorded it. Try again in a moment.
            {error.digest ? <span style={{ display: "block", marginTop: 8, fontSize: 12 }}>Reference: {error.digest}</span> : null}
          </p>
          <button type="button" onClick={reset} style={{ minHeight: 48, padding: "0 16px", fontSize: 14, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
