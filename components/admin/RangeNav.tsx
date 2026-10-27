import Link from "next/link"
import { cn } from "@/lib/utils"

/** The date-range chips: plain links, so the range lives in the URL. */
export function RangeNav({ base, current, options, extra = {} }: { base: string; current: string; options: readonly (readonly [string, string])[]; extra?: Record<string, string | undefined> }) {
  return (
    <nav aria-label="Date range" className="flex gap-2 overflow-x-auto">
      {options.map(([key, label]) => {
        const params = new URLSearchParams(Object.entries({ ...extra, range: key }).filter((e): e is [string, string] => !!e[1]))
        return (
          <Link
            key={key}
            href={`${base}?${params}`}
            aria-current={current === key ? "page" : undefined}
            className={cn(
              "h-12 lg:h-10 px-4 flex items-center rounded-[8px] border font-mono text-[14px] whitespace-nowrap",
              current === key ? "border-accent-ink text-accent-ink" : "border-line text-ink-muted hover:text-ink",
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

/** A two-column table of counts: what, and how many. */
export function CountTable({ rows, head, empty = "Nothing yet." }: { rows: { key: string; a: number; b?: number }[]; head: [string, string, string?]; empty?: string }) {
  if (rows.length === 0) return <p className="px-4 py-8 text-center font-mono text-[14px] text-ink-muted">{empty}</p>
  return (
    <table className="w-full font-mono text-[14px]">
      <thead>
        <tr className="text-left text-[12px] uppercase tracking-[1px] text-ink-muted">
          <th className="px-4 py-2 font-medium">{head[0]}</th>
          <th className="px-4 py-2 font-medium text-right">{head[1]}</th>
          {head[2] && <th className="px-4 py-2 font-medium text-right">{head[2]}</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-line">
            <td className="px-4 py-2 max-w-0 w-full truncate" title={r.key}>{r.key}</td>
            <td className="px-4 py-2 text-right tabular-nums">{r.a}</td>
            {head[2] && <td className="px-4 py-2 text-right tabular-nums">{r.b ?? "—"}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
