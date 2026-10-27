// Six points, one line, no axes: the direction is the point (Admin Metrics
// §11). Inline SVG on the ink token, so it follows the theme. The values are
// also given as text for anyone who cannot see the line.

export function Sparkline({ values, labels }: { values: (number | null)[]; labels: string[] }) {
  const known = values.map((v) => v ?? 0)
  const max = Math.max(1, ...known)
  const w = 120
  const h = 32
  const step = values.length > 1 ? w / (values.length - 1) : 0
  const points = known.map((v, i) => `${(i * step).toFixed(1)},${(h - 4 - (v / max) * (h - 8)).toFixed(1)}`).join(" ")
  return (
    <div className="mt-2">
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true" className="overflow-visible">
        <polyline points={points} fill="none" stroke="var(--color-accent-ink)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <p className="sr-only">
        {labels.map((l, i) => `${l}: ${values[i] ?? "none"}`).join(", ")}
      </p>
    </div>
  )
}
