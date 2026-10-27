import Link from "next/link"
import { cn } from "@/lib/utils"

// The admin console's few repeated shapes. Server components, no state.

export function PageHeader({ eyebrow, title, lede, children }: { eyebrow: string; title: string; lede?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 expanded:flex-row expanded:items-end expanded:justify-between">
      <div className="min-w-0">
        <p className="font-mono text-[12px] font-medium text-accent-ink uppercase tracking-[1px] mb-2">Admin · {eyebrow}</p>
        <h1 className="font-syne font-bold text-[28px] leading-[36px] tracking-[-0.5px] text-ink">{title}</h1>
        {lede && <p className="font-mono text-[14px] leading-6 text-ink-muted mt-1 max-w-2xl">{lede}</p>}
      </div>
      {children}
    </div>
  )
}

export function Panel({ title, action, children, className }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("bg-surface-raised border border-line rounded-[12px] overflow-hidden", className)}>
      {title && (
        <div className="px-4 py-4 border-b border-line flex items-center justify-between gap-4">
          <h2 className="font-syne font-bold text-[16px] text-ink">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * A number and the decision it informs (Admin Metrics §11: "every tile states
 * the decision it informs"). `alarm` tiles read zero when healthy and say so in
 * words, not only colour.
 */
export function Stat({
  label,
  value,
  decision,
  alarm,
  href,
}: {
  label: string
  value: React.ReactNode
  decision?: string
  alarm?: boolean
  href?: string
}) {
  const body = (
    <>
      <p className="font-mono text-[12px] uppercase tracking-[1px] text-ink-muted">{label}</p>
      <p className={cn("font-syne font-bold text-[24px] leading-[32px] tabular-nums mt-1", alarm ? "text-danger-ink" : "text-ink")}>
        {value}
        {alarm && <span className="sr-only"> — needs attention</span>}
      </p>
      {decision && <p className="font-mono text-[12px] leading-4 text-ink-muted mt-2">{decision}</p>}
    </>
  )
  const box = cn("block bg-surface-raised border rounded-[12px] p-4", alarm ? "border-danger-ink" : "border-line")
  return href ? (
    <Link href={href} className={cn(box, "hover:bg-ink/[0.06] transition-colors duration-150")}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  )
}

/** A small label chip; colour always beside a word, never instead of one. */
export function Tag({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "accent" | "info" | "success" | "danger" }) {
  const ink = {
    muted: "text-ink-muted",
    accent: "text-accent-ink",
    info: "text-info-ink",
    success: "text-success-ink",
    danger: "text-danger-ink",
  }[tone]
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-[4px] border border-line px-2 h-6 font-mono text-[12px] uppercase tracking-[0.5px]", ink)}>
      {children}
    </span>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-12 text-center font-mono text-[14px] text-ink-muted">{children}</p>
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  })
}
