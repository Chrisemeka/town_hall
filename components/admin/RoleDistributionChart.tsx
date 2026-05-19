"use client"

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts"

export type RoleSlice = { role: string; count: number }

const COLORS = ["#E8FF47", "#7AB8FF", "#FF8FA3", "#A78BFA", "#7C7C8A"]

export function RoleDistributionChart({ data }: { data: RoleSlice[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="bg-graphite border border-iron rounded-[12px] p-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
      <h3 className="font-syne font-bold text-[16px] text-chalk mb-1">Roles</h3>
      <p className="font-mono text-[12px] text-ash mb-4">Distribution of all accounts.</p>

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
                stroke="#0E0E10"
                strokeWidth={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "#15151A",
                  border: "1px solid #2C2C35",
                  borderRadius: 8,
                  fontFamily: "var(--font-dm-mono)",
                  fontSize: 12,
                  color: "#F4F4F5",
                }}
                labelStyle={{ color: "#7C7C8A" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-syne font-bold text-[28px] text-chalk leading-none">{total}</span>
            <span className="font-mono text-[11px] text-ash uppercase tracking-[1px] mt-1">total</span>
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
                <span className="font-mono text-[13px] text-chalk capitalize flex-1">{d.role}</span>
                <span className="font-mono text-[13px] text-ash tabular-nums">
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
