/**
 * The chrome every Settings section shares.
 *
 * Settings grew from one form into four sections (Profile, Give and take,
 * Plan, Appearance) and PR 3 adds a fifth. Without a shared shell that is five
 * copies of a heading, a description and a card.
 */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[12px] border border-line bg-surface-raised p-6 sm:p-8">
      <h2 className="font-syne font-bold text-[20px] leading-7 text-ink">{title}</h2>
      {description && (
        <p className="font-sans text-[14px] leading-6 text-ink mt-2">{description}</p>
      )}
      <div className="mt-6">{children}</div>
    </section>
  )
}

/**
 * One number and what it is.
 *
 * The value is rendered above the label, larger: a metric row read at a glance
 * is a number first. At 360px these stack rather than letting a long label
 * collide with its own figure.
 */
export function Metric({
  value,
  label,
  hint,
}: {
  value: string
  label: string
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-syne font-bold text-[28px] leading-9 text-ink">
        {value}
      </span>
      <span className="font-mono text-[12px] uppercase tracking-[0.5px] text-ink-muted">
        {label}
      </span>
      {hint && (
        <span className="font-sans text-[13px] leading-5 text-ink-muted">{hint}</span>
      )}
    </div>
  )
}
