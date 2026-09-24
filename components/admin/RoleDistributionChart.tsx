"use client"

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts"

export type RoleSlice = { role: string; count: number }

/*
 * Mid-tone on purpose. A pie slice is a "graphical object required to
 * understand content", so WCAG 1.4.11 wants 3:1 against its background — and
 * this chart has two backgrounds now. Four of the five previous colours failed
 * on Bone (Voltage 1.02:1, the blue 1.90, the rose 1.99, the violet 2.50);
 * every colour here clears 3:1 on Bone AND on Obsidian, so one palette serves
 * both themes rather than two that can drift.
 *
 *   #9A7D00  Bone 3.63  Obsidian 4.87
 *   #2F7DD1  Bone 3.88  Obsidian 4.57
 *   #C2455E  Bone 4.48  Obsidian 3.95
 *   #6D4AC7  Bone 5.58  Obsidian 3.17
 *   #6B6B78  Bone 4.82  Obsidian 3.67
 */
const COLORS = ["#9A7D00", "#2F7DD1", "#C2455E", "#6D4AC7", "#6B6B78"]

export function RoleDistributionChart({ data }: { data: RoleSlice[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="bg-surface-raised border border-line rounded-[12px] p-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
      <h3 className="font-syne font-bold text-[16px] text-ink mb-1">Roles</h3>
      <p className="font-mono text-[12px] text-ink-muted mb-4">Distribution of all accounts.</p>

      <div className="flex items-center gap-6">
        <div className="h-[220px] w-[220px] shrink-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="role"
                innerRadius={56}
                outerRadius={92}
                paddingAngle={2}
                stroke="var(--color-surface)"
                strokeWidth={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--color-surface-raised)",
                  border: "1px solid var(--color-line)",
                  borderRadius: 8,
                  fontFamily: "var(--font-dm-mono)",
                  fontSize: 12,
                  color: "var(--color-ink)",
                }}
                labelStyle={{ color: "var(--color-ink-muted)" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-syne font-bold text-[28px] text-ink leading-none">{total}</span>
            <span className="font-mono text-[11px] text-ink-muted uppercase tracking-[1px] mt-1">total</span>
          </div>
        </div>

        <ul className="flex flex-col gap-2 flex-1">
          {data.map((d, i) => {
            const pct = total > 0 ? Math.round((d.count / total) * 100) : 0
            return (
              <li key={d.role} className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="font-mono text-[13px] text-ink capitalize flex-1">{d.role}</span>
                <span className="font-mono text-[13px] text-ink-muted tabular-nums">
                  {d.count} · {pct}%
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
