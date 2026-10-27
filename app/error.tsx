"use client"

import Link from "next/link"
import { Button } from "@/components/ui/Button"

// A route that threw. The error itself is recorded server-side by
// instrumentation.ts (error.server); this page only says so and offers a way on.
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="font-syne font-bold text-[28px] leading-[36px] text-ink mb-3">Something went wrong.</h1>
      <p className="font-mono text-[14px] leading-6 text-ink-muted mb-8 max-w-[360px]">
        We&apos;ve recorded it. Try again, or head back to the start.
        {error.digest ? <span className="block mt-2 text-[12px]">Reference: {error.digest}</span> : null}
      </p>
      <div className="flex flex-col medium:flex-row items-center gap-4">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="secondary">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  )
}
